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
  const [done, setDone] = useDoneSet(user);
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
  const isGroupDone = (group: DuplicateGroup) =>
    group.duplicates.every((timestamp) => done.has(doneKey(group, timestamp)));
  const doneCount = groups.filter(isGroupDone).length;
  const visible = hideDone ? groups.filter((group) => !isGroupDone(group)) : groups;

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
          Finds plays that were scrobbled more than once, usually because two
          apps scrobbled the same song.
        </p>
        <p className="mt-2 text-foreground/60">
          Last.fm does not let apps delete scrobbles, so each play links to
          that track in your Last.fm library around that date. There you will
          see the same play several times (Last.fm rounds the times to the
          minute): keep one and delete the others. It does not matter which one
          you keep. Then tick it off here.
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
                  ? `${duplicateCount.toLocaleString()} duplicate${duplicateCount === 1 ? "" : "s"} to delete`
                  : "No duplicates"}
              </h2>
              <p className="text-sm text-foreground/60">
                {groups.length > 0 &&
                  `${groups.length.toLocaleString()} play${groups.length === 1 ? " was" : "s were"} scrobbled more than once · `}
                {scanned.length.toLocaleString()} scrobbles scanned
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
                  done={isGroupDone(group)}
                  onToggle={(value) =>
                    setDone(
                      group.duplicates.map((timestamp) => doneKey(group, timestamp)),
                      value,
                    )
                  }
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
  onToggle,
}: {
  user: string;
  group: DuplicateGroup;
  done: boolean;
  onToggle: (done: boolean) => void;
}) {
  const times = [group.original, ...group.duplicates];
  const spread = times.at(-1)! - times[0];
  const extra = group.duplicates.length;

  return (
    <li
      className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6 ${done ? "opacity-50" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className={`font-medium wrap-break-word ${done ? "line-through" : ""}`}>
          {group.track}
        </p>
        <p className="truncate text-sm text-foreground/65">
          {group.artist}
          {group.album ? ` · ${group.album}` : ""}
        </p>
        <p className="mt-1 text-sm text-foreground/60">
          Scrobbled {times.length} times{" "}
          {spread ? `within ${formatGap(spread)}` : "at the same time"}:{" "}
          {formatTimes(times)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <a
          href={libraryTrackUrl(user, group.artist, group.track, group.original)}
          target="_blank"
          rel="noreferrer"
          className="text-lastfm-start underline-offset-2 hover:underline"
        >
          keep 1, delete {extra} on last.fm ↗
        </a>
        <label className="flex items-center gap-1.5 text-foreground/70">
          <input
            type="checkbox"
            checked={done}
            onChange={(event) => onToggle(event.target.checked)}
            className="size-4 accent-lastfm-start"
          />
          done
        </label>
      </div>
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

/** "3 Oct 2026, 10:51:55, 10:51:56 and 10:51:58", repeating the date only when it changes. */
function formatTimes(times: number[]) {
  const day = (uts: number) =>
    new Date(uts * 1000).toLocaleDateString(undefined, { dateStyle: "medium" });
  const time = (uts: number) =>
    new Date(uts * 1000).toLocaleTimeString(undefined, { timeStyle: "medium" });

  return new Intl.ListFormat(undefined, { type: "conjunction" }).format(
    times.map((uts, index) =>
      index && day(uts) === day(times[index - 1])
        ? time(uts)
        : `${day(uts)}, ${time(uts)}`,
    ),
  );
}

function formatGap(seconds: number) {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Ticked-off duplicate scrobbles, remembered in this browser. */
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

  function set(keys: string[], value: boolean) {
    const next = new Set(done);
    for (const key of keys) {
      if (value) next.add(key);
      else next.delete(key);
    }

    setDoneState(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // Storage can be unavailable (private mode); ticks then last for the visit.
    }
  }

  return [done, set] as const;
}
