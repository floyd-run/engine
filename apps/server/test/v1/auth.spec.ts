import { describe, expect, it, vi, beforeAll } from "vitest";
import { createClient } from "../setup/client";
import type { Client } from "../setup/client";

interface ApiErrorResponse {
  error: { code: string };
}

describe("Authentication", () => {
  describe("when FLOYD_API_KEY is set", () => {
    let client: Client;

    beforeAll(async () => {
      process.env["FLOYD_API_KEY"] = "test_secret_key";
      vi.resetModules();
      client = await createClient();
    });

    it("returns 401 when Authorization header is missing", async () => {
      const response = await client.get("/v1/workspaces");

      expect(response.status).toBe(401);
      const body = (await response.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("missing_authorization");
    });

    it("returns 401 when Authorization header has invalid format", async () => {
      const response = await client.get("/v1/workspaces", {
        headers: { Authorization: "InvalidFormat token" },
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("invalid_authorization_format");
    });

    it("returns 401 when API key is invalid", async () => {
      const response = await client.get("/v1/workspaces", {
        headers: { Authorization: "Bearer wrong_key" },
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("invalid_api_key");
    });

    it("returns 200 when API key is valid", async () => {
      const response = await client.get("/v1/workspaces", {
        headers: { Authorization: "Bearer test_secret_key" },
      });

      expect(response.status).toBe(200);
    });
  });

  describe("when FLOYD_API_KEY is not set", () => {
    let client: Client;

    beforeAll(async () => {
      delete process.env["FLOYD_API_KEY"];
      vi.resetModules();
      client = await createClient();
    });

    it("skips auth and returns 200", async () => {
      const response = await client.get("/v1/workspaces");

      expect(response.status).toBe(200);
    });
  });
});
