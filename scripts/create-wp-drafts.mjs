#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getWpConfig } from './lib/env.mjs';
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';
import { markdownToHtml, parseArticleFile } from './lib/markdown-to-html.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../generated/adanabosanma-authority-articles');
const REPORT_PATH = resolve(__dirname, '../reports/adanabosanma-draft-upload-report.md');
const DRY_RUN = !process.argv.includes('--execute');

const BANNED = [
  'en iyi avukat',
  'uzman avukat',
  'lider avukat',
  'garantili sonuç',
  'kesin kazanılır',
  'mutlaka kazanılır',
  'başarı garantisi',
  'en başarılı',
  'rakipsiz',
];

const ARTICLE_ORDER = [
  'adanada-bosanma-davasi-nasil-acilir.md',
  'adanada-anlasmali-bosanma-protokolu.md',
  'adanada-cekismeli-bosanma-davasi-ne-kadar-surer.md',
  'adanada-nafaka-davasi-ve-nafaka-artirim-sureci.md',
  'adanada-velayet-davasinda-cocugun-ustun-yarari.md',
  'bosanmada-mal-paylasimi-ve-katilma-alacagi.md',
  'adanada-uzaklastirma-karari-nasil-alinir.md',
];

const TAXONOMY_BY_SLUG = {
  'adanada-bosanma-davasi-nasil-acilir': {
    categories: ['Boşanma Davaları', 'Aile Hukuku'],
    tags: ['Adana boşanma avukatı', 'Adana aile hukuku avukatı', 'anlaşmalı boşanma', 'çekişmeli boşanma', 'Av. Ceren Sümer Cilli'],
  },
  'adanada-anlasmali-bosanma-protokolu': {
    categories: ['Boşanma Davaları', 'Aile Hukuku'],
    tags: ['Adana boşanma avukatı', 'anlaşmalı boşanma', 'Adana aile hukuku avukatı', 'Av. Ceren Sümer Cilli'],
  },
  'adanada-cekismeli-bosanma-davasi-ne-kadar-surer': {
    categories: ['Boşanma Davaları', 'Aile Hukuku'],
    tags: ['Adana boşanma avukatı', 'çekişmeli boşanma', 'Adana aile hukuku avukatı', 'Av. Ceren Sümer Cilli'],
  },
  'adanada-nafaka-davasi-ve-nafaka-artirim-sureci': {
    categories: ['Nafaka', 'Aile Hukuku'],
    tags: ['nafaka davası', 'Adana aile hukuku avukatı', 'Adana boşanma avukatı', 'Av. Ceren Sümer Cilli'],
  },
  'adanada-velayet-davasinda-cocugun-ustun-yarari': {
    categories: ['Velayet', 'Aile Hukuku'],
    tags: ['velayet davası', 'Adana aile hukuku avukatı', 'Adana boşanma avukatı', 'Av. Ceren Sümer Cilli'],
  },
  'bosanmada-mal-paylasimi-ve-katilma-alacagi': {
    categories: ['Mal Paylaşımı', 'Aile Hukuku'],
    tags: ['mal paylaşımı', 'katılma alacağı', 'Adana aile hukuku avukatı', 'Av. Ceren Sümer Cilli'],
  },
  'adanada-uzaklastirma-karari-nasil-alinir': {
    categories: ['Koruma ve Uzaklaştırma', 'Aile Hukuku'],
    tags: ['uzaklaştırma kararı', '6284 sayılı Kanun', 'Adana aile hukuku avukatı', 'Av. Ceren Sümer Cilli'],
  },
};

function validateArticle(meta, body, slug) {
  const issues = [];
  const text = `${meta.title} ${meta.seo_title} ${meta.meta_description} ${body}`.toLowerCase();

  if (!meta.title) issues.push('title eksik');
  if (!meta.slug) issues.push('slug eksik');
  if (!meta.seo_title) issues.push('seo_title eksik');
  if (!meta.meta_description) issues.push('meta_description eksik');
  if (!/faq|sık sorulan|sıkça sorulan|sss/i.test(body)) issues.push('FAQ bölümü bulunamadı');
  if (!/hukuki tavsiye|genel bilgilendirme|bilgilendirme amac/i.test(body)) issues.push('hukuki uyarı zayıf/eksik');
  if (!/ceren\s+s[üu]mer\s+cilli|av\.\s*ceren/i.test(body)) issues.push('Av. Ceren Sümer Cilli sinyali zayıf');
  if (!/adana/i.test(body)) issues.push('Adana yerel bağlamı zayıf');
  if (!/^#{2,3}\s/m.test(body)) issues.push('H2/H3 başlık yapısı zayıf');

  for (const phrase of BANNED) {
    if (text.includes(phrase)) issues.push(`yasak ifade: ${phrase}`);
  }

  return issues;
}

async function findOrCreateTerm(endpoint, name) {
  const search = await wpFetch(`${endpoint}?search=${encodeURIComponent(name)}&per_page=100`);
  if (!search.ok) throw new Error(`Term arama hatası (${search.status})`);
  const items = await search.json();
  const exact = items.find((i) => i.name.toLowerCase() === name.toLowerCase());
  if (exact) return { id: exact.id, name: exact.name, created: false };

  const create = await wpFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!create.ok) {
    const err = await create.text();
    throw new Error(`Term oluşturulamadı (${name}): ${create.status} ${err.slice(0, 120)}`);
  }
  const created = await create.json();
  return { id: created.id, name: created.name, created: true };
}

async function snapshotPublished() {
  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish' });
  const pages = await fetchAllPaginated('/wp-json/wp/v2/pages', { status: 'publish' });
  return {
    postIds: posts.map((p) => p.id).sort((a, b) => a - b),
    pageIds: pages.map((p) => p.id).sort((a, b) => a - b),
    postCount: posts.length,
    pageCount: pages.length,
  };
}

async function main() {
  if (DRY_RUN) {
    console.log('DRY-RUN modu — WordPress\'e gönderim yapılmadı.');
    console.log('Göndermek için: npm run draft:wp -- --execute');
    return;
  }

  if (!existsSync(ARTICLES_DIR)) {
    throw new Error('Üretilmiş makale klasörü bulunamadı.');
  }

  const before = await snapshotPublished();
  const results = [];
  const createdTerms = { categories: [], tags: [] };

  for (const file of ARTICLE_ORDER) {
    const filePath = resolve(ARTICLES_DIR, file);
    if (!existsSync(filePath)) throw new Error(`Makale bulunamadı: ${file}`);

    const raw = readFileSync(filePath, 'utf8');
    const { meta, body } = parseArticleFile(raw);
    const slug = meta.slug || file.replace('.md', '');
    const taxonomy = TAXONOMY_BY_SLUG[slug] || { categories: ['Aile Hukuku'], tags: ['Av. Ceren Sümer Cilli'] };
    const validation = validateArticle(meta, body, slug);

    const categoryIds = [];
    const categoryNames = [];
    for (const cat of taxonomy.categories) {
      const term = await findOrCreateTerm('/wp-json/wp/v2/categories', cat);
      categoryIds.push(term.id);
      categoryNames.push(term.name);
      if (term.created) createdTerms.categories.push(term.name);
    }

    const tagIds = [];
    const tagNames = [];
    for (const tag of taxonomy.tags) {
      const term = await findOrCreateTerm('/wp-json/wp/v2/tags', tag);
      tagIds.push(term.id);
      tagNames.push(term.name);
      if (term.created) createdTerms.tags.push(term.name);
    }

    const htmlBody = markdownToHtml(body);
    const payload = {
      title: meta.title,
      slug: meta.slug,
      status: 'draft',
      excerpt: meta.meta_description || '',
      content: htmlBody,
      categories: categoryIds,
      tags: tagIds,
      meta: {
        rank_math_title: meta.seo_title || meta.title,
        rank_math_description: meta.meta_description || '',
      },
    };

    const res = await wpFetch('/wp-json/wp/v2/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${file} gönderilemedi (${res.status}): ${errText.slice(0, 200)}`);
    }

    const post = await res.json();
    if (post.status !== 'draft') {
      throw new Error(`${file} draft olmalıydı, status=${post.status}`);
    }

    results.push({
      title: meta.title,
      slug: post.slug,
      id: post.id,
      status: post.status,
      link: post.link,
      categories: categoryNames,
      tags: tagNames,
      seo_title: meta.seo_title,
      meta_description: meta.meta_description,
      validationIssues: validation,
    });
  }

  const after = await snapshotPublished();
  const publishedUnchanged =
    before.postCount === after.postCount &&
    before.pageCount === after.pageCount &&
    JSON.stringify(before.postIds) === JSON.stringify(after.postIds) &&
    JSON.stringify(before.pageIds) === JSON.stringify(after.pageIds);

  const reportDir = dirname(REPORT_PATH);
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });

  let md = `# Draft Yükleme Raporu\n\n> ${new Date().toISOString()}\n\n`;
  md += `- Gönderilen draft sayısı: **${results.length}**\n`;
  md += `- Publish yapıldı mı: **Hayır** (tümü status=draft)\n`;
  md += `- Canlı içerik değişti mi: **${publishedUnchanged ? 'Hayır' : 'Kontrol gerekli'}**\n\n`;
  md += `## Draft Yazılar\n\n| # | Başlık | ID | Slug | Durum |\n|---|--------|-----|------|-------|\n`;
  results.forEach((r, i) => {
    md += `| ${i + 1} | ${r.title} | ${r.id} | \`${r.slug}\` | ${r.status} |\n`;
  });
  md += `\n## Draft Linkleri\n\n`;
  for (const r of results) md += `- **${r.title}:** ${r.link}\n`;
  md += `\n## Kategoriler ve Etiketler\n\n`;
  for (const r of results) {
    md += `### ${r.title}\n- Kategoriler: ${r.categories.join(', ')}\n- Etiketler: ${r.tags.join(', ')}\n- SEO title: ${r.seo_title}\n\n`;
  }
  if (createdTerms.categories.length || createdTerms.tags.length) {
    md += `## Yeni Oluşturulan Terimler\n\n`;
    if (createdTerms.categories.length) md += `- Kategoriler: ${[...new Set(createdTerms.categories)].join(', ')}\n`;
    if (createdTerms.tags.length) md += `- Etiketler: ${[...new Set(createdTerms.tags)].join(', ')}\n`;
  }

  writeFileSync(REPORT_PATH, md, 'utf8');

  console.log(`Draft yükleme tamamlandı: ${results.length} yazı`);
  console.log(`Canlı içerik değişmedi: ${publishedUnchanged ? 'evet' : 'hayır — kontrol edin'}`);
  console.log(`Rapor: ${REPORT_PATH}`);
  for (const r of results) {
    console.log(`- [${r.status}] ID ${r.id}: ${r.title}`);
    console.log(`  ${r.link}`);
  }
}

main().catch((err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
