import { Module } from "@nestjs/common";
import { CurrentAccountService } from "./current-account.service.js";

@Module({
  providers: [CurrentAccountService],
  exports: [CurrentAccountService]
})
export class AuthModule {}
