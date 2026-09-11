/**
 * Entity Round 1 — Person sameAs only (adanabosanmaavukati.org).
 * Custom Person @id: https://adanabosanmaavukati.org/#ceren-sumer-cilli
 *
 * - kimdir URL → canonical profil URL
 * - Milliyet yazar profili additive
 * Rank Math / LegalService / duplicate #person / author slug: DOKUNULMAZ
 *
 * Default: dry-run (generated patch only).
 * Production: --execute (onay sonrası)
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch } from './wp-fetch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const EXECUTE = process.argv.includes('--execute');

export const CANONICAL_PROFILE = 'https://www.cerensumer.av.tr/av-ceren-sumer-cilli/';
export const MILLIYET_AUTHOR = 'https://blog.milliyet.com.tr/avcerensumercilli';
export const OLD_KIMDIR =
  'https://www.cerensumer.av.tr/adana-bosanma-avukati-ceren-sumer-cilli-kimdir/';
export const CUSTOM_PERSON_ID = 'https://adanabosanmaavukati.org/#ceren-sumer-cilli';

/** Pure transform for custom Person.sameAs only */
export function alignPersonSameAs(sameAs) {
  const list = Array.isArray(sameAs) ? [...sameAs] : [];
  const next = list.map((u) => (u === OLD_KIMDIR ? CANONICAL_PROFILE : u));
  if (!next.includes(CANONICAL_PROFILE)) next.unshift(CANONICAL_PROFILE);
  if (!next.includes(MILLIYET_AUTHOR)) {
    const idx = next.indexOf(CANONICAL_PROFILE);
    next.splice(idx + 1, 0, MILLIYET_AUTHOR);
  }
  // de-dupe preserving order
  return [...new Set(next)];
}

export function patchCustomPersonSameAsInRaw(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('invalid raw');
  if (!raw.includes(CUSTOM_PERSON_ID)) {
    return { content: raw, changed: false, reason: 'custom_person_not_found' };
  }

  const re =
    /(<script[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi;
  let changed = false;
  let beforeSameAs = null;
  let afterSameAs = null;
  let personCountTouched = 0;

  const content = raw.replace(re, (full, open, jsonText, close) => {
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch {
      return full;
    }

    const nodes = data?.['@graph']
      ? data['@graph']
      : Array.isArray(data)
        ? data
        : [data];

    let localChange = false;
    for (const node of nodes) {
      if (!node || node['@type'] !== 'Person') continue;
      if (node['@id'] !== CUSTOM_PERSON_ID) continue;
      // Only the custom supporting Person — not Rank Math #person
      beforeSameAs = node.sameAs ? [...node.sameAs] : [];
      afterSameAs = alignPersonSameAs(node.sameAs);
      if (JSON.stringify(beforeSameAs) !== JSON.stringify(afterSameAs)) {
        node.sameAs = afterSameAs;
        localChange = true;
        personCountTouched += 1;
      }
    }

    if (!localChange) return full;
    changed = true;
    const pretty = `${JSON.stringify(data, null, 2)}\n`;
    return `${open}${pretty}${close}`;
  });

  return {
    content,
    changed,
    reason: changed ? 'ok' : 'sameAs_already_aligned',
    beforeSameAs,
    afterSameAs,
    personCountTouched,
  };
}

async function main() {
  console.log(`Mod: ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}`);
  const res = await wpFetch(
    '/wp-json/wp/v2/pages?slug=avukat-ceren-sumer-cilli&context=edit',
  );
  if (!res.ok) throw new Error(`pages fetch ${res.status}`);
  const pages = await res.json();
  if (!pages[0]) throw new Error('profile page not found');
  const page = pages[0];
  const raw = page.content?.raw || '';

  const result = patchCustomPersonSameAsInRaw(raw);
  const outDir = resolve(ROOT, 'generated');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'entity-r1-profile-before.html'), raw);
  writeFileSync(resolve(outDir, 'entity-r1-profile-after.html'), result.content);
  writeFileSync(
    resolve(ROOT, 'reports/entity-round1-bosanma-sameas-diff.json'),
    JSON.stringify(
      {
        pageId: page.id,
        modified: page.modified,
        personId: CUSTOM_PERSON_ID,
        ...result,
        contentOmitted: true,
      },
      null,
      2,
    ),
  );

  console.log(JSON.stringify({
    pageId: page.id,
    changed: result.changed,
    reason: result.reason,
    beforeSameAs: result.beforeSameAs,
    afterSameAs: result.afterSameAs,
    personCountTouched: result.personCountTouched,
  }, null, 2));

  if (!result.changed) {
    console.log('No write needed.');
    return;
  }

  if (!EXECUTE) {
    console.log('DRY-RUN — production yazılmadı.');
    return;
  }

  const upd = await wpFetch(`/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: result.content }),
  });
  const text = await upd.text();
  if (!upd.ok) throw new Error(`update ${upd.status} ${text.slice(0, 300)}`);
  console.log('UPDATED', JSON.parse(text).modified);
}

// Allow import without running
if (process.argv[1] && process.argv[1].endsWith('entity-round1-sameas.mjs')) {
  main().catch((e) => {
    console.error('HATA:', e.message);
    process.exit(1);
  });
}
