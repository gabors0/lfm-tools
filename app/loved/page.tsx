import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiError } from "@/app/_components/api-error";
import { LoveButton } from "@/app/_components/love-button";
import { smallPrimaryButton } from "@/app/_components/styles";
import {
  getLovedTracks,
  LastFmApiError,
  type LovedTracksResponse,
} from "@/lib/lastfm";
import { getSession } from "@/lib/session";

type LovedPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function LovedPage({ searchParams }: LovedPageProps) {
  const session = await getSession();
  if (!session) redirect("/");

  const requestedPage = Number((await searchParams).page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  let lovedtracks: LovedTracksResponse["lovedtracks"] | null = null;
  let errorMessage: string | null = null;

  try {
    ({ lovedtracks } = await getLovedTracks(session.name, page));
  } catch (error) {
    errorMessage =
      error instanceof LastFmApiError
        ? error.message
        : "Could not load your loved tracks.";
  }

  if (errorMessage || !lovedtracks) {
    return (
      <ApiError
        title="Loved tracks"
        message={errorMessage ?? "Could not load your loved tracks."}
      />
    );
  }

  const totalPages = Number(lovedtracks["@attr"].totalPages);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-foreground/60">{session.name}</p>
            <h1 className="text-3xl font-light mt-2">Loved tracks</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <p className="text-foreground/60">
              {Number(lovedtracks["@attr"].total).toLocaleString()} total
            </p>
            <Link
              href="/loved/restore"
              className="rounded-sm border border-border px-3 py-1.5 transition-colors hover:border-lastfm-start hover:text-lastfm-start"
            >
              restore…
            </Link>
            {Number(lovedtracks["@attr"].total) > 0 && (
              <Link
                href="/loved/clear"
                className={smallPrimaryButton}
              >
                clear all…
              </Link>
            )}
          </div>
        </header>

        {lovedtracks.track.length ? (
          <ol className="divide-y divide-border border-y border-border">
            {lovedtracks.track.map((track, index) => (
              <li key={`${track.url}-${track.date.uts}`} className="flex items-center gap-3 py-4 sm:gap-4">
                <span className="hidden w-8 shrink-0 text-right text-sm text-foreground/40 sm:block">
                  {(page - 1) * 50 + index + 1}
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
                  </p>
                  <p className="mt-1 text-xs text-foreground/50 sm:hidden">
                    {track.date["#text"]}
                  </p>
                </div>
                <time
                  dateTime={new Date(Number(track.date.uts) * 1000).toISOString()}
                  className="hidden text-sm text-foreground/50 sm:block"
                >
                  {track.date["#text"]}
                </time>
                <LoveButton
                  artist={track.artist.name}
                  track={track.name}
                  initialLoved
                />
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-md border border-border bg-surface p-6">
            No loved tracks found.
          </p>
        )}

        <nav aria-label="Loved tracks pages" className="mt-8 flex justify-between">
          {page > 1 ? (
            <Link href={`/loved?page=${page - 1}`} className="hover:text-lastfm-start">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages && (
            <Link href={`/loved?page=${page + 1}`} className="hover:text-lastfm-start">
              Next →
            </Link>
          )}
        </nav>
    </main>
  );
}
