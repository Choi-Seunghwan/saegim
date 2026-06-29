import { Injectable, OnModuleInit } from "@nestjs/common";
import { ContentRepository } from "./content.repository.js";
import type { CreatePostInput } from "./content.types.js";

@Injectable()
export class ContentService implements OnModuleInit {
  constructor(private readonly contentRepository: ContentRepository) {}

  async onModuleInit() {
    await this.contentRepository.ensureSeedData();
  }

  getFeed() {
    return this.contentRepository.getFeed();
  }

  getShelf() {
    return this.contentRepository.getShelf();
  }

  getPost(postId: string) {
    return this.contentRepository.getPost(postId);
  }

  likePost(postId: string) {
    return this.contentRepository.likePost(postId);
  }

  unlikePost(postId: string) {
    return this.contentRepository.unlikePost(postId);
  }

  carvePost(postId: string) {
    return this.contentRepository.carvePost(postId);
  }

  uncarvePost(postId: string) {
    return this.contentRepository.uncarvePost(postId);
  }

  createPost(input: CreatePostInput) {
    return this.contentRepository.createPost(input);
  }

  getRecommendedAccounts() {
    return this.contentRepository.getRecommendedAccounts();
  }
}
