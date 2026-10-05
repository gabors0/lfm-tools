"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { listLovedTracks, unloveTracks } from "@/app/actions";
import {
  alertBox,
  panel,
  primaryButton,
  secondaryButton,
  textInput,
} from "@/app/_components/styles";
import {
  UNLOVE_BATCH_SIZE,
  type LovedTrackBackup,
  type TrackRef,
} from "@/lib/scrobble-utils";

const RATE_LIMIT_PAUSE_SECONDS = 60;
// Roughly what the server-side throttle achieves, for the time estimate.
const TRACKS_PER_SECOND = 3;

type Phase = "idle" | "loading" | "ready" | "running" | "stopped" | "done";
type FailedTrack = TrackRef & { error: string };

export function ClearLovedTracks({ user }: { user: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [tracks, setTracks] = useState<LovedTrackBackup[]>([]);
  const [remaining, setRemaining] = useState<TrackRef[]>([]);
  const [removed, setRemoved] = useState(0);
  const [failed, setFailed] = useState<FailedTrack[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRequested = useRef(false);

  // Stop sending batches if the user leaves this page.
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

  async function load() {
    setPhase("loading");
    setError(null);

    const result = await listLovedTracks().catch(() => null);
    if (!result?.ok) {
      setError(result?.error ?? "Could not reach the server. Try again.");
      setPhase("idle");
      return;
    }

    setTracks(result.tracks);
    setRemaining(result.tracks.map(({ artist, track }) => ({ artist, track })));
    setPhase(result.tracks.length ? "ready" : "done");
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(tracks, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${user}-loved-tracks-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackedUp(true);
  }

  async function run(queue: TrackRef[]) {
    stopRequested.current = false;
    setPhase("running");
    setError(null);
    setNotice(null);

    let pending = queue;

    while (pending.length && !stopRequested.current) {
      const batch = pending.slice(0, UNLOVE_BATCH_SIZE);
      const result = await unloveTracks(batch).catch(() => null);

      if (!result?.ok) {
        setError(
          result?.error ??
            "Lost the connection to the server. Resume to continue where it stopped.",
        );
        break;
      }

      pending = pending.slice(result.processed);
      setRemaining(pending);
      setRemoved((count) => count + result.processed - result.failed.length);
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

  function stop() {
    stopRequested.current = true;
    setNotice("Stopping after the current batch…");
  }

  function retryFailed() {
    const queue = failed.map(({ artist, track }) => ({ artist, track }));
    setFailed([]);
    setRemaining(queue);
    void run(queue);
  }

  const total = tracks.length;
  const handled = total - remaining.length;
  const confirmed = confirmation.trim().toLowerCase() === user.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <div className={`${panel} text-sm leading-relaxed`}>
        <p>
          This unloves every track you have loved on Last.fm. Last.fm has no
          undo, so download the backup first. It lists every track with the
          date you loved it.
        </p>
        <p className="mt-2 text-foreground/60">
          Tracks are removed about {TRACKS_PER_SECOND} per second to stay
          inside Last.fm&apos;s rate limit. Keep this tab open until it
          finishes. You can stop and resume at any time.
        </p>
      </div>

      {(phase === "idle" || phase === "loading") && (
        <div>
          <button
            type="button"
            onClick={load}
            disabled={phase === "loading"}
            className={secondaryButton}
          >
            {phase === "loading" ? "loading loved tracks…" : "load loved tracks"}
          </button>
        </div>
      )}

      {phase === "ready" && (
        <div className="flex flex-col gap-5">
          <p>
            Found <strong>{total.toLocaleString()}</strong> loved tracks. This
            will take about {formatEta(total)}.
          </p>
          <div>
            <button type="button" onClick={downloadBackup} className={secondaryButton}>
              {backedUp ? "backup downloaded ✓" : "download backup (.json)"}
            </button>
          </div>
          <label className="flex max-w-sm flex-col gap-1.5">
            <span className="text-sm text-foreground/70">
              Type <strong>{user}</strong> to confirm
            </span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={textInput}
            />
          </label>
          <div>
            <button
              type="button"
              onClick={() => void run(remaining)}
              disabled={!confirmed}
              className={primaryButton}
            >
              unlove all {total.toLocaleString()} tracks
            </button>
          </div>
        </div>
      )}

      {(phase === "running" || phase === "stopped" || phase === "done") &&
        total > 0 && (
          <div className="flex flex-col gap-3">
            <div
              role="progressbar"
              aria-label="Unloving tracks"
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
              Removed {removed.toLocaleString()} of {total.toLocaleString()}
              {failed.length > 0 && ` · ${failed.length} failed`}
              {phase === "running" &&
                remaining.length > 0 &&
                ` · about ${formatEta(remaining.length)} left`}
            </p>
            <div className="flex gap-2">
              {phase === "running" && (
                <button type="button" onClick={stop} className={secondaryButton}>
                  stop
                </button>
              )}
              {phase === "stopped" && (
                <button
                  type="button"
                  onClick={() => void run(remaining)}
                  className={secondaryButton}
                >
                  resume
                </button>
              )}
              {phase === "done" && failed.length > 0 && (
                <button type="button" onClick={retryFailed} className={secondaryButton}>
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

      {phase === "done" && (
        <p className={panel}>
          {total === 0
            ? "You have no loved tracks."
            : "Done. Last.fm can take a few minutes to update your loved tracks list."}{" "}
          <Link href="/loved" className="text-lastfm-start hover:underline">
            Back to loved tracks
          </Link>
        </p>
      )}

      {failed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-foreground/70">
            {failed.length} track{failed.length === 1 ? "" : "s"} could not be
            unloved
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

function formatEta(trackCount: number) {
  const minutes = Math.ceil(trackCount / TRACKS_PER_SECOND / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}

async function wait(milliseconds: number, stopRequested: RefObject<boolean>) {
  const until = Date.now() + milliseconds;
  while (Date.now() < until && !stopRequested.current) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
