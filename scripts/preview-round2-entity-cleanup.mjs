/**
 * Round 2 local schema + H1 + snippet checks. Canlı WordPress'e yazmaz.
 *
 *   node scripts/preview-round2-entity-cleanup.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProfileHtml, buildProfileJsonLd } from './lib/ceren-profile-content.mjs';
import { buildEntityCleanupSnippetPhp, PERSON_ID, PERSON_SCHEMA_NAME } from './lib/entity-cleanup-snippet.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'reports', 'round2-entity-cleanup-2026-08-21');
mkdirSync(OUT, { recursive: true });

const html = buildProfileHtml();
const jsonLd = buildProfileJsonLd();
const php = buildEntityCleanupSnippetPhp();
const h1Count = (html.match(/<h1\b/gi) || []).length;
const person = (jsonLd['@graph'] || []).find((n) => n['@type'] === 'Person');

const fails = [];
if (h1Count !== 1) fails.push(`content H1 count ${h1Count}`);
if (!html.includes('<h1>Avukat Ceren Sümer Cilli</h1>')) fails.push('preferred H1 text missing');
if (person?.name !== 'Ceren Sümer Cilli') fails.push(`Person.name ${person?.name}`);
if (person?.['@id'] !== PERSON_ID) fails.push('@id');
if (!php.includes('astra_the_title_enabled')) fails.push('missing Astra title filter');
if (!php.includes('csc_is_ceren_profile_page')) fails.push('profile-page guard missing');
if (!php.includes('Rank Math global disable = NO')) fails.push('global disable comment missing');
if (!php.includes("!csc_is_ceren_profile_page()")) fails.push('json_ld not limited to profile');
if (php.includes("strpos($id, '/author/') !== false")) {
  fails.push('snippet still rewrites all /author/ Persons');
}
if (JSON.stringify(person?.sameAs || []).includes('uludagsozluk')) fails.push('Uludağ in sameAs');
if (JSON.stringify(person?.sameAs || []).includes('eksisozluk')) fails.push('Ekşi in sameAs');

const report = {
  generated_at: new Date().toISOString(),
  live_wp_write: false,
  contentH1Count: h1Count,
  note: 'Canlıda tema ayrıca h1.entry-title basıyor. PHP snippet Astra title’ı kapatınca DOM H1=1 olur.',
  person: { id: person?.['@id'], name: person?.name, jobTitle: person?.jobTitle, sameAs: person?.sameAs },
  PERSON_SCHEMA_NAME,
  fails,
};

writeFileSync(join(OUT, 'adanabosanma-local-checks.json'), JSON.stringify(report, null, 2), 'utf8');
writeFileSync(join(OUT, 'entity-cleanup-snippet.php'), php, 'utf8');
writeFileSync(join(OUT, 'person-schema.json'), JSON.stringify(jsonLd, null, 2), 'utf8');

if (fails.length) {
  console.error('FAIL', fails);
  process.exit(1);
}
console.log('adanabosanma Round 2 local checks PASS');
console.log('  content H1=1 (Avukat Ceren Sümer Cilli)');
console.log('  Person.name=', person.name);
console.log('  snippet PHP written (not deployed)');
