"use client";

import Link from "next/link";
import { useState } from "react";
import { listLovedTracks } from "@/app/actions";
import {
  BatchProgress,
  countTracks,
  formatEta,
  useLoveBatches,
} from "@/app/_components/love-batches";
import { alertBox, panel, primaryButton } from "@/app/_components/styles";
import type { TrackRef } from "@/lib/scrobble-utils";

type Plan = {
  fileName: string;
  inFile: number;
  skipped: number;
  alreadyLoved: number | null;
  queue: TrackRef[];
};

export function RestoreLovedTracks() {
  const [step, setStep] = useState<"pick" | "checking" | "ready" | "started">(
    "pick",
  );
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const batches = useLoveBatches(true);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setError(null);
    setPlan(null);

    const parsed = parseBackup(await file.text());
    if (typeof parsed === "string") {
      setError(parsed);
      return;
    }

    setStep("checking");
    // Skip tracks that are already loved to save requests.
    const current = await listLovedTracks().catch(() => null);
    const loved = new Set(current?.ok ? current.tracks.map(trackKey) : []);
    const queue = parsed.tracks.filter((track) => !loved.has(trackKey(track)));

    setPlan({
      fileName: file.name,
      inFile: parsed.tracks.length,
      skipped: parsed.skipped,
      alreadyLoved: current?.ok ? parsed.tracks.length - queue.length : null,
      queue,
    });
    setStep("ready");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={`${panel} text-sm leading-relaxed`}>
        <p>
          Pick a loved tracks backup: the <code>.json</code> file from{" "}
          <Link href="/loved/clear" className="text-lastfm-start hover:underline">
            clear all
          </Link>{" "}
          or{" "}
          <Link href="/export" className="text-lastfm-start hover:underline">
            export
          </Link>
          . Every track in it that is not loved yet gets loved again.
        </p>
        <p className="mt-2 text-foreground/60">
          Last.fm does not let apps set the date a track was loved, so restored
          tracks show today&apos;s date. They are loved oldest first, so their
          order is kept.
        </p>
      </div>

      {(step === "pick" || step === "checking") && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-foreground/70">Backup file</span>
          <input
            type="file"
            accept=".json,application/json"
            disabled={step === "checking"}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="text-sm file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-border file:bg-transparent file:px-4 file:py-2 file:text-foreground file:transition-colors hover:file:border-lastfm-start hover:file:text-lastfm-start"
          />
          {step === "checking" && (
            <span className="text-sm text-foreground/60">
              Checking which tracks are already loved…
            </span>
          )}
        </label>
      )}

      {error && (
        <p role="alert" className={alertBox}>
          {error}
        </p>
      )}

      {step === "ready" && plan && (
        <div className="flex flex-col gap-5">
          <div className="text-sm leading-relaxed">
            <p>
              <strong>{plan.fileName}</strong> has {countTracks(plan.inFile)}
              {plan.skipped > 0 &&
                ` (${plan.skipped.toLocaleString()} unreadable entries were skipped)`}
              .
            </p>
            {plan.alreadyLoved === null ? (
              <p className="text-foreground/60">
                Could not check your current loved tracks, so all of them will
                be sent.
              </p>
            ) : (
              <p className="text-foreground/60">
                {plan.alreadyLoved.toLocaleString()}{" "}
                {plan.alreadyLoved === 1 ? "is" : "are"} already loved.
              </p>
            )}
          </div>
          {plan.queue.length ? (
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setStep("started");
                  batches.start(plan.queue);
                }}
                className={primaryButton}
              >
                love {countTracks(plan.queue.length)}
              </button>
              <span className="text-sm text-foreground/60">
                about {formatEta(plan.queue.length)}
              </span>
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="text-sm text-foreground/60 hover:text-lastfm-start"
              >
                pick another file
              </button>
            </div>
          ) : (
            <p className={panel}>Everything in this file is already loved.</p>
          )}
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

function trackKey({ artist, track }: TrackRef) {
  return `${artist.trim().toLowerCase()}\u0000${track.trim().toLowerCase()}`;
}

/** Tracks from a backup file, oldest loved first, or an error message. */
function parseBackup(text: string) {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return "This file is not valid JSON.";
  }

  if (!Array.isArray(data)) {
    return "This file is not a loved tracks backup (expected a list of tracks).";
  }

  const seen = new Set<string>();
  const entries: (TrackRef & { lovedAt: number | null })[] = [];
  let skipped = 0;

  for (const entry of data as Record<string, unknown>[]) {
    const artist = typeof entry?.artist === "string" ? entry.artist.trim() : "";
    const track = typeof entry?.track === "string" ? entry.track.trim() : "";
    if (!artist || !track) {
      skipped++;
      continue;
    }

    const key = trackKey({ artist, track });
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      artist,
      track,
      lovedAt: typeof entry.lovedAt === "number" ? entry.lovedAt : null,
    });
  }

  if (!entries.length) return "No tracks with an artist and title were found in this file.";

  // Love the oldest first so the newest ends up on top again.
  if (entries.every((entry) => entry.lovedAt !== null)) {
    entries.sort((left, right) => left.lovedAt! - right.lovedAt!);
  }

  return {
    tracks: entries.map(({ artist, track }) => ({ artist, track })),
    skipped,
  };
}
