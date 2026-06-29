import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";

const googleAuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";

@Injectable()
export class GoogleOAuthService {
  private readonly clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  private readonly callbackUrl =
    process.env.GOOGLE_OAUTH_CALLBACK_URL?.trim() ?? "http://localhost:4000/auth/google/callback";

  getAuthorizationRedirect() {
    if (!this.clientId) {
      throw new ServiceUnavailableException("Google 로그인이 아직 설정되지 않았어요.");
    }

    const authorizationUrl = new URL(googleAuthorizationEndpoint);
    authorizationUrl.searchParams.set("client_id", this.clientId);
    authorizationUrl.searchParams.set("redirect_uri", this.callbackUrl);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "openid email profile");
    authorizationUrl.searchParams.set("access_type", "offline");
    authorizationUrl.searchParams.set("prompt", "select_account");
    authorizationUrl.searchParams.set("state", "saegim-oauth-dev");

    return authorizationUrl.toString();
  }

  getCallbackPreview(input: { code?: string | undefined; error?: string | undefined; state?: string | undefined }) {
    if (input.error) {
      throw new BadRequestException(`Google 로그인이 취소되었어요: ${input.error}`);
    }

    if (!input.code) {
      throw new BadRequestException("Google 인증 코드를 찾을 수 없어요.");
    }

    return {
      provider: "google",
      codeReceived: true,
      state: input.state ?? null,
      next: "token-exchange"
    };
  }
}
