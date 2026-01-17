import pino from "pino";
import { config } from "../config/index.js";


export const logger = config.NODE_ENV === "development"
  ? pino({
      level: "debug",
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    })
  : pino({
      level: "info",
    });