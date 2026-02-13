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
  service,
  booking,
} from "@floyd-run/schema/outputs";

const registry = new OpenAPIRegistry();

// Register schemas
registry.register("Ledger", ledger.base);
registry.register("Resource", resource.base);
registry.register("Allocation", allocation.base);
registry.register("WebhookSubscription", webhook.subscription);
registry.register("AvailabilityItem", availability.item);
registry.register("TimelineBlock", availability.timelineBlock);
registry.register("Slot", availability.slot);
registry.register("ResourceSlots", availability.resourceSlots);
registry.register("Window", availability.window);
registry.register("ResourceWindows", availability.resourceWindows);
registry.register("Policy", policy.base);
registry.register("Service", service.base);
registry.register("Booking", booking.base);
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
      content: { "application/json": { schema: ledger.list } },
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
      content: { "application/json": { schema: ledger.get } },
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
      content: { "application/json": { schema: ledger.get } },
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
      content: { "application/json": { schema: resource.list } },
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
      content: { "application/json": { schema: resource.get } },
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
          schema: z.object({
            timezone: z.string().openapi({
              description: "IANA timezone for the resource (e.g. America/New_York)",
              example: "America/New_York",
            }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Resource created",
      content: { "application/json": { schema: resource.get } },
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
            startTime: z.string().datetime().openapi({
              description: "Start of the time window (ISO 8601)",
              example: "2026-01-04T10:00:00Z",
            }),
            endTime: z.string().datetime().openapi({
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
      content: { "application/json": { schema: availability.query } },
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
      content: { "application/json": { schema: allocation.list } },
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
      content: { "application/json": { schema: allocation.get } },
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
    "Creates a raw allocation for a resource. Use bookings for policy-evaluated reservations with lifecycle management. Supports idempotency via the Idempotency-Key header.",
  request: {
    params: z.object({ ledgerId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            resourceId: z.string().openapi({ example: "rsc_01abc123def456ghi789jkl012" }),
            startTime: z.string().datetime(),
            endTime: z.string().datetime(),
            expiresAt: z.string().datetime().nullable().optional().openapi({
              description: "If set, the allocation auto-expires after this time",
            }),
            metadata: z.record(z.string(), z.unknown()).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Allocation created",
      content: { "application/json": { schema: allocation.get } },
    },
    409: {
      description: "Allocation conflicts with existing allocation",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/ledgers/{ledgerId}/allocations/{id}",
  tags: ["Allocations"],
  summary: "Delete an allocation",
  description:
    "Deletes a raw allocation. Allocations that belong to a booking cannot be deleted directly — cancel the booking instead.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    204: { description: "Allocation deleted" },
    404: {
      description: "Allocation not found",
      content: { "application/json": { schema: error.schema } },
    },
    409: {
      description: "Allocation belongs to a booking",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

// Service routes
registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/services",
  tags: ["Services"],
  summary: "List all services in a ledger",
  request: { params: z.object({ ledgerId: z.string() }) },
  responses: {
    200: {
      description: "List of services",
      content: { "application/json": { schema: service.list } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/services/{id}",
  tags: ["Services"],
  summary: "Get a service by ID",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Service details",
      content: { "application/json": { schema: service.get } },
    },
    404: {
      description: "Service not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/services",
  tags: ["Services"],
  summary: "Create a new service",
  description: "Creates a service that groups resources with an optional scheduling policy.",
  request: {
    params: z.object({ ledgerId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().openapi({ description: "Service name", example: "Haircut" }),
            policyId: z
              .string()
              .nullable()
              .optional()
              .openapi({ description: "Policy to enforce on bookings" }),
            resourceIds: z
              .array(z.string())
              .optional()
              .openapi({
                description: "Resources that belong to this service",
                example: ["rsc_01abc123def456ghi789jkl012"],
              }),
            metadata: z.record(z.string(), z.unknown()).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Service created",
      content: { "application/json": { schema: service.get } },
    },
    404: {
      description: "Policy or resource not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/ledgers/{ledgerId}/services/{id}",
  tags: ["Services"],
  summary: "Update a service",
  description:
    "Replaces the full service definition including name, policy, and resource assignments.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().openapi({ description: "Service name", example: "Haircut" }),
            policyId: z
              .string()
              .nullable()
              .optional()
              .openapi({ description: "Policy to enforce on bookings" }),
            resourceIds: z
              .array(z.string())
              .optional()
              .openapi({
                description: "Resources that belong to this service",
                example: ["rsc_01abc123def456ghi789jkl012"],
              }),
            metadata: z.record(z.string(), z.unknown()).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Service updated",
      content: { "application/json": { schema: service.get } },
    },
    404: {
      description: "Service, policy, or resource not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/ledgers/{ledgerId}/services/{id}",
  tags: ["Services"],
  summary: "Delete a service",
  description: "Deletes a service. Fails if the service has bookings in hold or confirmed status.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    204: { description: "Service deleted" },
    404: {
      description: "Service not found",
      content: { "application/json": { schema: error.schema } },
    },
    409: {
      description: "Service has active bookings",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

// Service Availability routes
registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/services/{id}/availability/slots",
  tags: ["Service Availability"],
  summary: "Query available booking slots",
  description:
    "Returns discrete grid-aligned time slots for appointment-style booking. " +
    "Applies the service's policy (schedule, duration, grid, buffers, lead time) and filters by existing allocations. " +
    "Pass includeUnavailable: true to get the full grid with available/unavailable status.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            startTime: z.string().datetime().openapi({
              description: "Start of the query window (ISO 8601)",
              example: "2026-03-02T00:00:00Z",
            }),
            endTime: z.string().datetime().openapi({
              description: "End of the query window (ISO 8601). Max 7 days from startTime.",
              example: "2026-03-07T00:00:00Z",
            }),
            durationMs: z.number().int().positive().openapi({
              description: "Desired booking duration in milliseconds",
              example: 3600000,
            }),
            resourceIds: z.array(z.string()).optional().openapi({
              description:
                "Filter to specific resources. Defaults to all resources in the service.",
            }),
            includeUnavailable: z.boolean().optional().openapi({
              description: "Return all grid positions with status. Defaults to false.",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Available slots per resource",
      content: { "application/json": { schema: availability.slotsResponse } },
    },
    404: {
      description: "Service not found",
      content: { "application/json": { schema: error.schema } },
    },
    422: {
      description: "Invalid input (range too large, invalid resourceIds, etc.)",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/services/{id}/availability/windows",
  tags: ["Service Availability"],
  summary: "Query available time windows",
  description:
    "Returns continuous available time ranges for rental-style booking. " +
    "Applies the service's policy and subtracts existing allocations (with buffer-aware gap shrinkage). " +
    "Pass includeUnavailable: true to get the full schedule with available/unavailable status.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            startTime: z.string().datetime().openapi({
              description: "Start of the query window (ISO 8601)",
              example: "2026-03-02T00:00:00Z",
            }),
            endTime: z.string().datetime().openapi({
              description: "End of the query window (ISO 8601). Max 31 days from startTime.",
              example: "2026-03-07T00:00:00Z",
            }),
            resourceIds: z.array(z.string()).optional().openapi({
              description:
                "Filter to specific resources. Defaults to all resources in the service.",
            }),
            includeUnavailable: z.boolean().optional().openapi({
              description: "Return full schedule with status. Defaults to false.",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Available windows per resource",
      content: { "application/json": { schema: availability.windowsResponse } },
    },
    404: {
      description: "Service not found",
      content: { "application/json": { schema: error.schema } },
    },
    422: {
      description: "Invalid input (range too large, invalid resourceIds, etc.)",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

// Booking routes
registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/bookings",
  tags: ["Bookings"],
  summary: "List all bookings in a ledger",
  request: { params: z.object({ ledgerId: z.string() }) },
  responses: {
    200: {
      description: "List of bookings",
      content: { "application/json": { schema: booking.list } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/ledgers/{ledgerId}/bookings/{id}",
  tags: ["Bookings"],
  summary: "Get a booking by ID",
  description: "Returns the booking with its nested allocations.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Booking details with allocations",
      content: { "application/json": { schema: booking.get } },
    },
    404: {
      description: "Booking not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/bookings",
  tags: ["Bookings"],
  summary: "Create a new booking",
  description:
    "Creates a booking for a service. Evaluates the service's policy, checks for conflicts, and creates the underlying allocation. " +
    "When the policy defines buffers, the allocation's startTime/endTime represent the buffer-expanded blocked window. " +
    "The original customer time can be derived using buffer.beforeMs and buffer.afterMs on the allocation. " +
    "Supports idempotency via the Idempotency-Key header.",
  request: {
    params: z.object({ ledgerId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            serviceId: z.string().openapi({ example: "svc_01abc123def456ghi789jkl012" }),
            resourceId: z.string().openapi({ example: "rsc_01abc123def456ghi789jkl012" }),
            startTime: z.string().datetime().openapi({ example: "2026-01-15T10:00:00Z" }),
            endTime: z.string().datetime().openapi({ example: "2026-01-15T11:00:00Z" }),
            status: z
              .enum(["hold", "confirmed"])
              .default("hold")
              .openapi({ description: "Initial status. Hold creates a temporary reservation." }),
            metadata: z.record(z.string(), z.unknown()).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Booking created",
      content: { "application/json": { schema: booking.get } },
    },
    404: {
      description: "Service or resource not found",
      content: { "application/json": { schema: error.schema } },
    },
    409: {
      description: "Conflict (overlap, policy rejected, or resource not in service)",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/bookings/{id}/confirm",
  tags: ["Bookings"],
  summary: "Confirm a held booking",
  description:
    "Confirms a booking that is in hold status. Idempotent — confirming an already confirmed booking returns success. Supports idempotency via the Idempotency-Key header.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Booking confirmed",
      content: { "application/json": { schema: booking.get } },
    },
    404: {
      description: "Booking not found",
      content: { "application/json": { schema: error.schema } },
    },
    409: {
      description: "Booking cannot be confirmed (expired or invalid state)",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/ledgers/{ledgerId}/bookings/{id}/cancel",
  tags: ["Bookings"],
  summary: "Cancel a booking",
  description:
    "Cancels a booking in hold or confirmed status. Idempotent — canceling an already canceled booking returns success. Supports idempotency via the Idempotency-Key header.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Booking canceled",
      content: { "application/json": { schema: booking.get } },
    },
    404: {
      description: "Booking not found",
      content: { "application/json": { schema: error.schema } },
    },
    409: {
      description: "Booking cannot be canceled (invalid state)",
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
      content: { "application/json": { schema: webhook.listSubscriptions } },
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
      content: { "application/json": { schema: webhook.createSubscription } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/v1/ledgers/{ledgerId}/webhooks/{id}",
  tags: ["Webhooks"],
  summary: "Update a webhook subscription",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
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
      content: { "application/json": { schema: webhook.updateSubscription } },
    },
    404: {
      description: "Webhook subscription not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/ledgers/{ledgerId}/webhooks/{id}",
  tags: ["Webhooks"],
  summary: "Delete a webhook subscription",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
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
  path: "/v1/ledgers/{ledgerId}/webhooks/{id}/rotate-secret",
  tags: ["Webhooks"],
  summary: "Rotate webhook secret",
  description:
    "Generates a new secret for the webhook subscription. The old secret is invalidated immediately.",
  request: {
    params: z.object({ ledgerId: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "New secret generated (includes secret)",
      content: { "application/json": { schema: webhook.rotateSecret } },
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
      content: { "application/json": { schema: policy.list } },
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
      content: { "application/json": { schema: policy.get } },
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
      content: { "application/json": { schema: policy.get } },
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
      content: { "application/json": { schema: policy.get } },
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
    description: "Booking engine for AI agents",
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
