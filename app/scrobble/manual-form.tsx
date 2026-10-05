"use client";

import { useState, useTransition, type ReactNode } from "react";
import { scrobbleTrack, type ScrobbleResult } from "@/app/actions";
import { primaryButton, textInput } from "@/app/_components/styles";
import {
  resolveWhen,
  WhenPicker,
  type When,
} from "@/app/_components/when-picker";
import { libraryTrackUrl } from "@/lib/scrobble-utils";
import { ScrobbleResults } from "./scrobble-results";

type ManualScrobbleFormProps = {
  user: string;
  initial: {
    artist: string;
    track: string;
    album: string;
    albumArtist: string;
    // Set when editing an existing scrobble.
    timestamp: number | null;
  };
};

export function ManualScrobbleForm({ user, initial }: ManualScrobbleFormProps) {
  const [fields, setFields] = useState({
    artist: initial.artist,
    track: initial.track,
    album: initial.album,
    albumArtist: initial.albumArtist,
  });
  const [when, setWhen] = useState<When>(
    initial.timestamp === null
      ? { mode: "now" }
      : { mode: "custom", uts: initial.timestamp },
  );
  const [result, setResult] = useState<ScrobbleResult | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = initial.timestamp !== null;
  const originalUrl = editing
    ? libraryTrackUrl(user, initial.artist, initial.track)
    : null;

  function update(name: keyof typeof fields) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setFields((current) => ({ ...current, [name]: event.target.value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const timestamp = resolveWhen(when);
    if (timestamp === undefined) {
      setResult({ ok: false, error: "Pick the time you listened to it." });
      return;
    }

    startTransition(async () => {
      setResult(await scrobbleTrack({ ...fields, timestamp }));
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {originalUrl && (
        <p className="rounded-md border border-border bg-surface/50 p-4 text-sm">
          <strong className="font-medium">Editing a scrobble.</strong> Last.fm
          does not let apps change or delete scrobbles, so this sends a
          corrected copy at the original time. Afterwards,{" "}
          <ExternalLink href={originalUrl}>
            delete the original on last.fm
          </ExternalLink>
          .
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Artist" required>
          <input
            value={fields.artist}
            onChange={update("artist")}
            required
            autoComplete="off"
            className={textInput}
          />
        </Field>
        <Field label="Track" required>
          <input
            value={fields.track}
            onChange={update("track")}
            required
            autoComplete="off"
            className={textInput}
          />
        </Field>
        <Field label="Album">
          <input
            value={fields.album}
            onChange={update("album")}
            autoComplete="off"
            className={textInput}
          />
        </Field>
        <Field label="Album artist">
          <input
            value={fields.albumArtist}
            onChange={update("albumArtist")}
            placeholder="if different from the artist"
            autoComplete="off"
            className={textInput}
          />
        </Field>
      </div>

      <WhenPicker label="Listened" value={when} onChange={setWhen} />

      <div>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "scrobbling…" : editing ? "scrobble corrected copy" : "scrobble"}
        </button>
      </div>

      {result && <ScrobbleResults result={result} />}
      {result?.ok && result.outcomes[0]?.accepted && originalUrl && (
        <p className="text-sm">
          Now{" "}
          <ExternalLink href={originalUrl}>
            delete the original scrobble on last.fm
          </ExternalLink>{" "}
          so it is not counted twice.
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-foreground/70">
        {label}
        {required && <span className="text-lastfm-start"> *</span>}
      </span>
      {children}
    </label>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-lastfm-start underline-offset-2 hover:underline"
    >
      {children} ↗
    </a>
  );
}
