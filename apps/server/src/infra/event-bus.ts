import type { Transaction } from "kysely";
import type { Database } from "database/schema";
import { generateId } from "@floyd-run/utils";

// Internal event types for the event bus
export type InternalEventType =
  | "allocation.created"
  | "allocation.deleted"
  | "booking.created"
  | "booking.confirmed"
  | "booking.canceled"
  | "booking.expired";

export interface InternalEvent {
  id: string;
  type: InternalEventType;
  ledgerId: string;
  schemaVersion: number;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Emit an internal event to the outbox for eventual delivery.
 * MUST be called within the same transaction as the data mutation.
 *
 * @param trx - The transaction object (enforces transactional safety)
 * @param type - The event type
 * @param ledgerId - The ledger ID this event belongs to
 * @param data - The event payload data (caller is responsible for serialization)
 */
export async function emitEvent(
  trx: Transaction<Database>,
  type: InternalEventType,
  ledgerId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const eventId = generateId("evt");

  const event: InternalEvent = {
    id: eventId,
    type,
    ledgerId,
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    data,
  };

  await trx
    .insertInto("outboxEvents")
    .values({
      id: eventId,
      ledgerId,
      eventType: type,
      schemaVersion: 1,
      payload: event as unknown as Record<string, unknown>,
      publishAttempts: 0,
    })
    .execute();
}
