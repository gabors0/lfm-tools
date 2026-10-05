"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  HistoryProgress,
  useScrobbleHistory,
} from "@/app/_components/scrobble-history";
import {
  panel,
  primaryButton,
  secondaryButton,
  segment,
} from "@/app/_components/styles";
import {
  findDuplicates,
  libraryTrackUrl,
  nowUts,
  type DuplicateGroup,
  type ScrobbleExportRow,
} from "@/lib/scrobble-utils";

const DAY = 24 * 60 * 60;
const RANGES = [
  ["7 days", 7 * DAY],
  ["30 days", 30 * DAY],
  ["1 year", 365 * DAY],
  ["all time", null],
] as const;
// Some apps scrobble partway through a song, so duplicates are often a minute
// or two apart; real replays of a song are at least its length apart.
const WINDOWS = [
  ["1 minute", 60],
  ["3 minutes", 3 * 60],
  ["10 minutes", 10 * 60],
] as const;
const DEFAULT_WINDOW = 3 * 60;
const GROUPS_PER_STEP = 100;

export function DuplicateFinder({ user }: { user: string }) {
  const [range, setRange] = useState<number | null>(30 * DAY);
  const [windowSeconds, setWindowSeconds] = useState<number>(DEFAULT_WINDOW);
  const [scanned, setScanned] = useState<ScrobbleExportRow[] | null>(null);
  const [shown, setShown] = useState(GROUPS_PER_STEP);
  const [hideDone, setHideDone] = useState(false);
  const [done, toggleDone] = useDoneSet(user);
  const history = useScrobbleHistory();
  const { phase } = history;

  const groups = useMemo(
    () => (scanned ? findDuplicates(scanned, windowSeconds) : []),
    [scanned, windowSeconds],
  );
  const duplicateCount = groups.reduce(
    (count, group) => count + group.duplicates.length,
    0,
  );
  const doneCount = groups.reduce(
    (count, group) =>
      count +
      group.duplicates.filter((timestamp) => done.has(doneKey(group, timestamp)))
        .length,
    0,
  );
  const visible = hideDone
    ? groups.filter((group) =>
        group.duplicates.some((timestamp) => !done.has(doneKey(group, timestamp))),
      )
    : groups;

  function scan() {
    setScanned(null);
    setShown(GROUPS_PER_STEP);
    history.start({
      from: range === null ? undefined : nowUts() - range,
      onDone: (rows) => setScanned([...rows]),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className={`${panel} text-sm leading-relaxed`}>
        <p>
          Finds the same track scrobbled more than once within a short time,
          usually because two apps scrobbled the same play.
        </p>
        <p className="mt-2 text-foreground/60">
          Last.fm does not let apps delete scrobbles, so each duplicate links
          to that track in your Last.fm library (around that date), where you
          can delete it. Tick it off here once it is gone.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <Choice label="Scan">
          {RANGES.map(([label, seconds]) => (
            <button
              key={label}
              type="button"
              disabled={phase === "running"}
              aria-pressed={range === seconds}
              onClick={() => setRange(seconds)}
              className={segment(range === seconds)}
            >
              {label}
            </button>
          ))}
        </Choice>
        <Choice label="Count as a duplicate when played again within">
          {WINDOWS.map(([label, seconds]) => (
            <button
              key={label}
              type="button"
              aria-pressed={windowSeconds === seconds}
              onClick={() => setWindowSeconds(seconds)}
              className={segment(windowSeconds === seconds)}
            >
              {label}
            </button>
          ))}
        </Choice>
        {windowSeconds > DEFAULT_WINDOW && (
          <p className="-mt-2 text-sm text-foreground/60">
            This also catches short songs you really did play twice in a row,
            so check before deleting.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {phase === "running" ? (
            <button type="button" onClick={history.stop} className={secondaryButton}>
              stop
            </button>
          ) : (
            <button type="button" onClick={scan} className={primaryButton}>
              {phase === "idle" ? "find duplicates" : "scan again"}
            </button>
          )}
          {phase === "stopped" && (
            <>
              <button type="button" onClick={history.resume} className={secondaryButton}>
                resume
              </button>
              {history.fetched > 0 && (
                <button
                  type="button"
                  onClick={() => setScanned([...history.rows.current])}
                  className={secondaryButton}
                >
                  check the {history.fetched.toLocaleString()} scanned so far
                </button>
              )}
            </>
          )}
        </div>

        <HistoryProgress history={history} label="Scanning scrobbles" doneText="done" />
      </div>

      {scanned && (
        <section aria-labelledby="results-heading" className="flex flex-col gap-4">
          <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <h2 id="results-heading" className="text-2xl font-light">
                {duplicateCount
                  ? `${duplicateCount.toLocaleString()} duplicate${duplicateCount === 1 ? "" : "s"}`
                  : "No duplicates"}
              </h2>
              <p className="text-sm text-foreground/60">
                in {scanned.length.toLocaleString()} scrobbles
                {doneCount > 0 && ` · ${doneCount.toLocaleString()} ticked off`}
              </p>
            </div>
            {doneCount > 0 && (
              <label className="flex items-center gap-2 text-sm text-foreground/70">
                <input
                  type="checkbox"
                  checked={hideDone}
                  onChange={(event) => setHideDone(event.target.checked)}
                  className="size-4 accent-lastfm-start"
                />
                hide ticked off
              </label>
            )}
          </header>

          {visible.length > 0 && (
            <ol className="divide-y divide-border border-y border-border">
              {visible.slice(0, shown).map((group) => (
                <DuplicateRow
                  key={`${group.original}-${group.artist}-${group.track}`}
                  user={user}
                  group={group}
                  done={done}
                  hideDone={hideDone}
                  onToggle={toggleDone}
                />
              ))}
            </ol>
          )}

          {visible.length > shown && (
            <div>
              <button
                type="button"
                onClick={() => setShown((count) => count + GROUPS_PER_STEP)}
                className={secondaryButton}
              >
                show more ({(visible.length - shown).toLocaleString()} left)
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function DuplicateRow({
  user,
  group,
  done,
  hideDone,
  onToggle,
}: {
  user: string;
  group: DuplicateGroup;
  done: Set<string>;
  hideDone: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <li className="py-4">
      <p className="font-medium wrap-break-word">{group.track}</p>
      <p className="truncate text-sm text-foreground/65">
        {group.artist}
        {group.album ? ` · ${group.album}` : ""}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        <li className="flex flex-wrap items-center gap-x-3 text-foreground/50">
          <time dateTime={isoDate(group.original)}>{formatTime(group.original)}</time>
          <span>original, keep</span>
        </li>
        {group.duplicates.map((timestamp, index) => {
          const key = doneKey(group, timestamp);
          const isDone = done.has(key);
          const previous = index ? group.duplicates[index - 1] : group.original;
          if (hideDone && isDone) return null;

          return (
            <li
              key={timestamp}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${isDone ? "text-foreground/40 line-through" : ""}`}
            >
              <time dateTime={isoDate(timestamp)}>{formatTime(timestamp)}</time>
              <span className="text-lastfm-start">
                duplicate, {formatGap(timestamp - previous)} later
              </span>
              <a
                href={libraryTrackUrl(user, group.artist, group.track, timestamp)}
                target="_blank"
                rel="noreferrer"
                className="text-foreground/60 hover:text-lastfm-start"
              >
                delete on last.fm ↗
              </a>
              <label className="flex items-center gap-1.5 text-foreground/60">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => onToggle(key)}
                  className="size-4 accent-lastfm-start"
                />
                done
              </label>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-sm text-foreground/70">{label}</span>
      <div className="flex flex-wrap text-sm">{children}</div>
    </div>
  );
}

function doneKey(group: DuplicateGroup, timestamp: number) {
  return `${timestamp}|${group.artist.toLowerCase()}|${group.track.toLowerCase()}`;
}

function formatTime(uts: number) {
  return new Date(uts * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function isoDate(uts: number) {
  return new Date(uts * 1000).toISOString();
}

function formatGap(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

/** Ticked-off duplicates, remembered in this browser. */
function useDoneSet(user: string) {
  const storageKey = `lfm-tools:duplicates-done:${user}`;
  const [done, setDoneState] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    } catch {
      return new Set();
    }
  });

  function toggle(key: string) {
    const next = new Set(done);
    if (next.has(key)) next.delete(key);
    else next.add(key);

    setDoneState(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // Storage can be unavailable (private mode); ticks then last for the visit.
    }
  }

  return [done, toggle] as const;
}
