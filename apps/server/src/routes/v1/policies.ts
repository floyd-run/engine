import { Hono } from "hono";
import { services } from "../../services/index.js";
import { NotFoundError } from "lib/errors";
import { serializePolicy } from "./serializers";

// Nested under /v1/ledgers/:ledgerId/policies
export const policies = new Hono()
  .get("/", async (c) => {
    const { policies } = await services.policy.list({
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.json({ data: policies.map(serializePolicy) });
  })

  .get("/:id", async (c) => {
    const { policy } = await services.policy.get({ id: c.req.param("id") });
    if (!policy) throw new NotFoundError("Policy not found");
    return c.json({ data: serializePolicy(policy) });
  })

  .post("/", async (c) => {
    const body = await c.req.json();
    const { policy, warnings } = await services.policy.create({
      ...(body as object),
      ledgerId: c.req.param("ledgerId")!,
    } as Parameters<typeof services.policy.create>[0]);

    const responseBody: Record<string, unknown> = { data: serializePolicy(policy) };
    if (warnings.length > 0) {
      responseBody["warnings"] = warnings;
    }
    return c.json(responseBody, 201);
  })

  .put("/:id", async (c) => {
    const body = await c.req.json();
    const { policy, warnings } = await services.policy.update({
      ...(body as object),
      id: c.req.param("id")!,
    } as Parameters<typeof services.policy.update>[0]);

    const responseBody: Record<string, unknown> = { data: serializePolicy(policy) };
    if (warnings.length > 0) {
      responseBody["warnings"] = warnings;
    }
    return c.json(responseBody);
  })

  .delete("/:id", async (c) => {
    const { deleted } = await services.policy.remove({ id: c.req.param("id") });
    if (!deleted) throw new NotFoundError("Policy not found");
    return c.body(null, 204);
  });
