import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "last.fm tools",
  description: "description",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <nav className="relative z-10 flex h-16 items-center justify-between border-b-2 border-border after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-border/70 after:to-transparent">
          <div className="flex h-full items-center">
            <Link href="/" className="px-4 text-2xl font-light transition-colors hover:text-lastfm-start">
              last.fm toolbox
            </Link>
            {[
              ["loved tracks", "/loved"],
              ["scrobbles", "/scrobbles"],
              ["settings", "/settings"],
            ].map(([label, href]) => (
              <div key={href} className="flex h-full items-center">
                <span
                  aria-hidden="true"
                  className="h-full w-px -skew-x-12 bg-border"
                />
                <Link
                  href={href}
                  className="flex h-full items-center px-5 text-sm transition-colors hover:text-lastfm-start"
                >
                  {label}
                </Link>
              </div>
            ))}
          </div>
          <div className="flex h-full items-center">
            {[
              ["ko-fi", "https://ko-fi.com/gabors0"],
              ["github", "https://github.com/gabors0/lfm-tools"],
            ].map(([label, href], index) => (
              <div key={href} className="flex h-full items-center">
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="h-full w-px -skew-x-12 bg-border"
                  />
                )}
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-full items-center px-5 text-sm transition-colors hover:text-lastfm-start"
                >
                  {label}
                </a>
              </div>
            ))}
            <div className="flex h-full items-center">
              <span
                aria-hidden="true"
                className="h-full w-px -skew-x-12 bg-border"
              />
              <button
                type="button"
                className="flex h-full items-center px-5 text-sm transition-colors hover:text-lastfm-start"
              >
                logout
              </button>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
