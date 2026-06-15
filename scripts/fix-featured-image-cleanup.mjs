#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';
import { stripHtml } from './lib/link-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASE = getWpConfig().baseUrl.replace(/\/$/, '');
const EXECUTE = process.argv.includes('--execute');
const DRY = !EXECUTE;

const AILE_HUKUKU_CAT_ID = 7;
const REPORT_MD = resolve(ROOT, 'reports/featured-image-cleanup-report.md');
const REPORT_JSON = resolve(ROOT, 'reports/featured-image-cleanup-results.json');

/** QC raporu hedefleri; canlıda ID yoksa fallbackMediaId kullanılır */
const ALT_TARGETS = [
  {
    reportPostId: 131,
    reportMediaId: 151,
    reportTitle: 'Nafaka Türleri Nelerdir?',
    fallbackMediaId: 94,
    altText: 'Nafaka türleri ve boşanma sürecinde mali haklar',
  },
  {
    reportPostId: 122,
    reportMediaId: 123,
    reportTitle: 'Boşanma Davasında Hakimin Takdir Yetkisi',
    fallbackMediaId: 87,
    altText: 'Boşanma davasında hakimin takdir yetkisi',
  },
  {
    reportPostId: 98,
    reportMediaId: 100,
    reportTitle: 'Anlaşmalı Boşanma Davası (güncel uygulamalar)',
    fallbackMediaId: 90,
    altText: 'Anlaşmalı boşanma davası ve güncel uygulamalar',
  },
];

const CATEGORY_TARGETS = [
  { postId: 263, titleHint: 'Ekşi / Uludağ Sözlük' },
  { postId: 257, titleHint: 'Trump / bilim insanı' },
  { postId: 252, titleHint: 'Yapay zeka ceza' },
];

async function fetchMedia(id) {
  const res = await wpFetch(`/wp-json/wp/v2/media/${id}?context=edit`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchPost(id) {
  const res = await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`);
  if (!res.ok) return null;
  return res.json();
}

async function resolveMediaId(target) {
  let media = await fetchMedia(target.reportMediaId);
  if (media) return { mediaId: target.reportMediaId, source: 'report-id' };
  media = await fetchMedia(target.fallbackMediaId);
  if (media) {
    return {
      mediaId: target.fallbackMediaId,
      source: 'fallback-live-empty-alt',
      reportMediaMissing: target.reportMediaId,
    };
  }
  return { mediaId: null, source: 'not-found' };
}

async function backupState(altResolved, categorySnapshots) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = resolve(ROOT, `data/backups/featured-image-cleanup-${ts}`);
  mkdirSync(dir, { recursive: true });

  const backup = {
    backedUpAt: new Date().toISOString(),
    alt: [],
    categories: categorySnapshots,
  };

  for (const item of altResolved) {
    if (!item.mediaId) continue;
    const media = await fetchMedia(item.mediaId);
    backup.alt.push({
      mediaId: item.mediaId,
      slug: media?.slug,
      alt_text: media?.alt_text ?? '',
      title: stripHtml(media?.title?.rendered),
      target: item,
    });
  }

  writeFileSync(resolve(dir, 'backup.json'), JSON.stringify(backup, null, 2));
  return { dir, backup };
}

async function updateMediaAlt(mediaId, altText) {
  if (DRY) return { dry: true, mediaId, altText };
  const res = await wpFetch(`/wp-json/wp/v2/media/${mediaId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alt_text: altText }),
  });
  if (!res.ok) throw new Error(`Media ${mediaId} güncellenemedi (${res.status})`);
  return res.json();
}

function pickReplacementCategories(current, allCats) {
  const withoutAile = current.filter((id) => id !== AILE_HUKUKU_CAT_ID);
  if (withoutAile.length) return { categories: withoutAile, action: 'removed-aile-only' };

  const genel = allCats.find((c) => /genel/i.test(c.name));
  if (genel) return { categories: [genel.id], action: `moved-to-${genel.slug}` };

  const haber = allCats.find((c) => /hukuk haber|haber/i.test(c.name));
  if (haber) return { categories: [haber.id], action: `moved-to-${haber.slug}` };

  const hizmetler = allCats.find((c) => c.slug === 'hizmetler');
  if (hizmetler) return { categories: [hizmetler.id], action: `moved-to-${hizmetler.slug}` };

  return { categories: [], action: 'removed-aile-no-replacement-found' };
}

async function processCategories(allCats) {
  const results = [];
  for (const target of CATEGORY_TARGETS) {
    const post = await fetchPost(target.postId);
    if (!post) {
      results.push({
        postId: target.postId,
        titleHint: target.titleHint,
        action: 'skipped-not-found',
        note: 'Canlı sitede bu post ID mevcut değil',
      });
      continue;
    }

    const categories = post.categories || [];
    const snapshot = {
      postId: post.id,
      slug: post.slug,
      title: stripHtml(post.title?.rendered),
      categoriesBefore: [...categories],
    };

    if (!categories.includes(AILE_HUKUKU_CAT_ID)) {
      results.push({ ...snapshot, action: 'skipped-not-in-aile-hukuku' });
      continue;
    }

    const next = pickReplacementCategories(categories, allCats);
    if (DRY) {
      results.push({ ...snapshot, action: 'dry-run', categoriesAfter: next.categories, move: next.action });
      continue;
    }

    const res = await wpFetch(`/wp-json/wp/v2/posts/${post.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: next.categories, status: post.status }),
    });
    if (!res.ok) throw new Error(`Post ${post.id} kategori güncellenemedi (${res.status})`);
    results.push({
      ...snapshot,
      action: next.action,
      categoriesAfter: next.categories,
      updated: true,
    });
  }
  return results;
}

async function verify(allCats) {
  const out = {
    checkedAt: new Date().toISOString(),
    alt: [],
    categories: [],
    rehberPage: {},
    featuredMissing: [],
  };

  for (const target of ALT_TARGETS) {
    const resolved = await resolveMediaId(target);
    if (!resolved.mediaId) {
      out.alt.push({ ...target, ok: false, reason: 'media-not-found' });
      continue;
    }
    const media = await fetchMedia(resolved.mediaId);
    out.alt.push({
      mediaId: resolved.mediaId,
      alt_text: media?.alt_text ?? '',
      ok: Boolean(media?.alt_text?.trim()),
      reportMediaId: target.reportMediaId,
    });
  }

  for (const target of CATEGORY_TARGETS) {
    const post = await fetchPost(target.postId);
    if (!post) {
      out.categories.push({ postId: target.postId, ok: true, note: 'post-not-found-already-absent' });
      continue;
    }
    out.categories.push({
      postId: post.id,
      slug: post.slug,
      inAileHukuku: (post.categories || []).includes(AILE_HUKUKU_CAT_ID),
      categories: post.categories,
      ok: !(post.categories || []).includes(AILE_HUKUKU_CAT_ID),
    });
  }

  const rehberUrls = [`${BASE}/aile-hukuku-rehberi/`, `${BASE}/category/aile-hukuku/`];
  for (const url of rehberUrls) {
    const res = await fetch(`${url}?v=${Date.now()}`, {
      headers: { 'User-Agent': 'featured-image-cleanup-verify/1.0' },
    });
    const html = await res.text();
    const offTopic = ['eksisozluk', 'uludagsozluk', 'trump', 'yapay zeka', 'yapay-zeka'];
    out.rehberPage[url] = {
      http: res.status,
      offTopicVisible: offTopic.filter((k) => html.toLowerCase().includes(k)),
    };
  }

  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish', context: 'edit' });
  for (const p of posts) {
    if (!p.featured_media) {
      out.featuredMissing.push({ id: p.id, slug: p.slug, title: stripHtml(p.title?.rendered) });
    } else {
      const media = await fetchMedia(p.featured_media);
      if (!media?.alt_text?.trim()) {
        out.featuredMissing.push({
          id: p.id,
          slug: p.slug,
          mediaId: p.featured_media,
          issue: 'empty-alt-on-featured-media',
        });
      }
    }
  }

  out.allCategories = allCats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, count: c.count }));
  return out;
}

function buildMarkdown(backupDir, altResults, categoryResults, verify, allCats) {
  let md = `# Featured Image Cleanup Raporu\n\n`;
  md += `> **Tarih:** ${new Date().toISOString()}\n`;
  md += `> **Mod:** ${DRY ? 'DRY-RUN' : 'CANLI UYGULAMA'}\n\n`;
  md += `## Yedek\n\n\`${backupDir}\`\n\n`;

  md += `## Mevcut Kategoriler\n\n`;
  md += `| ID | Slug | Ad | Yazı sayısı |\n|----|------|----|-------------|\n`;
  for (const c of allCats.sort((a, b) => a.name.localeCompare(b.name))) {
    md += `| ${c.id} | \`${c.slug}\` | ${c.name} | ${c.count} |\n`;
  }
  md += `\n**Not:** "Genel" veya "Hukuk Haberleri" kategorisi yok; gerekirse mevcut en yakın kategori kullanılır.\n\n`;

  md += `## 1. Alt Text Düzeltmeleri\n\n`;
  md += `| Rapor media ID | Canlı media ID | Alt text | Sonuç |\n`;
  md += `|----------------|----------------|----------|-------|\n`;
  for (const r of altResults) {
    const result = r.updated ? '✓ güncellendi' : r.skipped === 'already-set' ? '✓ zaten uygulanmış' : r.dry ? 'dry-run' : r.error ?? '—';
    md += `| ${r.reportMediaId}${r.reportMediaMissing ? ' (404)' : ''} | ${r.mediaId ?? '—'} | ${r.altText} | ${result} |\n`;
  }

  md += `\n## 2. Aile Hukuku Kategori Temizliği\n\n`;
  md += `| Post ID | Başlık ipucu | Sonuç |\n|---------|--------------|-------|\n`;
  for (const r of categoryResults) {
    md += `| ${r.postId} | ${r.titleHint ?? r.title ?? '—'} | ${r.action}${r.updated ? ' ✓' : ''} |\n`;
  }

  if (verify) {
    md += `\n## 3. Doğrulama\n\n`;
    md += `### Alt text\n\n`;
    for (const a of verify.alt) {
      md += `- Media **${a.mediaId}**: ${a.ok ? 'dolu ✓' : 'boş ✗'} — \`${a.alt_text || ''}\`\n`;
    }
    md += `\n### Kategori (263, 257, 252)\n\n`;
    for (const c of verify.categories) {
      md += `- Post **${c.postId}**: ${c.ok ? 'Aile Hukuku dışında ✓' : 'hâlâ Aile Hukuku ✗'} (${c.note ?? c.slug ?? ''})\n`;
    }
    md += `\n### Rehber / arşiv sayfası\n\n`;
    for (const [url, info] of Object.entries(verify.rehberPage)) {
      md += `- \`${url}\` — HTTP ${info.http}; off-topic görünür: ${info.offTopicVisible.length ? info.offTopicVisible.join(', ') : 'yok ✓'}\n`;
    }
    md += `\n### Featured image eksik / boş alt\n\n`;
    if (!verify.featuredMissing.length) md += `_Yayın yazılarında featured image + alt sorunu yok._\n`;
    else {
      for (const f of verify.featuredMissing) {
        md += `- Post **${f.id}** (\`${f.slug}\`): ${f.issue ?? 'featured_media=0'}\n`;
      }
    }
  }

  return md;
}

async function main() {
  console.log(DRY ? 'DRY-RUN' : 'CANLI UYGULAMA');
  const allCats = await fetchAllPaginated('/wp-json/wp/v2/categories', { per_page: 100 });

  const altResolved = [];
  for (const target of ALT_TARGETS) {
    const resolved = await resolveMediaId(target);
    altResolved.push({ ...target, ...resolved });
  }

  const categorySnapshots = [];
  for (const target of CATEGORY_TARGETS) {
    const post = await fetchPost(target.postId);
    if (post) {
      categorySnapshots.push({
        postId: post.id,
        slug: post.slug,
        title: stripHtml(post.title?.rendered),
        categories: post.categories || [],
      });
    } else {
      categorySnapshots.push({ postId: target.postId, missing: true, titleHint: target.titleHint });
    }
  }

  const { dir: backupDir, backup } = await backupState(altResolved, categorySnapshots);

  const altResults = [];
  for (const item of altResolved) {
    if (!item.mediaId) {
      altResults.push({ ...item, error: 'media-not-found' });
      continue;
    }
    const media = await fetchMedia(item.mediaId);
    if (media?.alt_text?.trim() === item.altText) {
      altResults.push({ ...item, skipped: 'already-set' });
      continue;
    }
    try {
      await updateMediaAlt(item.mediaId, item.altText);
      altResults.push({ ...item, updated: !DRY, dry: DRY });
    } catch (e) {
      altResults.push({ ...item, error: e.message });
    }
  }

  const categoryResults = await processCategories(allCats);
  const verifyResult = EXECUTE ? await verify(allCats) : null;

  const payload = {
    mode: DRY ? 'dry-run' : 'execute',
    backupDir,
    backup,
    altResults,
    categoryResults,
    verify: verifyResult,
    allCategories: allCats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, count: c.count })),
  };

  writeFileSync(REPORT_JSON, JSON.stringify(payload, null, 2));
  writeFileSync(REPORT_MD, buildMarkdown(backupDir, altResults, categoryResults, verifyResult, allCats));

  console.log(`Rapor: ${REPORT_MD}`);
  console.log(`JSON: ${REPORT_JSON}`);
  console.log(`Yedek: ${backupDir}`);

  if (DRY) console.log('\nCanlı uygulamak için: node scripts/fix-featured-image-cleanup.mjs --execute');
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
