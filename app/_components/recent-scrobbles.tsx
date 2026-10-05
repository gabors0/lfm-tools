import Link from "next/link";
import { homeHref } from "@/app/_components/home-href";
import { LoveButton } from "@/app/_components/love-button";
import { alertBox } from "@/app/_components/styles";
import {
  getRecentTracks,
  LastFmApiError,
  type RecentTrack,
  type RecentTracksResponse,
} from "@/lib/lastfm";
import { canResubmit, libraryTrackUrl, nowUts } from "@/lib/scrobble-utils";

const PAGE_SIZE = 50;

export async function RecentScrobbles({ user, page }: { user: string; page: number }) {
  let recenttracks: RecentTracksResponse["recenttracks"] | null = null;
  let errorMessage: string | null = null;

  try {
    ({ recenttracks } = await getRecentTracks(user, page, PAGE_SIZE));
  } catch (error) {
    errorMessage =
      error instanceof LastFmApiError
        ? error.message
        : "Could not load your recent tracks.";
  }

  return (
    <section id="recent" aria-labelledby="recent-heading" className="scroll-mt-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h2 id="recent-heading" className="text-2xl font-light">
          Recent scrobbles
        </h2>
        {recenttracks && (
          <p className="text-sm text-foreground/60">
            {Number(recenttracks["@attr"].total).toLocaleString()} total
          </p>
        )}
      </header>

      {errorMessage || !recenttracks ? (
        <p role="alert" className={alertBox}>
          {errorMessage ?? "Could not load your recent tracks."}
        </p>
      ) : (
        <ScrobbleList user={user} page={page} recenttracks={recenttracks} />
      )}
    </section>
  );
}

function ScrobbleList({
  user,
  page,
  recenttracks,
}: {
  user: string;
  page: number;
  recenttracks: RecentTracksResponse["recenttracks"];
}) {
  const totalPages = Number(recenttracks["@attr"].totalPages);
  const now = nowUts();

  if (!recenttracks.track.length) {
    return (
      <p className="rounded-md border border-border bg-surface p-6">
        No scrobbles yet. Scrobble something above!
      </p>
    );
  }

  return (
    <>
      <ol className="divide-y divide-border border-y border-border">
        {recenttracks.track.map((track, index) => {
          const nowPlaying = track["@attr"]?.nowplaying === "true";
          const when = nowPlaying ? "Now playing" : track.date?.["#text"];

          return (
            <li key={`${track.url}-${track.date?.uts ?? `now-${index}`}`} className="flex items-center gap-3 py-4 sm:gap-4">
              <span className="hidden w-8 shrink-0 text-right text-sm text-foreground/40 sm:block">
                {(page - 1) * PAGE_SIZE + index + 1}
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
                  <RowActions track={track} user={user} page={page} now={now} />
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
                <RowActions track={track} user={user} page={page} now={now} />
              </div>
            </li>
          );
        })}
      </ol>

      <nav aria-label="Scrobble pages" className="mt-8 flex justify-between">
        {page > 1 ? (
          <Link
            href={homeHref({ page: page > 2 ? page - 1 : null }, "recent")}
            className="hover:text-lastfm-start"
          >
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        {page < totalPages && (
          <Link
            href={homeHref({ page: page + 1 }, "recent")}
            className="hover:text-lastfm-start"
          >
            Older →
          </Link>
        )}
      </nav>
    </>
  );
}

function RowActions({
  track,
  user,
  page,
  now,
}: {
  track: RecentTrack;
  user: string;
  page: number;
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
