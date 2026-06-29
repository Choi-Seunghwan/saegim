import { Body, Controller, Delete as HttpDelete, Get, Headers, Param, Patch, Post as HttpPost } from "@nestjs/common";
import { ContentService } from "../content.service.js";
import type { UpdateAccountInput } from "../content.types.js";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly contentService: ContentService) {}

  @Get("me")
  getCurrentAccount(@Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.getCurrentAccount(accountIdHint);
  }

  @Patch("me")
  updateCurrentAccount(@Body() input: UpdateAccountInput, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.updateCurrentAccount(input, accountIdHint);
  }

  @Get("recommended")
  getRecommendedAccounts(@Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.getRecommendedAccounts(accountIdHint);
  }

  @Get(":accountId")
  getAccountDetail(@Param("accountId") accountId: string, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.getAccountDetail(accountId, accountIdHint);
  }

  @HttpPost(":accountId/follow")
  followAccount(@Param("accountId") accountId: string, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.followAccount(accountId, accountIdHint);
  }

  @HttpDelete(":accountId/follow")
  unfollowAccount(@Param("accountId") accountId: string, @Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.unfollowAccount(accountId, accountIdHint);
  }
}
