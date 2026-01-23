import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with OpenAPI support - must be imported before any schema definitions
extendZodWithOpenApi(z);

export { z };
