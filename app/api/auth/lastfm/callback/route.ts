import { NextRequest, NextResponse } from "next/server";
import { exchangeTokenForSession, LastFmApiError } from "@/lib/lastfm";
import {
  AUTH_STARTED_COOKIE,
  saveSession,
} from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const authWasStartedHere = request.cookies.has(AUTH_STARTED_COOKIE);

  // Last.fm tokens used to be hex but are now URL-safe base64 (A-Z, a-z, 0-9,
  // "-", "_"), so only sanity-check the shape and let Last.fm validate it.
  if (!token || !/^[\w-]{16,64}$/.test(token)) {
    console.error(
      `[lastfm auth callback] invalid token ${JSON.stringify({
        queryParameters: [...request.nextUrl.searchParams.keys()],
        tokenPresent: Boolean(token),
        tokenLength: token?.length ?? 0,
      })}`,
    );
    const response = NextResponse.redirect(
      new URL("/?auth_error=invalid_callback", request.url),
    );
    response.cookies.delete(AUTH_STARTED_COOKIE);
    return response;
  }

  if (!authWasStartedHere) {
    console.error("[lastfm auth callback] login cookie missing", {
      callbackOrigin: request.nextUrl.origin,
    });
    return NextResponse.redirect(
      new URL("/?auth_error=missing_login_cookie", request.url),
    );
  }

  try {
    const session = await exchangeTokenForSession(token);
    await saveSession(session);
    console.info("[lastfm auth callback] login completed");

    const response = NextResponse.redirect(new URL("/scrobble", request.url));
    response.cookies.delete(AUTH_STARTED_COOKIE);
    return response;
  } catch (error) {
    console.error("[lastfm auth callback] session exchange failed", {
      error: error instanceof Error ? error.message : String(error),
      code: error instanceof LastFmApiError ? error.code : undefined,
    });
    const errorCode =
      error instanceof LastFmApiError
        ? `lastfm_${error.code ?? "unknown"}`
        : "server";
    const response = NextResponse.redirect(
      new URL(`/?auth_error=${errorCode}`, request.url),
    );
    response.cookies.delete(AUTH_STARTED_COOKIE);
    return response;
  }
}
