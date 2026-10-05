import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Scrobbling and recent scrobbles were merged into the home page. Query
    // strings (edit pre-fills, page numbers) are passed through.
    return [
      { source: "/scrobble", destination: "/", permanent: false },
      { source: "/scrobbles", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
