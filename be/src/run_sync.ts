import 'dotenv/config';
import { syncRegistrations } from './jobs/vtopiaSync.js';
console.log('Starting sync manually...');
syncRegistrations().then(() => console.log('Done')).catch(console.error);
