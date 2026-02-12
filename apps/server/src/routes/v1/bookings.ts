import { Hono } from "hono";
import { operations } from "operations";
import { NotFoundError } from "lib/errors";
import { idempotent, storeIdempotencyResponse, IdempotencyVariables } from "infra/idempotency";
import { serializeBooking } from "./serializers";

// Significant fields for booking create idempotency hash
const BOOKING_SIGNIFICANT_FIELDS = ["serviceId", "resourceId", "startAt", "endAt", "status"];

// Nested under /v1/ledgers/:ledgerId/bookings
export const bookings = new Hono<{ Variables: IdempotencyVariables }>()
  .get("/", async (c) => {
    const { bookings } = await operations.booking.list({
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.json({
      data: bookings.map(({ booking, allocations }) => serializeBooking(booking, allocations)),
    });
  })

  .get("/:id", async (c) => {
    const { booking, allocations } = await operations.booking.get({ id: c.req.param("id") });
    if (!booking) throw new NotFoundError("Booking not found");
    return c.json({ data: serializeBooking(booking, allocations) });
  })

  .post("/", idempotent({ significantFields: BOOKING_SIGNIFICANT_FIELDS }), async (c) => {
    const body = c.get("parsedBody") || (await c.req.json());
    const { booking, allocations, serverTime } = await operations.booking.create({
      ...(body as object),
      ledgerId: c.req.param("ledgerId")!,
    } as Parameters<typeof operations.booking.create>[0]);
    const responseBody = { data: serializeBooking(booking, allocations), meta: { serverTime } };
    await storeIdempotencyResponse(c, responseBody, 201);
    return c.json(responseBody, 201);
  })

  .post("/:id/confirm", idempotent(), async (c) => {
    const { booking, allocations, serverTime } = await operations.booking.confirm({
      id: c.req.param("id"),
    });
    const responseBody = { data: serializeBooking(booking, allocations), meta: { serverTime } };
    await storeIdempotencyResponse(c, responseBody, 200);
    return c.json(responseBody);
  })

  .post("/:id/cancel", idempotent(), async (c) => {
    const { booking, allocations, serverTime } = await operations.booking.cancel({
      id: c.req.param("id"),
    });
    const responseBody = { data: serializeBooking(booking, allocations), meta: { serverTime } };
    await storeIdempotencyResponse(c, responseBody, 200);
    return c.json(responseBody);
  });
