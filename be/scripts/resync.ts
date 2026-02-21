import "dotenv/config";
import { syncRegistrations } from "../src/jobs/vtopiaSync.js";

async function main() {
  console.log("Running manual sync...");
  await syncRegistrations();
  console.log("Done.");
  process.exit(0);
}

main().catch(console.error);
