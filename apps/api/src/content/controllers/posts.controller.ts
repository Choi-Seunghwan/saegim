import { Controller, Get, Param } from "@nestjs/common";
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
}
