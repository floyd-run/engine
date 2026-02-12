import { db } from "database";
import { generateId } from "@floyd-run/utils";
import { faker } from "@faker-js/faker";
import { createService } from "./service.factory";
import { createResource } from "./resource.factory";

export async function createBooking(overrides?: {
  ledgerId?: string;
  serviceId?: string;
  resourceId?: string;
  status?: "hold" | "confirmed" | "cancelled" | "expired";
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  startAt?: Date;
  endAt?: Date;
}) {
  let ledgerId = overrides?.ledgerId;
  let serviceId = overrides?.serviceId;
  let resourceId = overrides?.resourceId;

  // If no service or resource provided, create the full chain
  if (!serviceId || !resourceId) {
    if (!ledgerId) {
      const { createLedger } = await import("./ledger.factory");
      const { ledger } = await createLedger();
      ledgerId = ledger.id;
    }

    if (!resourceId) {
      const { resource } = await createResource({ ledgerId });
      resourceId = resource.id;
    }

    if (!serviceId) {
      const { service } = await createService({ ledgerId, resourceIds: [resourceId] });
      serviceId = service.id;
    }
  }

  if (!ledgerId) {
    const svc = await db
      .selectFrom("services")
      .where("id", "=", serviceId)
      .selectAll()
      .executeTakeFirstOrThrow();
    ledgerId = svc.ledgerId;
  }

  const startAt = overrides?.startAt ?? faker.date.future();
  const endAt = overrides?.endAt ?? new Date(startAt.getTime() + 60 * 60 * 1000);
  const status = overrides?.status ?? "hold";

  // Respect DB constraint: hold requires expiresAt, others require null
  const expiresAt =
    overrides?.expiresAt !== undefined
      ? overrides.expiresAt
      : status === "hold"
        ? new Date(Date.now() + 15 * 60 * 1000)
        : null;

  const booking = await db
    .insertInto("bookings")
    .values({
      id: generateId("bkg"),
      ledgerId,
      serviceId,
      status,
      expiresAt,
      metadata: overrides?.metadata ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const allocation = await db
    .insertInto("allocations")
    .values({
      id: generateId("alc"),
      ledgerId,
      resourceId,
      bookingId: booking.id,
      active: status === "hold" || status === "confirmed",
      startAt,
      endAt,
      expiresAt,
      metadata: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { booking, allocation, ledgerId, serviceId, resourceId };
}
