import { db } from "./client";
import { createResourceRepository } from "./repositories/resource.repository";

export const resourceRepository = createResourceRepository(db);
