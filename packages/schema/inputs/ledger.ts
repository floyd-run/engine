import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const get = z.object({
  id: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});
