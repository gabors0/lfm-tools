import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DuplicateFinder } from "./duplicate-finder";

export default async function DuplicatesPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="text-sm text-foreground/60">{session.name}</p>
        <h1 className="text-3xl font-light">Duplicate scrobbles</h1>
      </header>
      <DuplicateFinder user={session.name} />
    </main>
  );
}
