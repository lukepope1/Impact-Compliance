import { spawnSync } from "node:child_process";

/**
 * Production boot sequence for a hosted deployment (see docs/DEPLOYMENT.md).
 *
 * Migrations run here rather than at build time because a Render build has no database
 * attached — and `migrate deploy`, unlike `migrate dev`, only applies existing migration
 * files and never generates or resets anything, which is what you want running unattended
 * against a live database.
 *
 * Seeding is opt-in via SEED_ON_START, and the seed script itself no-ops when the data is
 * already present, so leaving the flag on across restarts is safe. It exists so a fresh
 * review environment comes up already populated instead of greeting the first visitor
 * with an empty app.
 */

function run(label, command, args) {
  console.log(`\n[start] ${label}…`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`[start] ${label} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

run("Applying database migrations", "npx", ["prisma", "migrate", "deploy"]);

if (process.env.SEED_ON_START === "true") {
  run("Seeding demo data", "npx", ["tsx", "prisma/seed.ts"]);
} else {
  console.log("[start] SEED_ON_START is not 'true' — skipping seed.");
}

console.log("\n[start] Starting API + client…");
await import("../dist/index.js");
