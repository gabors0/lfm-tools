import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything except the home page needs a Last.fm login.
      disallow: ["/api/", "/loved", "/duplicates", "/export"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
