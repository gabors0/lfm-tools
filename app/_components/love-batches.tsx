"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { setTracksLoved } from "@/app/actions";
import { alertBox, secondaryButton } from "@/app/_components/styles";
import { LOVE_BATCH_SIZE, type TrackRef } from "@/lib/scrobble-utils";

const RATE_LIMIT_PAUSE_SECONDS = 60;
// Roughly what the server-side throttle achieves, for time estimates.
const TRACKS_PER_SECOND = 3;

type FailedTrack = TrackRef & { error: string };

/** Loves or unloves a list of tracks in throttled batches, with stop/resume. */
export function useLoveBatches(loved: boolean) {
  const [phase, setPhase] = useState<"idle" | "running" | "stopped" | "done">(
    "idle",
  );
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState<TrackRef[]>([]);
  const [succeeded, setSucceeded] = useState(0);
  const [failed, setFailed] = useState<FailedTrack[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRequested = useRef(false);

  // Stop sending batches if the user leaves the page.
  useEffect(
    () => () => {
      stopRequested.current = true;
    },
    [],
  );

  useEffect(() => {
    if (phase !== "running") return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  async function run(queue: TrackRef[]) {
    stopRequested.current = false;
    setPhase("running");
    setError(null);
    setNotice(null);

    let pending = queue;

    while (pending.length && !stopRequested.current) {
      const batch = pending.slice(0, LOVE_BATCH_SIZE);
      const result = await setTracksLoved(batch, loved).catch(() => null);

      if (!result?.ok) {
        setError(
          result?.error ??
            "Lost the connection to the server. Resume to continue where it stopped.",
        );
        break;
      }

      pending = pending.slice(result.processed);
      setRemaining(pending);
      setSucceeded((count) => count + result.processed - result.failed.length);
      setFailed((current) => [...current, ...result.failed]);

      if (result.rateLimited) {
        setNotice(
          `Last.fm asked for a break. Waiting ${RATE_LIMIT_PAUSE_SECONDS} seconds…`,
        );
        await wait(RATE_LIMIT_PAUSE_SECONDS * 1000, stopRequested);
        setNotice(null);
      }
    }

    setNotice(null);
    setPhase(pending.length ? "stopped" : "done");
  }

  return {
    loved,
    phase,
    total,
    remaining: remaining.length,
    succeeded,
    failed,
    notice,
    error,
    start(queue: TrackRef[]) {
      setTotal(queue.length);
      setSucceeded(0);
      setFailed([]);
      setRemaining(queue);
      void run(queue);
    },
    stop() {
      stopRequested.current = true;
      setNotice("Stopping after the current batch…");
    },
    resume() {
      void run(remaining);
    },
    retryFailed() {
      const queue = failed.map(({ artist, track }) => ({ artist, track }));
      setFailed([]);
      setRemaining(queue);
      void run(queue);
    },
  };
}

type LoveBatches = ReturnType<typeof useLoveBatches>;

export function BatchProgress({ batches }: { batches: LoveBatches }) {
  const { phase, total, remaining, succeeded, failed, notice, error } = batches;
  const handled = total - remaining;
  const verb = batches.loved ? "Loved" : "Removed";

  return (
    <div className="flex flex-col gap-4">
      {total > 0 && (
        <div className="flex flex-col gap-3">
          <div
            role="progressbar"
            aria-label={batches.loved ? "Loving tracks" : "Unloving tracks"}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={handled}
            className="h-2 overflow-hidden rounded-full bg-surface"
          >
            <div
              className="h-full bg-linear-to-r from-lastfm-start to-lastfm-end transition-[width]"
              style={{ width: `${(handled / total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-foreground/70" aria-live="polite">
            {verb} {succeeded.toLocaleString()} of {total.toLocaleString()}
            {failed.length > 0 && ` · ${failed.length} failed`}
            {phase === "running" &&
              remaining > 0 &&
              ` · about ${formatEta(remaining)} left`}
          </p>
          <div className="flex gap-2">
            {phase === "running" && (
              <button type="button" onClick={batches.stop} className={secondaryButton}>
                stop
              </button>
            )}
            {phase === "stopped" && (
              <button type="button" onClick={batches.resume} className={secondaryButton}>
                resume
              </button>
            )}
            {phase === "done" && failed.length > 0 && (
              <button
                type="button"
                onClick={batches.retryFailed}
                className={secondaryButton}
              >
                retry {failed.length} failed
              </button>
            )}
          </div>
        </div>
      )}

      {notice && <p className="text-sm text-foreground/70">{notice}</p>}

      {error && (
        <p role="alert" className={alertBox}>
          {error}
        </p>
      )}

      {failed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-foreground/70">
            {failed.length} track{failed.length === 1 ? "" : "s"} could not be{" "}
            {batches.loved ? "loved" : "unloved"}
          </summary>
          <ul className="mt-2 max-h-64 list-inside list-disc overflow-y-auto text-foreground/70">
            {failed.map((track, index) => (
              <li key={`${index}-${track.artist}-${track.track}`}>
                {track.artist} – {track.track}: {track.error}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** "1 track", "2,500 tracks". */
export function countTracks(count: number) {
  return `${count.toLocaleString()} track${count === 1 ? "" : "s"}`;
}

export function formatEta(trackCount: number) {
  const minutes = Math.ceil(trackCount / TRACKS_PER_SECOND / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}

export async function wait(milliseconds: number, stopRequested: RefObject<boolean>) {
  const until = Date.now() + milliseconds;
  while (Date.now() < until && !stopRequested.current) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
