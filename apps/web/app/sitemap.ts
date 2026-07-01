import type { MetadataRoute } from "next";
import { CURRENT_LEGAL_VERSIONS } from "@saegim/domain";
import { fetchPublicSeoIndex } from "../src/lib/public-api";
import { absoluteUrl, publicEditorialPath, publicPostPath, publicProfilePath } from "../src/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const legalEntries = [
    {
      url: absoluteUrl("/about"),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7
    },
    {
      url: absoluteUrl("/terms"),
      lastModified: new Date(CURRENT_LEGAL_VERSIONS.terms),
      changeFrequency: "monthly" as const,
      priority: 0.32
    },
    {
      url: absoluteUrl("/privacy"),
      lastModified: new Date(CURRENT_LEGAL_VERSIONS.privacy),
      changeFrequency: "monthly" as const,
      priority: 0.32
    }
  ];
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
      ...legalEntries,
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
    return [rootEntry, ...legalEntries];
  }
}
