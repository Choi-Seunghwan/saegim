import { Controller, Get, Param, Query } from "@nestjs/common";
import { ContentService } from "../content.service.js";

@Controller("editorial-pages")
export class EditorialPagesController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  getEditorialPages(@Query("kind") kind?: string) {
    return this.contentService.getEditorialPages(kind);
  }

  @Get(":pageId")
  getEditorialPage(@Param("pageId") pageId: string) {
    return this.contentService.getEditorialPage(pageId);
  }
}
