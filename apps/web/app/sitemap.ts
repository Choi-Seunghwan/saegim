import type { MetadataRoute } from "next";
import { fetchPublicSeoIndex } from "../src/lib/public-api";
import { absoluteUrl, publicEditorialPath, publicPostPath, publicProfilePath } from "../src/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rootEntry = {
    url: absoluteUrl("/"),
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 1
  };

  try {
    const index = await fetchPublicSeoIndex();

    return [
      rootEntry,
      ...index.posts.map((post) => ({
        url: absoluteUrl(publicPostPath(post.id)),
        lastModified: new Date(post.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.82
      })),
      ...index.accounts.map((account) => ({
        url: absoluteUrl(publicProfilePath(account.handle)),
        lastModified: new Date(account.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.72
      })),
      ...index.editorialPages.map((page) => ({
        url: absoluteUrl(publicEditorialPath(page.id)),
        lastModified: new Date(page.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.64
      }))
    ];
  } catch {
    return [rootEntry];
  }
}
