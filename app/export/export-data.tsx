"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { listLovedTracks } from "@/app/actions";
import { downloadFile, fileDate } from "@/app/_components/download";
import {
  HistoryProgress,
  useScrobbleHistory,
} from "@/app/_components/scrobble-history";
import {
  alertBox,
  panel,
  primaryButton,
  secondaryButton,
} from "@/app/_components/styles";
import { toCsv, type ScrobbleExportRow } from "@/lib/scrobble-utils";

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
  const history = useScrobbleHistory();
  const { phase, fetched } = history;

  function save(rows: ScrobbleExportRow[], as: Format) {
    const records = rows.map((row) => ({
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

  return (
    <div className="flex flex-col gap-4">
      <FormatPicker value={format} onChange={setFormat} disabled={phase === "running"} />

      <div className="flex flex-wrap gap-2">
        {phase !== "running" && (
          <button
            type="button"
            onClick={() =>
              history.start({
                onDone: (rows) => {
                  if (rows.length) save(rows, format);
                },
              })
            }
            className={primaryButton}
          >
            {phase === "idle" ? "export scrobbles" : "start over"}
          </button>
        )}
        {phase === "running" && (
          <button type="button" onClick={history.stop} className={secondaryButton}>
            stop
          </button>
        )}
        {phase === "stopped" && (
          <button type="button" onClick={history.resume} className={secondaryButton}>
            resume
          </button>
        )}
        {(phase === "stopped" || phase === "done") && fetched > 0 && (
          <button
            type="button"
            onClick={() => save(history.rows.current, format)}
            className={secondaryButton}
          >
            {phase === "done"
              ? `download again (.${format})`
              : `download the ${fetched.toLocaleString()} fetched so far`}
          </button>
        )}
      </div>

      <HistoryProgress
        history={history}
        label="Exporting scrobbles"
        doneText={fetched ? "done, your download has started" : "there are no scrobbles to export"}
      />
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
