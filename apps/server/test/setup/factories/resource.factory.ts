import { faker } from "@faker-js/faker";
import { db } from "database";

export async function createResource() {
  const resource = await db
    .insertInto("resources")
    .values({
      name: faker.string.uuid(),
      timezone: faker.location.timeZone(),
      metadata: {},
    })
    .returningAll()
    .executeTakeFirst();

  return { resource: resource! };
}
