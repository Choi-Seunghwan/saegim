import { Body, Controller, Delete as HttpDelete, Get, Headers, Param, Post as HttpPost, Query } from "@nestjs/common";
import { ContentService } from "../content.service.js";
import type { CreateCommentInput, CreatePostInput } from "../content.types.js";

@Controller()
export class PostsController {
  constructor(private readonly contentService: ContentService) {}

  @Get("feed")
  getFeed(@Headers("cookie") cookieHeader?: string) {
    return this.contentService.getFeed(cookieHeader);
  }

  @Get("shelf")
  getShelf(@Headers("cookie") cookieHeader?: string) {
    return this.contentService.getShelf(cookieHeader);
  }

  @Get("drawer")
  getDrawer(@Headers("cookie") cookieHeader?: string) {
    return this.contentService.getDrawer(cookieHeader);
  }

  @Get("search")
  search(@Query("q") query?: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.search(query, cookieHeader);
  }

  @Get("posts/:postId")
  getPost(@Param("postId") postId: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.getPost(postId, cookieHeader);
  }

  @HttpPost("posts/:postId/like")
  likePost(@Param("postId") postId: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.likePost(postId, cookieHeader);
  }

  @HttpDelete("posts/:postId/like")
  unlikePost(@Param("postId") postId: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.unlikePost(postId, cookieHeader);
  }

  @HttpPost("posts/:postId/carve")
  carvePost(@Param("postId") postId: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.carvePost(postId, cookieHeader);
  }

  @HttpDelete("posts/:postId/carve")
  uncarvePost(@Param("postId") postId: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.uncarvePost(postId, cookieHeader);
  }

  @Get("posts/:postId/comments")
  getComments(@Param("postId") postId: string) {
    return this.contentService.getComments(postId);
  }

  @HttpPost("posts/:postId/comments")
  createComment(
    @Param("postId") postId: string,
    @Body() input: CreateCommentInput,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.createComment(postId, input, cookieHeader);
  }

  @HttpPost("posts")
  createPost(@Body() input: CreatePostInput, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.createPost(input, cookieHeader);
  }
}
