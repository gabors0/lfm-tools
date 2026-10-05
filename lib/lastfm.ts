import "server-only";

import { createHash } from "node:crypto";
import {
  ignoredReason,
  MAX_SCROBBLES_PER_REQUEST,
  type ScrobbleOutcome,
} from "@/lib/scrobble-utils";

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

export type LastFmSession = {
  name: string;
  key: string;
  subscriber: "0" | "1";
};

type LastFmErrorResponse = {
  error: number;
  message: string;
};

export type LastFmImage = {
  size: "small" | "medium" | "large" | "extralarge";
  "#text": string;
};

export type LovedTrack = {
  name: string;
  mbid: string;
  url: string;
  date: { uts: string; "#text": string };
  artist: { name: string; mbid: string; url: string };
  image: LastFmImage[];
};

export type LovedTracksResponse = {
  lovedtracks: {
    track: LovedTrack[];
    "@attr": {
      user: string;
      page: string;
      perPage: string;
      totalPages: string;
      total: string;
    };
  };
};

// Shape returned by user.getRecentTracks with extended=1.
export type RecentTrack = {
  name: string;
  mbid: string;
  url: string;
  artist: { name: string; mbid: string; url: string };
  album: { mbid: string; "#text": string };
  image: LastFmImage[];
  loved: "0" | "1";
  date?: { uts: string; "#text": string };
  "@attr"?: { nowplaying: "true" };
};

export type RecentTracksResponse = {
  recenttracks: {
    track: RecentTrack[];
    "@attr": {
      user: string;
      page: string;
      perPage: string;
      totalPages: string;
      total: string;
    };
  };
};

export type AlbumSearchResult = {
  name: string;
  artist: string;
  url: string;
  mbid: string;
  image: LastFmImage[];
};

type AlbumSearchResponse = {
  results: { albummatches: { album: AlbumSearchResult[] } };
};

type AlbumInfoTrack = {
  name: string;
  duration: number | null;
  artist: { name: string };
};

type AlbumInfoResponse = {
  album: {
    name: string;
    artist: string;
    url: string;
    image: LastFmImage[];
    tracks?: { track?: AlbumInfoTrack | AlbumInfoTrack[] };
  };
};

export type AlbumTrack = {
  name: string;
  artist: string;
  duration: number | null;
};

export type AlbumInfo = {
  name: string;
  artist: string;
  url: string;
  image: LastFmImage[];
  tracks: AlbumTrack[];
};

export type ScrobbleInput = {
  artist: string;
  track: string;
  timestamp: number;
  album?: string;
  albumArtist?: string;
  duration?: number;
};

type ScrobbleResponseItem = {
  artist: { "#text": string; corrected: string | number };
  track: { "#text": string; corrected: string | number };
  ignoredMessage: { code: string | number; "#text": string };
};

type ScrobbleResponse = {
  scrobbles: {
    scrobble: ScrobbleResponseItem | ScrobbleResponseItem[];
  };
};

export class LastFmApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "LastFmApiError";
  }
}

export function isLastFmConfigured() {
  const cookieSecret = process.env.AUTH_COOKIE_SECRET;

  return Boolean(
    process.env.LASTFM_API_KEY &&
      process.env.LASTFM_API_SECRET &&
      cookieSecret &&
      cookieSecret.length >= 32,
  );
}

export function getLastFmApiKey() {
  return requiredEnv("LASTFM_API_KEY");
}

function getLastFmApiSecret() {
  return requiredEnv("LASTFM_API_SECRET");
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createApiSignature(params: Record<string, string>) {
  const signatureBody = Object.entries(params)
    .filter(([key]) => key !== "format" && key !== "callback")
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}${value}`)
    .join("");

  return createHash("md5")
    .update(`${signatureBody}${getLastFmApiSecret()}`, "utf8")
    .digest("hex");
}

function signParams(params: Record<string, string>) {
  const withKey = { ...params, api_key: getLastFmApiKey() };
  return { ...withKey, api_sig: createApiSignature(withKey) };
}

function isLastFmError(data: unknown): data is LastFmErrorResponse {
  return typeof data === "object" && data !== null && "error" in data;
}

async function parseLastFmResponse<T>(response: Response): Promise<T> {
  // Last.fm sends error details as JSON even on 4xx responses.
  const data: unknown = await response.json().catch(() => null);

  if (isLastFmError(data)) {
    throw new LastFmApiError(data.message, data.error);
  }

  if (!response.ok || data === null) {
    throw new LastFmApiError(
      `Last.fm returned HTTP ${response.status}. Please try again.`,
    );
  }

  return data as T;
}

async function lastFmGet<T>(params: Record<string, string>): Promise<T> {
  const searchParams = new URLSearchParams({
    ...params,
    api_key: getLastFmApiKey(),
    format: "json",
  });
  const response = await fetch(`${LASTFM_API_URL}?${searchParams}`, {
    cache: "no-store",
  });

  return parseLastFmResponse<T>(response);
}

async function lastFmPost<T>(
  sessionKey: string,
  params: Record<string, string>,
): Promise<T> {
  const response = await fetch(LASTFM_API_URL, {
    method: "POST",
    body: new URLSearchParams({
      ...signParams({ ...params, sk: sessionKey }),
      format: "json",
    }),
    cache: "no-store",
  });

  return parseLastFmResponse<T>(response);
}

export async function exchangeTokenForSession(
  token: string,
): Promise<LastFmSession> {
  const searchParams = new URLSearchParams({
    ...signParams({ method: "auth.getSession", token }),
    format: "json",
  });
  const response = await fetch(`${LASTFM_API_URL}?${searchParams}`, {
    cache: "no-store",
  });
  const { session } = await parseLastFmResponse<{
    session: Omit<LastFmSession, "subscriber"> & { subscriber: string | number };
  }>(response);

  // Last.fm's JSON can send `subscriber` as the number 0 instead of "0".
  return {
    name: session.name,
    key: session.key,
    subscriber: String(session.subscriber) === "1" ? "1" : "0",
  };
}

export function getLovedTracks(user: string, page = 1, limit = 50) {
  return lastFmGet<LovedTracksResponse>({
    method: "user.getLovedTracks",
    user,
    page: String(page),
    limit: String(limit),
  });
}

export function getRecentTracks(user: string, page = 1, limit = 50) {
  return lastFmGet<RecentTracksResponse>({
    method: "user.getRecentTracks",
    user,
    page: String(page),
    limit: String(limit),
    extended: "1",
  });
}

export async function getAllLovedTracks(user: string) {
  const tracks: LovedTrack[] = [];

  for (let page = 1, totalPages = 1; page <= totalPages; page++) {
    const { lovedtracks } = await getLovedTracks(user, page, 1000);
    tracks.push(...lovedtracks.track);
    totalPages = Number(lovedtracks["@attr"].totalPages);
  }

  return tracks;
}

export async function searchAlbums(query: string, limit = 12) {
  const data = await lastFmGet<AlbumSearchResponse>({
    method: "album.search",
    album: query,
    limit: String(limit),
  });

  return data.results.albummatches.album;
}

export async function getAlbumInfo(
  artist: string,
  album: string,
): Promise<AlbumInfo> {
  const { album: info } = await lastFmGet<AlbumInfoResponse>({
    method: "album.getInfo",
    artist,
    album,
    autocorrect: "1",
  });
  // Last.fm omits the list for albums without a tracklist and may send a
  // single track as an object instead of an array.
  const tracks = info.tracks?.track ?? [];

  return {
    name: info.name,
    artist: info.artist,
    url: info.url,
    image: info.image,
    tracks: (Array.isArray(tracks) ? tracks : [tracks]).map((track) => ({
      name: track.name,
      artist: track.artist.name,
      duration: Number(track.duration) || null,
    })),
  };
}

export async function setTrackLoved(
  sessionKey: string,
  artist: string,
  track: string,
  loved: boolean,
) {
  await lastFmPost<unknown>(sessionKey, {
    method: loved ? "track.love" : "track.unlove",
    artist,
    track,
  });
}

export async function scrobbleTracks(
  sessionKey: string,
  scrobbles: ScrobbleInput[],
): Promise<ScrobbleOutcome[]> {
  if (!scrobbles.length || scrobbles.length > MAX_SCROBBLES_PER_REQUEST) {
    throw new Error(
      `Send between 1 and ${MAX_SCROBBLES_PER_REQUEST} scrobbles per request.`,
    );
  }

  const params: Record<string, string> = { method: "track.scrobble" };

  scrobbles.forEach((scrobble, index) => {
    params[`artist[${index}]`] = scrobble.artist;
    params[`track[${index}]`] = scrobble.track;
    params[`timestamp[${index}]`] = String(scrobble.timestamp);
    if (scrobble.album) params[`album[${index}]`] = scrobble.album;
    if (scrobble.albumArtist) {
      params[`albumArtist[${index}]`] = scrobble.albumArtist;
    }
    if (scrobble.duration) {
      params[`duration[${index}]`] = String(scrobble.duration);
    }
  });

  const data = await lastFmPost<ScrobbleResponse>(sessionKey, params);
  const items = [data.scrobbles.scrobble].flat();

  // Last.fm answers in the same order the scrobbles were sent.
  return items.map((item, index) => {
    const code = String(item.ignoredMessage.code);

    return {
      artist: item.artist["#text"] || scrobbles[index].artist,
      track: item.track["#text"] || scrobbles[index].track,
      timestamp: scrobbles[index].timestamp,
      accepted: code === "0",
      ignoredReason: code === "0" ? null : ignoredReason(code),
      corrected:
        String(item.artist.corrected) === "1" ||
        String(item.track.corrected) === "1",
    };
  });
}
