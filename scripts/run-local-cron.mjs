#!/usr/bin/env node
/**
 * Local cron loop — runs hourly-ingest.mjs on an interval.
 *
 *   node scripts/run-local-cron.mjs              # every 60 minutes
 *   node scripts/run-local-cron.mjs --every 60   # seconds (dev: try --every 10 --advance)
 *   node scripts/run-local-cron.mjs --once       # single ingest then exit
 *   node scripts/run-local-cron.mjs --advance    # demo: each tick adds the next hour
 */
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const ingest = join(__dirname, 'hourly-ingest.mjs');

const once = process.argv.includes('--once');
const advance = process.argv.includes('--advance');
const live = process.argv.includes('--live');
const everyIdx = process.argv.indexOf('--every');
const everySec = everyIdx >= 0 ? Number(process.argv[everyIdx + 1]) : 3600;

function runIngest() {
  const args = [ingest];
  if (advance) args.push('--advance');
  if (live) args.push('--live');
  console.log(`[${new Date().toISOString()}] running: node ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ingest exit ${code}`))));
  });
}

async function main() {
  await runIngest();
  if (once) return;
  const ms = Math.max(5, everySec) * 1000;
  console.log(`Local cron armed — next run in ${everySec}s (Ctrl+C to stop)`);
  setInterval(() => {
    runIngest().catch((err) => console.error(err));
  }, ms);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
