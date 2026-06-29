import { Controller, Get, Query, Redirect } from "@nestjs/common";
import { GoogleOAuthService } from "./google-oauth.service.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly googleOAuthService: GoogleOAuthService) {}

  @Get("google")
  @Redirect()
  startGoogleOAuth() {
    return {
      url: this.googleOAuthService.getAuthorizationRedirect(),
      statusCode: 302
    };
  }

  @Get("google/callback")
  handleGoogleOAuthCallback(
    @Query("code") code?: string,
    @Query("error") error?: string,
    @Query("state") state?: string
  ) {
    return this.googleOAuthService.getCallbackPreview({ code, error, state });
  }
}
