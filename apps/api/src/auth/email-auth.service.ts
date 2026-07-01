import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import type { AccountProfile } from "../content/content.types.js";
import { PrismaService } from "../database/prisma.service.js";
import { LegalConsentService } from "./legal-consent.service.js";
import { createRandomPublicHandle } from "./public-handle.js";

interface EmailAuthInput {
  email?: unknown;
  password?: unknown;
}

interface EmailSignupInput extends EmailAuthInput {
  displayName?: unknown;
  agreements?: unknown;
}

const passwordIterations = 120_000;
const passwordKeyLength = 32;
const passwordDigest = "sha256";
const legacyDefaultTagline = "한 줄을 곁에 두는 사람";
const duplicateEmailMessage = "이미 가입된 이메일이에요.";
const accountInclude = Prisma.validator<Prisma.AccountInclude>()({
  _count: {
    select: {
      posts: true,
      followerRelations: true,
    },
  },
});

type AccountWithCounts = Prisma.AccountGetPayload<{
  include: typeof accountInclude;
}>;

@Injectable()
export class EmailAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legalConsentService: LegalConsentService,
  ) {}

  async signup(input: EmailSignupInput) {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizeSignupPassword(input.password);
    const displayName = this.normalizeDisplayName(input.displayName);
    const agreement = this.legalConsentService.validateRequiredAgreement(
      input.agreements,
    );

    let existingAccount: { id: string } | null;
    let existingCredential: { id: string } | null;

    try {
      [existingAccount, existingCredential] = await Promise.all([
        this.prisma.account.findUnique({
          where: { email },
          select: { id: true },
        }),
        this.prisma.emailCredential.findUnique({
          where: { email },
          select: { id: true },
        }),
      ]);
    } catch (error) {
      this.handleAuthSchemaError(error, "가입");
    }

    if (existingAccount || existingCredential) {
      throw new ConflictException(duplicateEmailMessage);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const handle = await this.createUniqueHandle();

      try {
        const account = await this.prisma.$transaction(async (transaction) => {
          const createdAccount = await transaction.account.create({
            data: {
              email,
              handle,
              displayName,
              emailCredential: {
                create: {
                  email,
                  passwordHash: this.hashPassword(password),
                },
              },
            },
            include: accountInclude,
          });

          await transaction.accountConsent.createMany({
            data: this.legalConsentService.makeConsentCreateManyInput(
              createdAccount.id,
              agreement,
              "EMAIL_SIGNUP",
            ),
            skipDuplicates: true,
          });

          return createdAccount;
        });

        return {
          accountId: account.id,
          item: this.toAccountProfile(account),
        };
      } catch (error) {
        if (this.isUniqueConflict(error, "handle")) {
          continue;
        }

        this.handleSignupPersistenceError(error);
      }
    }

    throw new ServiceUnavailableException(
      "계정 주소를 만드는 중이에요. 잠시 후 다시 시도해 주세요.",
    );
  }

  private handleSignupPersistenceError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (this.isUniqueConflict(error, "email")) {
        throw new ConflictException(duplicateEmailMessage);
      }

      if (error.code === "P2021") {
        throw new ServiceUnavailableException(
          "가입 준비가 아직 완료되지 않았어요. 잠시 후 다시 시도해 주세요.",
        );
      }
    }

    throw error;
  }

  private isUniqueConflict(error: unknown, field: "email" | "handle") {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      return false;
    }

    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return target.some(
        (value) => typeof value === "string" && value.toLowerCase() === field,
      );
    }

    if (typeof target === "string") {
      return target.toLowerCase().includes(field);
    }

    return false;
  }

  async login(input: EmailAuthInput) {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizeLoginPassword(input.password);
    let credential: Prisma.EmailCredentialGetPayload<{
      include: { account: { include: typeof accountInclude } };
    }> | null;

    try {
      credential = await this.prisma.emailCredential.findUnique({
        where: { email },
        include: {
          account: {
            include: accountInclude,
          },
        },
      });
    } catch (error) {
      this.handleAuthSchemaError(error, "로그인");
    }

    if (
      !credential ||
      !this.verifyPassword(password, credential.passwordHash)
    ) {
      throw new UnauthorizedException("이메일 또는 비밀번호를 확인해 주세요.");
    }

    return {
      accountId: credential.accountId,
      item: this.toAccountProfile(credential.account),
    };
  }

  private normalizeEmail(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("이메일을 입력해 주세요.");
    }

    const email = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      throw new BadRequestException("이메일 형식을 확인해 주세요.");
    }

    return email;
  }

  private handleAuthSchemaError(
    error: unknown,
    actionLabel: "가입" | "로그인",
  ): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      throw new ServiceUnavailableException(
        `${actionLabel} 준비가 아직 완료되지 않았어요. 잠시 후 다시 시도해 주세요.`,
      );
    }

    throw error;
  }

  private normalizeSignupPassword(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("비밀번호를 입력해 주세요.");
    }

    const password = value.trim();
    if (
      password.length < 8 ||
      password.length > 120 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new BadRequestException(
        "비밀번호는 8자 이상, 영문과 숫자를 함께 입력해 주세요.",
      );
    }

    return password;
  }

  private normalizeLoginPassword(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("비밀번호를 입력해 주세요.");
    }

    const password = value.trim();
    if (password.length > 120) {
      throw new UnauthorizedException("이메일 또는 비밀번호를 확인해 주세요.");
    }

    return password;
  }

  private normalizeDisplayName(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      return "새김 사용자";
    }

    const displayName = value.trim();
    if (displayName.length > 24) {
      throw new BadRequestException("닉네임은 24자 이내로 입력해 주세요.");
    }

    return displayName;
  }

  private async createUniqueHandle() {
    for (let index = 0; index < 30; index += 1) {
      const handle = createRandomPublicHandle();
      const existingAccount = await this.prisma.account.findUnique({
        where: { handle },
        select: { id: true },
      });

      if (!existingAccount) {
        return handle;
      }
    }

    return `${createRandomPublicHandle()}${Date.now().toString(36).slice(-4)}`;
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString("base64url");
    const hash = pbkdf2Sync(
      password,
      salt,
      passwordIterations,
      passwordKeyLength,
      passwordDigest,
    ).toString("base64url");

    return `pbkdf2$${passwordIterations}$${salt}$${hash}`;
  }

  private verifyPassword(password: string, passwordHash: string) {
    const [scheme, iterationsText, salt, hash] = passwordHash.split("$");
    const iterations = Number(iterationsText);
    if (scheme !== "pbkdf2" || !iterations || !salt || !hash) {
      return false;
    }

    const expected = Buffer.from(hash, "base64url");
    const actual = pbkdf2Sync(
      password,
      salt,
      iterations,
      expected.length,
      passwordDigest,
    );

    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private toAccountProfile(account: AccountWithCounts): AccountProfile {
    return {
      id: account.id,
      handle: account.handle,
      displayName: account.displayName,
      tagline: this.normalizeStoredTagline(account.tagline),
      verification: account.verification === "OFFICIAL" ? "official" : "none",
      postCount: account._count.posts,
      writingFriendCount: account._count.followerRelations,
      ...(account.photoUrl ? { photoUrl: account.photoUrl } : {}),
      ...(account.bio ? { bio: account.bio } : {}),
    };
  }

  private normalizeStoredTagline(tagline: string) {
    return tagline === legacyDefaultTagline ? "" : tagline;
  }
}
