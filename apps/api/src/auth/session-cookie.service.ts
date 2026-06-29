import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

const sessionCookieName = "saegim_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

interface SessionPayload {
  accountId: string;
  iat: number;
  exp: number;
}

@Injectable()
export class SessionCookieService {
  createSessionCookie(accountId: string) {
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      accountId,
      iat: now,
      exp: now + sessionMaxAgeSeconds
    };
    const payloadText = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(payloadText);

    return this.serializeCookie(`${payloadText}.${signature}`, sessionMaxAgeSeconds);
  }

  createClearCookie() {
    return this.serializeCookie("", 0);
  }

  getSessionAccountId(cookieHeader?: string) {
    const cookieValue = this.getCookieValue(cookieHeader);
    if (!cookieValue) {
      return null;
    }

    const [payloadText, signature] = cookieValue.split(".");
    if (!payloadText || !signature || !this.isValidSignature(payloadText, signature)) {
      return null;
    }

    try {
      const payload = JSON.parse(this.base64UrlDecode(payloadText)) as Partial<SessionPayload>;
      if (!payload.accountId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload.accountId;
    } catch {
      return null;
    }
  }

  private getCookieValue(cookieHeader?: string) {
    return (
      cookieHeader
        ?.split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith(`${sessionCookieName}=`))
        ?.slice(sessionCookieName.length + 1) ?? null
    );
  }

  private serializeCookie(value: string, maxAgeSeconds: number) {
    const secure = process.env.NODE_ENV === "production" || process.env.SAEGIM_COOKIE_SECURE === "true";
    const parts = [
      `${sessionCookieName}=${value}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAgeSeconds}`
    ];

    if (secure) {
      parts.push("Secure");
    }

    return parts.join("; ");
  }

  private sign(payloadText: string) {
    return createHmac("sha256", this.getSecret()).update(payloadText).digest("base64url");
  }

  private isValidSignature(payloadText: string, signature: string) {
    const expectedSignature = this.sign(payloadText);
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private getSecret() {
    const secret = process.env.SAEGIM_SESSION_SECRET?.trim();

    if (!secret && process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException("세션 비밀키가 설정되지 않았어요.");
    }

    return secret || "saegim-local-session-secret";
  }

  private base64UrlEncode(value: string) {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  private base64UrlDecode(value: string) {
    return Buffer.from(value, "base64url").toString("utf8");
  }
}
