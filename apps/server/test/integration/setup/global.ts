import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

import { execSync } from "child_process";

export default function setup() {
  console.log("Running migrations...");
  execSync("npx tsx src/scripts/migrate.ts", {
    env: process.env,
    stdio: "pipe",
    encoding: "utf-8",
  });
}
