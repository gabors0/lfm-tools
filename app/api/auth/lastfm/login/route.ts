import { NextResponse } from "next/server";
import { getLastFmApiKey } from "@/lib/lastfm";
import {
  AUTH_STARTED_COOKIE,
  authCookieOptions,
} from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const authorizationUrl = new URL("https://www.last.fm/api/auth/");
    authorizationUrl.searchParams.set("api_key", getLastFmApiKey());
    authorizationUrl.searchParams.set(
      "cb",
      new URL("/api/auth/lastfm/callback", request.url).toString(),
    );

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(AUTH_STARTED_COOKIE, "1", {
      ...authCookieOptions(),
      maxAge: 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("[lastfm auth] could not start login", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL("/?auth_error=config", request.url));
  }
}
