import { Controller, Get } from "@nestjs/common";
import { ContentService } from "../content.service.js";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly contentService: ContentService) {}

  @Get("recommended")
  getRecommendedAccounts() {
    return this.contentService.getRecommendedAccounts();
  }
}
