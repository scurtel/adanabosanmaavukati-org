/**
 * Av. Ceren Sümer Cilli aile hukuku profilini WordPress sayfa 15'e yazar.
 * Varsayılan: DRY-RUN. Canlı yazmak için --execute gerekir.
 *
 *   node scripts/apply-ceren-credentials.mjs
 *   node scripts/apply-ceren-credentials.mjs --execute
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wpFetch } from './lib/wp-fetch.mjs';
import {
  buildProfileHtml,
  buildProfileJsonLd,
  injectProfileSchema,
  PROFILE_PAGE_ID,
  PROFILE_URL,
} from './lib/ceren-profile-content.mjs';

const EXECUTE = process.argv.includes('--execute');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'reports', 'credential-entity-2026-08-21');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const html = injectProfileSchema(buildProfileHtml(), buildProfileJsonLd());

  const report = {
    generated_at: new Date().toISOString(),
    execute: EXECUTE,
    profile_url: PROFILE_URL,
    page_id: PROFILE_PAGE_ID,
  };

  if (!EXECUTE) {
    writeFileSync(join(OUT, 'would-apply-profile.html'), html, 'utf8');
    report.action = 'dry-run';
    writeFileSync(join(OUT, 'apply-dry-run.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log('DRY-RUN: canlı WordPress’e yazılmadı.');
    console.log('Canlı uygulamak için onay sonrası: node scripts/apply-ceren-credentials.mjs --execute');
    return;
  }

  const current = await wpFetch(`/wp-json/wp/v2/pages/${PROFILE_PAGE_ID}?context=edit`);
  const page = await current.json();
  writeFileSync(
    join(OUT, `page-${PROFILE_PAGE_ID}-pre.json`),
    JSON.stringify(
      { id: page.id, slug: page.slug, title: page.title, content: page.content?.raw },
      null,
      2
    ),
    'utf8'
  );

  const res = await wpFetch(`/wp-json/wp/v2/pages/${PROFILE_PAGE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: html,
      status: 'publish',
    }),
  });
  const updated = await res.json();
  report.action = 'updated';
  report.link = updated.link;
  writeFileSync(join(OUT, 'apply-result.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('Profil sayfası güncellendi:', updated.link);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
