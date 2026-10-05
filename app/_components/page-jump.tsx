"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { homeHref } from "@/app/_components/home-href";

type PageJumpProps = {
  totalPages: number;
  // Other list params (like the sort order) to keep.
  keep: Record<string, string | null>;
};

export function PageJump({ totalPages, keep }: PageJumpProps) {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const page = Math.min(Math.max(Math.trunc(Number(value)) || 1, 1), totalPages);
        router.push(homeHref({ ...keep, page: page > 1 ? page : null }, "recent"));
        setValue("");
      }}
      className="flex items-center gap-2 text-sm"
    >
      <label className="flex items-center gap-2 text-foreground/70">
        go to page
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={totalPages}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-24 rounded-sm border border-border bg-surface/40 px-2 py-1 outline-none transition-colors focus:border-lastfm-start"
        />
      </label>
      <button
        type="submit"
        className="rounded-sm border border-border px-3 py-1 transition-colors hover:border-lastfm-start hover:text-lastfm-start"
      >
        go
      </button>
    </form>
  );
}
