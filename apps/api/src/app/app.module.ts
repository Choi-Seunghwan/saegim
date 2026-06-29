import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module.js";
import { HealthModule } from "../health/health.module.js";

@Module({
  imports: [HealthModule, ContentModule]
})
export class AppModule {}
