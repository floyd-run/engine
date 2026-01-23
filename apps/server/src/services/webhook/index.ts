import create from "./create";
import get from "./get";
import list from "./list";
import update from "./update";
import remove from "./remove";
import rotateSecret from "./rotate-secret";
import listDeliveries from "./list-deliveries";
import retryDelivery from "./retry-delivery";

export const webhook = {
  create,
  get,
  list,
  update,
  remove,
  rotateSecret,
  listDeliveries,
  retryDelivery,
};
