import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import {
  LegalConsentService,
  type LegalAgreementInput
} from "./legal-consent.service.js";
import { createRandomPublicHandle } from "./public-handle.js";

const googleAuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
const googleUserInfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo";

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleProfile {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

interface OAuthAgreementQuery {
  terms?: unknown;
  privacy?: unknown;
  termsVersion?: unknown;
  privacyVersion?: unknown;
}

interface OAuthStatePayload {
  flow?: unknown;
  agreements?: unknown;
}

@Injectable()
export class GoogleOAuthService {
  private readonly clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  private readonly clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  private readonly callbackUrl =
    process.env.GOOGLE_OAUTH_CALLBACK_URL?.trim() ?? "http://localhost:4000/auth/google/callback";
  private readonly successRedirectUrl =
    process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_URL?.trim() ?? this.firstWebOrigin() ?? "http://127.0.0.1:3000";

  constructor(
    private readonly prisma: PrismaService,
    private readonly legalConsentService: LegalConsentService
  ) {}

  getAuthorizationRedirect(input: OAuthAgreementQuery = {}) {
    if (!this.clientId) {
      throw new ServiceUnavailableException("Google 로그인이 아직 설정되지 않았어요.");
    }

    const agreement = this.hasAgreementInput(input)
      ? this.legalConsentService.validateRequiredAgreement(input)
      : null;

    const authorizationUrl = new URL(googleAuthorizationEndpoint);
    authorizationUrl.searchParams.set("client_id", this.clientId);
    authorizationUrl.searchParams.set("redirect_uri", this.callbackUrl);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "openid email profile");
    authorizationUrl.searchParams.set("access_type", "offline");
    authorizationUrl.searchParams.set("prompt", "select_account");
    authorizationUrl.searchParams.set("state", this.encodeOAuthState(agreement));

    return authorizationUrl.toString();
  }

  async completeCallback(input: { code?: string | undefined; error?: string | undefined; state?: string | undefined }) {
    if (input.error) {
      throw new BadRequestException(`Google 로그인이 취소되었어요: ${input.error}`);
    }

    if (!input.code) {
      throw new BadRequestException("Google 인증 코드를 찾을 수 없어요.");
    }

    const token = await this.exchangeCodeForToken(input.code);
    const profile = await this.fetchGoogleProfile(token.access_token);
    const agreement =
      this.decodeOAuthState(input.state) ??
      this.legalConsentService.currentRequiredAgreement();
    const accountId = await this.upsertGoogleAccount(profile, agreement);

    return {
      accountId,
      redirectUrl: this.successRedirectUrl
    };
  }

  private async exchangeCodeForToken(code: string): Promise<Required<GoogleTokenResponse>> {
    if (!this.clientId || !this.clientSecret) {
      throw new ServiceUnavailableException("Google 로그인이 아직 설정되지 않았어요.");
    }

    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.callbackUrl,
      grant_type: "authorization_code"
    });

    const response = await fetch(googleTokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body
    });

    if (!response.ok) {
      throw new BadRequestException("Google 토큰 교환에 실패했어요.");
    }

    const token = (await response.json()) as GoogleTokenResponse;
    if (!token.access_token) {
      throw new BadRequestException("Google 액세스 토큰을 받지 못했어요.");
    }

    return {
      access_token: token.access_token
    };
  }

  private async fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
    const response = await fetch(googleUserInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new BadRequestException("Google 프로필을 불러오지 못했어요.");
    }

    const profile = (await response.json()) as Record<string, unknown>;
    const sub = this.asString(profile.sub);
    if (!sub) {
      throw new BadRequestException("Google 계정 식별자를 찾지 못했어요.");
    }

    const email = this.asString(profile.email);
    const name = this.asString(profile.name);
    const picture = this.asString(profile.picture);

    return {
      sub,
      ...(email ? { email } : {}),
      emailVerified: profile.email_verified === true,
      ...(name ? { name } : {}),
      ...(picture ? { picture } : {})
    };
  }

  private async upsertGoogleAccount(profile: GoogleProfile, agreement: LegalAgreementInput) {
    const existingOAuthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "GOOGLE",
          providerAccountId: profile.sub
        }
      },
      include: {
        account: true
      }
    });

    if (existingOAuthAccount) {
      const updateData: { displayName?: string; photoUrl?: string; email?: string } = {};
      if (profile.name) {
        updateData.displayName = profile.name;
      }
      if (profile.picture) {
        updateData.photoUrl = profile.picture;
      }
      if (
        profile.email &&
        profile.emailVerified &&
        (!existingOAuthAccount.account.email || existingOAuthAccount.account.email === profile.email)
      ) {
        updateData.email = profile.email;
      }

      await this.prisma.$transaction(async (transaction) => {
        await transaction.account.update({
          where: { id: existingOAuthAccount.accountId },
          data: updateData
        });
        await transaction.oAuthAccount.update({
          where: {
            provider_providerAccountId: {
              provider: "GOOGLE",
              providerAccountId: profile.sub
            }
          },
          data: {
            ...(profile.email ? { email: profile.email } : {})
          }
        });

        await transaction.accountConsent.createMany({
          data: this.legalConsentService.makeConsentCreateManyInput(
            existingOAuthAccount.accountId,
            agreement,
            "GOOGLE_OAUTH"
          ),
          skipDuplicates: true
        });
      });

      return existingOAuthAccount.accountId;
    }

    const linkedAccount = profile.email && profile.emailVerified
      ? await this.prisma.account.findUnique({
          where: { email: profile.email },
          select: { id: true }
        })
      : null;

    if (linkedAccount) {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.oAuthAccount.create({
          data: {
            provider: "GOOGLE",
            providerAccountId: profile.sub,
            ...(profile.email ? { email: profile.email } : {}),
            accountId: linkedAccount.id
          }
        });

        await transaction.accountConsent.createMany({
          data: this.legalConsentService.makeConsentCreateManyInput(
            linkedAccount.id,
            agreement,
            "GOOGLE_OAUTH"
          ),
          skipDuplicates: true
        });
      });

      return linkedAccount.id;
    }

    return this.createGoogleAccount(profile, agreement);
  }

  private async createGoogleAccount(profile: GoogleProfile, agreement: LegalAgreementInput) {
    const handle = await this.createUniqueHandle();
    const displayName = profile.name ?? "새김 사용자";

    return this.prisma.$transaction(async (transaction) => {
      const account = await transaction.account.create({
        data: {
          handle,
          displayName,
          ...(profile.email && profile.emailVerified ? { email: profile.email } : {}),
          ...(profile.picture ? { photoUrl: profile.picture } : {})
        },
        select: { id: true }
      });

      await transaction.oAuthAccount.create({
        data: {
          provider: "GOOGLE",
          providerAccountId: profile.sub,
          ...(profile.email ? { email: profile.email } : {}),
          accountId: account.id
        }
      });

      await transaction.accountConsent.createMany({
        data: this.legalConsentService.makeConsentCreateManyInput(
          account.id,
          agreement,
          "GOOGLE_OAUTH"
        ),
        skipDuplicates: true
      });

      return account.id;
    });
  }

  private hasAgreementInput(input: OAuthAgreementQuery) {
    return (
      input.terms !== undefined ||
      input.privacy !== undefined ||
      input.termsVersion !== undefined ||
      input.privacyVersion !== undefined
    );
  }

  private encodeOAuthState(agreement: LegalAgreementInput | null) {
    const payload = {
      flow: "saegim-oauth",
      ...(agreement ? { agreements: agreement } : {})
    };

    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  }

  private decodeOAuthState(state?: string | undefined): LegalAgreementInput | null {
    if (!state) {
      return null;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(state, "base64url").toString("utf8")
      ) as OAuthStatePayload;

      if (payload.flow !== "saegim-oauth" || !payload.agreements) {
        return null;
      }

      return this.legalConsentService.validateRequiredAgreement(payload.agreements);
    } catch {
      return null;
    }
  }

  private async createUniqueHandle() {
    for (let index = 0; index < 30; index += 1) {
      const handle = createRandomPublicHandle();
      const existingAccount = await this.prisma.account.findUnique({
        where: { handle },
        select: { id: true }
      });

      if (!existingAccount) {
        return handle;
      }
    }

    return `${createRandomPublicHandle()}${Date.now().toString(36).slice(-4)}`;
  }

  private asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private firstWebOrigin() {
    return process.env.WEB_ORIGIN?.split(",").map((origin) => origin.trim()).find(Boolean) ?? null;
  }
}
