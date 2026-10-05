# Last.fm Toolbox

A small Next.js app in the spirit of Open Scrobbler, plus a few tools Last.fm
itself does not offer.

## Features

The home page is the scrobbler, with your recent scrobbles underneath:

- **Scrobble a track**: artist, track, optional album and album artist, either
  "just now" or at a specific time within the last 14 days.
- **Scrobble an album**: search Last.fm, pick tracks from the tracklist, and
  scrobble them back to back so the last one ends when you finished listening.
- **Scrobble history**: newest or oldest first, with numbered pages. Love or
  unlove each scrobble, re-send it with fixes ("edit" fills the form above), or
  open it in your Last.fm library to delete it.
- **Loved tracks**: unlove single tracks, or **clear all loved tracks** in
  rate-limited batches. You can download a JSON backup first, and stop or resume
  at any time. **Restore** loves everything in a backup file again.
- **Export**: download your whole scrobble history as CSV or JSON, or a backup
  of your loved tracks.

Last.fm's API has no way to edit or delete scrobbles. "Edit" therefore sends a
corrected copy at the original time, and the original has to be deleted on the
Last.fm website. The app links straight to the right library page.

## First-time setup

1. Create a [Last.fm API account](https://www.last.fm/api/account/create).
2. In that API account, set the callback URL to:

   ```text
   http://localhost:3000/api/auth/lastfm/callback
   ```

   For a deployed app, replace the origin with your real HTTPS domain and update
   the callback in Last.fm too.

3. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Put your Last.fm **API key** and **shared secret** in `.env.local`. Generate
   the cookie-encryption secret with:

   ```bash
   openssl rand -base64 32
   ```

   Do not prefix these names with `NEXT_PUBLIC_`: all three values must stay on
   the server. `.env.local` is ignored by Git.

5. Start the app and open [http://localhost:3000](http://localhost:3000):

   ```bash
   bun dev
   ```

Click **Log in with Last.fm**, approve the app on Last.fm, and Last.fm will send
the browser back to the callback route.

## What the backend is doing

The login flow has three parts:

1. `GET /api/auth/lastfm/login` redirects the browser to Last.fm.
2. Last.fm redirects to `GET /api/auth/lastfm/callback?token=...` with a one-time
   token after the user approves access.
3. The callback signs an `auth.getSession` request with the shared secret,
   exchanges the token for a Last.fm session, encrypts it, and stores it in an
   HTTP-only cookie for 30 days.

The shared secret never leaves the server. The user's Last.fm password is only
entered on Last.fm and never passes through this app.

## Reading Last.fm data

The browser can use the local JSON endpoints after login:

```js
const response = await fetch("/api/lastfm/loved-tracks?page=1&limit=50");

if (!response.ok) {
  throw new Error("Could not load loved tracks");
}

const data = await response.json();
console.log(data.lovedtracks.track);
```

Available examples:

- `GET /api/lastfm/loved-tracks?page=1&limit=50`
- `GET /api/lastfm/recent-tracks?page=1&limit=50`

Server Components should skip the extra HTTP hop and call the helper directly:

```tsx
import { getLovedTracks } from "@/lib/lastfm";
import { getSession } from "@/lib/session";

export default async function MyPage() {
  const session = await getSession();
  if (!session) return <p>Please log in.</p>;

  const data = await getLovedTracks(session.name, 1, 50);
  return <pre>{JSON.stringify(data.lovedtracks.track, null, 2)}</pre>;
}
```

Many Last.fm read methods do not require a user session, but they still require
your API key. The session is useful here because it securely tells the app which
username was authenticated. Write methods such as `track.love`, `track.unlove`,
and `track.scrobble` additionally require the session key (`sk`) and an API
signature.

To add another read method, add a typed wrapper beside `getLovedTracks` in
`lib/lastfm.ts`, then call Last.fm with a method such as:

- `user.getTopTracks`
- `user.getTopArtists`
- `user.getTopAlbums`
- `user.getWeeklyTrackChart`

See the [Last.fm API method list](https://www.last.fm/api) for each method's
parameters and whether authentication is required.

## Important files

- `lib/lastfm.ts` — Last.fm requests, response types, and request signing
- `lib/session.ts` — encrypted cookie session handling
- `app/api/auth/lastfm/*` — login and callback routes
- `lib/scrobble-utils.ts` — shared, client-safe helpers (timestamps, limits, URLs)
- `app/actions.ts` — Server Actions for scrobbling, loving, and clearing loved tracks
- `app/api/lastfm/*` — JSON endpoints for browser-side code
- `app/page.tsx` — login screen, or the scrobbler and recent scrobbles
- `app/_components/*` — scrobble forms, album search, recent scrobbles list
- `app/loved/*` — loved tracks, clear-all, and restore from a backup
- `app/export/*` — scrobble history and loved tracks export
