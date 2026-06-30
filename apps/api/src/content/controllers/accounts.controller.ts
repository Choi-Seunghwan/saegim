import { Body, Controller, Delete as HttpDelete, Get, Headers, Param, Patch, Post as HttpPost } from "@nestjs/common";
import { ContentService } from "../content.service.js";
import type { UpdateAccountInput } from "../content.types.js";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly contentService: ContentService) {}

  @Get("me")
  getCurrentAccount(@Headers("cookie") cookieHeader?: string) {
    return this.contentService.getCurrentAccount(cookieHeader);
  }

  @Patch("me")
  updateCurrentAccount(
    @Body() input: UpdateAccountInput,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.updateCurrentAccount(input, cookieHeader);
  }

  @Get("recommended")
  getRecommendedAccounts(@Headers("cookie") cookieHeader?: string) {
    return this.contentService.getRecommendedAccounts(cookieHeader);
  }

  @Get("following")
  getFollowingAccounts(@Headers("cookie") cookieHeader?: string) {
    return this.contentService.getFollowingAccounts(cookieHeader);
  }

  @Get(":accountId")
  getAccountDetail(@Param("accountId") accountId: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.getAccountDetail(accountId, cookieHeader);
  }

  @HttpPost(":accountId/follow")
  followAccount(@Param("accountId") accountId: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.followAccount(accountId, cookieHeader);
  }

  @HttpDelete(":accountId/follow")
  unfollowAccount(@Param("accountId") accountId: string, @Headers("cookie") cookieHeader?: string) {
    return this.contentService.unfollowAccount(accountId, cookieHeader);
  }
}
