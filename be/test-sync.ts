import 'dotenv/config';
import { syncRegistrations } from './src/jobs/praanaSync.js';

async function main() {
  await syncRegistrations();
  process.exit(0);
}

main();
