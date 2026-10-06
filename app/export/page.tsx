import { redirect } from "next/navigation";
import { getLovedTracks, getRecentTracks } from "@/lib/lastfm";
import { getSession } from "@/lib/session";
import { ExportData } from "./export-data";

export default async function ExportPage() {
  const session = await getSession();
  if (!session) redirect("/");

  // Totals are only shown for context, so a failed lookup is not an error.
  const [scrobbles, loved] = await Promise.all([
    getRecentTracks(session.name, 1, 1)
      .then(({ recenttracks }) => Number(recenttracks["@attr"].total))
      .catch(() => null),
    getLovedTracks(session.name, 1, 1)
      .then(({ lovedtracks }) => Number(lovedtracks["@attr"].total))
      .catch(() => null),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="text-sm text-foreground/60">{session.name}</p>
        <h1 className="text-3xl font-light mt-2">Export</h1>
      </header>
      <ExportData
        user={session.name}
        scrobbleTotal={scrobbles}
        lovedTotal={loved}
      />
    </main>
  );
}
