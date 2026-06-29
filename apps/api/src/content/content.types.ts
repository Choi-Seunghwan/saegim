import type { seedAccounts, seedPostBundles } from "./seed-data.js";

export type AccountProfile = (typeof seedAccounts)[number] & {
  viewerState?: {
    subscribed: boolean;
  };
};
export type PostBundle = (typeof seedPostBundles)[number];
export type SentenceCard = PostBundle["cards"][number];
export type CardComposition = SentenceCard["comp"];
export type ContentSource = SentenceCard["source"];

export interface CreatePostInput {
  title?: string;
  visibility?: PostBundle["post"]["visibility"];
  creationType?: PostBundle["post"]["creationType"];
  cards: Array<{
    text: string;
    comp?: Partial<CardComposition>;
    source?: Partial<ContentSource>;
    tags?: string[];
  }>;
}

export interface UpdateAccountInput {
  displayName?: string;
  tagline?: string;
  bio?: string | null;
  photoUrl?: string | null;
}
