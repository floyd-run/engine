import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createResource } from "../../setup/factories";
import type { Allocation } from "@floyd-run/schema/types";

interface ApiResponse {
  data: Allocation;
  meta?: { serverTime: string };
  error?: { code: string };
}

describe("Idempotency", () => {
  describe("POST /v1/workspaces/:workspaceId/allocations", () => {
    it("returns same response for duplicate request with same idempotency key", async () => {
      const { resource, workspaceId } = await createResource();
      const idempotencyKey = `test-key-${Date.now()}`;

      const body = {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      };

      // First request
      const response1 = await client.post(`/v1/workspaces/${workspaceId}/allocations`, body, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
      expect(response1.status).toBe(201);
      const result1 = (await response1.json()) as ApiResponse;

      // Second request with same key
      const response2 = await client.post(`/v1/workspaces/${workspaceId}/allocations`, body, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
      expect(response2.status).toBe(201);
      const result2 = (await response2.json()) as ApiResponse;

      // Should return same allocation
      expect(result2.data.id).toBe(result1.data.id);
    });

    it("returns 422 when same key used with different payload", async () => {
      const { resource, workspaceId } = await createResource();
      const idempotencyKey = `test-key-${Date.now()}`;

      // First request
      const response1 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations`,
        {
          resourceId: resource.id,
          status: "confirmed",
          startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
          endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
        },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      expect(response1.status).toBe(201);

      // Second request with same key but different payload
      const response2 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations`,
        {
          resourceId: resource.id,
          status: "confirmed",
          startAt: new Date("2026-02-01T11:00:00Z").toISOString(), // Different time
          endAt: new Date("2026-02-01T12:00:00Z").toISOString(),
        },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );

      expect(response2.status).toBe(422);
      const errorBody = (await response2.json()) as ApiResponse;
      expect(errorBody.error?.code).toBe("idempotency_payload_mismatch");
    });

    it("allows different keys for different requests", async () => {
      const { resource, workspaceId } = await createResource();

      // First request with key1
      const response1 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations`,
        {
          resourceId: resource.id,
          status: "confirmed",
          startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
          endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
        },
        { headers: { "Idempotency-Key": `key1-${Date.now()}` } },
      );
      expect(response1.status).toBe(201);
      const result1 = (await response1.json()) as ApiResponse;

      // Second request with key2 (different time slot to avoid conflict)
      const response2 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations`,
        {
          resourceId: resource.id,
          status: "confirmed",
          startAt: new Date("2026-02-01T12:00:00Z").toISOString(),
          endAt: new Date("2026-02-01T13:00:00Z").toISOString(),
        },
        { headers: { "Idempotency-Key": `key2-${Date.now()}` } },
      );
      expect(response2.status).toBe(201);
      const result2 = (await response2.json()) as ApiResponse;

      // Should create different allocations
      expect(result2.data.id).not.toBe(result1.data.id);
    });

    it("ignores metadata changes for idempotency (significant fields only)", async () => {
      const { resource, workspaceId } = await createResource();
      const idempotencyKey = `test-key-${Date.now()}`;

      const basePayload = {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      };

      // First request without metadata
      const response1 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations`,
        basePayload,
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      expect(response1.status).toBe(201);
      const result1 = (await response1.json()) as ApiResponse;

      // Second request with metadata (not a significant field)
      const response2 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations`,
        { ...basePayload, metadata: { note: "test" } },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      expect(response2.status).toBe(201);
      const result2 = (await response2.json()) as ApiResponse;

      // Should return same allocation (metadata ignored in hash)
      expect(result2.data.id).toBe(result1.data.id);
    });

    it("works normally without idempotency key", async () => {
      const { resource, workspaceId } = await createResource();

      const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
    });
  });

  describe("POST /v1/workspaces/:workspaceId/allocations/:id/confirm", () => {
    it("returns same response for duplicate confirm with same idempotency key", async () => {
      const { resource, workspaceId } = await createResource();
      const idempotencyKey = `confirm-key-${Date.now()}`;

      // Create a hold
      const createResponse = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "hold",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      const { data: hold } = (await createResponse.json()) as ApiResponse;

      // First confirm
      const response1 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations/${hold.id}/confirm`,
        {},
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      expect(response1.status).toBe(200);
      const result1 = (await response1.json()) as ApiResponse;

      // Second confirm with same key
      const response2 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations/${hold.id}/confirm`,
        {},
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      expect(response2.status).toBe(200);
      const result2 = (await response2.json()) as ApiResponse;

      // Should return same response (cached)
      expect(result2.data.id).toBe(result1.data.id);
      expect(result2.data.status).toBe(result1.data.status);
    });
  });

  describe("POST /v1/workspaces/:workspaceId/allocations/:id/cancel", () => {
    it("returns same response for duplicate cancel with same idempotency key", async () => {
      const { resource, workspaceId } = await createResource();
      const idempotencyKey = `cancel-key-${Date.now()}`;

      // Create a confirmed allocation
      const createResponse = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });
      const { data: allocation } = (await createResponse.json()) as ApiResponse;

      // First cancel
      const response1 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations/${allocation.id}/cancel`,
        {},
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      expect(response1.status).toBe(200);
      const result1 = (await response1.json()) as ApiResponse;

      // Second cancel with same key
      const response2 = await client.post(
        `/v1/workspaces/${workspaceId}/allocations/${allocation.id}/cancel`,
        {},
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      expect(response2.status).toBe(200);
      const result2 = (await response2.json()) as ApiResponse;

      // Should return same response (cached)
      expect(result2.data.id).toBe(result1.data.id);
      expect(result2.data.status).toBe(result1.data.status);
    });
  });
});
