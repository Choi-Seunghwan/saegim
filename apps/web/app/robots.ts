import type { MetadataRoute } from "next";
import { absoluteUrl } from "../src/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/posts/", "/u/", "/editorial/"],
        disallow: ["/search", "/drawer", "/capture", "/me", "/settings"]
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
