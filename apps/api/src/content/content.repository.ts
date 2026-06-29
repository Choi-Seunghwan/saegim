import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { seedAccounts, seedPostBundles } from "./seed-data.js";
import type { AccountProfile, CardComposition, ContentSource, CreatePostInput, PostBundle } from "./content.types.js";

const currentAccountId = "acct-me";
const accountInclude = Prisma.validator<Prisma.AccountInclude>()({
  _count: {
    select: {
      posts: true,
      followerRelations: true
    }
  }
});
const postInclude = Prisma.validator<Prisma.PostInclude>()({
  author: {
    include: accountInclude
  },
  cards: {
    orderBy: {
      order: "asc"
    }
  },
  likes: {
    where: {
      accountId: currentAccountId
    },
    select: {
      id: true
    }
  },
  carves: {
    where: {
      accountId: currentAccountId
    },
    select: {
      id: true
    }
  },
  _count: {
    select: {
      comments: true
    }
  }
});

type AccountWithCounts = Prisma.AccountGetPayload<{
  include: typeof accountInclude;
}>;

type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

const sourceKinds: ContentSource["kind"][] = ["book", "web", "direct", "publisher"];
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
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSeedData() {
    for (const account of seedAccounts) {
      await this.prisma.account.upsert({
        where: { id: account.id },
        update: {
          displayName: account.displayName,
          tagline: account.tagline,
          verification: this.toDbVerification(account.verification),
          ...(account.bio ? { bio: account.bio } : {}),
          ...(account.photoUrl ? { photoUrl: account.photoUrl } : {})
        },
        create: {
          id: account.id,
          handle: account.handle,
          displayName: account.displayName,
          tagline: account.tagline,
          verification: this.toDbVerification(account.verification),
          ...(account.bio ? { bio: account.bio } : {}),
          ...(account.photoUrl ? { photoUrl: account.photoUrl } : {})
        }
      });
    }

    for (const bundle of seedPostBundles) {
      const existingPost = await this.prisma.post.findUnique({
        where: { id: bundle.post.id },
        select: { id: true }
      });

      if (existingPost) {
        continue;
      }

      await this.prisma.post.create({
        data: {
          id: bundle.post.id,
          title: bundle.post.title,
          authorId: bundle.post.authorId,
          visibility: this.toDbVisibility(bundle.post.visibility),
          creationType: this.toDbCreationType(bundle.post.creationType),
          likeCountCache: bundle.viewerState.likeCount,
          commentCountCache: bundle.viewerState.commentCount,
          publishedAt: new Date(bundle.post.createdAt),
          createdAt: new Date(bundle.post.createdAt),
          cards: {
            create: bundle.cards.map((card) => ({
              id: card.id,
              order: card.order,
              text: card.text,
              comp: card.comp as unknown as Prisma.InputJsonValue,
              sourceKind: this.toDbSourceKind(card.source.kind),
              ...(card.source.author ? { sourceAuthor: card.source.author } : {}),
              ...(card.source.work ? { sourceWork: card.source.work } : {}),
              ...(card.source.url ? { sourceUrl: card.source.url } : {}),
              tags: card.tags,
              embeddingStatus: this.toDbEmbeddingStatus(card.embeddingStatus),
              createdAt: new Date(card.createdAt)
            }))
          }
        }
      });
    }
  }

  async getFeed() {
    const posts = await this.findPosts([{ createdAt: "desc" }, { id: "desc" }]);

    return {
      items: posts.map((post) => this.toPostBundle(post))
    };
  }

  async getShelf() {
    const posts = await this.findPosts([{ likeCountCache: "desc" }, { createdAt: "desc" }, { id: "desc" }]);

    return {
      items: posts.map((post) => this.toPostBundle(post))
    };
  }

  async getPost(postId: string) {
    const post = await this.findPostById(postId);
    return this.toPostBundle(post);
  }

  async createPost(input: CreatePostInput) {
    const cardsInput = this.normalizeCards(input);
    const author = await this.getCurrentAuthor();
    const firstCard = cardsInput[0]!;
    const now = new Date();
    const title = input.title?.trim() || this.titleFromText(firstCard.text);

    const post = await this.prisma.post.create({
      data: {
        title,
        authorId: author.id,
        visibility: this.toDbVisibility(input.visibility ?? "public"),
        creationType: this.toDbCreationType(input.creationType ?? "original"),
        publishedAt: now,
        cards: {
          create: cardsInput.map((card, order) => {
            const source = this.normalizeSource(card.source);

            return {
              order,
              text: card.text,
              comp: this.normalizeComposition(card.comp) as unknown as Prisma.InputJsonValue,
              sourceKind: this.toDbSourceKind(source.kind),
              ...(source.author ? { sourceAuthor: source.author } : {}),
              ...(source.work ? { sourceWork: source.work } : {}),
              ...(source.url ? { sourceUrl: source.url } : {}),
              tags: this.normalizeTags(card.tags)
            };
          })
        }
      }
    });

    return this.getPost(post.id);
  }

  async likePost(postId: string) {
    await this.assertPostExists(postId);

    await this.prisma.$transaction(async (tx) => {
      const existingLike = await tx.like.findUnique({
        where: {
          accountId_postId: {
            accountId: currentAccountId,
            postId
          }
        },
        select: { id: true }
      });

      if (existingLike) {
        return;
      }

      await tx.like.create({
        data: {
          accountId: currentAccountId,
          postId
        }
      });
      await tx.post.update({
        where: { id: postId },
        data: {
          likeCountCache: {
            increment: 1
          }
        }
      });
    });

    return this.getPost(postId);
  }

  async unlikePost(postId: string) {
    await this.assertPostExists(postId);

    await this.prisma.$transaction(async (tx) => {
      const existingLike = await tx.like.findUnique({
        where: {
          accountId_postId: {
            accountId: currentAccountId,
            postId
          }
        },
        select: { id: true }
      });

      if (!existingLike) {
        return;
      }

      await tx.like.delete({
        where: {
          accountId_postId: {
            accountId: currentAccountId,
            postId
          }
        }
      });
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: { likeCountCache: true }
      });
      await tx.post.update({
        where: { id: postId },
        data: {
          likeCountCache: Math.max(0, (post?.likeCountCache ?? 0) - 1)
        }
      });
    });

    return this.getPost(postId);
  }

  async carvePost(postId: string) {
    const post = await this.findPostById(postId);

    await this.prisma.carve.upsert({
      where: {
        accountId_postId: {
          accountId: currentAccountId,
          postId
        }
      },
      update: {},
      create: {
        accountId: currentAccountId,
        postId,
        cardId: post.cards[0]?.id ?? null
      }
    });

    return this.getPost(postId);
  }

  async uncarvePost(postId: string) {
    await this.assertPostExists(postId);
    const existingCarve = await this.prisma.carve.findUnique({
      where: {
        accountId_postId: {
          accountId: currentAccountId,
          postId
        }
      },
      select: { id: true }
    });

    if (existingCarve) {
      await this.prisma.carve.delete({
        where: {
          accountId_postId: {
            accountId: currentAccountId,
            postId
          }
        }
      });
    }

    return this.getPost(postId);
  }

  async getRecommendedAccounts() {
    const accounts = await this.prisma.account.findMany({
      where: {
        id: {
          not: currentAccountId
        }
      },
      include: accountInclude,
      orderBy: [{ verification: "desc" }, { createdAt: "asc" }]
    });

    return {
      items: accounts.map((account) => this.toAccountProfile(account))
    };
  }

  private async findPosts(orderBy: Prisma.PostOrderByWithRelationInput[]) {
    return this.prisma.post.findMany({
      where: {
        visibility: "PUBLIC"
      },
      include: postInclude,
      orderBy
    });
  }

  private async findPostById(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: postInclude
    });

    if (!post) {
      throw new NotFoundException("글을 찾을 수 없어요.");
    }

    return post;
  }

  private async assertPostExists(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true }
    });

    if (!post) {
      throw new NotFoundException("글을 찾을 수 없어요.");
    }
  }

  private async getCurrentAuthor() {
    const account = await this.prisma.account.findUnique({
      where: { id: currentAccountId },
      include: accountInclude
    });

    if (!account) {
      throw new NotFoundException("현재 계정을 찾을 수 없어요.");
    }

    return account;
  }

  private toPostBundle(post: PostWithRelations): PostBundle {
    const firstCard = post.cards[0];
    if (!firstCard) {
      throw new NotFoundException("글에 장이 없어요.");
    }

    return {
      post: {
        id: post.id,
        title: post.title,
        authorId: post.authorId,
        coverCardId: firstCard.id,
        cardCount: post.cards.length,
        visibility: this.fromDbVisibility(post.visibility),
        creationType: this.fromDbCreationType(post.creationType),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString()
      },
      author: this.toAccountProfile(post.author),
      cards: post.cards.map((card) => ({
        id: card.id,
        postId: card.postId,
        order: card.order,
        text: card.text,
        comp: card.comp as unknown as CardComposition,
        source: this.toContentSource(card),
        tags: card.tags,
        embeddingStatus: this.fromDbEmbeddingStatus(card.embeddingStatus),
        createdAt: card.createdAt.toISOString()
      })),
      viewerState: {
        liked: post.likes.length > 0,
        carved: post.carves.length > 0,
        subscribed: false,
        likeCount: post.likeCountCache,
        commentCount: post.commentCountCache
      }
    };
  }

  private toAccountProfile(account: AccountWithCounts): AccountProfile {
    const seedAccount = seedAccounts.find((item) => item.id === account.id);

    return {
      id: account.id,
      handle: account.handle,
      displayName: account.displayName,
      tagline: account.tagline,
      verification: this.fromDbVerification(account.verification),
      postCount: Math.max(seedAccount?.postCount ?? 0, account._count.posts),
      writingFriendCount: Math.max(seedAccount?.writingFriendCount ?? 0, account._count.followerRelations),
      ...(account.photoUrl ? { photoUrl: account.photoUrl } : {}),
      ...(account.bio ? { bio: account.bio } : {})
    };
  }

  private toContentSource(card: PostWithRelations["cards"][number]): ContentSource {
    return {
      kind: this.fromDbSourceKind(card.sourceKind),
      ...(card.sourceAuthor ? { author: card.sourceAuthor } : {}),
      ...(card.sourceWork ? { work: card.sourceWork } : {}),
      ...(card.sourceUrl ? { url: card.sourceUrl } : {})
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

    return {
      kind,
      ...(source?.author?.trim() ? { author: source.author.trim() } : {}),
      ...(source?.work?.trim() ? { work: source.work.trim() } : {}),
      ...(source?.url?.trim() ? { url: source.url.trim() } : {})
    };
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

  private toDbVerification(value: AccountProfile["verification"]) {
    return value === "official" ? "OFFICIAL" : "NONE";
  }

  private fromDbVerification(value: string): AccountProfile["verification"] {
    return value === "OFFICIAL" ? "official" : "none";
  }

  private toDbVisibility(value: PostBundle["post"]["visibility"]) {
    return value === "private" ? "PRIVATE" : "PUBLIC";
  }

  private fromDbVisibility(value: string): PostBundle["post"]["visibility"] {
    return value === "PRIVATE" ? "private" : "public";
  }

  private toDbCreationType(value: PostBundle["post"]["creationType"]) {
    return value === "original" ? "ORIGINAL" : "CURATION";
  }

  private fromDbCreationType(value: string): PostBundle["post"]["creationType"] {
    return value === "ORIGINAL" ? "original" : "curation";
  }

  private toDbSourceKind(value: ContentSource["kind"]) {
    return value.toUpperCase() as "BOOK" | "WEB" | "DIRECT" | "PUBLISHER";
  }

  private fromDbSourceKind(value: string): ContentSource["kind"] {
    const sourceKind = value.toLowerCase() as ContentSource["kind"];
    return sourceKinds.includes(sourceKind) ? sourceKind : "direct";
  }

  private toDbEmbeddingStatus(value: PostBundle["cards"][number]["embeddingStatus"]) {
    return value.toUpperCase() as "PENDING" | "READY" | "SKIPPED";
  }

  private fromDbEmbeddingStatus(value: string): PostBundle["cards"][number]["embeddingStatus"] {
    if (value === "READY") return "ready";
    if (value === "SKIPPED") return "skipped";
    return "pending";
  }
}
