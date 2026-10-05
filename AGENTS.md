# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, and others) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

`next dev` rewrites only the block between the markers above, so edit around it, not inside it. Its point stands: this is Next.js 16, so check `node_modules/next/dist/docs/` before using a Next API.

## What this is

Last.fm Toolbox: an Open Scrobbler-style Next.js App Router app (Bun, React 19, Tailwind v4, no database). It logs in with Last.fm, scrobbles tracks/albums, and adds tools Last.fm lacks: sortable history, love/unlove, clear all loved tracks, restore loves from a backup, history export, and a duplicate-scrobble finder.

## Commands

- `bun dev` — dev server on http://localhost:3000 (Next allows only one dev server per project)
- `bun run build` / `bun run start`
- `bun run lint` — ESLint (`eslint-config-next`)
- `bunx tsc --noEmit` — type check. In a clean checkout run `bunx next typegen` first; `LayoutProps` and route types are generated into `.next/`.

There is no test suite. Verify with type check, lint, build, and by loading the pages.

Setup needs `.env.local` (copy `.env.example`): `LASTFM_API_KEY`, `LASTFM_API_SECRET`, `AUTH_COOKIE_SECRET` (≥ 32 chars). The Last.fm API account's callback URL is `http://localhost:3000/api/auth/lastfm/callback`. Use the same host when logging in (`localhost`, not `127.0.0.1`), or the login-started cookie is missing on return.

## Architecture

**Auth** (`app/api/auth/lastfm/*`, `lib/session.ts`): login redirects to Last.fm with a short-lived `lfm_auth_started` cookie. The callback exchanges the token via a signed `auth.getSession` call and stores `{name, key, subscriber}` AES-256-GCM-sealed in the HTTP-only `lfm_session` cookie for 30 days. Last.fm tokens are URL-safe base64 (not hex), and `subscriber` can arrive as a number; both are handled, so don't tighten those checks.

**`lib/lastfm.ts`** (server-only) is the single Last.fm client.
- `lastFmGet` retries transient errors (codes 8/11/16, HTTP errors without a body, network failures).
- `lastFmPost` signs writes with the session key and never retries.
- `parseLastFmResponse` reads the JSON before checking the HTTP status, because Last.fm sends error codes on 4xx responses.

Response quirks to keep in mind:
- A list with one item can come back as an object; normalize with `[x].flat()`.
- `user.getRecentTracks` puts "now playing" (an entry without `date`) at the top of *every* page.
- With `extended=1` the artist is `artist.name`, not `artist["#text"]`.
- `album.getInfo` durations are seconds.

**`lib/scrobble-utils.ts`** holds pure helpers, shared types and constants used by both server actions and client components. Keep it free of server-only imports.

**`app/actions.ts`** holds all Server Actions.
- Each one re-reads the session, validates its input, and returns `ActionResult` (`{ ok: true, ... } | { ok: false, error }`) instead of throwing.
- A `"use server"` file may only export async functions (types are fine), so constants belong in `scrobble-utils.ts`.
- A successful scrobble calls `refresh()` so the home list re-renders in the same round trip.

**Bulk operations and rate limits.** Last.fm allows roughly 5 requests/second, and Server Actions are dispatched one at a time from the client. Long jobs are therefore client-driven loops that call one action per batch, with stop/resume, a pause on rate-limit errors, and a `beforeunload` warning:
- `useLoveBatches` (`app/_components/love-batches.tsx`): love/unlove 20 tracks per call, ≥ 250 ms apart. Used by clear-all and restore.
- `useScrobbleHistory` (`app/_components/scrobble-history.tsx`): 4 pages × 200 scrobbles per call, ≥ 1 s per call, with a pinned `to` timestamp so new scrobbles don't shift pages. Used by export and duplicates. Rows are kept in a ref because histories can hold 100k+ rows.

**Home page (`app/page.tsx`)** shows the login screen when logged out. Logged in, it shows the scrobble form above the scrobble history.
- All state lives in search params: `mode=album`, `q`, `artist`/`track`/`album`/`ts` (the "edit" pre-fill), `page`, `sort=oldest`.
- `homeHref` builds links that keep the list's `page`/`sort`.
- `/scrobble` and `/scrobbles` redirect to `/` with their query (`next.config.ts`).
- Oldest-first pages are computed in `getScrobblePage` by fetching the newest-first pages that contain them, because Last.fm only pages newest-first.

**API limits that shape features:**
- Scrobbles can't be edited or deleted through the API. "Edit" re-scrobbles a corrected copy at the original timestamp, and delete/duplicate actions link to the user's Last.fm library page (`libraryTrackUrl`, optionally date-filtered).
- Scrobbles older than 14 days are rejected (`timestampProblem`, `canResubmit`).
- `track.love` can't set a date, so restore loves the oldest first.

**Client-only time values:** `<input type="datetime-local">` uses the browser's time zone, which the server can't know. `WhenPicker` therefore renders the input only on the client (`useSyncExternalStore`) to avoid hydration mismatches.

**Styling:**
- Theme tokens (`lastfm-start`/`lastfm-end` gradient, `border`, `surface`) live in `app/globals.css`, with a dark-mode variant.
- Shared class strings and `segment()` (joined toggle buttons) live in `app/_components/styles.ts`. Don't append conflicting padding utilities to them; add a variant instead (e.g. `smallPrimaryButton`).
- The full navbar shows from `lg`; below that, `MobileMenu` takes over.
