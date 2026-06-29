import { Controller, Get, Headers } from "@nestjs/common";
import { ContentService } from "../content.service.js";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly contentService: ContentService) {}

  @Get("me")
  getCurrentAccount(@Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.getCurrentAccount(accountIdHint);
  }

  @Get("recommended")
  getRecommendedAccounts(@Headers("x-saegim-account-id") accountIdHint?: string) {
    return this.contentService.getRecommendedAccounts(accountIdHint);
  }
}
