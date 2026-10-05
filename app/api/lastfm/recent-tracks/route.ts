import { NextRequest } from "next/server";
import { getRecentTracks, LastFmApiError } from "@/lib/lastfm";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return Response.json({ error: "Log in with Last.fm first." }, { status: 401 });
  }

  const page = positiveInteger(request.nextUrl.searchParams.get("page"), 1);
  const limit = Math.min(
    positiveInteger(request.nextUrl.searchParams.get("limit"), 50),
    200,
  );

  try {
    const data = await getRecentTracks(session.name, page, limit);
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof LastFmApiError
        ? error.message
        : "Could not load recent tracks.";
    return Response.json({ error: message }, { status: 502 });
  }
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
