import { PrismaClient } from "@prisma/client";
import { seedTlrCatalog } from "./seedTlrCatalog";

/**
 * Loads reference data — the things the application needs in order to work at all, as
 * opposed to demo content.
 *
 * Today that is the TLR field catalog. It used to load only as part of the demo seed, which
 * meant an environment started without SEED_ON_START had an empty TLR form and an export
 * that failed with "mapping version is not seeded". Reference data is not optional, so it
 * has its own entry point that every boot runs. Everything here is an upsert, which is also
 * how a regenerated catalog reaches an environment that is already running.
 */
const prisma = new PrismaClient();

async function main() {
  const catalog = await seedTlrCatalog(prisma);
  if (catalog.fields !== catalog.expected) {
    throw new Error(`TLR catalog loaded ${catalog.fields} fields but the catalog declares ${catalog.expected}`);
  }
  console.log("Reference data loaded:", catalog);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
