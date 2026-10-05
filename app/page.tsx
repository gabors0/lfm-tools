import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AlbumScrobbler } from "@/app/_components/album-scrobbler";
import { homeHref } from "@/app/_components/home-href";
import { ManualScrobbleForm } from "@/app/_components/manual-form";
import { RecentScrobbles } from "@/app/_components/recent-scrobbles";
import { primaryButton } from "@/app/_components/styles";
import { getSession } from "@/lib/session";

const authErrors: Record<string, string> = {
  config: "The Last.fm environment variables are missing or invalid.",
  invalid_callback: "Last.fm returned an invalid login token. Please try again.",
  missing_login_cookie:
    "The login cookie was missing. Use the same hostname as your Last.fm callback (for example, localhost rather than 127.0.0.1), then try again.",
  lastfm_4: "Last.fm rejected the login token. Please try again.",
  lastfm_10: "Last.fm rejected the API key. Check LASTFM_API_KEY.",
  lastfm_13: "Last.fm rejected the API signature. Check LASTFM_API_SECRET.",
  lastfm_14: "Last.fm says the login was not authorized. Please try again.",
  lastfm_15: "The Last.fm login token expired. Please try again.",
  lastfm_unknown: "Last.fm could not finish the login. Please try again.",
  server: "The server could not save the login. Check the terminal for details.",
};

type HomeSearchParams = {
  auth_error?: string;
  token?: string;
  // Scrobble form: "album" switches to album search.
  mode?: string;
  q?: string;
  // Pre-filled by "edit" on a recent scrobble, or the chosen album.
  artist?: string;
  track?: string;
  album?: string;
  albumArtist?: string;
  ts?: string;
  // Scrobble list: page number and "oldest" for oldest first.
  page?: string;
  sort?: string;
};

type HomeProps = {
  searchParams: Promise<HomeSearchParams>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  // Some existing Last.fm API accounts use the site root as their callback.
  // Forward that token into the dedicated handler so those accounts still work.
  if (params.token) {
    redirect(`/api/auth/lastfm/callback?token=${encodeURIComponent(params.token)}`);
  }

  const session = await getSession();
  if (!session) return <LogIn authError={params.auth_error} />;

  const page = positiveInteger(params.page) ?? 1;
  const albumMode = params.mode === "album";
  const initial = {
    artist: params.artist ?? "",
    track: params.track ?? "",
    album: params.album ?? "",
    albumArtist: params.albumArtist ?? "",
    timestamp: positiveInteger(params.ts),
  };
  const order = params.sort === "oldest" ? "oldest" : "newest";
  // Kept in the scrobble form's links so the list below stays where it is.
  const listParams = {
    page: page > 1 ? String(page) : null,
    sort: order === "oldest" ? "oldest" : null,
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-8 sm:gap-14 sm:px-6 sm:py-12">
      <section id="scrobble" aria-labelledby="scrobble-heading" className="scroll-mt-6">
        <header className="mb-6">
          <p className="text-sm text-foreground/60">{session.name}</p>
          <h1 id="scrobble-heading" className="text-3xl font-light">
            Scrobble
          </h1>
        </header>

        <nav
          aria-label="What to scrobble"
          className="mb-8 flex gap-6 border-b border-border"
        >
          <Tab href={homeHref(listParams)} active={!albumMode}>
            a track
          </Tab>
          <Tab href={homeHref({ mode: "album", ...listParams })} active={albumMode}>
            an album
          </Tab>
        </nav>

        {albumMode ? (
          <AlbumScrobbler
            query={params.q?.trim() ?? ""}
            artist={params.artist}
            album={params.album}
            keep={listParams}
          />
        ) : (
          <ManualScrobbleForm
            // Remount when an edit link pre-fills different values.
            key={JSON.stringify(initial)}
            user={session.name}
            initial={initial}
          />
        )}
      </section>

      <RecentScrobbles user={session.name} page={page} order={order} />
    </main>
  );
}

function LogIn({ authError }: { authError?: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <a href="/api/auth/lastfm/login" className={primaryButton}>
        <Image
          src="/lastfm-brands-solid-full.svg"
          width={30}
          height={30}
          alt="last.fm logo"
          className="brightness-0 invert"
        />
        log in with last.fm
      </a>
      {authError && (
        <p role="alert" className="max-w-xl text-center text-sm text-lastfm-start">
          {authErrors[authError] ?? authErrors.lastfm_unknown}
        </p>
      )}
    </main>
  );
}

function Tab({
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
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 pb-2 transition-colors ${
        active
          ? "border-lastfm-start"
          : "border-transparent text-foreground/60 hover:text-lastfm-start"
      }`}
    >
      {children}
    </Link>
  );
}

function positiveInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
