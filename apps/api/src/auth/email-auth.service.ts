import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import type { AccountProfile } from "../content/content.types.js";
import { PrismaService } from "../database/prisma.service.js";
import { createRandomPublicHandle } from "./public-handle.js";

interface EmailAuthInput {
  email?: unknown;
  password?: unknown;
}

interface EmailSignupInput extends EmailAuthInput {
  displayName?: unknown;
}

const passwordIterations = 120_000;
const passwordKeyLength = 32;
const passwordDigest = "sha256";
const legacyDefaultTagline = "한 줄을 곁에 두는 사람";
const accountInclude = Prisma.validator<Prisma.AccountInclude>()({
  _count: {
    select: {
      posts: true,
      followerRelations: true
    }
  }
});

type AccountWithCounts = Prisma.AccountGetPayload<{
  include: typeof accountInclude;
}>;

@Injectable()
export class EmailAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(input: EmailSignupInput) {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);
    const displayName = this.normalizeDisplayName(input.displayName);

    const existingAccount = await this.prisma.account.findUnique({
      where: { email },
      select: { id: true }
    });
    const existingCredential = await this.prisma.emailCredential.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingAccount || existingCredential) {
      throw new ConflictException("이미 가입된 이메일이에요.");
    }

    const handle = await this.createUniqueHandle();
    const account = await this.prisma.account.create({
      data: {
        email,
        handle,
        displayName,
        emailCredential: {
          create: {
            email,
            passwordHash: this.hashPassword(password)
          }
        }
      },
      include: accountInclude
    });

    return {
      accountId: account.id,
      item: this.toAccountProfile(account)
    };
  }

  async login(input: EmailAuthInput) {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);
    const credential = await this.prisma.emailCredential.findUnique({
      where: { email },
      include: {
        account: {
          include: accountInclude
        }
      }
    });

    if (!credential || !this.verifyPassword(password, credential.passwordHash)) {
      throw new UnauthorizedException("이메일 또는 비밀번호를 확인해 주세요.");
    }

    return {
      accountId: credential.accountId,
      item: this.toAccountProfile(credential.account)
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

  private normalizePassword(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("비밀번호를 입력해 주세요.");
    }

    const password = value.trim();
    if (password.length < 8 || password.length > 120 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException("비밀번호는 8자 이상, 영문과 숫자를 함께 입력해 주세요.");
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
        select: { id: true }
      });

      if (!existingAccount) {
        return handle;
      }
    }

    return `${createRandomPublicHandle()}${Date.now().toString(36).slice(-4)}`;
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString("base64url");
    const hash = pbkdf2Sync(password, salt, passwordIterations, passwordKeyLength, passwordDigest).toString("base64url");

    return `pbkdf2$${passwordIterations}$${salt}$${hash}`;
  }

  private verifyPassword(password: string, passwordHash: string) {
    const [scheme, iterationsText, salt, hash] = passwordHash.split("$");
    const iterations = Number(iterationsText);
    if (scheme !== "pbkdf2" || !iterations || !salt || !hash) {
      return false;
    }

    const expected = Buffer.from(hash, "base64url");
    const actual = pbkdf2Sync(password, salt, iterations, expected.length, passwordDigest);

    return actual.length === expected.length && timingSafeEqual(actual, expected);
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
      ...(account.bio ? { bio: account.bio } : {})
    };
  }

  private normalizeStoredTagline(tagline: string) {
    return tagline === legacyDefaultTagline ? "" : tagline;
  }
}
