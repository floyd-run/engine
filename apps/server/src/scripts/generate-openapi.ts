import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { writeFileSync } from "fs";
import { join } from "path";
import { allocation, resource, workspace, error } from "@floyd-run/schema/outputs";

const registry = new OpenAPIRegistry();

// Register schemas
registry.register("Workspace", workspace.schema);
registry.register("Resource", resource.schema);
registry.register("Allocation", allocation.schema);
registry.register("Error", error.schema);

// Workspace routes
registry.registerPath({
  method: "get",
  path: "/v1/workspaces",
  tags: ["Workspaces"],
  summary: "List all workspaces",
  responses: {
    200: {
      description: "List of workspaces",
      content: { "application/json": { schema: workspace.listSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/workspaces/{id}",
  tags: ["Workspaces"],
  summary: "Get a workspace by ID",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Workspace ID" }),
    }),
  },
  responses: {
    200: {
      description: "Workspace details",
      content: { "application/json": { schema: workspace.getSchema } },
    },
    404: {
      description: "Workspace not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/workspaces",
  tags: ["Workspaces"],
  summary: "Create a new workspace",
  request: {
    body: {
      content: { "application/json": { schema: z.object({}) } },
    },
  },
  responses: {
    201: {
      description: "Workspace created",
      content: { "application/json": { schema: workspace.getSchema } },
    },
  },
});

// Resource routes
registry.registerPath({
  method: "get",
  path: "/v1/workspaces/{workspaceId}/resources",
  tags: ["Resources"],
  summary: "List all resources in a workspace",
  request: { params: z.object({ workspaceId: z.string() }) },
  responses: {
    200: {
      description: "List of resources",
      content: { "application/json": { schema: resource.listSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/workspaces/{workspaceId}/resources/{id}",
  tags: ["Resources"],
  summary: "Get a resource by ID",
  request: {
    params: z.object({ workspaceId: z.string(), id: z.string() }),
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
  path: "/v1/workspaces/{workspaceId}/resources",
  tags: ["Resources"],
  summary: "Create a new resource",
  request: {
    params: z.object({ workspaceId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            timezone: z.string().default("UTC").openapi({ example: "America/New_York" }),
          }),
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
  path: "/v1/workspaces/{workspaceId}/resources/{id}",
  tags: ["Resources"],
  summary: "Delete a resource",
  request: {
    params: z.object({ workspaceId: z.string(), id: z.string() }),
  },
  responses: {
    204: { description: "Resource deleted" },
    404: {
      description: "Resource not found",
      content: { "application/json": { schema: error.schema } },
    },
  },
});

// Allocation routes
registry.registerPath({
  method: "get",
  path: "/v1/workspaces/{workspaceId}/allocations",
  tags: ["Allocations"],
  summary: "List all allocations in a workspace",
  request: { params: z.object({ workspaceId: z.string() }) },
  responses: {
    200: {
      description: "List of allocations",
      content: { "application/json": { schema: allocation.listSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/workspaces/{workspaceId}/allocations/{id}",
  tags: ["Allocations"],
  summary: "Get an allocation by ID",
  request: {
    params: z.object({ workspaceId: z.string(), id: z.string() }),
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
  path: "/v1/workspaces/{workspaceId}/allocations",
  tags: ["Allocations"],
  summary: "Create a new allocation",
  description:
    "Creates a new allocation for a resource. Supports idempotency via the Idempotency-Key header.",
  request: {
    params: z.object({ workspaceId: z.string() }),
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
  path: "/v1/workspaces/{workspaceId}/allocations/{id}/confirm",
  tags: ["Allocations"],
  summary: "Confirm a held allocation",
  description: "Confirms an allocation that is currently in HOLD status.",
  request: {
    params: z.object({ workspaceId: z.string(), id: z.string() }),
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
  path: "/v1/workspaces/{workspaceId}/allocations/{id}/cancel",
  tags: ["Allocations"],
  summary: "Cancel an allocation",
  description: "Cancels an allocation that is in HOLD or CONFIRMED status.",
  request: {
    params: z.object({ workspaceId: z.string(), id: z.string() }),
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
