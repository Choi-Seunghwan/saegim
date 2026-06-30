import { Injectable, UnauthorizedException } from "@nestjs/common";
import { SessionCookieService } from "./session-cookie.service.js";

@Injectable()
export class CurrentAccountService {
  constructor(private readonly sessionCookieService: SessionCookieService) {}

  getOptionalCurrentAccountId(cookieHeader?: string) {
    return this.sessionCookieService.getSessionAccountId(cookieHeader);
  }

  getCurrentAccountId(cookieHeader?: string) {
    const sessionAccountId = this.getOptionalCurrentAccountId(cookieHeader);
    if (sessionAccountId) {
      return sessionAccountId;
    }

    throw new UnauthorizedException("로그인이 필요해요.");
  }
}
