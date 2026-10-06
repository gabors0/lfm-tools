import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { logout } from "@/app/actions";
import { MobileMenu } from "@/app/_components/mobile-menu";
import { getSession } from "@/lib/session";
import { siteDescription, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const rag = localFont({
  src: [
    { path: "./fonts/Rag-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Rag-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/Rag-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Rag-BoldItalic.woff2", weight: "700", style: "italic" },
    { path: "./fonts/Rag-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-rag",
});

const pages = [
  ["loved tracks", "/loved"],
  ["duplicates", "/duplicates"],
  ["export", "/export"],
];
const externalLinks = [
  ["ko-fi ↗", "https://ko-fi.com/gabors0"],
  ["github ↗", "https://github.com/gabors0/lfm-tools"],
];

const navLink =
  "flex h-full items-center px-5 text-sm transition-colors hover:text-lastfm-start";
const menuLink =
  "px-4 py-3 text-left transition-colors hover:text-lastfm-start";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: `${siteName}: scrobble, export and clean up your Last.fm`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    "last.fm",
    "lastfm",
    "scrobbler",
    "manual scrobble",
    "scrobble album",
    "duplicate scrobbles",
    "export last.fm history",
    "loved tracks",
  ],
  openGraph: {
    type: "website",
    siteName,
    title: `${siteName}: scrobble, export and clean up your Last.fm`,
    description: siteDescription,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName}: scrobble, export and clean up your Last.fm`,
    description: siteDescription,
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  return (
    <html lang="en" className={`${rag.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <nav className="relative z-10 flex h-16 items-center justify-between border-b-2 border-border after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-border/70 after:to-transparent max-lg:has-[#mobile-menu:not([hidden])]:after:hidden">
          <div className="flex h-full items-center">
            <Link
              href="/"
              className="whitespace-nowrap px-4 text-xl font-extralight transition-colors hover:text-lastfm-start sm:text-2xl"
            >
              last.fm toolbox
            </Link>
            {pages.map(([label, href]) => (
              <div key={href} className="hidden h-full items-center lg:flex">
                <Separator />
                <Link href={href} className={navLink}>
                  {label}
                </Link>
              </div>
            ))}
          </div>

          <div className="hidden h-full items-center lg:flex">
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
