import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const isVercel = Boolean(process.env.VERCEL);
const command = isVercel ? "../node_modules/vite/bin/vite.js" : "./run-framework.mjs";
const args = isVercel ? ["build"] : ["build"];
const script = fileURLToPath(new URL(command, import.meta.url));
const result = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
