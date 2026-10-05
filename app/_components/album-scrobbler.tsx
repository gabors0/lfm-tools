import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { AlbumPicker } from "@/app/_components/album-picker";
import { homeHref } from "@/app/_components/home-href";
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

type AlbumScrobblerProps = {
  query: string;
  artist?: string;
  album?: string;
  // Recent scrobbles page, kept in links so the history below stays put.
  page: number;
};

export function AlbumScrobbler({ query, artist, album, page }: AlbumScrobblerProps) {
  return artist && album ? (
    <AlbumDetails artist={artist} album={album} query={query} page={page} />
  ) : (
    <AlbumSearch query={query} page={page} />
  );
}

async function AlbumSearch({ query, page }: { query: string; page: number }) {
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
      <Form action="/" className="flex gap-2">
        <input type="hidden" name="mode" value="album" />
        {page > 1 && <input type="hidden" name="page" value={page} />}
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
                href={homeHref({
                  mode: "album",
                  artist: album.artist,
                  album: album.name,
                  q: query,
                  page: page > 1 ? page : null,
                })}
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
  page,
}: {
  artist: string;
  album: string;
  query: string;
  page: number;
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
        href={homeHref({ mode: "album", q: query, page: page > 1 ? page : null })}
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
              <h3 className="truncate text-2xl font-light">{info.name}</h3>
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
              <Link href="/" className="text-lastfm-start hover:underline">
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
