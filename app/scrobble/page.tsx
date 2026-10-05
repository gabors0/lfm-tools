import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  alertBox,
  panel,
  primaryButton,
  textInput,
} from "@/app/_components/styles";
import {
  getAlbumInfo,
  LastFmApiError,
  searchAlbums,
  type AlbumInfo,
  type AlbumSearchResult,
  type LastFmImage,
} from "@/lib/lastfm";
import { getSession } from "@/lib/session";
import { AlbumPicker } from "./album-picker";
import { ManualScrobbleForm } from "./manual-form";

type ScrobblePageProps = {
  searchParams: Promise<{
    mode?: string;
    q?: string;
    artist?: string;
    track?: string;
    album?: string;
    albumArtist?: string;
    ts?: string;
  }>;
};

export default async function ScrobblePage({ searchParams }: ScrobblePageProps) {
  const session = await getSession();
  if (!session) redirect("/");

  const params = await searchParams;
  const albumMode = params.mode === "album";
  const requestedTimestamp = Number(params.ts);
  const initial = {
    artist: params.artist ?? "",
    track: params.track ?? "",
    album: params.album ?? "",
    albumArtist: params.albumArtist ?? "",
    timestamp:
      Number.isSafeInteger(requestedTimestamp) && requestedTimestamp > 0
        ? requestedTimestamp
        : null,
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <header className="mb-8">
        <p className="text-sm text-foreground/60">{session.name}</p>
        <h1 className="text-3xl font-light">Scrobble</h1>
      </header>

      <nav
        aria-label="What to scrobble"
        className="mb-8 flex gap-6 border-b border-border"
      >
        <Tab href="/scrobble" active={!albumMode}>
          a track
        </Tab>
        <Tab href="/scrobble?mode=album" active={albumMode}>
          an album
        </Tab>
      </nav>

      {albumMode ? (
        params.artist && params.album ? (
          <AlbumDetails
            artist={params.artist}
            album={params.album}
            query={params.q ?? ""}
          />
        ) : (
          <AlbumSearch query={params.q?.trim() ?? ""} />
        )
      ) : (
        <ManualScrobbleForm
          // Remount when an edit link pre-fills different values.
          key={JSON.stringify(initial)}
          user={session.name}
          initial={initial}
        />
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

async function AlbumSearch({ query }: { query: string }) {
  let albums: AlbumSearchResult[] = [];
  let errorMessage: string | null = null;

  if (query) {
    try {
      albums = (await searchAlbums(query)).filter(
        (album) => album.name && album.name !== "(null)",
      );
    } catch (error) {
      errorMessage =
        error instanceof LastFmApiError
          ? error.message
          : "Could not search Last.fm.";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Form action="/scrobble" className="flex gap-2">
        <input type="hidden" name="mode" value="album" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="album title"
          aria-label="Album title"
          required
          className={textInput}
        />
        <button type="submit" className={primaryButton}>
          search
        </button>
      </Form>

      {errorMessage && (
        <p role="alert" className={alertBox}>
          {errorMessage}
        </p>
      )}
      {query && !errorMessage && !albums.length && (
        <p className={panel}>No albums found for “{query}”.</p>
      )}

      {albums.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
          {albums.map((album) => (
            <li key={album.url}>
              <Link
                href={`/scrobble?${new URLSearchParams({
                  mode: "album",
                  artist: album.artist,
                  album: album.name,
                  q: query,
                })}`}
                className="group block"
              >
                <Cover image={album.image} />
                <p className="mt-2 truncate font-medium transition-colors group-hover:text-lastfm-start">
                  {album.name}
                </p>
                <p className="truncate text-sm text-foreground/65">
                  {album.artist}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function AlbumDetails({
  artist,
  album,
  query,
}: {
  artist: string;
  album: string;
  query: string;
}) {
  let info: AlbumInfo | null = null;
  let errorMessage: string | null = null;

  try {
    info = await getAlbumInfo(artist, album);
  } catch (error) {
    errorMessage =
      error instanceof LastFmApiError
        ? error.message
        : "Could not load this album.";
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/scrobble?${new URLSearchParams({ mode: "album", q: query })}`}
        className="text-sm text-foreground/60 transition-colors hover:text-lastfm-start"
      >
        ← back to search
      </Link>

      {errorMessage || !info ? (
        <p role="alert" className={alertBox}>
          {errorMessage ?? "Could not load this album."}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="w-24 shrink-0">
              <Cover image={info.image} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-light">{info.name}</h2>
              <p className="truncate text-foreground/65">{info.artist}</p>
            </div>
          </div>
          {info.tracks.length ? (
            <AlbumPicker
              key={info.url}
              album={info.name}
              albumArtist={info.artist}
              tracks={info.tracks}
            />
          ) : (
            <p className={panel}>
              Last.fm has no tracklist for this album. Use the{" "}
              <Link href="/scrobble" className="text-lastfm-start hover:underline">
                track form
              </Link>{" "}
              instead.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Cover({ image }: { image: LastFmImage[] }) {
  const src =
    image.find(({ size }) => size === "extralarge")?.["#text"] ||
    image.at(-1)?.["#text"];

  if (!src) {
    return <div className="aspect-square w-full rounded-sm bg-surface" />;
  }

  return (
    <Image
      src={src}
      alt=""
      width={300}
      height={300}
      // Last.fm already serves small, cached JPEGs.
      unoptimized
      className="aspect-square w-full rounded-sm bg-surface object-cover"
    />
  );
}
