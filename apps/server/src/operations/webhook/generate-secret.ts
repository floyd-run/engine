import { randomBytes } from "crypto";

export function generateSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}
