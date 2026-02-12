import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { writeFileSync } from "fs";
import { join } from "path";
import {
  allocation,
  resource,
  ledger,
  webhook,
  policy,
  error,
  availability,
} from "@floyd-run/schema/outputs";

const registry = new OpenAPIRegistry();

// Register schemas
registry.register("Ledger", ledger.schema);
registry.register("Resource", resource.schema);
registry.register("Allocation", allocation.schema);
registry.register("WebhookSubscription", webhook.subscriptionSchema);
registry.register("AvailabilityItem", availability.itemSchema);
registry.register("TimelineBlock", availability.timelineBlockSchema);
registry.register("Policy", policy.schema);
registry.register("Error", error.schema);

// Ledger routes
registry.registerPath({
  method: "get",
  path: "/v1/ledgers",
  tags: ["Ledgers"],
  summary: "List all ledgers",
  responses: {
    200: {
      description: "List of ledgers",
      content: { "application/json": { schema: ledger.listSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{id}",
  tags: ["Ledgers"],
  summary: "Get a ledger by ID",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Ledger ID" }),
    }),
  },
  responses: {
    200: {
      description: "Ledger details",
      content: { "application/json": { schema: ledger.getSchema } },
    },
    404: {
      description: "Ledger not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers",
  tags: ["Ledgers"],
  summary: "Create a new ledger",
  request: {
    body: {
      content: { "application/json": { schema: z.object({}) } },
    },
  },
  responses: {
    201: {
      description: "Ledger created",
      content: { "application/json": { schema: ledger.getSchema } },
    },
  },
});

// Resource routes
registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/resources",
  tags: ["Resources"],
  summary: "List all resources in a ledger",
  request: { params: z.object({ ledgerId: z.string() }) },
  responses: {
    200: {
      description: "List of resources",
      content: { "application/json": { schema: resource.listSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/resources/{id}",
  tags: ["Resources"],
  summary: "Get a resource by ID",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Resource details",
      content: { "application/json": { schema: resource.getSchema } },
    },
    404: {
      description: "Resource not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/resources",
  tags: ["Resources"],
  summary: "Create a new resource",
  request: {
    params: z.object({ ledgerId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({}),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Resource created",
      content: { "application/json": { schema: resource.getSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/ledgers/{ledgerId}/resources/{id}",
  tags: ["Resources"],
  summary: "Delete a resource",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    204: { description: "Resource deleted" },
    404: {
      description: "Resource not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

// Availability routes
registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/availability",
  tags: ["Availability"],
  summary: "Query resource availability",
  description:
    "Returns a timeline of free/busy blocks for the specified resources within the given time window. " +
    "Overlapping and adjacent allocations are merged into single busy blocks.",
  request: {
    params: z.object({ ledgerId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            resourceIds: z.array(z.string()).openapi({
              description: "Resource IDs to query",
              example: ["rsc_01abc123def456ghi789jkl012"],
            }),
            startAt: z.string().datetime().openapi({
              description: "Start of the time window (ISO 8601)",
              example: "2026-01-04T10:00:00Z",
            }),
            endAt: z.string().datetime().openapi({
              description: "End of the time window (ISO 8601)",
              example: "2026-01-04T18:00:00Z",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Availability timeline for each resource",
      content: { "application/json": { schema: availability.querySchema } },
    },
  },
});

// Allocation routes
registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/allocations",
  tags: ["Allocations"],
  summary: "List all allocations in a ledger",
  request: { params: z.object({ ledgerId: z.string() }) },
  responses: {
    200: {
      description: "List of allocations",
      content: { "application/json": { schema: allocation.listSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/allocations/{id}",
  tags: ["Allocations"],
  summary: "Get an allocation by ID",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Allocation details",
      content: { "application/json": { schema: allocation.getSchema } },
    },
    404: {
      description: "Allocation not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/allocations",
  tags: ["Allocations"],
  summary: "Create a new allocation",
  description:
    "Creates a new allocation for a resource. Supports idempotency via the Idempotency-Key header.",
  request: {
    params: z.object({ ledgerId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            resourceId: z.string().openapi({ example: "res_01abc123def456ghi789jkl012" }),
            status: z.enum(["hold", "confirmed"]).default("hold"),
            startAt: z.string().datetime(),
            endAt: z.string().datetime(),
            expiresAt: z.string().datetime().nullable().optional(),
            metadata: z.record(z.string(), z.unknown()).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Allocation created",
      content: { "application/json": { schema: allocation.getSchema } },
    },
    409: {
      description: "Allocation conflicts with existing allocation",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/allocations/{id}/confirm",
  tags: ["Allocations"],
  summary: "Confirm a held allocation",
  description: "Confirms an allocation that is currently in HOLD status.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Allocation confirmed",
      content: { "application/json": { schema: allocation.getSchema } },
    },
    404: {
      description: "Allocation not found",
      content: { "application/json": { schema: error.schema } },
    },
    409: {
      description: "Allocation cannot be confirmed",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/allocations/{id}/cancel",
  tags: ["Allocations"],
  summary: "Cancel an allocation",
  description: "Cancels an allocation that is in HOLD or CONFIRMED status.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Allocation cancelled",
      content: { "application/json": { schema: allocation.getSchema } },
    },
    404: {
      description: "Allocation not found",
      content: { "application/json": { schema: error.schema } },
    },
    409: {
      description: "Allocation cannot be cancelled",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

// Webhook routes
registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/webhooks",
  tags: ["Webhooks"],
  summary: "List webhook subscriptions",
  request: { params: z.object({ ledgerId: z.string() }) },
  responses: {
    200: {
      description: "List of webhook subscriptions",
      content: { "application/json": { schema: webhook.listSubscriptionsSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/webhooks",
  tags: ["Webhooks"],
  summary: "Create a webhook subscription",
  description:
    "Creates a new webhook subscription. The secret is only returned once at creation time.",
  request: {
    params: z.object({ ledgerId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            url: z.string().url().openapi({ example: "https://example.com/webhook" }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Webhook subscription created (includes secret)",
      content: { "application/json": { schema: webhook.createSubscriptionSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/v1/ledgers/{ledgerId}/webhooks/{subscriptionId}",
  tags: ["Webhooks"],
  summary: "Update a webhook subscription",
  request: {
    params: z.object({ ledgerId: z.string(), subscriptionId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            url: z.string().url().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Webhook subscription updated",
      content: { "application/json": { schema: webhook.updateSubscriptionSchema } },
    },
    404: {
      description: "Webhook subscription not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/ledgers/{ledgerId}/webhooks/{subscriptionId}",
  tags: ["Webhooks"],
  summary: "Delete a webhook subscription",
  request: {
    params: z.object({ ledgerId: z.string(), subscriptionId: z.string() }),
  },
  responses: {
    204: { description: "Webhook subscription deleted" },
    404: {
      description: "Webhook subscription not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/webhooks/{subscriptionId}/rotate-secret",
  tags: ["Webhooks"],
  summary: "Rotate webhook secret",
  description:
    "Generates a new secret for the webhook subscription. The old secret is invalidated immediately.",
  request: {
    params: z.object({ ledgerId: z.string(), subscriptionId: z.string() }),
  },
  responses: {
    200: {
      description: "New secret generated (includes secret)",
      content: { "application/json": { schema: webhook.rotateSecretSchema } },
    },
    404: {
      description: "Webhook subscription not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

// Policy routes
registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/policies",
  tags: ["Policies"],
  summary: "List policies for a ledger",
  request: { params: z.object({ ledgerId: z.string() }) },
  responses: {
    200: {
      description: "List of policies",
      content: { "application/json": { schema: policy.listSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/policies/{id}",
  tags: ["Policies"],
  summary: "Get a policy by ID",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Policy details",
      content: { "application/json": { schema: policy.getSchema } },
    },
    404: {
      description: "Policy not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/policies",
  tags: ["Policies"],
  summary: "Create a policy",
  description:
    "Creates a new scheduling policy for the ledger. The config is provided in authoring format (friendly units like minutes/hours) and stored in canonical format (milliseconds).",
  request: {
    params: z.object({ ledgerId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            config: z
              .object({
                schema_version: z.literal(1),
                default: z.enum(["open", "closed"]),
                config: z.object({}).passthrough(),
                rules: z.array(z.object({}).passthrough()).optional(),
              })
              .passthrough()
              .openapi({ description: "Policy configuration in authoring format" }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Policy created (may include warnings)",
      content: { "application/json": { schema: policy.getSchema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/ledgers/{ledgerId}/policies/{id}",
  tags: ["Policies"],
  summary: "Update a policy",
  description:
    "Replaces the full policy configuration. The config is re-normalized, re-validated, and re-hashed.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            config: z
              .object({
                schema_version: z.literal(1),
                default: z.enum(["open", "closed"]),
                config: z.object({}).passthrough(),
                rules: z.array(z.object({}).passthrough()).optional(),
              })
              .passthrough()
              .openapi({ description: "Policy configuration in authoring format" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Policy updated (may include warnings)",
      content: { "application/json": { schema: policy.getSchema } },
    },
    404: {
      description: "Policy not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/ledgers/{ledgerId}/policies/{id}",
  tags: ["Policies"],
  summary: "Delete a policy",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    204: { description: "Policy deleted" },
    404: {
      description: "Policy not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

// Generate OpenAPI document
const generator = new OpenApiGeneratorV31(registry.definitions);
const doc = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Floyd Engine API",
    version: "1.0.0",
    description: "Resource scheduling and allocation engine",
  },
  servers: [
    {
      url: "{baseUrl}",
      description: "API Server",
      variables: {
        baseUrl: {
          default: "https://api.floyd.run",
          description: "Base URL for the Floyd Engine API",
        },
      },
    },
  ],
});

// Write to file
const outputPath = join(import.meta.dirname, "../../openapi.json");
writeFileSync(outputPath, JSON.stringify(doc, null, 2));
console.log(`OpenAPI spec written to ${outputPath}`);
