// Runs a self-contained local PostgreSQL instance for development — no Docker or
// system install required. Keep this running in its own terminal while you work:
//
//   npm run db:local
//
// Data persists in server/.pgdata between runs. Uses port 5434 (the CRM's own
// embedded Postgres uses 5433) so both products' local databases can run at once
// without colliding — this product's DB is otherwise entirely separate.
import fs from "fs";
import path from "path";
import EmbeddedPostgres from "embedded-postgres";

const dataDir = path.join(__dirname, "..", ".pgdata");
const needsInit = !fs.existsSync(path.join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5434,
  persistent: true,
});

async function main() {
  if (needsInit) await pg.initialise();
  await pg.start();
  if (needsInit) await pg.createDatabase("nmtc_compliance");
  console.log("Local PostgreSQL running on postgresql://postgres:postgres@localhost:5434/nmtc_compliance");
  console.log("Press Ctrl+C to stop.");
}

async function shutdown() {
  try {
    await pg.stop();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
