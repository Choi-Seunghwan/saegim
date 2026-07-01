import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CurrentAccountService } from "../auth/current-account.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { seedAccounts, seedEditorialPages, seedPostBundles } from "./seed-data.js";
import type {
  AccountProfile,
  CardBackgroundImage,
  CardComposition,
  ContentSource,
  CreateCommentInput,
  CreatePostInput,
  EditorialPage,
  EditorialPageKind,
  ListPage,
  PostComment,
  PostBundle,
  SearchResult,
  AccountDetail,
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
const unauthenticatedViewerId = "__saegim_guest__";

function viewerAccountId(accountId?: string | null) {
  return accountId ?? unauthenticatedViewerId;
}

function accountIncludeForViewer(accountId?: string | null) {
  return Prisma.validator<Prisma.AccountInclude>()({
    _count: {
      select: {
        posts: true,
        followerRelations: true
      }
    },
    followerRelations: {
      where: {
        followerId: viewerAccountId(accountId)
      },
      select: {
        id: true
      }
    }
  });
}
function postIncludeForAccount(accountId?: string | null) {
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
        accountId: viewerAccountId(accountId)
      },
      select: {
        id: true
      }
    },
    carves: {
      where: {
        accountId: viewerAccountId(accountId)
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
type EditorialPageRecord = Prisma.EditorialPageGetPayload<{}>;

const sourceKinds: ContentSource["kind"][] = ["book", "web", "direct", "publisher"];
const editorialPageKinds: EditorialPageKind[] = ["notice", "event", "ad"];
const defaultCardComp: CardComposition = {
  bg: "linear-gradient(150deg,#F4F1F3,#E7E5EA 55%,#D8DAE4)",
  dim: 0,
  textColor: "#38323F",
  size: 30,
  weight: 700,
  align: "center",
  font: "gothic",
  textPos: null,
  sourcePos: null,
  bgImage: null
};
const defaultPageLimit = 8;
const defaultAccountPageLimit = 12;
const maxPageLimit = 24;
const maxCardsPerPost = 10;
const maxProfilePhotoValueLength = 240_000;
const legacyDefaultTagline = "한 줄을 곁에 두는 사람";

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type PageQueryOptions = {
  cursor?: string | undefined;
  limit?: string | number | undefined;
};
type SearchQueryOptions = {
  accountCursor?: string | undefined;
  postCursor?: string | undefined;
  accountLimit?: string | number | undefined;
  postLimit?: string | number | undefined;
};
type PageParams = {
  cursor?: string;
  limit: number;
};
type ShelfSortMode = "popular" | "latest";

@Injectable()
export class ContentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentAccountService: CurrentAccountService
  ) {}

  async ensureSeedData() {
    await this.removeLegacyDevelopmentAccount();

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

    for (const page of seedEditorialPages) {
      await this.prisma.editorialPage.upsert({
        where: { id: page.id },
        update: {
          kind: this.toDbEditorialPageKind(page.kind),
          label: page.label,
          title: page.title,
          summary: page.summary,
          body: page.body,
          ctaLabel: page.cta?.label ?? null,
          ctaAction: page.cta ? this.toDbEditorialCtaAction(page.cta.action) : null,
          publishedAt: new Date(page.publishedAt),
          isActive: true
        },
        create: {
          id: page.id,
          kind: this.toDbEditorialPageKind(page.kind),
          label: page.label,
          title: page.title,
          summary: page.summary,
          body: page.body,
          ctaLabel: page.cta?.label ?? null,
          ctaAction: page.cta ? this.toDbEditorialCtaAction(page.cta.action) : null,
          publishedAt: new Date(page.publishedAt),
          isActive: true
        }
      });
    }
  }

  private async removeLegacyDevelopmentAccount() {
    await this.prisma.account.deleteMany({
      where: {
        id: "acct-me",
        email: null
      }
    });
  }

  async getFeed(options?: PageQueryOptions, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getOptionalCurrentAccountId(cookieHeader);

    return this.findPostsPage(
      [
        { author: { verification: "desc" } },
        { likeCountCache: "desc" },
        { commentCountCache: "desc" },
        { publishedAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" }
      ],
      currentAccountId,
      options
    );
  }

  async getShelf(sort?: string, options?: PageQueryOptions, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getOptionalCurrentAccountId(cookieHeader);
    const sortMode = this.normalizeShelfSort(sort);
    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      sortMode === "latest"
        ? [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
        : [{ likeCountCache: "desc" }, { commentCountCache: "desc" }, { publishedAt: "desc" }, { id: "desc" }];

    return this.findPostsPage(orderBy, currentAccountId, options);
  }

  async getDrawer(options?: PageQueryOptions, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
    const page = this.normalizePageOptions(options);
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {})
    });

    return this.toRelationPostPage(carves, page.limit);
  }

  async getEditorialPages(kind?: string) {
    const pageKind = this.normalizeEditorialPageKind(kind);
    const pages = await this.prisma.editorialPage.findMany({
      where: {
        isActive: true,
        ...(pageKind ? { kind: this.toDbEditorialPageKind(pageKind) } : {})
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
    });

    return {
      items: pages.map((page) => this.toEditorialPage(page))
    };
  }

  async getEditorialPage(pageId: string) {
    const page = await this.prisma.editorialPage.findFirst({
      where: {
        id: pageId,
        isActive: true
      }
    });

    if (!page) {
      throw new NotFoundException("소식을 찾을 수 없어요.");
    }

    return {
      item: this.toEditorialPage(page)
    };
  }

  async search(
    query: string | undefined,
    options?: SearchQueryOptions,
    cookieHeader?: string
  ): Promise<SearchResult> {
    const currentAccountId = this.currentAccountService.getOptionalCurrentAccountId(cookieHeader);
    const normalizedQuery = typeof query === "string" ? query.trim() : "";
    const accountIncludeWithViewer = accountIncludeForViewer(currentAccountId);
    const postInclude = postIncludeForAccount(currentAccountId);
    const accountExclusion = currentAccountId ? { id: { not: currentAccountId } } : {};
    const accountPage = this.normalizePageOptions(
      { cursor: options?.accountCursor, limit: options?.accountLimit },
      defaultPageLimit
    );
    const postPage = this.normalizePageOptions(
      { cursor: options?.postCursor, limit: options?.postLimit },
      defaultPageLimit
    );
    const accountOrderBy: Prisma.AccountOrderByWithRelationInput[] = [
      { verification: "desc" },
      { posts: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "desc" }
    ];

    if (!normalizedQuery) {
      const [accounts, posts] = await Promise.all([
        this.prisma.account.findMany({
          where: accountExclusion,
          include: accountIncludeWithViewer,
          orderBy: accountOrderBy,
          take: accountPage.limit + 1,
          ...(accountPage.cursor ? { cursor: { id: accountPage.cursor }, skip: 1 } : {})
        }),
        this.prisma.post.findMany({
          where: {
            visibility: "PUBLIC"
          },
          include: postInclude,
          orderBy: [{ likeCountCache: "desc" }, { commentCountCache: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
          take: postPage.limit + 1,
          ...(postPage.cursor ? { cursor: { id: postPage.cursor }, skip: 1 } : {})
        })
      ]);
      const accountResult = this.toAccountPage(accounts, accountPage.limit);
      const postResult = this.toPostPage(posts, postPage.limit);

      return {
        accounts: accountResult.items,
        posts: postResult.items,
        accountPageInfo: accountResult.pageInfo,
        postPageInfo: postResult.pageInfo
      };
    }

    const [accounts, posts] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          ...accountExclusion,
          OR: [
            { handle: { contains: normalizedQuery, mode: "insensitive" } },
            { displayName: { contains: normalizedQuery, mode: "insensitive" } },
            { tagline: { contains: normalizedQuery, mode: "insensitive" } },
            { bio: { contains: normalizedQuery, mode: "insensitive" } }
          ]
        },
        include: accountIncludeWithViewer,
        orderBy: accountOrderBy,
        take: accountPage.limit + 1,
        ...(accountPage.cursor ? { cursor: { id: accountPage.cursor }, skip: 1 } : {})
      }),
      this.prisma.post.findMany({
        where: {
          visibility: "PUBLIC",
          OR: [
            { title: { contains: normalizedQuery, mode: "insensitive" } },
            {
              cards: {
                some: {
                  text: { contains: normalizedQuery, mode: "insensitive" }
                }
              }
            }
          ]
        },
        include: postInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: postPage.limit + 1,
        ...(postPage.cursor ? { cursor: { id: postPage.cursor }, skip: 1 } : {})
      })
    ]);
    const accountResult = this.toAccountPage(accounts, accountPage.limit);
    const postResult = this.toPostPage(posts, postPage.limit);

    return {
      accounts: accountResult.items,
      posts: postResult.items,
      accountPageInfo: accountResult.pageInfo,
      postPageInfo: postResult.pageInfo
    };
  }

  async getPost(postId: string, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getOptionalCurrentAccountId(cookieHeader);
    const post = await this.findPostById(postId, currentAccountId);
    return this.toPostBundle(post);
  }

  async createPost(input: CreatePostInput, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
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

    return this.getPost(post.id, cookieHeader);
  }

  async likePost(postId: string, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
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

    return this.getPost(postId, cookieHeader);
  }

  async unlikePost(postId: string, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
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

    return this.getPost(postId, cookieHeader);
  }

  async carvePost(postId: string, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
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

    return this.getPost(postId, cookieHeader);
  }

  async uncarvePost(postId: string, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
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

    return this.getPost(postId, cookieHeader);
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

  async createComment(postId: string, input: CreateCommentInput, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
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
      post: await this.getPost(postId, cookieHeader)
    };
  }

  async getCurrentAccount(cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
    const account = await this.getCurrentAuthor(currentAccountId);

    return {
      item: this.toAccountProfile(account)
    };
  }

  async getAccountDetail(accountId: string, cookieHeader?: string): Promise<AccountDetail> {
    const currentAccountId = this.currentAccountService.getOptionalCurrentAccountId(cookieHeader);
    const page = this.normalizePageOptions(undefined);
    const [account, posts] = await Promise.all([
      this.prisma.account.findUnique({
        where: { id: accountId },
        include: accountIncludeForViewer(currentAccountId)
      }),
      this.prisma.post.findMany({
        where: {
          authorId: accountId,
          visibility: "PUBLIC"
        },
        include: postIncludeForAccount(currentAccountId),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: page.limit + 1
      })
    ]);

    if (!account) {
      throw new NotFoundException("계정을 찾을 수 없어요.");
    }
    const postPage = this.toPostPage(posts, page.limit);

    return {
      account: this.toAccountProfile(account),
      posts: postPage.items,
      postPageInfo: postPage.pageInfo
    };
  }

  async getAccountPosts(accountId: string, options?: PageQueryOptions, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getOptionalCurrentAccountId(cookieHeader);
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true }
    });

    if (!account) {
      throw new NotFoundException("계정을 찾을 수 없어요.");
    }

    return this.findPostsPage(
      [{ createdAt: "desc" }, { id: "desc" }],
      currentAccountId,
      options,
      { authorId: accountId }
    );
  }

  async updateCurrentAccount(input: UpdateAccountInput, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
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

  async followAccount(accountId: string, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
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

  async unfollowAccount(accountId: string, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
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

  async getRecommendedAccounts(options?: PageQueryOptions, cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getOptionalCurrentAccountId(cookieHeader);
    const page = this.normalizePageOptions(options, defaultAccountPageLimit);
    const accounts = await this.prisma.account.findMany({
      where: currentAccountId ? { id: { not: currentAccountId } } : {},
      include: accountIncludeForViewer(currentAccountId),
      orderBy: [
        { verification: "desc" },
        { posts: { _count: "desc" } },
        { followerRelations: { _count: "desc" } },
        { createdAt: "desc" },
        { id: "desc" }
      ],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {})
    });

    return this.toAccountPage(accounts, page.limit);
  }

  async getFollowingAccounts(cookieHeader?: string) {
    const currentAccountId = this.currentAccountService.getCurrentAccountId(cookieHeader);
    const follows = await this.prisma.follow.findMany({
      where: {
        followerId: currentAccountId
      },
      include: {
        following: {
          include: accountIncludeForViewer(currentAccountId)
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    return {
      items: follows.map((follow) => this.toAccountProfile(follow.following))
    };
  }

  private async findPostsPage(
    orderBy: Prisma.PostOrderByWithRelationInput[],
    currentAccountId?: string | null,
    options?: PageQueryOptions,
    where: Prisma.PostWhereInput = {}
  ): Promise<ListPage<PostBundle>> {
    const page = this.normalizePageOptions(options);
    const posts = await this.prisma.post.findMany({
      where: {
        ...where,
        visibility: "PUBLIC"
      },
      include: postIncludeForAccount(currentAccountId),
      orderBy,
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {})
    });

    return this.toPostPage(posts, page.limit);
  }

  private normalizePageOptions(options?: PageQueryOptions, fallbackLimit = defaultPageLimit): PageParams {
    const parsedLimit = Number(options?.limit ?? fallbackLimit);
    const safeLimit = Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : fallbackLimit;
    const limit = Math.min(Math.max(safeLimit, 1), maxPageLimit);
    const cursor = typeof options?.cursor === "string" && options.cursor.trim() ? options.cursor.trim() : undefined;

    return {
      limit,
      ...(cursor ? { cursor } : {})
    };
  }

  private normalizeShelfSort(sort?: string): ShelfSortMode {
    return sort === "latest" ? "latest" : "popular";
  }

  private toPostPage(posts: PostWithRelations[], limit: number): ListPage<PostBundle> {
    const items = posts.slice(0, limit);

    return {
      items: items.map((post) => this.toPostBundle(post)),
      pageInfo: {
        hasNextPage: posts.length > limit,
        nextCursor: posts.length > limit ? (items.at(-1)?.id ?? null) : null,
        limit
      }
    };
  }

  private toAccountPage(accounts: AccountWithViewer[], limit: number): ListPage<AccountProfile> {
    const items = accounts.slice(0, limit);

    return {
      items: items.map((account) => this.toAccountProfile(account)),
      pageInfo: {
        hasNextPage: accounts.length > limit,
        nextCursor: accounts.length > limit ? (items.at(-1)?.id ?? null) : null,
        limit
      }
    };
  }

  private toRelationPostPage<T extends { id: string; post: PostWithRelations }>(
    relations: T[],
    limit: number
  ): ListPage<PostBundle> {
    const items = relations.slice(0, limit);

    return {
      items: items.map((relation) => this.toPostBundle(relation.post)),
      pageInfo: {
        hasNextPage: relations.length > limit,
        nextCursor: relations.length > limit ? (items.at(-1)?.id ?? null) : null,
        limit
      }
    };
  }

  private async findPostById(postId: string, currentAccountId?: string | null) {
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
    const subscribed = this.isSubscribedAccount(account);

    return {
      id: account.id,
      handle: account.handle,
      displayName: account.displayName,
      tagline: this.normalizeStoredTagline(account.tagline),
      verification: this.fromDbVerification(account.verification),
      postCount: account._count.posts,
      writingFriendCount: account._count.followerRelations,
      ...(account.photoUrl ? { photoUrl: account.photoUrl } : {}),
      ...(account.bio ? { bio: account.bio } : {}),
      ...(typeof subscribed === "boolean" ? { viewerState: { subscribed } } : {})
    };
  }

  private normalizeStoredTagline(tagline: string) {
    return tagline === legacyDefaultTagline ? "" : tagline;
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

  private toEditorialPage(page: EditorialPageRecord): EditorialPage {
    const ctaAction = page.ctaAction ? this.fromDbEditorialCtaAction(page.ctaAction) : null;

    return {
      id: page.id,
      kind: this.fromDbEditorialPageKind(page.kind),
      label: page.label,
      title: page.title,
      date: this.formatEditorialDate(page.publishedAt),
      summary: page.summary,
      body: page.body,
      ...(page.ctaLabel && ctaAction
        ? {
            cta: {
              label: page.ctaLabel,
              action: ctaAction
            }
          }
        : {})
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

    if (cards.length > maxCardsPerPost) {
      throw new BadRequestException(`한 글은 최대 ${maxCardsPerPost}장까지 발행할 수 있어요.`);
    }

    return cards;
  }

  private normalizeComposition(comp?: Partial<CardComposition>): CardComposition {
    return {
      ...defaultCardComp,
      ...comp,
      textPos: comp?.textPos ?? defaultCardComp.textPos ?? null,
      sourcePos: comp?.sourcePos ?? defaultCardComp.sourcePos ?? null,
      bgImage: this.normalizeBackgroundImage(comp?.bgImage)
    };
  }

  private normalizeBackgroundImage(image?: CardBackgroundImage | null): CardBackgroundImage | null {
    if (!image?.url?.trim()) {
      return null;
    }

    const naturalWidth = Number(image.naturalWidth);
    const naturalHeight = Number(image.naturalHeight);

    return {
      url: image.url.trim(),
      ...(image.objectKey?.trim() ? { objectKey: image.objectKey.trim() } : {}),
      ...(image.alt?.trim() ? { alt: image.alt.trim().slice(0, 100) } : {}),
      ...(Number.isFinite(naturalWidth) && naturalWidth > 0 ? { naturalWidth: Math.round(naturalWidth) } : {}),
      ...(Number.isFinite(naturalHeight) && naturalHeight > 0 ? { naturalHeight: Math.round(naturalHeight) } : {}),
      focalX: clampNumber(Number.isFinite(image.focalX) ? image.focalX : 50, 0, 100),
      focalY: clampNumber(Number.isFinite(image.focalY) ? image.focalY : 50, 0, 100),
      zoom: clampNumber(Number.isFinite(image.zoom) ? image.zoom : 1, 1, 2.5)
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
      data.photoUrl = this.normalizeText(input.photoUrl, "프로필 사진", maxProfilePhotoValueLength);
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

  private normalizeEditorialPageKind(value?: string): EditorialPageKind | undefined {
    const normalizedValue = value?.trim().toLowerCase();

    if (!normalizedValue) {
      return undefined;
    }

    if (!editorialPageKinds.includes(normalizedValue as EditorialPageKind)) {
      throw new BadRequestException("소식 종류가 올바르지 않아요.");
    }

    return normalizedValue as EditorialPageKind;
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

  private toDbEditorialPageKind(value: EditorialPageKind) {
    if (value === "event") return "EVENT";
    if (value === "ad") return "AD";
    return "NOTICE";
  }

  private fromDbEditorialPageKind(value: string): EditorialPageKind {
    if (value === "EVENT") return "event";
    if (value === "AD") return "ad";
    return "notice";
  }

  private toDbEditorialCtaAction(value: NonNullable<EditorialPage["cta"]>["action"]) {
    return value === "contact" ? "CONTACT" : "DISCOVER";
  }

  private fromDbEditorialCtaAction(value: string): NonNullable<EditorialPage["cta"]>["action"] {
    return value === "CONTACT" ? "contact" : "discover";
  }

  private formatEditorialDate(value: Date) {
    const year = value.getUTCFullYear();
    const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${value.getUTCDate()}`.padStart(2, "0");

    return `${year}.${month}.${day}`;
  }
}
