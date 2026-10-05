"use client";

import { useState, useTransition } from "react";
import { updateLoved } from "@/app/actions";

type LoveButtonProps = {
  artist: string;
  track: string;
  initialLoved: boolean;
};

export function LoveButton({ artist, track, initialLoved }: LoveButtonProps) {
  const [loved, setLoved] = useState(initialLoved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !loved;
    setLoved(next);
    setError(null);

    startTransition(async () => {
      const result = await updateLoved(artist, track, next);
      if (!result.ok) {
        setLoved(!next);
        setError(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={loved}
      aria-label={`${loved ? "Unlove" : "Love"} ${track} by ${artist}`}
      title={error ?? (loved ? "unlove" : "love")}
      className={`p-1 transition-colors disabled:opacity-60 ${
        error
          ? "text-lastfm-start animate-pulse"
          : loved
            ? "text-lastfm-start hover:text-lastfm-end"
            : "text-foreground/35 hover:text-lastfm-start"
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <path
          d="M12 20.25s-7.5-4.55-9.55-9.1C.9 7.65 3.25 4 6.85 4c2.1 0 3.6 1.1 5.15 3 1.55-1.9 3.05-3 5.15-3 3.6 0 5.95 3.65 4.4 7.15-2.05 4.55-9.55 9.1-9.55 9.1Z"
          fill={loved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
