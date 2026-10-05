import Link from "next/link";
import type { ReactNode } from "react";
import { homeHref } from "@/app/_components/home-href";
import { LoveButton } from "@/app/_components/love-button";
import { PageJump } from "@/app/_components/page-jump";
import { alertBox, panel } from "@/app/_components/styles";
import {
  getScrobblePage,
  LastFmApiError,
  type RecentTrack,
  type ScrobblePage,
} from "@/lib/lastfm";
import {
  canResubmit,
  libraryTrackUrl,
  nowUts,
  SCROBBLES_PER_PAGE,
} from "@/lib/scrobble-utils";

type Order = "newest" | "oldest";

type RecentScrobblesProps = {
  user: string;
  page: number;
  order: Order;
};

export async function RecentScrobbles({ user, page, order }: RecentScrobblesProps) {
  let result: ScrobblePage | null = null;
  let errorMessage: string | null = null;

  try {
    result = await getScrobblePage(user, page, order, SCROBBLES_PER_PAGE);
  } catch (error) {
    errorMessage =
      error instanceof LastFmApiError
        ? error.message
        : "Could not load your recent tracks.";
  }

  return (
    <section id="recent" aria-labelledby="recent-heading" className="scroll-mt-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <h2 id="recent-heading" className="text-2xl font-light">
            {order === "oldest" ? "Oldest scrobbles" : "Recent scrobbles"}
          </h2>
          {result && (
            <p className="text-sm text-foreground/60">
              {result.total.toLocaleString()} total
            </p>
          )}
        </div>
        <nav aria-label="Sort scrobbles" className="flex text-sm">
          <SortLink href={homeHref({}, "recent")} active={order === "newest"}>
            newest first
          </SortLink>
          <SortLink
            href={homeHref({ sort: "oldest" }, "recent")}
            active={order === "oldest"}
          >
            oldest first
          </SortLink>
        </nav>
      </header>

      {errorMessage || !result ? (
        <p role="alert" className={alertBox}>
          {errorMessage ?? "Could not load your recent tracks."}
        </p>
      ) : result.totalPages > 0 && page > result.totalPages ? (
        <p className={panel}>
          There is no page {page.toLocaleString()}.{" "}
          <Link
            href={pageHref(result.totalPages, order)}
            className="text-lastfm-start hover:underline"
          >
            Go to the last page
          </Link>
        </p>
      ) : !result.tracks.length ? (
        <p className={panel}>No scrobbles yet. Scrobble something above!</p>
      ) : (
        <>
          <ScrobbleList user={user} page={page} order={order} tracks={result.tracks} />
          <Pagination page={page} totalPages={result.totalPages} order={order} />
        </>
      )}
    </section>
  );
}

function ScrobbleList({
  user,
  page,
  order,
  tracks,
}: {
  user: string;
  page: number;
  order: Order;
  tracks: RecentTrack[];
}) {
  const now = nowUts();
  // "Now playing" sits above the first scrobble and gets no number.
  const offset = tracks[0]?.date ? 0 : 1;

  return (
    <ol className="divide-y divide-border border-y border-border">
      {tracks.map((track, index) => {
        const nowPlaying = !track.date;
        const when = nowPlaying ? "Now playing" : track.date?.["#text"];

        return (
          <li key={`${track.url}-${track.date?.uts ?? `now-${index}`}`} className="flex items-center gap-3 py-4 sm:gap-4">
            <span className="hidden min-w-8 shrink-0 text-right text-sm tabular-nums text-foreground/40 sm:block">
              {nowPlaying ? "▸" : (page - 1) * SCROBBLES_PER_PAGE + index + 1 - offset}
            </span>
            <div className="min-w-0 flex-1">
              <a
                href={track.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium wrap-break-word hover:text-lastfm-start"
              >
                {track.name}
              </a>
              <p className="truncate text-sm text-foreground/65">
                {track.artist.name}
                {track.album["#text"] ? ` · ${track.album["#text"]}` : ""}
              </p>
              {/* On small screens the time and actions share a line here. */}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-foreground/50 md:hidden">
                <span>{when}</span>
                <RowActions track={track} user={user} page={page} order={order} now={now} />
              </div>
            </div>
            <span className="hidden text-sm text-foreground/50 md:block">
              {when}
            </span>
            <LoveButton
              artist={track.artist.name}
              track={track.name}
              initialLoved={track.loved === "1"}
            />
            <div className="hidden shrink-0 items-center gap-3 text-sm md:flex">
              <RowActions track={track} user={user} page={page} order={order} now={now} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SortLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`border px-3 py-1 transition-colors first:rounded-l-sm last:rounded-r-sm ${
        active
          ? "border-lastfm-start text-lastfm-start"
          : "border-border text-foreground/60 hover:text-lastfm-start"
      }`}
    >
      {children}
    </Link>
  );
}

function pageHref(page: number, order: Order) {
  return homeHref(
    { sort: order === "oldest" ? "oldest" : null, page: page > 1 ? page : null },
    "recent",
  );
}

/** Page numbers to show: first, last, and the neighbours of the current page. */
function pageWindow(page: number, totalPages: number) {
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);
  const items: (number | "gap")[] = [];

  pages.forEach((value, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && value - previous === 2) items.push(value - 1);
    else if (previous !== undefined && value - previous > 2) items.push("gap");
    items.push(value);
  });

  return items;
}

function Pagination({
  page,
  totalPages,
  order,
}: {
  page: number;
  totalPages: number;
  order: Order;
}) {
  if (totalPages <= 1) return null;

  const cell =
    "flex h-8 min-w-8 items-center justify-center rounded-sm px-2 tabular-nums";

  return (
    <nav aria-label="Scrobble pages" className="mt-8 flex flex-col items-center gap-4">
      <ol className="flex flex-wrap items-center justify-center gap-1 text-sm">
        <li>
          {page > 1 ? (
            <Link
              href={pageHref(page - 1, order)}
              aria-label="Previous page"
              className={`${cell} hover:text-lastfm-start`}
            >
              ‹
            </Link>
          ) : (
            <span aria-hidden="true" className={`${cell} text-foreground/25`}>
              ‹
            </span>
          )}
        </li>
        {pageWindow(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className={`${cell} text-foreground/40`}>
              …
            </li>
          ) : (
            <li
              key={item}
              // Phones only get first, current and last to fit on one line.
              className={
                item === page || item === 1 || item === totalPages
                  ? undefined
                  : "hidden sm:block"
              }
            >
              <Link
                href={pageHref(item, order)}
                aria-current={item === page ? "page" : undefined}
                className={`${cell} ${
                  item === page
                    ? "bg-linear-to-b from-lastfm-start to-lastfm-end text-white"
                    : "hover:text-lastfm-start"
                }`}
              >
                {item.toLocaleString()}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1, order)}
              aria-label="Next page"
              className={`${cell} hover:text-lastfm-start`}
            >
              ›
            </Link>
          ) : (
            <span aria-hidden="true" className={`${cell} text-foreground/25`}>
              ›
            </span>
          )}
        </li>
      </ol>
      <PageJump
        totalPages={totalPages}
        keep={{ sort: order === "oldest" ? "oldest" : null }}
      />
    </nav>
  );
}

function RowActions({
  track,
  user,
  page,
  order,
  now,
}: {
  track: RecentTrack;
  user: string;
  page: number;
  order: Order;
  now: number;
}) {
  const nowPlaying = track["@attr"]?.nowplaying === "true";
  const timestamp = track.date ? Number(track.date.uts) : null;

  return (
    <>
      {timestamp !== null && canResubmit(timestamp, now) ? (
        <Link
          href={homeHref(
            {
              artist: track.artist.name,
              track: track.name,
              album: track.album["#text"],
              ts: timestamp,
              sort: order === "oldest" ? "oldest" : null,
              page: page > 1 ? page : null,
            },
            "scrobble",
          )}
          className="text-foreground/60 hover:text-lastfm-start"
        >
          edit
        </Link>
      ) : (
        <span
          title={
            nowPlaying
              ? "This track is still playing."
              : "Last.fm only accepts scrobbles from the last 14 days, so this one can't be re-sent."
          }
          className="cursor-help text-foreground/25"
        >
          edit
        </span>
      )}
      {!nowPlaying && (
        <a
          href={libraryTrackUrl(user, track.artist.name, track.name)}
          target="_blank"
          rel="noreferrer"
          title="Last.fm only allows deleting scrobbles on its website"
          className="text-foreground/60 hover:text-lastfm-start"
        >
          delete ↗
        </a>
      )}
    </>
  );
}
