import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AuthController } from "./auth.controller.js";
import { CurrentAccountService } from "./current-account.service.js";
import { EmailAuthService } from "./email-auth.service.js";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { LegalConsentService } from "./legal-consent.service.js";
import { SessionCookieService } from "./session-cookie.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    CurrentAccountService,
    EmailAuthService,
    GoogleOAuthService,
    LegalConsentService,
    SessionCookieService
  ],
  exports: [CurrentAccountService]
})
export class AuthModule {}
