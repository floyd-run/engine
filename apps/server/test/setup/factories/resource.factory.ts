import { faker } from "@faker-js/faker";
import { db } from "database";
import { generateId } from "lib/id";

export async function createResource() {
  const resource = await db
    .insertInto("resources")
    .values({
      id: generateId("res"),
      name: faker.string.uuid(),
      timezone: faker.location.timeZone(),
      metadata: {},
    })
    .returningAll()
    .executeTakeFirst();

  return { resource: resource! };
}
