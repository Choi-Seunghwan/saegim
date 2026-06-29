import { Body, Controller, Delete as HttpDelete, Get, Headers, Param, Post as HttpPost, Query } from "@nestjs/common";
import { ContentService } from "../content.service.js";
import type { CreateCommentInput, CreatePostInput } from "../content.types.js";

function accountContext(accountIdHint?: string, cookieHeader?: string) {
  return cookieHeader?.includes("saegim_session=") ? cookieHeader : accountIdHint?.trim() || cookieHeader;
}

@Controller()
export class PostsController {
  constructor(private readonly contentService: ContentService) {}

  @Get("feed")
  getFeed(@Headers("x-saegim-account-id") accountIdHint?: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.getFeed(accountContext(accountIdHint, cookieHeader));
  }

  @Get("shelf")
  getShelf(@Headers("x-saegim-account-id") accountIdHint?: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.getShelf(accountContext(accountIdHint, cookieHeader));
  }

  @Get("drawer")
  getDrawer(@Headers("x-saegim-account-id") accountIdHint?: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.getDrawer(accountContext(accountIdHint, cookieHeader));
  }

  @Get("search")
  search(
    @Query("q") query?: string,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.search(query, accountContext(accountIdHint, cookieHeader));
  }

  @Get("posts/:postId")
  getPost(
    @Param("postId") postId: string,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.getPost(postId, accountContext(accountIdHint, cookieHeader));
  }

  @HttpPost("posts/:postId/like")
  likePost(
    @Param("postId") postId: string,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.likePost(postId, accountContext(accountIdHint, cookieHeader));
  }

  @HttpDelete("posts/:postId/like")
  unlikePost(
    @Param("postId") postId: string,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.unlikePost(postId, accountContext(accountIdHint, cookieHeader));
  }

  @HttpPost("posts/:postId/carve")
  carvePost(
    @Param("postId") postId: string,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.carvePost(postId, accountContext(accountIdHint, cookieHeader));
  }

  @HttpDelete("posts/:postId/carve")
  uncarvePost(
    @Param("postId") postId: string,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.uncarvePost(postId, accountContext(accountIdHint, cookieHeader));
  }

  @Get("posts/:postId/comments")
  getComments(@Param("postId") postId: string) {
    return this.contentService.getComments(postId);
  }

  @HttpPost("posts/:postId/comments")
  createComment(
    @Param("postId") postId: string,
    @Body() input: CreateCommentInput,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.createComment(postId, input, accountContext(accountIdHint, cookieHeader));
  }

  @HttpPost("posts")
  createPost(
    @Body() input: CreatePostInput,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.createPost(input, accountContext(accountIdHint, cookieHeader));
  }
}
