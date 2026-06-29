import { Module } from "@nestjs/common";
import { AccountsController } from "./controllers/accounts.controller.js";
import { PostsController } from "./controllers/posts.controller.js";
import { ContentService } from "./content.service.js";

@Module({
  controllers: [AccountsController, PostsController],
  providers: [ContentService],
  exports: [ContentService]
})
export class ContentModule {}
