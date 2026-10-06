"use client";

import { useState, type ReactNode } from "react";

export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="flex h-full items-center lg:hidden"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-full items-center px-4 transition-colors hover:text-lastfm-start"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
          <path
            d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {/* Hidden rather than unmounted: closing re-renders before the
          click's default action, and Safari won't follow a link or submit
          a form that is no longer in the document. */}
      <div
        id="mobile-menu"
        hidden={!open}
        // Close after following a link or submitting logout.
        onClick={(event) => {
          if ((event.target as Element).closest("a, button")) setOpen(false);
        }}
        className="absolute inset-x-0 top-full flex flex-col divide-y divide-border border-y-2 border-border bg-background shadow-lg shadow-border/60"
      >
        {children}
      </div>
    </div>
  );
}
