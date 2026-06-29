import { Injectable } from "@nestjs/common";

@Injectable()
export class CurrentAccountService {
  private readonly developmentAccountId = process.env.DEV_ACCOUNT_ID?.trim() || "acct-me";

  getCurrentAccountId(accountIdHint?: string) {
    const developmentAccountIdHint = this.getDevelopmentAccountIdHint(accountIdHint);
    return developmentAccountIdHint ?? this.developmentAccountId;
  }

  private getDevelopmentAccountIdHint(accountIdHint?: string) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    const normalizedAccountId = accountIdHint?.trim();
    return normalizedAccountId || null;
  }
}
