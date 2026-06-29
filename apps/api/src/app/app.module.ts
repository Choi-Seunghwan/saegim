import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ContentModule } from "../content/content.module.js";
import { HealthModule } from "../health/health.module.js";

@Module({
  imports: [HealthModule, AuthModule, ContentModule]
})
export class AppModule {}
