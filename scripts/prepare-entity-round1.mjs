#!/usr/bin/env node
/**
 * Entity Round 1 — Person sameAs only (adanabosanmaavukati.org).
 * Default dry-run. Production: --execute
 */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, 'lib/entity-round1-sameas.mjs');
const extra = process.argv.slice(2);
const r = spawnSync(process.execPath, [target, ...extra], { stdio: 'inherit' });
process.exit(r.status ?? 1);
