import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AccountsController } from "./controllers/accounts.controller.js";
import { PostsController } from "./controllers/posts.controller.js";
import { ContentRepository } from "./content.repository.js";
import { ContentService } from "./content.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AccountsController, PostsController],
  providers: [ContentRepository, ContentService],
  exports: [ContentService]
})
export class ContentModule {}
