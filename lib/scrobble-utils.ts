// Pure helpers and types shared by server actions and client components.
// Keep this file free of server-only imports so client code can use it.

// Last.fm ignores scrobbles older than 14 days.
export const MAX_SCROBBLE_AGE_SECONDS = 14 * 24 * 60 * 60;
// Allow a little clock skew before calling a timestamp "in the future".
export const MAX_FUTURE_SKEW_SECONDS = 5 * 60;
// Used when Last.fm does not know how long an album track is.
export const FALLBACK_TRACK_DURATION_SECONDS = 180;
export const MAX_SCROBBLES_PER_REQUEST = 50;
export const MAX_ALBUM_TRACKS = 200;
export const LOVE_BATCH_SIZE = 20;
export const SCROBBLES_PER_PAGE = 50;
// Export reads the history in pages of 200, a few pages per server call.
export const EXPORT_PAGE_SIZE = 200;
export const EXPORT_PAGES_PER_CALL = 4;

export type TrackRef = {
  artist: string;
  track: string;
};

export type LovedTrackBackup = TrackRef & {
  url: string;
  lovedAt: number;
};

export type ScrobbleExportRow = TrackRef & {
  album: string;
  timestamp: number;
  loved: boolean;
};

export type ScrobbleOutcome = TrackRef & {
  timestamp: number;
  accepted: boolean;
  ignoredReason: string | null;
  corrected: boolean;
};

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const IGNORED_REASONS: Record<string, string> = {
  "1": "Last.fm ignored the artist.",
  "2": "Last.fm ignored the track.",
  "3": "The timestamp is more than 14 days old.",
  "4": "The timestamp is too far in the future.",
  "5": "You have hit Last.fm's daily scrobble limit.",
};

export function ignoredReason(code: string) {
  return IGNORED_REASONS[code] ?? "Last.fm ignored this scrobble.";
}

export function nowUts() {
  return Math.floor(Date.now() / 1000);
}

export function timestampProblem(uts: number, now = nowUts()) {
  if (!Number.isSafeInteger(uts)) return "Pick a valid time.";
  if (uts > now + MAX_FUTURE_SKEW_SECONDS) return "That time is in the future.";
  if (uts < now - MAX_SCROBBLE_AGE_SECONDS) {
    return "Last.fm only accepts scrobbles from the last 14 days.";
  }
  return null;
}

export function canResubmit(uts: number, now = nowUts()) {
  return uts > now - MAX_SCROBBLE_AGE_SECONDS;
}

/** Start times for tracks played back to back, the last one ending at `finishedAt`. */
export function backToBackTimestamps(
  durations: (number | null)[],
  finishedAt: number,
) {
  const starts = new Array<number>(durations.length);
  let cursor = finishedAt;

  for (let index = durations.length - 1; index >= 0; index--) {
    cursor -= durations[index] || FALLBACK_TRACK_DURATION_SECONDS;
    starts[index] = cursor;
  }

  return starts;
}

export function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function lastFmPathSegment(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

/** The user's library page for a track, where its scrobbles can be deleted. */
export function libraryTrackUrl(user: string, artist: string, track: string) {
  return `https://www.last.fm/user/${encodeURIComponent(user)}/library/music/${lastFmPathSegment(artist)}/_/${lastFmPathSegment(track)}`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

// <input type="datetime-local"> values have no time zone, so these run in the
// browser and use its local time.
export function toDateTimeLocal(uts: number) {
  const date = new Date(uts * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function fromDateTimeLocal(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : Math.floor(time / 1000);
}

/** CSV text with a header row; starts with a BOM so Excel reads it as UTF-8. */
export function toCsv(rows: Record<string, string | number | boolean>[]) {
  if (!rows.length) return "";

  const columns = Object.keys(rows[0]);
  const field = (value: string | number | boolean) => {
    const text = String(value);
    return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return `\uFEFF${[
    columns.join(","),
    ...rows.map((row) => columns.map((column) => field(row[column])).join(",")),
  ].join("\r\n")}\r\n`;
}
