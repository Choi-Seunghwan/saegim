import { Injectable, OnModuleInit } from "@nestjs/common";
import { ContentRepository } from "./content.repository.js";
import type { CreatePostInput, UpdateAccountInput } from "./content.types.js";

@Injectable()
export class ContentService implements OnModuleInit {
  constructor(private readonly contentRepository: ContentRepository) {}

  async onModuleInit() {
    await this.contentRepository.ensureSeedData();
  }

  getFeed(accountIdHint?: string) {
    return this.contentRepository.getFeed(accountIdHint);
  }

  getShelf(accountIdHint?: string) {
    return this.contentRepository.getShelf(accountIdHint);
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

  createPost(input: CreatePostInput, accountIdHint?: string) {
    return this.contentRepository.createPost(input, accountIdHint);
  }

  getCurrentAccount(accountIdHint?: string) {
    return this.contentRepository.getCurrentAccount(accountIdHint);
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

  getRecommendedAccounts(accountIdHint?: string) {
    return this.contentRepository.getRecommendedAccounts(accountIdHint);
  }
}
