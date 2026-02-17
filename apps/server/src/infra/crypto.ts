import { createHmac } from "crypto";

/**
 * Compute HMAC-SHA256 signature for a payload.
 * Header format: `sha256=<hex>`
 */
export function computeHmacSignature(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}
