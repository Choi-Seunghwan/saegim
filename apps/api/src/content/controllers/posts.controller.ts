import { Body, Controller, Delete as HttpDelete, Get, Headers, Param, Post as HttpPost } from "@nestjs/common";
import { ContentService } from "../content.service.js";
import type { CreateCommentInput, CreatePostInput } from "../content.types.js";

@Controller()
export class PostsController {
  constructor(private readonly contentService: ContentService) {}

  @Get("feed")
  getFeed(@Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.getFeed(accountIdHint);
  }

  @Get("shelf")
  getShelf(@Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.getShelf(accountIdHint);
  }

  @Get("drawer")
  getDrawer(@Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.getDrawer(accountIdHint);
  }

  @Get("posts/:postId")
  getPost(@Param("postId") postId: string, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.getPost(postId, accountIdHint);
  }

  @HttpPost("posts/:postId/like")
  likePost(@Param("postId") postId: string, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.likePost(postId, accountIdHint);
  }

  @HttpDelete("posts/:postId/like")
  unlikePost(@Param("postId") postId: string, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.unlikePost(postId, accountIdHint);
  }

  @HttpPost("posts/:postId/carve")
  carvePost(@Param("postId") postId: string, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.carvePost(postId, accountIdHint);
  }

  @HttpDelete("posts/:postId/carve")
  uncarvePost(@Param("postId") postId: string, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.uncarvePost(postId, accountIdHint);
  }

  @Get("posts/:postId/comments")
  getComments(@Param("postId") postId: string) {
    return this.contentService.getComments(postId);
  }

  @HttpPost("posts/:postId/comments")
  createComment(
    @Param("postId") postId: string,
    @Body() input: CreateCommentInput,
    @Headers("x-saegim-account-id") accountIdHint?: string
  ) {
    return this.contentService.createComment(postId, input, accountIdHint);
  }

  @HttpPost("posts")
  createPost(@Body() input: CreatePostInput, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.createPost(input, accountIdHint);
  }
}
