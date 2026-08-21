/**
 * Av. Ceren Sümer Cilli aile hukuku credential/entity önizlemesi.
 * Canlı WordPress'e yazmaz.
 *
 *   node scripts/preview-credential-entity.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProfileHtml,
  buildProfileJsonLd,
  injectProfileSchema,
  PROFILE_URL,
  PERSON_ID,
  CANONICAL_PERSON_URL,
  MILLIYET_BLOG_URL,
  SAME_AS,
} from './lib/ceren-profile-content.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'reports', 'credential-entity-2026-08-21');

const html = injectProfileSchema(buildProfileHtml(), buildProfileJsonLd());
const jsonLd = buildProfileJsonLd();

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'profile.html'), html, 'utf8');
writeFileSync(join(OUT, 'person-schema.json'), JSON.stringify(jsonLd, null, 2), 'utf8');

const blob = `${html}\n${JSON.stringify(jsonLd)}`;
const privacyHits = [];
if (/T\.C\.\s*kimlik/i.test(blob)) privacyHits.push('tc-kimlik');
if (/baro sicil/i.test(blob)) privacyHits.push('baro-sicil');
if (/arabuluculuk sicil\s*no/i.test(blob)) privacyHits.push('arabuluculuk-sicil-no');

writeFileSync(
  join(OUT, 'preview-meta.json'),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      live_wp_write: false,
      profile_url: PROFILE_URL,
      person_id: PERSON_ID,
      canonical_person_url: CANONICAL_PERSON_URL,
      milliyet: MILLIYET_BLOG_URL,
      sameAs: SAME_AS,
      privacy_hits: privacyHits,
      note: 'Canlı uygulama için scripts/apply-ceren-credentials.mjs --execute gerekir; bu dosya yalnızca yerel taslaktır.',
    },
    null,
    2
  ),
  'utf8'
);

if (privacyHits.length) {
  console.error('Gizlilik taraması eşleşmesi:', privacyHits);
  process.exit(1);
}

console.log('Önizleme yazıldı (canlı WordPress’e yazılmadı):');
console.log(`  ${OUT}`);
