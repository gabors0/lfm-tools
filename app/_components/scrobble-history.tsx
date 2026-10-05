"use client";

import { useEffect, useRef, useState } from "react";
import { exportScrobblePages } from "@/app/actions";
import { wait } from "@/app/_components/love-batches";
import { alertBox } from "@/app/_components/styles";
import {
  EXPORT_PAGES_PER_CALL,
  nowUts,
  type ScrobbleExportRow,
} from "@/lib/scrobble-utils";

const RETRY_DELAYS_MS = [2000, 5000, 15000, 60000];

/**
 * Fetches scrobble history (newest first) a few pages per request, with
 * retries, stop and resume. Rows live in a ref because big histories hold
 * 100k+ of them.
 */
export function useScrobbleHistory() {
  const [phase, setPhase] = useState<"idle" | "running" | "stopped" | "done">(
    "idle",
  );
  const [fetched, setFetched] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = useRef<ScrobbleExportRow[]>([]);
  const nextPage = useRef(1);
  const totalPages = useRef<number | null>(null);
  const range = useRef<{ from?: number; to: number }>({ to: 0 });
  const onDone = useRef<(rows: ScrobbleExportRow[]) => void>(() => {});
  const stopRequested = useRef(false);

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

  async function fetchPages(pages: number[]) {
    for (let attempt = 0; ; attempt++) {
      const result = await exportScrobblePages(
        pages,
        range.current.to,
        range.current.from,
      ).catch(() => null);
      if (result?.ok) return result;

      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || stopRequested.current) {
        setError(
          result?.error ??
            "Lost the connection to the server. Resume to continue where it stopped.",
        );
        return null;
      }

      setNotice(
        `${result?.error ?? "Connection problem"}. Retrying in ${delay / 1000} seconds…`,
      );
      await wait(delay, stopRequested);
      setNotice(null);
    }
  }

  async function run() {
    stopRequested.current = false;
    setPhase("running");
    setError(null);
    setNotice(null);

    const startedAt = Date.now();
    const startedWith = rows.current.length;

    while (!stopRequested.current) {
      const known = totalPages.current;
      if (known !== null && nextPage.current > known) break;

      // The first request learns the page count; later ones fetch several pages.
      const last =
        known === null
          ? nextPage.current
          : Math.min(known, nextPage.current + EXPORT_PAGES_PER_CALL - 1);
      const pages = Array.from(
        { length: last - nextPage.current + 1 },
        (_, index) => nextPage.current + index,
      );

      const result = await fetchPages(pages);
      if (!result) break;

      rows.current.push(...result.rows);
      totalPages.current = result.totalPages;
      nextPage.current = last + 1;
      setTotal(result.total);
      setFetched(rows.current.length);
      setRate(
        (rows.current.length - startedWith) / ((Date.now() - startedAt) / 1000),
      );
    }

    setNotice(null);
    const finished =
      totalPages.current !== null && nextPage.current > totalPages.current;
    setPhase(finished ? "done" : "stopped");
    if (finished) onDone.current(rows.current);
  }

  return {
    phase,
    fetched,
    total,
    rate,
    notice,
    error,
    rows,
    /** Fetch everything after `from` (all history without it). */
    start(options: { from?: number; onDone: (rows: ScrobbleExportRow[]) => void }) {
      rows.current = [];
      nextPage.current = 1;
      totalPages.current = null;
      // Pin the end so scrobbles made meanwhile don't shift the pages.
      range.current = { from: options.from, to: nowUts() };
      onDone.current = options.onDone;
      setFetched(0);
      setTotal(null);
      setRate(null);
      void run();
    },
    stop() {
      stopRequested.current = true;
      setNotice("Stopping after the current request…");
    },
    resume() {
      void run();
    },
  };
}

type ScrobbleHistory = ReturnType<typeof useScrobbleHistory>;

export function HistoryProgress({
  history,
  label,
  doneText,
}: {
  history: ScrobbleHistory;
  label: string;
  doneText: string;
}) {
  const { phase, fetched, total, rate, notice, error } = history;
  const remaining = total === null ? null : Math.max(0, total - fetched);

  if (phase === "idle") return null;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total ?? 0}
        aria-valuenow={fetched}
        className="h-2 overflow-hidden rounded-full bg-surface"
      >
        <div
          className="h-full bg-linear-to-r from-lastfm-start to-lastfm-end transition-[width]"
          style={{ width: total ? `${(fetched / total) * 100}%` : "0%" }}
        />
      </div>
      <p className="text-sm text-foreground/70" aria-live="polite">
        {total === null
          ? "Starting…"
          : `Fetched ${fetched.toLocaleString()} of ${total.toLocaleString()} scrobbles`}
        {phase === "running" &&
          remaining !== null &&
          remaining > 0 &&
          rate !== null &&
          rate > 0 &&
          ` · about ${formatMinutes(remaining / rate)} left`}
        {phase === "done" && ` · ${doneText}`}
      </p>
      {notice && <p className="text-sm text-foreground/70">{notice}</p>}
      {error && (
        <p role="alert" className={alertBox}>
          {error}
        </p>
      )}
    </div>
  );
}

function formatMinutes(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
