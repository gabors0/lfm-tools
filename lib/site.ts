export const siteName = "Last.fm Toolbox";
export const siteDescription =
  "Free Last.fm tools: scrobble tracks and albums manually, browse and sort your scrobble history, find duplicate scrobbles, export your history, and clear or restore loved tracks.";

// Set NEXT_PUBLIC_SITE_URL to the production origin. On Vercel the production
// domain is picked up automatically.
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);
