import { Body, Controller, Delete as HttpDelete, Get, Param, Post as HttpPost } from "@nestjs/common";
import { ContentService } from "../content.service.js";
import type { CreatePostInput } from "../content.types.js";

@Controller()
export class PostsController {
  constructor(private readonly contentService: ContentService) {}

  @Get("feed")
  getFeed() {
    return this.contentService.getFeed();
  }

  @Get("shelf")
  getShelf() {
    return this.contentService.getShelf();
  }

  @Get("posts/:postId")
  getPost(@Param("postId") postId: string) {
    return this.contentService.getPost(postId);
  }

  @HttpPost("posts/:postId/like")
  likePost(@Param("postId") postId: string) {
    return this.contentService.likePost(postId);
  }

  @HttpDelete("posts/:postId/like")
  unlikePost(@Param("postId") postId: string) {
    return this.contentService.unlikePost(postId);
  }

  @HttpPost("posts/:postId/carve")
  carvePost(@Param("postId") postId: string) {
    return this.contentService.carvePost(postId);
  }

  @HttpDelete("posts/:postId/carve")
  uncarvePost(@Param("postId") postId: string) {
    return this.contentService.uncarvePost(postId);
  }

  @HttpPost("posts")
  createPost(@Body() input: CreatePostInput) {
    return this.contentService.createPost(input);
  }
}
