import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock database and other dependencies before importing the worker
vi.mock("database", () => ({
  db: {},
}));

vi.mock("infra/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("infra/crypto", () => ({
  computeHmacSignature: vi.fn(() => "mocked-signature"),
}));

import {
  isRetryableError,
  computeNextAttemptAt,
  extractStatusCode,
} from "workers/outbox-publisher";

// ─── Constants ─────────────────────────────────────────────────────────────────

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("outbox-publisher retry logic", () => {
  describe("extractStatusCode", () => {
    it("extracts status code from error message", () => {
      const error = new Error("HTTP 404: Not Found");
      expect(extractStatusCode(error)).toBe(404);
    });

    it("extracts status code from error with complex message", () => {
      const error = new Error('HTTP 500: {"error":"Internal Server Error"}');
      expect(extractStatusCode(error)).toBe(500);
    });

    it("returns null for network errors without status", () => {
      const error = new Error("ECONNRESET");
      expect(extractStatusCode(error)).toBeNull();
    });

    it("returns null for DNS errors", () => {
      const error = new Error("getaddrinfo ENOTFOUND");
      expect(extractStatusCode(error)).toBeNull();
    });

    it("handles malformed error messages", () => {
      const error = new Error("Something went wrong");
      expect(extractStatusCode(error)).toBeNull();
    });
  });

  describe("isRetryableError", () => {
    describe("retryable errors", () => {
      it("treats network errors (no status code) as retryable", () => {
        expect(isRetryableError(null)).toBe(true);
      });

      it("treats 408 Request Timeout as retryable", () => {
        expect(isRetryableError(408)).toBe(true);
      });

      it("treats 429 Too Many Requests as retryable", () => {
        expect(isRetryableError(429)).toBe(true);
      });

      it("treats 500 Internal Server Error as retryable", () => {
        expect(isRetryableError(500)).toBe(true);
      });

      it("treats 502 Bad Gateway as retryable", () => {
        expect(isRetryableError(502)).toBe(true);
      });

      it("treats 503 Service Unavailable as retryable", () => {
        expect(isRetryableError(503)).toBe(true);
      });

      it("treats 504 Gateway Timeout as retryable", () => {
        expect(isRetryableError(504)).toBe(true);
      });
    });

    describe("non-retryable errors", () => {
      it("treats 400 Bad Request as non-retryable", () => {
        expect(isRetryableError(400)).toBe(false);
      });

      it("treats 401 Unauthorized as non-retryable", () => {
        expect(isRetryableError(401)).toBe(false);
      });

      it("treats 403 Forbidden as non-retryable", () => {
        expect(isRetryableError(403)).toBe(false);
      });

      it("treats 404 Not Found as non-retryable", () => {
        expect(isRetryableError(404)).toBe(false);
      });

      it("treats 422 Unprocessable Entity as non-retryable", () => {
        expect(isRetryableError(422)).toBe(false);
      });

      it("treats 405 Method Not Allowed as non-retryable", () => {
        expect(isRetryableError(405)).toBe(false);
      });
    });
  });

  describe("computeNextAttemptAt", () => {
    beforeEach(() => {
      // Fix the current time for deterministic tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-16T12:00:00Z"));
    });

    describe("non-retryable errors", () => {
      it("returns null for 401 Unauthorized", () => {
        const result = computeNextAttemptAt(1, 401);
        expect(result).toBeNull();
      });

      it("returns null for 403 Forbidden", () => {
        const result = computeNextAttemptAt(1, 403);
        expect(result).toBeNull();
      });

      it("returns null for 400 Bad Request", () => {
        const result = computeNextAttemptAt(1, 400);
        expect(result).toBeNull();
      });

      it("returns null for 404 Not Found", () => {
        const result = computeNextAttemptAt(1, 404);
        expect(result).toBeNull();
      });
    });

    describe("retryable errors - backoff schedule", () => {
      it("attempt 0: ~0 seconds (immediate)", () => {
        const result = computeNextAttemptAt(0, 500);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // 0s base + jitter (±30% of 0 = 0), so should be immediate
          expect(delayMs).toBeLessThan(100); // Allow small variance
        }
      });

      it("attempt 1: ~5 seconds ± jitter", () => {
        const result = computeNextAttemptAt(1, 500);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // 5s base ± 30% = 3.5s to 6.5s
          expect(delayMs).toBeGreaterThanOrEqual(3.5 * SECOND);
          expect(delayMs).toBeLessThanOrEqual(6.5 * SECOND);
        }
      });

      it("attempt 2: ~15 seconds ± jitter", () => {
        const result = computeNextAttemptAt(2, 500);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // 15s base ± 30% = 10.5s to 19.5s
          expect(delayMs).toBeGreaterThanOrEqual(10.5 * SECOND);
          expect(delayMs).toBeLessThanOrEqual(19.5 * SECOND);
        }
      });

      it("attempt 3: ~1 minute ± jitter", () => {
        const result = computeNextAttemptAt(3, 500);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // 60s base ± 30% = 42s to 78s
          expect(delayMs).toBeGreaterThanOrEqual(42 * SECOND);
          expect(delayMs).toBeLessThanOrEqual(78 * SECOND);
        }
      });

      it("attempt 4: ~5 minutes ± jitter", () => {
        const result = computeNextAttemptAt(4, 500);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // 300s base ± 30% = 210s to 390s
          expect(delayMs).toBeGreaterThanOrEqual(210 * SECOND);
          expect(delayMs).toBeLessThanOrEqual(390 * SECOND);
        }
      });

      it("attempt 10: capped at 4 hours ± jitter", () => {
        const result = computeNextAttemptAt(10, 500);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // 14400s (4h) base ± 30% = 10080s to 18720s
          expect(delayMs).toBeGreaterThanOrEqual(10080 * SECOND);
          expect(delayMs).toBeLessThanOrEqual(18720 * SECOND);
        }
      });

      it("attempt 25: still capped at 4 hours ± jitter", () => {
        const result = computeNextAttemptAt(25, 500);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // Should still be capped at 4h ± 30%
          expect(delayMs).toBeGreaterThanOrEqual(10080 * SECOND);
          expect(delayMs).toBeLessThanOrEqual(18720 * SECOND);
        }
      });
    });

    describe("retryable error types", () => {
      it("computes backoff for network errors (null status)", () => {
        const result = computeNextAttemptAt(1, null);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // Should follow attempt 1 schedule: ~5s ± 30%
          expect(delayMs).toBeGreaterThanOrEqual(3.5 * SECOND);
          expect(delayMs).toBeLessThanOrEqual(6.5 * SECOND);
        }
      });

      it("computes backoff for 429 Too Many Requests", () => {
        const result = computeNextAttemptAt(2, 429);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // Should follow attempt 2 schedule: ~15s ± 30%
          expect(delayMs).toBeGreaterThanOrEqual(10.5 * SECOND);
          expect(delayMs).toBeLessThanOrEqual(19.5 * SECOND);
        }
      });

      it("computes backoff for 503 Service Unavailable", () => {
        const result = computeNextAttemptAt(3, 503);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // Should follow attempt 3 schedule: ~60s ± 30%
          expect(delayMs).toBeGreaterThanOrEqual(42 * SECOND);
          expect(delayMs).toBeLessThanOrEqual(78 * SECOND);
        }
      });
    });

    describe("jitter randomization", () => {
      it("produces different delays for same attempt (jitter)", () => {
        const results: number[] = [];
        for (let i = 0; i < 10; i++) {
          const result = computeNextAttemptAt(4, 500);
          if (result) {
            results.push(result.getTime() - Date.now());
          }
        }

        // All results should be within the valid range
        results.forEach((delay) => {
          expect(delay).toBeGreaterThanOrEqual(210 * SECOND); // 5min - 30%
          expect(delay).toBeLessThanOrEqual(390 * SECOND); // 5min + 30%
        });

        // Results should not all be identical (jitter adds randomness)
        const uniqueValues = new Set(results);
        expect(uniqueValues.size).toBeGreaterThan(1);
      });
    });

    describe("edge cases", () => {
      it("handles attempt 0 (should use first schedule entry)", () => {
        const result = computeNextAttemptAt(0, 500);
        expect(result).not.toBeNull();
        if (result) {
          const delayMs = result.getTime() - Date.now();
          // Should use schedule[0] = 0s
          expect(delayMs).toBeLessThan(100);
        }
      });

      it("never returns negative delay", () => {
        // Even with jitter, delay should never be negative
        for (let attempt = 0; attempt < 30; attempt++) {
          const result = computeNextAttemptAt(attempt, 500);
          if (result) {
            const delayMs = result.getTime() - Date.now();
            expect(delayMs).toBeGreaterThanOrEqual(0);
          }
        }
      });
    });
  });
});
