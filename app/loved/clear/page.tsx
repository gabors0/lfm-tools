import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ClearLovedTracks } from "./clear-loved-tracks";

export default async function ClearLovedPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/loved"
        className="text-sm text-foreground/60 transition-colors hover:text-lastfm-start"
      >
        ← loved tracks
      </Link>
      <header className="mb-8 mt-4">
        <p className="text-sm text-foreground/60">{session.name}</p>
        <h1 className="text-3xl font-light">Clear all loved tracks</h1>
      </header>
      <ClearLovedTracks user={session.name} />
    </main>
  );
}
