import { Controller, Get, Headers, Post, Query, Redirect, Res } from "@nestjs/common";
import type { Response } from "express";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { SessionCookieService } from "./session-cookie.service.js";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly sessionCookieService: SessionCookieService
  ) {}

  @Get("google")
  @Redirect()
  startGoogleOAuth() {
    return {
      url: this.googleOAuthService.getAuthorizationRedirect(),
      statusCode: 302
    };
  }

  @Get("google/callback")
  @Redirect()
  async handleGoogleOAuthCallback(
    @Query("code") code?: string,
    @Query("error") error?: string,
    @Query("state") state?: string,
    @Res({ passthrough: true }) response?: Response
  ) {
    const result = await this.googleOAuthService.completeCallback({ code, error, state });
    response?.setHeader("Set-Cookie", this.sessionCookieService.createSessionCookie(result.accountId));

    return {
      url: result.redirectUrl,
      statusCode: 302
    };
  }

  @Get("session")
  getSession(@Headers("cookie") cookieHeader?: string) {
    const accountId = this.sessionCookieService.getSessionAccountId(cookieHeader);

    return {
      authenticated: Boolean(accountId),
      accountId
    };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response?: Response) {
    response?.setHeader("Set-Cookie", this.sessionCookieService.createClearCookie());

    return {
      ok: true
    };
  }
}
