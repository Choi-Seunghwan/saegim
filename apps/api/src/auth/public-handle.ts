import { randomBytes } from "node:crypto";

export function createRandomPublicHandle() {
  let body = "";

  while (body.length < 10) {
    body += randomBytes(8)
      .toString("base64url")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  return `sg-${body.slice(0, 10)}`;
}

export function toHandleBase(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9_]+/g, "")
      .slice(0, 24) || "saegim"
  );
}

export function isEmailDerivedHandle(handle: string, email: string) {
  const emailLocalPart = email.split("@")[0] ?? "";
  const baseHandle = toHandleBase(emailLocalPart);

  if (!baseHandle) {
    return false;
  }

  if (handle === baseHandle) {
    return true;
  }

  const suffix = handle.slice(baseHandle.length);
  return handle.startsWith(baseHandle) && /^\d+$/.test(suffix);
}
