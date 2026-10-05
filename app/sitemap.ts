import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Only the home page is public; the tools all sit behind a Last.fm login.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL("/", siteUrl).toString(), changeFrequency: "monthly" }];
}
