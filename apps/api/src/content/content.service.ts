import { Injectable, OnModuleInit } from "@nestjs/common";
import { ContentRepository } from "./content.repository.js";
import type { CreateCommentInput, CreatePostInput, UpdateAccountInput, UpdatePostInput } from "./content.types.js";

function parseBooleanEnv(value: string | undefined) {
  if (!value) return undefined;

  const normalizedValue = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalizedValue)) return true;
  if (["0", "false", "no", "off"].includes(normalizedValue)) return false;

  return undefined;
}

function shouldSeedMvpData() {
  const nodeEnv = (process.env.NODE_ENV ?? "development").trim().toLowerCase();
  if (nodeEnv === "production") return false;

  const explicitSeedFlag = parseBooleanEnv(process.env.SAEGIM_MVP_SEED_ENABLED);
  if (explicitSeedFlag !== undefined) return explicitSeedFlag;

  return ["development", "test", "local"].includes(nodeEnv);
}

@Injectable()
export class ContentService implements OnModuleInit {
  constructor(private readonly contentRepository: ContentRepository) {}

  async onModuleInit() {
    await this.contentRepository.ensureStartupData({
      seedMvpData: shouldSeedMvpData()
    });
  }

  getFeed(options?: { cursor?: string | undefined; limit?: string | undefined }, accountIdHint?: string) {
    return this.contentRepository.getFeed(options, accountIdHint);
  }

  getHomePosts(
    options?: { cursor?: string | undefined; limit?: string | undefined; slot?: string | undefined },
    accountIdHint?: string
  ) {
    return this.contentRepository.getHomePosts(options, accountIdHint);
  }

  getShelf(sort?: string, options?: { cursor?: string | undefined; limit?: string | undefined }, accountIdHint?: string) {
    return this.contentRepository.getShelf(sort, options, accountIdHint);
  }

  getShelfEditorPick(accountIdHint?: string) {
    return this.contentRepository.getShelfEditorPick(accountIdHint);
  }

  getDrawer(options?: { cursor?: string | undefined; limit?: string | undefined }, accountIdHint?: string) {
    return this.contentRepository.getDrawer(options, accountIdHint);
  }

  getEditorialPages(kind?: string) {
    return this.contentRepository.getEditorialPages(kind);
  }

  getEditorialPage(pageId: string) {
    return this.contentRepository.getEditorialPage(pageId);
  }

  getPublicSeoIndex() {
    return this.contentRepository.getPublicSeoIndex();
  }

  search(
    query: string | undefined,
    options?: {
      accountCursor?: string | undefined;
      postCursor?: string | undefined;
      accountLimit?: string | undefined;
      postLimit?: string | undefined;
    },
    accountIdHint?: string
  ) {
    return this.contentRepository.search(query, options, accountIdHint);
  }

  getPost(postId: string, accountIdHint?: string) {
    return this.contentRepository.getPost(postId, accountIdHint);
  }

  likePost(postId: string, accountIdHint?: string) {
    return this.contentRepository.likePost(postId, accountIdHint);
  }

  unlikePost(postId: string, accountIdHint?: string) {
    return this.contentRepository.unlikePost(postId, accountIdHint);
  }

  carvePost(postId: string, accountIdHint?: string) {
    return this.contentRepository.carvePost(postId, accountIdHint);
  }

  uncarvePost(postId: string, accountIdHint?: string) {
    return this.contentRepository.uncarvePost(postId, accountIdHint);
  }

  getComments(postId: string) {
    return this.contentRepository.getComments(postId);
  }

  createComment(postId: string, input: CreateCommentInput, accountIdHint?: string) {
    return this.contentRepository.createComment(postId, input, accountIdHint);
  }

  createPost(input: CreatePostInput, accountIdHint?: string) {
    return this.contentRepository.createPost(input, accountIdHint);
  }

  updatePost(postId: string, input: UpdatePostInput, accountIdHint?: string) {
    return this.contentRepository.updatePost(postId, input, accountIdHint);
  }

  deletePost(postId: string, accountIdHint?: string) {
    return this.contentRepository.deletePost(postId, accountIdHint);
  }

  getCurrentAccount(accountIdHint?: string) {
    return this.contentRepository.getCurrentAccount(accountIdHint);
  }

  getAccountDetail(accountHandle: string, accountIdHint?: string) {
    return this.contentRepository.getAccountDetail(accountHandle, accountIdHint);
  }

  getAccountPosts(
    accountHandle: string,
    options?: { cursor?: string | undefined; limit?: string | undefined },
    accountIdHint?: string
  ) {
    return this.contentRepository.getAccountPosts(accountHandle, options, accountIdHint);
  }

  updateCurrentAccount(input: UpdateAccountInput, accountIdHint?: string) {
    return this.contentRepository.updateCurrentAccount(input, accountIdHint);
  }

  followAccount(accountId: string, accountIdHint?: string) {
    return this.contentRepository.followAccount(accountId, accountIdHint);
  }

  unfollowAccount(accountId: string, accountIdHint?: string) {
    return this.contentRepository.unfollowAccount(accountId, accountIdHint);
  }

  getRecommendedAccounts(options?: { cursor?: string | undefined; limit?: string | undefined }, accountIdHint?: string) {
    return this.contentRepository.getRecommendedAccounts(options, accountIdHint);
  }

  getFollowingAccounts(accountIdHint?: string) {
    return this.contentRepository.getFollowingAccounts(accountIdHint);
  }
}
