import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

type ConsentSource = "EMAIL_SIGNUP" | "GOOGLE_OAUTH";

export interface LegalAgreementInput {
  terms: boolean;
  privacy: boolean;
  termsVersion: string;
  privacyVersion: string;
}

const currentLegalVersions = {
  terms: "2026-07-01",
  privacy: "2026-07-01"
} as const;

interface RawAgreementInput {
  terms?: unknown;
  privacy?: unknown;
  termsVersion?: unknown;
  privacyVersion?: unknown;
}

@Injectable()
export class LegalConsentService {
  currentRequiredAgreement(): LegalAgreementInput {
    return {
      terms: true,
      privacy: true,
      termsVersion: currentLegalVersions.terms,
      privacyVersion: currentLegalVersions.privacy
    };
  }

  validateRequiredAgreement(input: unknown): LegalAgreementInput {
    const agreement = this.asAgreementObject(input);

    if (agreement.terms !== true || agreement.privacy !== true) {
      throw new BadRequestException("이용약관과 개인정보 처리방침 동의가 필요해요.");
    }

    const termsVersion = this.asVersion(
      agreement.termsVersion,
      currentLegalVersions.terms
    );
    const privacyVersion = this.asVersion(
      agreement.privacyVersion,
      currentLegalVersions.privacy
    );

    if (
      termsVersion !== currentLegalVersions.terms ||
      privacyVersion !== currentLegalVersions.privacy
    ) {
      throw new BadRequestException("약관이 갱신되었어요. 새로고침 후 다시 동의해 주세요.");
    }

    return {
      terms: true,
      privacy: true,
      termsVersion,
      privacyVersion
    };
  }

  makeConsentCreateManyInput(
    accountId: string,
    agreement: LegalAgreementInput,
    source: ConsentSource
  ): Prisma.AccountConsentCreateManyInput[] {
    return [
      {
        accountId,
        documentType: "TERMS",
        version: agreement.termsVersion,
        source
      },
      {
        accountId,
        documentType: "PRIVACY",
        version: agreement.privacyVersion,
        source
      }
    ];
  }

  private asAgreementObject(input: unknown): RawAgreementInput {
    if (!input || typeof input !== "object") {
      return {};
    }

    return input as RawAgreementInput;
  }

  private asVersion(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }
}
