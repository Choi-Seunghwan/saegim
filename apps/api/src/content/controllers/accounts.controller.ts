import { Body, Controller, Delete as HttpDelete, Get, Headers, Param, Patch, Post as HttpPost } from "@nestjs/common";
import { ContentService } from "../content.service.js";
import type { UpdateAccountInput } from "../content.types.js";

function accountContext(accountIdHint?: string, cookieHeader?: string) {
  return cookieHeader?.includes("saegim_session=") ? cookieHeader : accountIdHint?.trim() || cookieHeader;
}

@Controller("accounts")
export class AccountsController {
  constructor(private readonly contentService: ContentService) {}

  @Get("me")
  getCurrentAccount(
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.getCurrentAccount(accountContext(accountIdHint, cookieHeader));
  }

  @Patch("me")
  updateCurrentAccount(
    @Body() input: UpdateAccountInput,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.updateCurrentAccount(input, accountContext(accountIdHint, cookieHeader));
  }

  @Get("recommended")
  getRecommendedAccounts(
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.getRecommendedAccounts(accountContext(accountIdHint, cookieHeader));
  }

  @Get("following")
  getFollowingAccounts(
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.getFollowingAccounts(accountContext(accountIdHint, cookieHeader));
  }

  @Get(":accountId")
  getAccountDetail(
    @Param("accountId") accountId: string,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.getAccountDetail(accountId, accountContext(accountIdHint, cookieHeader));
  }

  @HttpPost(":accountId/follow")
  followAccount(
    @Param("accountId") accountId: string,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.followAccount(accountId, accountContext(accountIdHint, cookieHeader));
  }

  @HttpDelete(":accountId/follow")
  unfollowAccount(
    @Param("accountId") accountId: string,
    @Headers("x-saegim-account-id") accountIdHint?: string,
    @Headers("cookie") cookieHeader?: string
  ) {
    return this.contentService.unfollowAccount(accountId, accountContext(accountIdHint, cookieHeader));
  }
}
