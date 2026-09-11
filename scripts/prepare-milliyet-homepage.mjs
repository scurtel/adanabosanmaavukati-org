#!/usr/bin/env node
/**
 * Ana sayfaya Milliyet yayın bölümünü hazırlar.
 * Varsayılan: dry-run (yalnızca generated/ yazar).
 * Canlı yazım: --execute (ONAY sonrası)
 *
 * npm run prepare:milliyet
 * npm run prepare:milliyet -- --execute
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch } from './lib/wp-fetch.mjs';
import { insertMilliyetSection, MILLIYET_ARTICLES_DIVORCE } from './lib/milliyet-homepage-section.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HOMEPAGE_ID = 19;
const EXECUTE = process.argv.includes('--execute');

async function main() {
  console.log(`Mod: ${EXECUTE ? 'CANLI UYGULAMA' : 'DRY-RUN (canlıya yazılmayacak)'}`);

  const res = await wpFetch(`/wp-json/wp/v2/pages/${HOMEPAGE_ID}?context=edit`);
  if (!res.ok) throw new Error(`page ${HOMEPAGE_ID}: ${res.status}`);
  const page = await res.json();
  const raw = page.content?.raw || '';

  const { content, inserted, reason } = insertMilliyetSection(raw);
  const outDir = resolve(ROOT, 'generated');
  mkdirSync(outDir, { recursive: true });

  const beforePath = resolve(outDir, 'homepage-19-before-milliyet.html');
  const afterPath = resolve(outDir, 'homepage-19-with-milliyet.html');
  const reportPath = resolve(ROOT, 'reports/milliyet-homepage-prepare-report.md');

  writeFileSync(beforePath, raw, 'utf8');
  writeFileSync(afterPath, content, 'utf8');

  const h2Count = (content.match(/milliyet-hukuk-yazilari/g) || []).length;
  const articleHits = MILLIYET_ARTICLES_DIVORCE.filter((a) => content.includes(a.url)).length;

  const report = `# Milliyet ana sayfa bölümü — hazırlık raporu

> Tarih: ${new Date().toISOString()}
> Mod: **${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}**
> inserted: ${inserted} (${reason})

## Kontroller

| Kontrol | Sonuç |
|---------|--------|
| Page ID | ${HOMEPAGE_ID} |
| Slug | ${page.slug} |
| Modified (önce) | ${page.modified} |
| milliyet-hukuk-yazilari sayısı | ${h2Count} |
| Milliyet URL eşleşmesi | ${articleHits}/${MILLIYET_ARTICLES_DIVORCE.length} |
| Canonical profil | https://www.cerensumer.av.tr/av-ceren-sumer-cilli/ |
| Schema değişikliği | Yok (bu script schema dokunmaz) |

## Çıktılar

- \`${beforePath}\`
- \`${afterPath}\`
`;

  writeFileSync(reportPath, report, 'utf8');
  console.log(report);

  if (!inserted) {
    console.log(`Bölüm eklenmedi: ${reason}`);
    if (reason === 'marker_not_found') process.exit(1);
    return;
  }

  if (!EXECUTE) {
    console.log('DRY-RUN tamamlandı. Production’a yazılmadı.');
    return;
  }

  const update = await wpFetch(`/wp-json/wp/v2/pages/${HOMEPAGE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const text = await update.text();
  if (!update.ok) throw new Error(`update failed: ${update.status} ${text.slice(0, 300)}`);
  const updated = JSON.parse(text);
  console.log(`CANLI güncellendi — modified: ${updated.modified}`);
}

main().catch((err) => {
  console.error('HATA:', err.message);
  process.exit(1);
});
