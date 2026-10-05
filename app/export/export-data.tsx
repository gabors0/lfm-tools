"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { exportScrobblePages, listLovedTracks } from "@/app/actions";
import { downloadFile, fileDate } from "@/app/_components/download";
import { wait } from "@/app/_components/love-batches";
import {
  alertBox,
  panel,
  primaryButton,
  secondaryButton,
} from "@/app/_components/styles";
import {
  EXPORT_PAGES_PER_CALL,
  nowUts,
  toCsv,
  type ScrobbleExportRow,
} from "@/lib/scrobble-utils";

const RETRY_DELAYS_MS = [2000, 5000, 15000, 60000];

type Format = "csv" | "json";

type ExportDataProps = {
  user: string;
  scrobbleTotal: number | null;
  lovedTotal: number | null;
};

export function ExportData({ user, scrobbleTotal, lovedTotal }: ExportDataProps) {
  return (
    <div className="flex flex-col gap-10">
      <Section
        title="Scrobble history"
        description={
          <>
            Every scrobble
            {scrobbleTotal !== null && ` (${scrobbleTotal.toLocaleString()})`} with
            its date, artist, album, track and whether the track is loved.
            Large histories take a few minutes; keep this tab open.
          </>
        }
      >
        <ScrobbleExport user={user} />
      </Section>
      <Section
        title="Loved tracks"
        description={
          <>
            A backup of your loved tracks
            {lovedTotal !== null && ` (${lovedTotal.toLocaleString()})`}. You
            can bring them back later with{" "}
            <Link href="/loved/restore" className="text-lastfm-start hover:underline">
              restore
            </Link>
            .
          </>
        }
      >
        <LovedExport user={user} />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-light">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-foreground/70">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function ScrobbleExport({ user }: { user: string }) {
  const [format, setFormat] = useState<Format>("csv");
  const [phase, setPhase] = useState<"idle" | "running" | "stopped" | "done">(
    "idle",
  );
  const [fetched, setFetched] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Large exports can hold 100k+ rows, so keep them out of React state.
  const rows = useRef<ScrobbleExportRow[]>([]);
  const nextPage = useRef(1);
  const totalPages = useRef<number | null>(null);
  const to = useRef(0);
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

  function start() {
    rows.current = [];
    nextPage.current = 1;
    totalPages.current = null;
    // Pin the end so scrobbles made during the export don't shift the pages.
    to.current = nowUts();
    setFetched(0);
    setTotal(null);
    void run();
  }

  async function fetchPages(pages: number[]) {
    for (let attempt = 0; ; attempt++) {
      const result = await exportScrobblePages(pages, to.current).catch(() => null);
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

      // The first call learns the page count; later calls fetch several pages.
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
    if (finished && rows.current.length) save(format);
  }

  function save(as: Format) {
    const records = rows.current.map((row) => ({
      date: new Date(row.timestamp * 1000).toISOString(),
      timestamp: row.timestamp,
      artist: row.artist,
      album: row.album,
      track: row.track,
      loved: row.loved,
    }));
    const name = `${user}-scrobbles-${fileDate()}`;

    if (as === "csv") {
      downloadFile(`${name}.csv`, toCsv(records), "text/csv;charset=utf-8");
    } else {
      // One scrobble per line keeps big files readable and compact.
      downloadFile(
        `${name}.json`,
        `[\n${records.map((record) => JSON.stringify(record)).join(",\n")}\n]\n`,
        "application/json",
      );
    }
  }

  const remaining = total === null ? null : Math.max(0, total - fetched);

  return (
    <div className="flex flex-col gap-4">
      <FormatPicker value={format} onChange={setFormat} disabled={phase === "running"} />

      <div className="flex flex-wrap gap-2">
        {phase !== "running" && (
          <button type="button" onClick={start} className={primaryButton}>
            {phase === "idle" ? "export scrobbles" : "start over"}
          </button>
        )}
        {phase === "running" && (
          <button
            type="button"
            onClick={() => {
              stopRequested.current = true;
              setNotice("Stopping after the current request…");
            }}
            className={secondaryButton}
          >
            stop
          </button>
        )}
        {phase === "stopped" && (
          <button type="button" onClick={() => void run()} className={secondaryButton}>
            resume
          </button>
        )}
        {(phase === "stopped" || phase === "done") && fetched > 0 && (
          <button type="button" onClick={() => save(format)} className={secondaryButton}>
            {phase === "done"
              ? `download again (.${format})`
              : `download the ${fetched.toLocaleString()} fetched so far`}
          </button>
        )}
      </div>

      {phase !== "idle" && (
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-label="Exporting scrobbles"
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
            {phase === "done" &&
              (fetched
                ? " · done, your download has started"
                : " · there are no scrobbles to export")}
          </p>
        </div>
      )}

      {notice && <p className="text-sm text-foreground/70">{notice}</p>}
      {error && (
        <p role="alert" className={alertBox}>
          {error}
        </p>
      )}
    </div>
  );
}

function LovedExport({ user }: { user: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setState("loading");
    setError(null);

    const result = await listLovedTracks().catch(() => null);
    if (!result?.ok) {
      setError(result?.error ?? "Could not reach the server. Try again.");
      setState("idle");
      return;
    }

    downloadFile(
      `${user}-loved-tracks-${fileDate()}.json`,
      JSON.stringify(result.tracks, null, 2),
      "application/json",
    );
    setState("done");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          onClick={download}
          disabled={state === "loading"}
          className={secondaryButton}
        >
          {state === "loading"
            ? "loading loved tracks…"
            : state === "done"
              ? "downloaded ✓ download again"
              : "download loved tracks (.json)"}
        </button>
      </div>
      {error && (
        <p role="alert" className={alertBox}>
          {error}
        </p>
      )}
    </div>
  );
}

function FormatPicker({
  value,
  onChange,
  disabled,
}: {
  value: Format;
  onChange: (value: Format) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className={`${panel} flex flex-wrap gap-x-5 gap-y-2 text-sm`}>
      <legend className="sr-only">File format</legend>
      {(
        [
          ["csv", "CSV (spreadsheets)"],
          ["json", "JSON"],
        ] as const
      ).map(([format, label]) => (
        <label key={format} className="flex items-center gap-2">
          <input
            type="radio"
            name="format"
            checked={value === format}
            onChange={() => onChange(format)}
            className="accent-lastfm-start"
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function formatMinutes(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
