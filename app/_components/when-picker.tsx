"use client";

import { useSyncExternalStore } from "react";
import { textInput } from "@/app/_components/styles";
import {
  fromDateTimeLocal,
  MAX_SCROBBLE_AGE_SECONDS,
  nowUts,
  toDateTimeLocal,
} from "@/lib/scrobble-utils";

export type When = { mode: "now" } | { mode: "custom"; uts: number | null };

const subscribe = () => () => {};

type WhenPickerProps = {
  label: string;
  value: When;
  onChange: (value: When) => void;
};

export function WhenPicker({ label, value, onChange }: WhenPickerProps) {
  // The custom time is shown in the browser's time zone, which the server does
  // not know, so the time input only renders on the client.
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm text-foreground/70">{label}</legend>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={value.mode === "now"}
            onChange={() => onChange({ mode: "now" })}
            className="accent-lastfm-start"
          />
          just now
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={value.mode === "custom"}
            onChange={() => onChange({ mode: "custom", uts: nowUts() })}
            className="accent-lastfm-start"
          />
          at a specific time
        </label>
      </div>
      {value.mode === "custom" && isClient && (
        <input
          type="datetime-local"
          step={1}
          required
          aria-label={label}
          value={value.uts === null ? "" : toDateTimeLocal(value.uts)}
          min={toDateTimeLocal(nowUts() - MAX_SCROBBLE_AGE_SECONDS)}
          max={toDateTimeLocal(nowUts())}
          onChange={(event) =>
            onChange({ mode: "custom", uts: fromDateTimeLocal(event.target.value) })
          }
          className={`${textInput} max-w-xs`}
        />
      )}
    </fieldset>
  );
}

/** The chosen time as a unix timestamp, null for "now", or undefined if incomplete. */
export function resolveWhen(value: When) {
  if (value.mode === "now") return null;
  return value.uts ?? undefined;
}
