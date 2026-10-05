import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const authErrors: Record<string, string> = {
  config: "The Last.fm environment variables are missing or invalid.",
  invalid_callback: "Last.fm returned an invalid login token. Please try again.",
  missing_login_cookie:
    "The login cookie was missing. Use the same hostname as your Last.fm callback (for example, localhost rather than 127.0.0.1), then try again.",
  lastfm_4: "Last.fm rejected the login token. Please try again.",
  lastfm_10: "Last.fm rejected the API key. Check LASTFM_API_KEY.",
  lastfm_13: "Last.fm rejected the API signature. Check LASTFM_API_SECRET.",
  lastfm_14: "Last.fm says the login was not authorized. Please try again.",
  lastfm_15: "The Last.fm login token expired. Please try again.",
  lastfm_unknown: "Last.fm could not finish the login. Please try again.",
  server: "The server could not save the login. Check the terminal for details.",
};

type HomeProps = {
  searchParams: Promise<{ auth_error?: string; token?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { auth_error: authError, token } = await searchParams;

  // Some existing Last.fm API accounts use the site root as their callback.
  // Forward that token into the dedicated handler so those accounts still work.
  if (token) {
    redirect(`/api/auth/lastfm/callback?token=${encodeURIComponent(token)}`);
  }

  // Scrobbling is the main page once logged in.
  if (await getSession()) redirect("/scrobble");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <a
        href="/api/auth/lastfm/login"
        className="flex items-center gap-2 rounded-sm bg-linear-to-b from-lastfm-start to-lastfm-end px-5 py-2.5 font-medium text-white transition-[filter] hover:brightness-115 active:translate-y-px"
      >
        <Image
          src="/lastfm-brands-solid-full.svg"
          width={30}
          height={30}
          alt="last.fm logo"
          className="brightness-0 invert"
        />
        log in with last.fm
      </a>
      {authError && (
        <p role="alert" className="max-w-xl text-center text-sm text-lastfm-start">
          {authErrors[authError] ?? authErrors.lastfm_unknown}
        </p>
      )}
    </main>
  );
}
