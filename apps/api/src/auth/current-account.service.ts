import { Injectable, UnauthorizedException } from "@nestjs/common";
import { SessionCookieService } from "./session-cookie.service.js";

@Injectable()
export class CurrentAccountService {
  private readonly developmentAccountId = process.env.DEV_ACCOUNT_ID?.trim() || "acct-me";

  constructor(private readonly sessionCookieService: SessionCookieService) {}

  getCurrentAccountId(accountContext?: string) {
    const developmentAccountIdHint = this.getDevelopmentAccountIdHint(accountContext);
    if (developmentAccountIdHint) {
      return developmentAccountIdHint;
    }

    const sessionAccountId = this.sessionCookieService.getSessionAccountId(accountContext);
    if (sessionAccountId) {
      return sessionAccountId;
    }

    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("로그인이 필요해요.");
    }

    return this.developmentAccountId;
  }

  private getDevelopmentAccountIdHint(accountContext?: string) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    const normalizedAccountId = accountContext?.trim();
    if (!normalizedAccountId || normalizedAccountId.includes("=")) {
      return null;
    }

    return normalizedAccountId || null;
  }
}
