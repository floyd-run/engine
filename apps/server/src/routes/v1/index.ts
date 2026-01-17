import { Hono } from "hono";
import { resource } from "./resources";

export const v1 = new Hono().route("/resources", resource);
