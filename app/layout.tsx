import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions";
import { MobileMenu } from "@/app/_components/mobile-menu";
import { getSession } from "@/lib/session";
import "./globals.css";

const pages = [
  ["loved tracks", "/loved"],
  ["export", "/export"],
];
const externalLinks = [
  ["ko-fi", "https://ko-fi.com/gabors0"],
  ["github", "https://github.com/gabors0/lfm-tools"],
];

const navLink =
  "flex h-full items-center px-5 text-sm transition-colors hover:text-lastfm-start";
const menuLink =
  "px-4 py-3 text-left transition-colors hover:text-lastfm-start";

export const metadata: Metadata = {
  title: "Last.fm Toolbox",
  description:
    "Scrobble tracks and albums to Last.fm and manage your loved tracks.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <nav className="relative z-10 flex h-16 items-center justify-between border-b-2 border-border after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-border/70 after:to-transparent">
          <div className="flex h-full items-center">
            <Link
              href="/"
              className="whitespace-nowrap px-4 text-xl font-light transition-colors hover:text-lastfm-start sm:text-2xl"
            >
              last.fm toolbox
            </Link>
            {pages.map(([label, href]) => (
              <div key={href} className="hidden h-full items-center md:flex">
                <Separator />
                <Link href={href} className={navLink}>
                  {label}
                </Link>
              </div>
            ))}
          </div>

          <div className="hidden h-full items-center md:flex">
            {externalLinks.map(([label, href], index) => (
              <div key={href} className="flex h-full items-center">
                {index > 0 && <Separator />}
                <a href={href} target="_blank" rel="noreferrer" className={navLink}>
                  {label}
                </a>
              </div>
            ))}
            {session && (
              <div className="flex h-full items-center">
                <Separator />
                <form action={logout} className="h-full">
                  <button type="submit" className={navLink}>
                    logout {session.name}
                  </button>
                </form>
              </div>
            )}
          </div>

          <MobileMenu>
            {pages.map(([label, href]) => (
              <Link key={href} href={href} className={menuLink}>
                {label}
              </Link>
            ))}
            {externalLinks.map(([label, href]) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noreferrer"
                className={menuLink}
              >
                {label} ↗
              </a>
            ))}
            {session && (
              <form action={logout} className="contents">
                <button type="submit" className={menuLink}>
                  logout {session.name}
                </button>
              </form>
            )}
          </MobileMenu>
        </nav>
        {children}
      </body>
    </html>
  );
}

function Separator() {
  return <span aria-hidden="true" className="h-full w-px -skew-x-12 bg-border" />;
}
