import { Injectable } from "@nestjs/common";

@Injectable()
export class CurrentAccountService {
  private readonly developmentAccountId = process.env.DEV_ACCOUNT_ID?.trim() || "acct-me";

  getCurrentAccountId() {
    return this.developmentAccountId;
  }
}
