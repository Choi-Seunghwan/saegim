import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { CurrentAccountService } from "./current-account.service.js";
import { GoogleOAuthService } from "./google-oauth.service.js";

@Module({
  controllers: [AuthController],
  providers: [CurrentAccountService, GoogleOAuthService],
  exports: [CurrentAccountService]
})
export class AuthModule {}
