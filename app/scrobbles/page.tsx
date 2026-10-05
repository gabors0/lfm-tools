import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiError } from "@/app/_components/api-error";
import { LoveButton } from "@/app/_components/love-button";
import {
  getRecentTracks,
  LastFmApiError,
  type RecentTracksResponse,
} from "@/lib/lastfm";
import { canResubmit, libraryTrackUrl, nowUts } from "@/lib/scrobble-utils";
import { getSession } from "@/lib/session";

type ScrobblesPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function ScrobblesPage({ searchParams }: ScrobblesPageProps) {
  const session = await getSession();
  if (!session) redirect("/");

  const requestedPage = Number((await searchParams).page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  let recenttracks: RecentTracksResponse["recenttracks"] | null = null;
  let errorMessage: string | null = null;

  try {
    ({ recenttracks } = await getRecentTracks(session.name, page));
  } catch (error) {
    errorMessage =
      error instanceof LastFmApiError
        ? error.message
        : "Could not load your recent tracks.";
  }

  if (errorMessage || !recenttracks) {
    return (
      <ApiError
        title="Recent scrobbles"
        message={errorMessage ?? "Could not load your recent tracks."}
      />
    );
  }

  const totalPages = Number(recenttracks["@attr"].totalPages);
  const now = nowUts();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-foreground/60">{session.name}</p>
            <h1 className="text-3xl font-light">Recent scrobbles</h1>
          </div>
          <p className="text-sm text-foreground/60">
            {Number(recenttracks["@attr"].total).toLocaleString()} total
          </p>
        </header>

        <ol className="divide-y divide-border border-y border-border">
          {recenttracks.track.map((track, index) => {
            const nowPlaying = track["@attr"]?.nowplaying === "true";
            const timestamp = track.date ? Number(track.date.uts) : null;

            return (
              <li key={`${track.url}-${track.date?.uts ?? `now-${index}`}`} className="flex items-center gap-4 py-4">
                <span className="w-8 shrink-0 text-right text-sm text-foreground/40">
                  {(page - 1) * 50 + index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={track.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:text-lastfm-start"
                  >
                    {track.name}
                  </a>
                  <p className="truncate text-sm text-foreground/65">
                    {track.artist.name}
                    {track.album["#text"] ? ` · ${track.album["#text"]}` : ""}
                  </p>
                </div>
                <span className="hidden text-sm text-foreground/50 md:block">
                  {nowPlaying ? "Now playing" : track.date?.["#text"]}
                </span>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <LoveButton
                    artist={track.artist.name}
                    track={track.name}
                    initialLoved={track.loved === "1"}
                  />
                  {timestamp !== null && canResubmit(timestamp, now) ? (
                    <Link
                      href={`/scrobble?${new URLSearchParams({
                        artist: track.artist.name,
                        track: track.name,
                        album: track.album["#text"],
                        ts: String(timestamp),
                      })}`}
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
                      href={libraryTrackUrl(session.name, track.artist.name, track.name)}
                      target="_blank"
                      rel="noreferrer"
                      title="Last.fm only allows deleting scrobbles on its website"
                      className="text-foreground/60 hover:text-lastfm-start"
                    >
                      delete ↗
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <nav aria-label="Scrobble pages" className="mt-8 flex justify-between">
          {page > 1 ? (
            <Link href={`/scrobbles?page=${page - 1}`} className="hover:text-lastfm-start">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages && (
            <Link href={`/scrobbles?page=${page + 1}`} className="hover:text-lastfm-start">
              Next →
            </Link>
          )}
        </nav>
    </main>
  );
}
