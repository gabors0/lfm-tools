"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAllLovedTracks,
  LastFmApiError,
  scrobbleTracks,
  setTrackLoved,
  type ScrobbleInput,
} from "@/lib/lastfm";
import {
  backToBackTimestamps,
  chunk,
  MAX_ALBUM_TRACKS,
  MAX_SCROBBLE_AGE_SECONDS,
  MAX_SCROBBLES_PER_REQUEST,
  nowUts,
  timestampProblem,
  UNLOVE_BATCH_SIZE,
  type ActionResult,
  type LovedTrackBackup,
  type ScrobbleOutcome,
  type TrackRef,
} from "@/lib/scrobble-utils";
import { clearSession, getSession } from "@/lib/session";

// Last.fm error codes that will fail every following request too.
const RATE_LIMIT_ERROR = 29;
const FATAL_ERRORS = new Set([9, 10, 26]);
// Stay under Last.fm's limit of roughly 5 requests per second.
const UNLOVE_MIN_INTERVAL_MS = 250;

const notLoggedIn = {
  ok: false,
  error: "Your Last.fm login has expired. Log in again.",
} as const;

export async function logout() {
  await clearSession();
  redirect("/");
}

export type ScrobbleResult = ActionResult<{ outcomes: ScrobbleOutcome[] }>;

export type TrackScrobbleInput = {
  artist: string;
  track: string;
  album: string;
  albumArtist: string;
  // null means "now".
  timestamp: number | null;
};

export async function scrobbleTrack(
  input: TrackScrobbleInput,
): Promise<ScrobbleResult> {
  const session = await getSession();
  if (!session) return notLoggedIn;

  const artist = text(input?.artist);
  const track = text(input?.track);
  if (!artist || !track) {
    return { ok: false, error: "Artist and track are required." };
  }

  const now = nowUts();
  const timestamp = input.timestamp ?? now;
  const problem = timestampProblem(timestamp, now);
  if (problem) return { ok: false, error: problem };

  try {
    const outcomes = await scrobbleTracks(session.key, [
      {
        artist,
        track,
        timestamp,
        album: text(input.album),
        albumArtist: text(input.albumArtist),
      },
    ]);
    refreshIfScrobbled(outcomes);
    return { ok: true, outcomes };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Could not scrobble.") };
  }
}

export type AlbumScrobbleInput = {
  album: string;
  albumArtist: string;
  tracks: (TrackRef & { duration: number | null })[];
  // When the last track finished playing; null means "now".
  finishedAt: number | null;
};

export async function scrobbleAlbum(
  input: AlbumScrobbleInput,
): Promise<ScrobbleResult> {
  const session = await getSession();
  if (!session) return notLoggedIn;

  if (!Array.isArray(input?.tracks) || !input.tracks.length) {
    return { ok: false, error: "Pick at least one track." };
  }
  if (input.tracks.length > MAX_ALBUM_TRACKS) {
    return {
      ok: false,
      error: `Pick at most ${MAX_ALBUM_TRACKS} tracks at once.`,
    };
  }

  const tracks = input.tracks.map((entry) => ({
    artist: text(entry?.artist),
    track: text(entry?.track),
    duration:
      Number.isSafeInteger(entry?.duration) && Number(entry.duration) > 0
        ? Number(entry.duration)
        : null,
  }));
  if (tracks.some(({ artist, track }) => !artist || !track)) {
    return { ok: false, error: "Every track needs an artist and a title." };
  }

  const now = nowUts();
  const finishedAt = input.finishedAt ?? now;
  const problem = timestampProblem(finishedAt, now);
  if (problem) return { ok: false, error: problem };

  const starts = backToBackTimestamps(
    tracks.map(({ duration }) => duration),
    finishedAt,
  );
  if (starts[0] < now - MAX_SCROBBLE_AGE_SECONDS) {
    return {
      ok: false,
      error:
        "The first track would start more than 14 days ago, which Last.fm rejects. Pick a later time or fewer tracks.",
    };
  }

  const album = text(input.album);
  const albumArtist = text(input.albumArtist);
  const scrobbles: ScrobbleInput[] = tracks.map((entry, index) => ({
    artist: entry.artist,
    track: entry.track,
    timestamp: starts[index],
    album,
    albumArtist,
    duration: entry.duration ?? undefined,
  }));
  const outcomes: ScrobbleOutcome[] = [];

  try {
    for (const batch of chunk(scrobbles, MAX_SCROBBLES_PER_REQUEST)) {
      outcomes.push(...(await scrobbleTracks(session.key, batch)));
    }
  } catch (error) {
    refreshIfScrobbled(outcomes);
    const message = errorMessage(error, "Could not scrobble the album.");
    return {
      ok: false,
      error: outcomes.length
        ? `${message} (${outcomes.length} tracks were sent before the error.)`
        : message,
    };
  }

  refreshIfScrobbled(outcomes);
  return { ok: true, outcomes };
}

export async function updateLoved(
  artist: string,
  track: string,
  loved: boolean,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return notLoggedIn;

  const ref = trackRef({ artist, track });
  if (!ref || typeof loved !== "boolean") {
    return { ok: false, error: "Invalid track." };
  }

  try {
    await setTrackLoved(session.key, ref.artist, ref.track, loved);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(
        error,
        loved ? "Could not love this track." : "Could not unlove this track.",
      ),
    };
  }
}

export async function listLovedTracks(): Promise<
  ActionResult<{ tracks: LovedTrackBackup[] }>
> {
  const session = await getSession();
  if (!session) return notLoggedIn;

  try {
    const tracks = await getAllLovedTracks(session.name);
    return {
      ok: true,
      tracks: tracks.map((track) => ({
        artist: track.artist.name,
        track: track.name,
        url: track.url,
        lovedAt: Number(track.date.uts),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error, "Could not load your loved tracks."),
    };
  }
}

export type UnloveResult = ActionResult<{
  // How many tracks from the start of the batch were handled (removed or failed).
  processed: number;
  failed: (TrackRef & { error: string })[];
  rateLimited: boolean;
}>;

export async function unloveTracks(tracks: TrackRef[]): Promise<UnloveResult> {
  const session = await getSession();
  if (!session) return notLoggedIn;

  const refs = Array.isArray(tracks) ? tracks.map(trackRef) : [];
  if (
    !refs.length ||
    refs.length > UNLOVE_BATCH_SIZE ||
    refs.some((ref) => !ref)
  ) {
    return { ok: false, error: "Invalid batch of tracks." };
  }

  const failed: (TrackRef & { error: string })[] = [];
  let processed = 0;
  let rateLimited = false;

  for (const ref of refs as TrackRef[]) {
    const startedAt = Date.now();

    try {
      await setTrackLoved(session.key, ref.artist, ref.track, false);
    } catch (error) {
      if (error instanceof LastFmApiError && error.code === RATE_LIMIT_ERROR) {
        rateLimited = true;
        break;
      }
      if (
        error instanceof LastFmApiError &&
        error.code !== undefined &&
        FATAL_ERRORS.has(error.code)
      ) {
        return { ok: false, error: error.message };
      }
      failed.push({
        ...ref,
        error: errorMessage(error, "Could not unlove this track."),
      });
    }

    processed++;
    await sleep(UNLOVE_MIN_INTERVAL_MS - (Date.now() - startedAt));
  }

  return { ok: true, processed, failed, rateLimited };
}

// Re-render the page in the same response so the recent scrobbles list
// shows what was just sent.
function refreshIfScrobbled(outcomes: ScrobbleOutcome[]) {
  if (outcomes.some((outcome) => outcome.accepted)) refresh();
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function trackRef(value: unknown): TrackRef | null {
  const ref = value as Partial<TrackRef> | null;
  const artist = text(ref?.artist);
  const track = text(ref?.track);
  return artist && track ? { artist, track } : null;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof LastFmApiError) return error.message;

  console.error("[lastfm action]", error);
  return fallback;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
}
