import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CurrentAccountService } from "../auth/current-account.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { seedAccounts, seedPostBundles } from "./seed-data.js";
import type {
  AccountProfile,
  CardComposition,
  ContentSource,
  CreateCommentInput,
  CreatePostInput,
  PostComment,
  PostBundle,
  UpdateAccountInput
} from "./content.types.js";

const accountInclude = Prisma.validator<Prisma.AccountInclude>()({
  _count: {
    select: {
      posts: true,
      followerRelations: true
    }
  }
});
function accountIncludeForViewer(accountId: string) {
  return Prisma.validator<Prisma.AccountInclude>()({
    _count: {
      select: {
        posts: true,
        followerRelations: true
      }
    },
    followerRelations: {
      where: {
        followerId: accountId
      },
      select: {
        id: true
      }
    }
  });
}
function postIncludeForAccount(accountId: string) {
  return Prisma.validator<Prisma.PostInclude>()({
    author: {
      include: accountIncludeForViewer(accountId)
    },
    cards: {
      orderBy: {
        order: "asc"
      }
    },
    likes: {
      where: {
        accountId
      },
      select: {
        id: true
      }
    },
    carves: {
      where: {
        accountId
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
}
const commentInclude = Prisma.validator<Prisma.CommentInclude>()({
  author: {
    include: accountInclude
  }
});

type AccountWithCounts = Prisma.AccountGetPayload<{
  include: typeof accountInclude;
}>;
type AccountWithViewer = Prisma.AccountGetPayload<{
  include: ReturnType<typeof accountIncludeForViewer>;
}>;

type PostWithRelations = Prisma.PostGetPayload<{
  include: ReturnType<typeof postIncludeForAccount>;
}>;
type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentAccountService: CurrentAccountService
  ) {}

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

  async getFeed(accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    const posts = await this.findPosts([{ createdAt: "desc" }, { id: "desc" }], currentAccountId);

    return {
      items: posts.map((post) => this.toPostBundle(post))
    };
  }

  async getShelf(accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    const posts = await this.findPosts(
      [{ likeCountCache: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      currentAccountId
    );

    return {
      items: posts.map((post) => this.toPostBundle(post))
    };
  }

  async getDrawer(accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    const carves = await this.prisma.carve.findMany({
      where: {
        accountId: currentAccountId,
        post: {
          visibility: "PUBLIC"
        }
      },
      include: {
        post: {
          include: postIncludeForAccount(currentAccountId)
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    return {
      items: carves.map((carve) => this.toPostBundle(carve.post))
    };
  }

  async getPost(postId: string, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    const post = await this.findPostById(postId, currentAccountId);
    return this.toPostBundle(post);
  }

  async createPost(input: CreatePostInput, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    const cardsInput = this.normalizeCards(input);
    const author = await this.getCurrentAuthor(currentAccountId);
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

    return this.getPost(post.id, accountIdHint);
  }

  async likePost(postId: string, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
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

    return this.getPost(postId, accountIdHint);
  }

  async unlikePost(postId: string, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
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

    return this.getPost(postId, accountIdHint);
  }

  async carvePost(postId: string, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    const post = await this.findPostById(postId, currentAccountId);

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

    return this.getPost(postId, accountIdHint);
  }

  async uncarvePost(postId: string, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
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

    return this.getPost(postId, accountIdHint);
  }

  async getComments(postId: string) {
    await this.assertPostExists(postId);
    const comments = await this.prisma.comment.findMany({
      where: { postId },
      include: commentInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    return {
      items: comments.map((comment) => this.toPostComment(comment))
    };
  }

  async createComment(postId: string, input: CreateCommentInput, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    await this.assertPostExists(postId);
    await this.getCurrentAuthor(currentAccountId);
    const body = this.normalizeCommentBody(input);

    const comment = await this.prisma.$transaction(async (tx) => {
      const createdComment = await tx.comment.create({
        data: {
          postId,
          authorId: currentAccountId,
          body
        },
        include: commentInclude
      });

      await tx.post.update({
        where: { id: postId },
        data: {
          commentCountCache: {
            increment: 1
          }
        }
      });

      return createdComment;
    });

    return {
      item: this.toPostComment(comment),
      post: await this.getPost(postId, accountIdHint)
    };
  }

  async getCurrentAccount(accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    const account = await this.getCurrentAuthor(currentAccountId);

    return {
      item: this.toAccountProfile(account)
    };
  }

  async updateCurrentAccount(input: UpdateAccountInput, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    await this.getCurrentAuthor(currentAccountId);

    const account = await this.prisma.account.update({
      where: { id: currentAccountId },
      data: this.normalizeAccountUpdate(input),
      include: accountInclude
    });

    return {
      item: this.toAccountProfile(account)
    };
  }

  async followAccount(accountId: string, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    await this.assertFollowableAccount(accountId, currentAccountId);

    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: currentAccountId,
          followingId: accountId
        }
      },
      update: {},
      create: {
        followerId: currentAccountId,
        followingId: accountId
      }
    });

    return this.getAccountProfile(accountId, currentAccountId);
  }

  async unfollowAccount(accountId: string, accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    await this.assertFollowableAccount(accountId, currentAccountId);

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentAccountId,
          followingId: accountId
        }
      },
      select: { id: true }
    });

    if (existingFollow) {
      await this.prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId: currentAccountId,
            followingId: accountId
          }
        }
      });
    }

    return this.getAccountProfile(accountId, currentAccountId);
  }

  async getRecommendedAccounts(accountIdHint?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(accountIdHint);
    const accounts = await this.prisma.account.findMany({
      where: {
        id: {
          not: currentAccountId
        }
      },
      include: accountIncludeForViewer(currentAccountId),
      orderBy: [{ verification: "desc" }, { createdAt: "asc" }]
    });

    return {
      items: accounts.map((account) => this.toAccountProfile(account))
    };
  }

  private async findPosts(orderBy: Prisma.PostOrderByWithRelationInput[], currentAccountId: string) {
    return this.prisma.post.findMany({
      where: {
        visibility: "PUBLIC"
      },
      include: postIncludeForAccount(currentAccountId),
      orderBy
    });
  }

  private async findPostById(postId: string, currentAccountId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: postIncludeForAccount(currentAccountId)
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

  private async assertFollowableAccount(accountId: string, currentAccountId: string) {
    if (accountId === currentAccountId) {
      throw new BadRequestException("자기 자신은 구독할 수 없어요.");
    }

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true }
    });

    if (!account) {
      throw new NotFoundException("계정을 찾을 수 없어요.");
    }
  }

  private async getAccountProfile(accountId: string, currentAccountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: accountIncludeForViewer(currentAccountId)
    });

    if (!account) {
      throw new NotFoundException("계정을 찾을 수 없어요.");
    }

    return {
      item: this.toAccountProfile(account)
    };
  }

  private async getCurrentAuthor(currentAccountId: string) {
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
        subscribed: this.isSubscribedAccount(post.author) ?? false,
        likeCount: post.likeCountCache,
        commentCount: post.commentCountCache
      }
    };
  }

  private toAccountProfile(account: AccountWithCounts | AccountWithViewer): AccountProfile {
    const seedAccount = seedAccounts.find((item) => item.id === account.id);
    const subscribed = this.isSubscribedAccount(account);

    return {
      id: account.id,
      handle: account.handle,
      displayName: account.displayName,
      tagline: account.tagline,
      verification: this.fromDbVerification(account.verification),
      postCount: Math.max(seedAccount?.postCount ?? 0, account._count.posts),
      writingFriendCount: Math.max(seedAccount?.writingFriendCount ?? 0, account._count.followerRelations),
      ...(account.photoUrl ? { photoUrl: account.photoUrl } : {}),
      ...(account.bio ? { bio: account.bio } : {}),
      ...(typeof subscribed === "boolean" ? { viewerState: { subscribed } } : {})
    };
  }

  private isSubscribedAccount(account: AccountWithCounts | AccountWithViewer) {
    return "followerRelations" in account ? account.followerRelations.length > 0 : undefined;
  }

  private toPostComment(comment: CommentWithAuthor): PostComment {
    return {
      id: comment.id,
      postId: comment.postId,
      author: this.toAccountProfile(comment.author),
      body: comment.body,
      createdAt: comment.createdAt.toISOString()
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

  private normalizeAccountUpdate(input: UpdateAccountInput) {
    if (!input || typeof input !== "object") {
      throw new BadRequestException("수정할 프로필 값을 입력해 주세요.");
    }

    const data: Prisma.AccountUpdateInput = {};

    if (Object.hasOwn(input, "displayName")) {
      data.displayName = this.normalizeRequiredText(input.displayName, "닉네임", 24);
    }

    if (Object.hasOwn(input, "tagline")) {
      data.tagline = this.normalizeText(input.tagline, "한줄 소개글", 48) ?? "";
    }

    if (Object.hasOwn(input, "bio")) {
      data.bio = this.normalizeText(input.bio, "소개글", 240);
    }

    if (Object.hasOwn(input, "photoUrl")) {
      data.photoUrl = this.normalizeText(input.photoUrl, "프로필 사진", 2048);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("수정할 프로필 값을 입력해 주세요.");
    }

    return data;
  }

  private normalizeCommentBody(input: CreateCommentInput) {
    if (!input || typeof input !== "object") {
      throw new BadRequestException("댓글 내용을 입력해 주세요.");
    }

    const body = this.normalizeRequiredText(input.body, "댓글", 300);
    return body;
  }

  private normalizeRequiredText(value: unknown, label: string, maxLength: number) {
    const normalizedText = this.normalizeText(value, label, maxLength);
    if (!normalizedText) {
      throw new BadRequestException(`${label}을 입력해 주세요.`);
    }

    return normalizedText;
  }

  private normalizeText(value: unknown, label: string, maxLength: number) {
    if (value === null || typeof value === "undefined") {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException(`${label} 형식이 올바르지 않아요.`);
    }

    const normalizedText = value.trim();
    if (normalizedText.length > maxLength) {
      throw new BadRequestException(`${label}은 ${maxLength}자까지 입력할 수 있어요.`);
    }

    return normalizedText || null;
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
