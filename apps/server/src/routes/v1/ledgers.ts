import { Hono } from "hono";
import { operations } from "../../operations/index.js";
import { NotFoundError } from "lib/errors";
import { serializeLedger } from "./serializers";

export const ledgers = new Hono()
  .get("/", async (c) => {
    const { ledgers } = await operations.ledger.list();
    return c.json({ data: ledgers.map(serializeLedger) });
  })

  .get("/:id", async (c) => {
    const { ledger } = await operations.ledger.get({ id: c.req.param("id") });
    if (!ledger) throw new NotFoundError("Ledger not found");
    return c.json({ data: serializeLedger(ledger) });
  })

  .post("/", async (c) => {
    const { ledger } = await operations.ledger.create();
    return c.json({ data: serializeLedger(ledger) }, 201);
  });
