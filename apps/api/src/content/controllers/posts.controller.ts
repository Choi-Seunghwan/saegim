import { Body, Controller, Get, Param, Post as HttpPost } from "@nestjs/common";
import type { CreatePostInput } from "../content.service.js";
import { ContentService } from "../content.service.js";

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

  @HttpPost("posts")
  createPost(@Body() input: CreatePostInput) {
    return this.contentService.createPost(input);
  }
}
