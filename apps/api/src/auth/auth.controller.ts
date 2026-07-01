import { Body, Controller, Get, Headers, Post, Query, Redirect, Res } from "@nestjs/common";
import type { Response } from "express";
import { EmailAuthService } from "./email-auth.service.js";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { SessionCookieService } from "./session-cookie.service.js";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly emailAuthService: EmailAuthService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly sessionCookieService: SessionCookieService
  ) {}

  @Post("signup")
  async signup(@Body() body: unknown, @Res({ passthrough: true }) response?: Response) {
    const result = await this.emailAuthService.signup(body ?? {});
    response?.setHeader("Set-Cookie", this.sessionCookieService.createSessionCookie(result.accountId));

    return {
      item: result.item
    };
  }

  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) response?: Response) {
    const result = await this.emailAuthService.login(body ?? {});
    response?.setHeader("Set-Cookie", this.sessionCookieService.createSessionCookie(result.accountId));

    return {
      item: result.item
    };
  }

  @Get("google")
  @Redirect()
  startGoogleOAuth(
    @Query("terms") terms?: string,
    @Query("privacy") privacy?: string,
    @Query("termsVersion") termsVersion?: string,
    @Query("privacyVersion") privacyVersion?: string
  ) {
    const agreementQuery =
      terms === undefined &&
      privacy === undefined &&
      termsVersion === undefined &&
      privacyVersion === undefined
        ? {}
        : {
            terms: terms === "true",
            privacy: privacy === "true",
            termsVersion,
            privacyVersion
          };

    return {
      url: this.googleOAuthService.getAuthorizationRedirect(agreementQuery),
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
