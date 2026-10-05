"use client";

import { useState, useTransition } from "react";
import { scrobbleAlbum, type ScrobbleResult } from "@/app/actions";
import { primaryButton, secondaryButton } from "@/app/_components/styles";
import {
  resolveWhen,
  WhenPicker,
  type When,
} from "@/app/_components/when-picker";
import type { AlbumTrack } from "@/lib/lastfm";
import {
  FALLBACK_TRACK_DURATION_SECONDS,
  formatDuration,
} from "@/lib/scrobble-utils";
import { ScrobbleResults } from "./scrobble-results";

type AlbumPickerProps = {
  album: string;
  albumArtist: string;
  tracks: AlbumTrack[];
};

export function AlbumPicker({ album, albumArtist, tracks }: AlbumPickerProps) {
  const [selected, setSelected] = useState(() => tracks.map(() => true));
  const [when, setWhen] = useState<When>({ mode: "now" });
  const [result, setResult] = useState<ScrobbleResult | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = tracks.filter((_, index) => selected[index]);
  const totalSeconds = chosen.reduce(
    (total, track) => total + (track.duration || FALLBACK_TRACK_DURATION_SECONDS),
    0,
  );
  const hasUnknownDurations = chosen.some((track) => !track.duration);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const finishedAt = resolveWhen(when);
    if (finishedAt === undefined) {
      setResult({ ok: false, error: "Pick when you finished listening." });
      return;
    }

    startTransition(async () => {
      setResult(
        await scrobbleAlbum({
          album,
          albumArtist,
          finishedAt,
          tracks: chosen.map((track) => ({
            artist: track.artist,
            track: track.name,
            duration: track.duration,
          })),
        }),
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
          <span className="text-foreground/60">
            {chosen.length} of {tracks.length} tracks · {formatDuration(totalSeconds)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(tracks.map(() => true))}
              className={secondaryButton}
            >
              all
            </button>
            <button
              type="button"
              onClick={() => setSelected(tracks.map(() => false))}
              className={secondaryButton}
            >
              none
            </button>
          </div>
        </div>
        <ol className="divide-y divide-border border-y border-border">
          {tracks.map((track, index) => (
            <li key={`${index}-${track.name}`}>
              <label className="flex cursor-pointer items-center gap-4 py-3">
                <input
                  type="checkbox"
                  checked={selected[index]}
                  onChange={(event) =>
                    setSelected((current) =>
                      current.map((value, position) =>
                        position === index ? event.target.checked : value,
                      ),
                    )
                  }
                  className="size-4 accent-lastfm-start"
                />
                <span className="w-6 shrink-0 text-right text-sm text-foreground/40">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{track.name}</span>
                  {track.artist !== albumArtist && (
                    <span className="block truncate text-sm text-foreground/65">
                      {track.artist}
                    </span>
                  )}
                </span>
                <span className="text-sm tabular-nums text-foreground/50">
                  {track.duration ? formatDuration(track.duration) : "–:––"}
                </span>
              </label>
            </li>
          ))}
        </ol>
        {hasUnknownDurations && (
          <p className="mt-2 text-sm text-foreground/60">
            Tracks without a known length count as{" "}
            {formatDuration(FALLBACK_TRACK_DURATION_SECONDS)}.
          </p>
        )}
      </div>

      <WhenPicker label="Finished listening" value={when} onChange={setWhen} />

      <div>
        <button
          type="submit"
          disabled={pending || !chosen.length}
          className={primaryButton}
        >
          {pending
            ? "scrobbling…"
            : `scrobble ${chosen.length} track${chosen.length === 1 ? "" : "s"}`}
        </button>
        <p className="mt-2 text-sm text-foreground/60">
          Tracks are timestamped back to back so the last one ends at the time
          above.
        </p>
      </div>

      {result && <ScrobbleResults result={result} />}
    </form>
  );
}
