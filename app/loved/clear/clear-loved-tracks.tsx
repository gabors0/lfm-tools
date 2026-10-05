"use client";

import Link from "next/link";
import { useState } from "react";
import { listLovedTracks } from "@/app/actions";
import { downloadFile, fileDate } from "@/app/_components/download";
import {
  BatchProgress,
  countTracks,
  formatEta,
  useLoveBatches,
} from "@/app/_components/love-batches";
import {
  alertBox,
  panel,
  primaryButton,
  secondaryButton,
  textInput,
} from "@/app/_components/styles";
import type { LovedTrackBackup } from "@/lib/scrobble-utils";

export function ClearLovedTracks({ user }: { user: string }) {
  const [step, setStep] = useState<"idle" | "loading" | "ready" | "started">(
    "idle",
  );
  const [tracks, setTracks] = useState<LovedTrackBackup[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const batches = useLoveBatches(false);

  async function load() {
    setStep("loading");
    setError(null);

    const result = await listLovedTracks().catch(() => null);
    if (!result?.ok) {
      setError(result?.error ?? "Could not reach the server. Try again.");
      setStep("idle");
      return;
    }

    setTracks(result.tracks);
    setStep("ready");
  }

  function downloadBackup() {
    downloadFile(
      `${user}-loved-tracks-${fileDate()}.json`,
      JSON.stringify(tracks, null, 2),
      "application/json",
    );
    setBackedUp(true);
  }

  function start() {
    setStep("started");
    batches.start(tracks.map(({ artist, track }) => ({ artist, track })));
  }

  const confirmed = confirmation.trim().toLowerCase() === user.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <div className={`${panel} text-sm leading-relaxed`}>
        <p>
          This unloves every track you have loved on Last.fm. Last.fm has no
          undo, so download the backup first. You can{" "}
          <Link href="/loved/restore" className="text-lastfm-start hover:underline">
            restore it
          </Link>{" "}
          later.
        </p>
        <p className="mt-2 text-foreground/60">
          Tracks are removed about 3 per second to stay inside Last.fm&apos;s
          rate limit. Keep this tab open until it finishes. You can stop and
          resume at any time.
        </p>
      </div>

      {(step === "idle" || step === "loading") && (
        <div>
          <button
            type="button"
            onClick={load}
            disabled={step === "loading"}
            className={secondaryButton}
          >
            {step === "loading" ? "loading loved tracks…" : "load loved tracks"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className={alertBox}>
          {error}
        </p>
      )}

      {step === "ready" && tracks.length === 0 && (
        <p className={panel}>You have no loved tracks.</p>
      )}

      {step === "ready" && tracks.length > 0 && (
        <div className="flex flex-col gap-5">
          <p>
            Found <strong>{countTracks(tracks.length)}</strong> you have
            loved. This will take about {formatEta(tracks.length)}.
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
              onClick={start}
              disabled={!confirmed}
              className={primaryButton}
            >
              unlove {tracks.length === 1 ? "1 track" : `all ${countTracks(tracks.length)}`}
            </button>
          </div>
        </div>
      )}

      {step === "started" && <BatchProgress batches={batches} />}

      {batches.phase === "done" && (
        <p className={panel}>
          Done. Last.fm can take a few minutes to update your loved tracks
          list.{" "}
          <Link href="/loved" className="text-lastfm-start hover:underline">
            Back to loved tracks
          </Link>
        </p>
      )}
    </div>
  );
}
