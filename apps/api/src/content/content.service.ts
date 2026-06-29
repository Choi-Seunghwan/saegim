import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { seedAccounts, seedPostBundles } from "./seed-data.js";

type AccountProfile = (typeof seedAccounts)[number];
type PostBundle = (typeof seedPostBundles)[number];
type SentenceCard = PostBundle["cards"][number];
type CardComposition = SentenceCard["comp"];
type ContentSource = SentenceCard["source"];
type SourceKind = ContentSource["kind"];

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

const sourceKinds: SourceKind[] = ["book", "web", "direct", "publisher"];
const defaultCardComp: CardComposition = {
  bg: "linear-gradient(150deg,#F4F1F3,#E7E5EA 55%,#D8DAE4)",
  dim: 0,
  textColor: "#38323F",
  size: 30,
  weight: 700,
  align: "center",
  font: "gothic",
  textPos: null,
  sourcePos: null
};

@Injectable()
export class ContentService {
  private readonly postBundles: PostBundle[] = [...seedPostBundles];

  getFeed() {
    return {
      items: this.postBundles
    };
  }

  getShelf() {
    return {
      items: [...this.postBundles].sort((a, b) => {
        const bLikes = b.viewerState?.likeCount ?? 0;
        const aLikes = a.viewerState?.likeCount ?? 0;
        return bLikes - aLikes;
      })
    };
  }

  getPost(postId: string) {
    const post = this.postBundles.find((item) => item.post.id === postId);
    if (!post) {
      throw new NotFoundException("글을 찾을 수 없어요.");
    }

    return post;
  }

  likePost(postId: string) {
    const bundle = this.getPost(postId);
    if (!bundle.viewerState.liked) {
      bundle.viewerState.liked = true;
      bundle.viewerState.likeCount += 1;
    }

    return bundle;
  }

  unlikePost(postId: string) {
    const bundle = this.getPost(postId);
    if (bundle.viewerState.liked) {
      bundle.viewerState.liked = false;
      bundle.viewerState.likeCount = Math.max(0, bundle.viewerState.likeCount - 1);
    }

    return bundle;
  }

  carvePost(postId: string) {
    const bundle = this.getPost(postId);
    bundle.viewerState.carved = true;
    return bundle;
  }

  uncarvePost(postId: string) {
    const bundle = this.getPost(postId);
    bundle.viewerState.carved = false;
    return bundle;
  }

  createPost(input: CreatePostInput) {
    const cardsInput = this.normalizeCards(input);
    const now = new Date().toISOString();
    const postId = `post-${randomUUID()}`;
    const author = this.getCurrentAuthor();
    const cards = cardsInput.map((card, index): SentenceCard => {
      return {
        id: `card-${randomUUID()}`,
        postId,
        order: index,
        text: card.text,
        comp: this.normalizeComposition(card.comp),
        source: this.normalizeSource(card.source),
        tags: this.normalizeTags(card.tags),
        embeddingStatus: "pending",
        createdAt: now
      };
    });
    const firstCard = cards[0]!;
    const title = input.title?.trim() || this.titleFromText(firstCard.text);
    const bundle: PostBundle = {
      post: {
        id: postId,
        title,
        authorId: author.id,
        coverCardId: firstCard.id,
        cardCount: cards.length,
        visibility: input.visibility ?? "public",
        creationType: input.creationType ?? "original",
        createdAt: now,
        updatedAt: now
      },
      author: {
        ...author,
        postCount: author.postCount + this.postBundles.filter((item) => item.author.id === author.id).length + 1
      },
      cards,
      viewerState: {
        liked: false,
        carved: false,
        subscribed: false,
        likeCount: 0,
        commentCount: 0
      }
    };

    this.postBundles.unshift(bundle);
    return bundle;
  }

  getRecommendedAccounts() {
    return {
      items: seedAccounts.filter((account) => account.id !== "acct-me")
    };
  }

  private normalizeCards(input: CreatePostInput) {
    if (!input || !Array.isArray(input.cards) || input.cards.length === 0) {
      throw new BadRequestException("발행할 장을 1개 이상 넣어 주세요.");
    }

    const cards = input.cards
      .map((card) => ({
        ...card,
        text: typeof card.text === "string" ? card.text.trim() : ""
      }))
      .filter((card) => card.text.length > 0);

    if (cards.length === 0) {
      throw new BadRequestException("문장을 입력해 주세요.");
    }

    return cards;
  }

  private normalizeComposition(comp?: Partial<CardComposition>): CardComposition {
    return {
      ...defaultCardComp,
      ...comp,
      textPos: comp?.textPos ?? defaultCardComp.textPos ?? null,
      sourcePos: comp?.sourcePos ?? defaultCardComp.sourcePos ?? null
    };
  }

  private normalizeSource(source?: Partial<ContentSource>): ContentSource {
    const kind = source?.kind && sourceKinds.includes(source.kind) ? source.kind : "direct";
    const normalized: ContentSource = { kind };

    if (source?.author?.trim()) {
      normalized.author = source.author.trim();
    }

    if (source?.work?.trim()) {
      normalized.work = source.work.trim();
    }

    if (source?.url?.trim()) {
      normalized.url = source.url.trim();
    }

    return normalized;
  }

  private normalizeTags(tags?: string[]) {
    if (!Array.isArray(tags)) {
      return [];
    }

    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 3);
  }

  private titleFromText(text: string) {
    const firstLine = text.split(/\r?\n/)[0]?.trim() || "새로 새긴 글";
    return firstLine.length > 24 ? `${firstLine.slice(0, 24)}...` : firstLine;
  }

  private getCurrentAuthor(): AccountProfile {
    const account = seedAccounts.find((item) => item.id === "acct-me");
    if (!account) {
      throw new NotFoundException("현재 계정을 찾을 수 없어요.");
    }

    return account;
  }
}
