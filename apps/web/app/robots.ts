import type { MetadataRoute } from "next";
import { absoluteUrl } from "../src/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/privacy", "/terms", "/p/", "/u/", "/editorial/"],
        disallow: ["/posts/", "/search", "/drawer", "/capture", "/me", "/settings"]
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
