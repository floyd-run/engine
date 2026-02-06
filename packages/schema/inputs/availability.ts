import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const querySchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  resourceIds: z.array(
    z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
  ),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
});
