import { Controller, Get } from "@nestjs/common";
import { ContentService } from "../content.service.js";

@Controller("seo")
export class SeoController {
  constructor(private readonly contentService: ContentService) {}

  @Get("public-index")
  getPublicSeoIndex() {
    return this.contentService.getPublicSeoIndex();
  }
}
