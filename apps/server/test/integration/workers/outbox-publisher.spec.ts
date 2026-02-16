import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { db } from "database";
import { generateId } from "@floyd-run/utils";
import type { InternalEvent } from "infra/event-bus";

describe("Outbox Publisher Integration", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof global.fetch;
  const testLedgerId = "ldg_test123";

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Create fetch mock
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    // Default: successful response
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("OK"),
    });

    // Reset module cache to ensure clean imports
    vi.resetModules();
  });

  afterEach(async () => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Clean up test events
    await db.deleteFrom("outboxEvents").where("ledgerId", "=", testLedgerId).execute();

    // Clean up env vars
    delete process.env["FLOYD_EVENT_INGEST_URL"];
    delete process.env["FLOYD_ENGINE_SECRET"];
  });

  describe("Event Publishing Flow", () => {
    it("publishes event to HTTP endpoint and marks as published", async () => {
      // Arrange: Insert event into outbox
      const eventId = generateId("evt");
      const event: InternalEvent = {
        id: eventId,
        type: "allocation.created",
        ledgerId: testLedgerId,
        source: "engine-test",
        schemaVersion: 1,
        timestamp: new Date().toISOString(),
        data: { test: "data" },
      };

      await db
        .insertInto("outboxEvents")
        .values({
          id: eventId,
          ledgerId: testLedgerId,
          eventType: "allocation.created",
          source: "engine-test",
          schemaVersion: 1,
          payload: event as unknown as Record<string, unknown>,
          publishAttempts: 0,
          nextAttemptAt: null,
        })
        .execute();

      // Act: Import and run publisher (would normally run in background)
      const { startOutboxPublisher, stopOutboxPublisher } = await import(
        "../../../src/workers/outbox-publisher"
      );

      // Set environment variable for test
      process.env["FLOYD_EVENT_INGEST_URL"] = "https://test.example.com/ingest";

      // Give publisher a moment to process
      startOutboxPublisher();
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait for poll + publish
      stopOutboxPublisher();

      // Assert: Event was published via HTTP
      expect(fetchMock).toHaveBeenCalledWith(
        "https://test.example.com/ingest",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "Floyd-Engine-ID": "engine-test",
          }),
        }),
      );

      // Assert: Event marked as published in database
      const publishedEvent = await db
        .selectFrom("outboxEvents")
        .selectAll()
        .where("id", "=", eventId)
        .executeTakeFirst();

      expect(publishedEvent?.publishedAt).not.toBeNull();
      expect(publishedEvent?.lastPublishError).toBeNull();
      expect(publishedEvent?.nextAttemptAt).toBeNull();
    });

    it("sets nextAttemptAt on retryable failure", async () => {
      // Arrange: Insert event and mock 500 error
      const eventId = generateId("evt");
      const event: InternalEvent = {
        id: eventId,
        type: "booking.created",
        ledgerId: testLedgerId,
        source: "engine-test",
        schemaVersion: 1,
        timestamp: new Date().toISOString(),
        data: { test: "data" },
      };

      await db
        .insertInto("outboxEvents")
        .values({
          id: eventId,
          ledgerId: testLedgerId,
          eventType: "booking.created",
          source: "engine-test",
          schemaVersion: 1,
          payload: event as unknown as Record<string, unknown>,
          publishAttempts: 0,
          nextAttemptAt: null,
        })
        .execute();

      // Mock 500 error (retryable)
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      process.env["FLOYD_EVENT_INGEST_URL"] = "https://test.example.com/ingest";

      // Act: Run publisher
      const { startOutboxPublisher, stopOutboxPublisher } = await import(
        "../../../src/workers/outbox-publisher"
      );

      startOutboxPublisher();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      stopOutboxPublisher();

      // Assert: Event NOT published, but has nextAttemptAt scheduled
      const failedEvent = await db
        .selectFrom("outboxEvents")
        .selectAll()
        .where("id", "=", eventId)
        .executeTakeFirst();

      expect(failedEvent?.publishedAt).toBeNull();
      expect(failedEvent?.publishAttempts).toBeGreaterThan(0);
      expect(failedEvent?.nextAttemptAt).not.toBeNull();
      expect(failedEvent?.lastPublishError).toContain("500");
    });

    it("does not schedule retry for non-retryable errors", async () => {
      // Arrange: Insert event and mock 401 error
      const eventId = generateId("evt");
      const event: InternalEvent = {
        id: eventId,
        type: "booking.created",
        ledgerId: testLedgerId,
        source: "engine-test",
        schemaVersion: 1,
        timestamp: new Date().toISOString(),
        data: { test: "data" },
      };

      await db
        .insertInto("outboxEvents")
        .values({
          id: eventId,
          ledgerId: testLedgerId,
          eventType: "booking.created",
          source: "engine-test",
          schemaVersion: 1,
          payload: event as unknown as Record<string, unknown>,
          publishAttempts: 0,
          nextAttemptAt: null,
        })
        .execute();

      // Mock 401 error (non-retryable)
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      process.env["FLOYD_EVENT_INGEST_URL"] = "https://test.example.com/ingest";

      // Act: Run publisher
      const { startOutboxPublisher, stopOutboxPublisher } = await import(
        "../../../src/workers/outbox-publisher"
      );

      startOutboxPublisher();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      stopOutboxPublisher();

      // Assert: Event NOT published, nextAttemptAt is null (won't retry)
      const blockedEvent = await db
        .selectFrom("outboxEvents")
        .selectAll()
        .where("id", "=", eventId)
        .executeTakeFirst();

      expect(blockedEvent?.publishedAt).toBeNull();
      expect(blockedEvent?.publishAttempts).toBeGreaterThan(0);
      expect(blockedEvent?.nextAttemptAt).toBeNull(); // No retry scheduled
      expect(blockedEvent?.lastPublishError).toContain("401");
    });

    it("includes Floyd-Signature header when secret is set", async () => {
      // Arrange
      const eventId = generateId("evt");
      const event: InternalEvent = {
        id: eventId,
        type: "allocation.created",
        ledgerId: testLedgerId,
        source: "engine-test",
        schemaVersion: 1,
        timestamp: new Date().toISOString(),
        data: { test: "data" },
      };

      await db
        .insertInto("outboxEvents")
        .values({
          id: eventId,
          ledgerId: testLedgerId,
          eventType: "allocation.created",
          source: "engine-test",
          schemaVersion: 1,
          payload: event as unknown as Record<string, unknown>,
          publishAttempts: 0,
          nextAttemptAt: null,
        })
        .execute();

      process.env["FLOYD_EVENT_INGEST_URL"] = "https://test.example.com/ingest";
      process.env["FLOYD_ENGINE_SECRET"] = "test-secret-key";

      // Act
      const { startOutboxPublisher, stopOutboxPublisher } = await import(
        "../../../src/workers/outbox-publisher"
      );

      startOutboxPublisher();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      stopOutboxPublisher();

      // Assert: Floyd-Signature header is present and not "unsigned"
      expect(fetchMock).toHaveBeenCalledWith(
        "https://test.example.com/ingest",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Floyd-Signature": expect.stringMatching(/^sha256=/),
          }),
        }),
      );

      const calls = fetchMock.mock.calls;
      const headers = calls[0]?.[1]?.headers as Record<string, string>;
      expect(headers["Floyd-Signature"]).not.toBe("sha256=unsigned");

      // Cleanup
      delete process.env["FLOYD_ENGINE_SECRET"];
    });

    it("respects nextAttemptAt and does not publish before scheduled time", async () => {
      // Arrange: Insert event with future nextAttemptAt
      const eventId = generateId("evt");
      const futureTime = new Date(Date.now() + 60000); // 1 minute in future

      await db
        .insertInto("outboxEvents")
        .values({
          id: eventId,
          ledgerId: testLedgerId,
          eventType: "booking.created",
          source: "engine-test",
          schemaVersion: 1,
          payload: {
            id: eventId,
            type: "booking.created",
            ledgerId: testLedgerId,
            source: "engine-test",
            schemaVersion: 1,
            timestamp: new Date().toISOString(),
            data: {},
          } as unknown as Record<string, unknown>,
          publishAttempts: 1,
          nextAttemptAt: futureTime,
        })
        .execute();

      process.env["FLOYD_EVENT_INGEST_URL"] = "https://test.example.com/ingest";

      // Act: Run publisher
      const { startOutboxPublisher, stopOutboxPublisher } = await import(
        "../../../src/workers/outbox-publisher"
      );

      startOutboxPublisher();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      stopOutboxPublisher();

      // Assert: Event was NOT published (nextAttemptAt is in future)
      expect(fetchMock).not.toHaveBeenCalled();

      // Event still in outbox unpublished
      const event = await db
        .selectFrom("outboxEvents")
        .selectAll()
        .where("id", "=", eventId)
        .executeTakeFirst();

      expect(event?.publishedAt).toBeNull();
      expect(event?.publishAttempts).toBe(1); // Unchanged
    });

    it("stops retrying after MAX_ATTEMPTS", async () => {
      // Arrange: Insert event with MAX_ATTEMPTS - 1
      const eventId = generateId("evt");

      await db
        .insertInto("outboxEvents")
        .values({
          id: eventId,
          ledgerId: testLedgerId,
          eventType: "booking.created",
          source: "engine-test",
          schemaVersion: 1,
          payload: {
            id: eventId,
            type: "booking.created",
            ledgerId: testLedgerId,
            source: "engine-test",
            schemaVersion: 1,
            timestamp: new Date().toISOString(),
            data: {},
          } as unknown as Record<string, unknown>,
          publishAttempts: 24, // One below MAX_ATTEMPTS (25)
          nextAttemptAt: null,
        })
        .execute();

      // Mock 500 error
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server Error"),
      });

      process.env["FLOYD_EVENT_INGEST_URL"] = "https://test.example.com/ingest";

      // Act: Run publisher - give it more time to process
      const { startOutboxPublisher, stopOutboxPublisher } = await import(
        "../../../src/workers/outbox-publisher"
      );

      startOutboxPublisher();
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Extra time
      stopOutboxPublisher();

      // Assert: Event exhausted retries (may still be at 24 or reached 25)
      const exhaustedEvent = await db
        .selectFrom("outboxEvents")
        .selectAll()
        .where("id", "=", eventId)
        .executeTakeFirst();

      expect(exhaustedEvent?.publishedAt).toBeNull();
      // The worker may not increment beyond 24 if it determines it's already at max
      expect(exhaustedEvent?.publishAttempts).toBeGreaterThanOrEqual(24);
      expect(exhaustedEvent?.nextAttemptAt).toBeNull(); // No more retries
      expect(exhaustedEvent?.lastPublishError).toContain("500");
    });
  });

  describe("Circuit Breaker", () => {
    it("activates circuit breaker after consecutive failures", async () => {
      // Arrange: Insert 5 events
      const eventIds = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const eventId = generateId("evt");
          await db
            .insertInto("outboxEvents")
            .values({
              id: eventId,
              ledgerId: testLedgerId,
              eventType: "booking.created",
              source: "engine-test",
              schemaVersion: 1,
              payload: {
                id: eventId,
                type: "booking.created",
                ledgerId: testLedgerId,
                source: "engine-test",
                schemaVersion: 1,
                timestamp: new Date().toISOString(),
                data: { index: i },
              } as unknown as Record<string, unknown>,
              publishAttempts: 0,
              nextAttemptAt: null,
            })
            .execute();
          return eventId;
        }),
      );

      // Mock 500 error for all requests
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server Error"),
      });

      process.env["FLOYD_EVENT_INGEST_URL"] = "https://test.example.com/ingest";

      // Act
      const { startOutboxPublisher, stopOutboxPublisher } = await import(
        "../../../src/workers/outbox-publisher"
      );

      startOutboxPublisher();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      stopOutboxPublisher();

      // Assert: Circuit breaker should activate after 3 consecutive failures
      // So at most 3 requests should be made, not all 5
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
    });
  });
});
