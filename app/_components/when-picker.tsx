"use client";

import { useSyncExternalStore } from "react";
import { segment, textInput } from "@/app/_components/styles";
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
      <div className="flex text-sm">
        <button
          type="button"
          aria-pressed={value.mode === "now"}
          onClick={() => onChange({ mode: "now" })}
          className={segment(value.mode === "now")}
        >
          just now
        </button>
        <button
          type="button"
          aria-pressed={value.mode === "custom"}
          // Keep an already chosen time when clicked again.
          onClick={() => {
            if (value.mode !== "custom") onChange({ mode: "custom", uts: nowUts() });
          }}
          className={segment(value.mode === "custom")}
        >
          at a specific time
        </button>
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
