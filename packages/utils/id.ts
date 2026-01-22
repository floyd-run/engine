import { ulid } from "ulid";

export type IdPrefix = "ws" | "res" | "alloc" | "idem";

export function generateId(prefix: IdPrefix): string {
  return `${prefix}_${ulid().toLowerCase()}`;
}

export function parseId(id: string): { prefix: IdPrefix; ulid: string } | null {
  const match = id.match(/^(ws|res|alloc|idem)_([a-z0-9]{26})$/);
  if (!match) return null;
  return { prefix: match[1] as IdPrefix, ulid: match[2]! };
}

export function isValidId(id: string, expectedPrefix?: IdPrefix): boolean {
  const parsed = parseId(id);
  if (!parsed) return false;
  if (expectedPrefix && parsed.prefix !== expectedPrefix) return false;
  return true;
}
