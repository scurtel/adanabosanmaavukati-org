#!/usr/bin/env node
/**
 * SEO Phase 2: cluster, FAQ schema, meta, aile-hukuku-rehberi, categories, GSC doc.
 * npm run apply:seo-phase2 -- --execute
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';
import { extractInternalLinks, stripHtml } from './lib/link-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASE = getWpConfig().baseUrl.replace(/\/$/, '');
const EXECUTE = process.argv.includes('--execute');
const SCHEMA_MARKER = 'ceren-faq-schema';
const AILE_HUKUKU_CAT = 7;

const META_FIXES = {
  158: {
    rank_math_title: "Adana'da Çekişmeli Boşanma Davası Nasıl Açılır? | Rehber",
    rank_math_description:
      "Adana'da çekişmeli boşanma davası açma süreci, deliller, velayet ve nafaka talepleri hakkında adım adım bilgilendirme rehberi.",
    rank_math_focus_keyword: 'adana çekişmeli boşanma davası nasıl açılır',
  },
  145: {
    rank_math_description:
      "Adana'da çekişmeli boşanma davası ne kadar sürer? Aşamalar, deliller ve süreyi etkileyen faktörler hakkında genel bilgilendirme.",
    rank_math_focus_keyword: 'adana çekişmeli boşanma davası ne kadar sürer',
  },
  143: { rank_math_focus_keyword: 'adana boşanma davası nasıl açılır' },
  144: { rank_math_focus_keyword: 'adana anlaşmalı boşanma protokolü' },
  146: { rank_math_focus_keyword: 'adana nafaka davası' },
  147: { rank_math_focus_keyword: 'adana velayet davası üstün yarar' },
  148: { rank_math_focus_keyword: 'boşanmada mal paylaşımı katılma alacağı' },
  149: {
    rank_math_description:
      "Adana'da uzaklaştırma kararı almak için 6284 sayılı Kanun kapsamındaki başvuru süreci ve koruyucu tedbirler hakkında rehber.",
    rank_math_focus_keyword: 'adana uzaklaştırma kararı 6284',
  },
  159: {
    rank_math_description:
      "Adana'da ortaklığın giderilmesi (izale-i şuyu) davası nasıl açılır? Hisseli taşınmazlarda paylaşım süreci hakkında genel bilgi.",
    rank_math_focus_keyword: 'adana ortaklığın giderilmesi davası',
  },
  160: {
    rank_math_description:
      "Adana'da miras davaları, veraset ilamı ve miras paylaşımı süreçleri hakkında genel bilgilendirme rehberi.",
    rank_math_focus_keyword: 'adana miras davası miras paylaşımı',
  },
  26: { rank_math_focus_keyword: 'adana velayet davası' },
  131: { rank_math_focus_keyword: 'aldatma zina boşanma davası ispat' },
  134: { rank_math_focus_keyword: 'velayet davasında hakim kriterleri' },
};

const PAGE_META = {
  15: { rank_math_title: 'Avukat Ceren Sümer Cilli | Adana Boşanma Avukatı' },
  98: {
    rank_math_title: 'Hizmetler | Adana Aile Hukuku Rehberleri',
    rank_math_description:
      "Adana'da boşanma, nafaka, velayet, miras ve taşınmaz uyuşmazlıkları hakkında bilgilendirme rehberleri ve hizmet alanları.",
  },
};

const CLUSTER_LINKS = [
  {
    postId: 158,
    url: `${BASE}/adana-cekismeli-bosanma-avukati/`,
    p: `<p>Çekişmeli boşanma sürecine ilişkin genel çerçeve için <a href="${BASE}/adana-cekismeli-bosanma-avukati/">Adana çekişmeli boşanma avukatı</a> sayfasını ve <a href="${BASE}/adanada-cekismeli-bosanma-davasi-ne-kadar-surer/">dava süresi rehberini</a> inceleyebilirsiniz.</p>`,
  },
  {
    postId: 145,
    url: `${BASE}/adana-cekismeli-bosanma-davasi/`,
    p: `<p>Davanın açılış aşamaları için <a href="${BASE}/adana-cekismeli-bosanma-davasi/">çekişmeli boşanma davası nasıl açılır</a> rehberine; genel bilgi için <a href="${BASE}/adana-cekismeli-bosanma-avukati/">Adana çekişmeli boşanma avukatı</a> sayfasına göz atabilirsiniz.</p>`,
  },
];

const FAQ_160 = `
<h2>Sık Sorulan Sorular</h2>
<h3>Adana'da miras davası ne kadar sürer?</h3>
<p>Süre; mirasçı sayısı, mal varlığının niteliği, veraset ilamı ve paylaşım uyuşmazlığına göre değişir. Somut dosyada değerlendirme farklılık gösterebilir.</p>
<h3>Veraset ilamı olmadan miras paylaşımı yapılır mı?</h3>
<p>Paylaşım sürecinde çoğu işlemde veraset ilamı ve mirasçılık belgesi gerekir. Eksik belge süreci uzatabilir.</p>
<h3>Miras paylaşımında anlaşma sağlanamazsa ne olur?</h3>
<p>Anlaşma sağlanamazsa sulh veya dava yoluyla paylaşım gündeme gelebilir; taşınmazlarda ortaklığın giderilmesi de değerlendirilebilir.</p>
<h3>Saklı pay ihlali nasıl ilerler?</h3>
<p>Saklı paylı mirasçının tenkis davası açması gündeme gelebilir; delil ve malvarlığı tespiti önemlidir.</p>
<h3>Miras davasında avukat desteği zorunlu mu?</h3>
<p>Kanuni zorunluluk yoktur; ancak usul ve hak kaybı riski nedeniyle hukuki destek alınması faydalı olabilir.</p>`;

function extractFaqFromHtml(html) {
  const items = [];
  const seen = new Set();

  const add = (q, a) => {
    const question = stripHtml(q).replace(/^S\d+:\s*/i, '').replace(/^\d+\.\s*/, '').trim();
    let answer = stripHtml(a).replace(/^C\d+:\s*/i, '').trim();
    if (!question || !answer) return;
    const key = question.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      question: question.endsWith('?') ? question : `${question}?`,
      answer,
    });
  };

  const rmMatch = html.match(/wp:rank-math\/faq-block\s*(\{[\s\S]*?\})\s*-->/);
  if (rmMatch) {
    try {
      const data = JSON.parse(rmMatch[1]);
      for (const q of data.questions || []) {
        add(q.title || '', q.content || '');
      }
    } catch {
      /* ignore */
    }
  }

  const section = html.split(/Sık Sorulan|Sıkça Sorulan|FAQ/i).slice(1).join('') || html;

  const h3pRe = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = h3pRe.exec(section)) !== null) {
    add(m[1], m[2]);
  }

  const h3rawRe =
    /<h3[^>]*>([\s\S]*?)<\/h3>\s*(?:<p[^>]*>([\s\S]*?)<\/p>|([^<][\s\S]*?)(?=\s*<h3|\s*<div class="author-note|\s*<!-- wp:html|\s*$))/gi;
  while ((m = h3rawRe.exec(section)) !== null) {
    add(m[1], m[2] || m[3] || '');
  }

  const strongRe = /<p[^>]*>\s*<strong>\s*(?:\d+\.\s*)?([^<]+\?)\s*<\/strong>\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = strongRe.exec(section)) !== null) {
    add(m[1], m[2]);
  }

  return items.filter((f) => f.question.includes('?')).slice(0, 12);
}

function faqSchemaBlock(items) {
  if (items.length < 3) return '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
  return `<!-- wp:html -->
<script type="application/ld+json" class="${SCHEMA_MARKER}">${JSON.stringify(schema)}</script>
<!-- /wp:html -->`;
}

function appendClusterLink(raw, paragraph, markerUrl) {
  if (raw.includes(markerUrl)) return raw;
  const marker = /(<div class="author-note"|<h2[^>]*>\s*Sık Sorulan|<h2[^>]*>\s*Sıkça Sorulan)/i;
  if (marker.test(raw)) return raw.replace(marker, `${paragraph}\n$1`);
  return `${raw.trim()}\n\n${paragraph}`;
}

async function rankMathMeta(objectId, objectType, meta) {
  if (!EXECUTE) return { dry: true, objectId, objectType, meta };
  const types = objectType === 'page' ? ['page', 'post'] : [objectType];
  let lastErr;
  for (const t of types) {
    const res = await wpFetch('/wp-json/rankmath/v1/updateMeta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectID: objectId, objectType: t, meta }),
    });
    if (res.ok) return res.json();
    lastErr = `${t} (${res.status})`;
  }
  throw new Error(`Rank Math meta ${objectId}: ${lastErr}`);
}

async function backupState() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = resolve(ROOT, `data/backups/seo-phase2-${ts}`);
  mkdirSync(dir, { recursive: true });
  const snap = { posts: [], pages: [], categories: [] };
  for (const id of Object.keys(META_FIXES).map(Number)) {
    const p = await (await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`)).json();
    snap.posts.push({ id, slug: p.slug, categories: p.categories, meta: p.meta, content: p.content?.raw });
  }
  for (const [id, meta] of Object.entries(PAGE_META)) {
    const p = await (await wpFetch(`/wp-json/wp/v2/pages/${id}?context=edit`)).json();
    snap.pages.push({ id: Number(id), slug: p.slug, content: p.content?.raw });
  }
  const c7 = await (await wpFetch('/wp-json/wp/v2/categories/7')).json();
  snap.categories.push({ id: 7, description: c7.description });
  writeFileSync(resolve(dir, 'backup.json'), JSON.stringify(snap, null, 2));
  return dir;
}

async function applyMetaFixes(log) {
  for (const [id, meta] of Object.entries(META_FIXES)) {
    try {
      const r = await rankMathMeta(Number(id), 'post', meta);
      log.push({ type: 'post-meta', id: Number(id), meta, result: r, ok: true });
    } catch (e) {
      log.push({ type: 'post-meta', id: Number(id), meta, ok: false, error: e.message });
    }
  }
  for (const [id, meta] of Object.entries(PAGE_META)) {
    try {
      const r = await rankMathMeta(Number(id), 'page', meta);
      log.push({ type: 'page-meta', id: Number(id), meta, result: r, ok: true });
    } catch (e) {
      log.push({ type: 'page-meta', id: Number(id), meta, ok: false, error: e.message });
    }
  }
  if (EXECUTE) {
    await wpFetch('/wp-json/wp/v2/categories/7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description:
          "Adana'da boşanma, nafaka, velayet, mal paylaşımı ve aile hukuku konularında bilgilendirme yazıları.",
      }),
    });
    log.push({ type: 'category', id: 7, action: 'description-set' });
  } else {
    log.push({ type: 'category', id: 7, action: 'dry-description' });
  }
}

async function applyCluster(log) {
  for (const item of CLUSTER_LINKS) {
    const post = await (await wpFetch(`/wp-json/wp/v2/posts/${item.postId}?context=edit`)).json();
    let raw = post.content?.raw || '';
    const next = appendClusterLink(raw, item.p, item.url);
    if (next === raw) {
      log.push({ type: 'cluster', postId: item.postId, action: 'skipped' });
      continue;
    }
    if (!EXECUTE) {
      log.push({ type: 'cluster', postId: item.postId, action: 'dry-append' });
      continue;
    }
    await wpFetch(`/wp-json/wp/v2/posts/${item.postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: next, status: 'publish' }),
    });
    log.push({ type: 'cluster', postId: item.postId, action: 'appended' });
  }
  for (const id of [145, 158]) {
    const url = `${BASE}/${id === 145 ? 'adanada-cekismeli-bosanma-davasi-ne-kadar-surer' : 'adana-cekismeli-bosanma-davasi'}/`;
    await rankMathMeta(id, 'post', { rank_math_canonical_url: url });
    log.push({ type: 'canonical', postId: id, url });
  }
}

async function applyFaqSchema(log) {
  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish' });
  for (const p of posts) {
    const full = await (await wpFetch(`/wp-json/wp/v2/posts/${p.id}?context=edit`)).json();
    let raw = full.content?.raw || '';
    if (raw.includes(SCHEMA_MARKER)) {
      log.push({ type: 'faq-schema', postId: p.id, action: 'skipped' });
      continue;
    }
    if (p.id === 160 && !/Sık Sorulan|Sıkça Sorulan/i.test(raw)) {
      const marker = /<div class="author-note"/i;
      raw = marker.test(raw) ? raw.replace(marker, `${FAQ_160}\n$&`) : `${raw}\n${FAQ_160}`;
    }
    const items = extractFaqFromHtml(raw);
    const block = faqSchemaBlock(items);
    if (!block) {
      log.push({ type: 'faq-schema', postId: p.id, action: 'no-faq-found', count: items.length });
      continue;
    }
    const next = `${raw.trim()}\n\n${block}`;
    if (!EXECUTE) {
      log.push({ type: 'faq-schema', postId: p.id, action: 'dry', faqCount: items.length });
      continue;
    }
    await wpFetch(`/wp-json/wp/v2/posts/${p.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: next, status: 'publish' }),
    });
    log.push({ type: 'faq-schema', postId: p.id, action: 'applied', faqCount: items.length });
  }
}

async function applyCategories(log) {
  const changes = [
    { postId: 159, categories: [17] },
    { postId: 160, categories: [1] },
    { postId: 131, categories: [1, 7] },
  ];
  for (const c of changes) {
    if (!EXECUTE) {
      log.push({ type: 'category-post', ...c, action: 'dry' });
      continue;
    }
    await wpFetch(`/wp-json/wp/v2/posts/${c.postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: c.categories, status: 'publish' }),
    });
    log.push({ type: 'category-post', ...c, action: 'updated' });
  }
}

async function ensureAileHukukuRehberi(log) {
  const pages = await fetchAllPaginated('/wp-json/wp/v2/pages', { status: 'publish' });
  const existing = pages.find((p) => p.slug === 'aile-hukuku-rehberi');
  if (existing) {
    log.push({ type: 'aile-rehberi', action: 'exists', id: existing.id });
    return existing.id;
  }
  const content = `<!-- wp:heading -->
<h2 class="wp-block-heading">Aile Hukuku Bilgilendirme Yazıları</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Adana'da boşanma, nafaka, velayet ve mal paylaşımı konularında hazırlanan güncel rehberler:</p>
<!-- /wp:paragraph -->

<!-- wp:query {"queryId":2,"query":{"perPage":20,"pages":0,"offset":0,"postType":"post","order":"desc","orderBy":"date","author":"","search":"","exclude":[],"sticky":"","inherit":false,"taxQuery":{"category":[${AILE_HUKUKU_CAT}]}}} -->
<div class="wp-block-query"><!-- wp:post-template -->
<!-- wp:post-title {"isLink":true} /-->
<!-- wp:post-excerpt {"moreText":"Devamını oku »","excerptLength":25} /-->
<!-- /wp:post-template --></div>
<!-- /wp:query -->

<!-- wp:paragraph -->
<p>Detaylı hizmet listesi için <a href="${BASE}/hizmetler/">Hizmetler</a> sayfasına bakabilirsiniz.</p>
<!-- /wp:paragraph -->`;

  if (!EXECUTE) {
    log.push({ type: 'aile-rehberi', action: 'dry-create' });
    return null;
  }
  const res = await wpFetch('/wp-json/wp/v2/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Aile Hukuku Rehberi',
      slug: 'aile-hukuku-rehberi',
      status: 'publish',
      content,
    }),
  });
  if (!res.ok) throw new Error(`aile-hukuku-rehberi oluşturulamadı (${res.status})`);
  const page = await res.json();
  await rankMathMeta(page.id, 'page', {
    rank_math_title: 'Aile Hukuku Rehberi | Adana Boşanma ve Aile Hukuku',
    rank_math_description:
      "Adana'da boşanma, nafaka, velayet ve mal paylaşımı hakkında aile hukuku bilgilendirme yazıları.",
  });
  log.push({ type: 'aile-rehberi', action: 'created', id: page.id });
  return page.id;
}

async function verify() {
  const out = { faqSchema: [], titles: [], categories: {}, aileRehberi: null };
  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish' });
  for (const p of posts) {
    const live = await fetch(`${BASE}/${p.slug}/?v=${Date.now()}`, {
      headers: { 'User-Agent': 'seo-phase2-verify/1.0' },
    });
    const html = await live.text();
    out.faqSchema.push({ id: p.id, slug: p.slug, hasFaqSchema: html.includes('FAQPage') || html.includes(SCHEMA_MARKER) });
  }
  const prof = await fetch(`${BASE}/avukat-ceren-sumer-cilli/`);
  out.titles.push({ page: 'profil', title: (await prof.text()).match(/<title>([^<]+)/i)?.[1] });
  const p158 = await fetch(`${BASE}/adana-cekismeli-bosanma-davasi/`);
  out.titles.push({ page: 'post-158', title: (await p158.text()).match(/<title>([^<]+)/i)?.[1] });
  for (const id of [159, 160, 131]) {
    const post = await (await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`)).json();
    out.categories[id] = post.categories;
  }
  const ar = await fetch(`${BASE}/aile-hukuku-rehberi/`);
  out.aileRehberi = { status: ar.status, ok: ar.ok };
  return out;
}

async function main() {
  console.log(EXECUTE ? 'CANLI SEO Phase 2' : 'DRY-RUN SEO Phase 2');
  const backupDir = await backupState();
  const log = [];
  await applyMetaFixes(log);
  await applyCluster(log);
  await applyFaqSchema(log);
  await applyCategories(log);
  await ensureAileHukukuRehberi(log);
  const verifyResult = EXECUTE ? await verify() : null;

  const gscMd = `# Google Search Console Kurulum\n\n1. https://search.google.com/search-console adresine gidin\n2. Mülk ekle: \`https://adanabosanmaavukati.org\`\n3. DNS veya HTML doğrulama yapın\n4. Site Haritaları → \`https://adanabosanmaavukati.org/sitemap_index.xml\` gönderin\n5. Sayfa dizine ekleme ve FAQ rich result raporlarını haftalık izleyin\n`;

  let md = `# SEO Phase 2 Raporu\n\n> ${new Date().toISOString()} | ${EXECUTE ? 'CANLI' : 'DRY-RUN'}\n\nYedek: \`${backupDir}\`\n\n`;
  md += `## Yapılan işlemler\n\n`;
  for (const e of log) md += `- ${e.type} ${e.postId || e.id || ''}: ${e.action || JSON.stringify(e.meta || e.result || '').slice(0, 80)}\n`;
  if (verifyResult) {
    md += `\n## Doğrulama\n\n`;
    md += `- FAQ schema: ${verifyResult.faqSchema.filter((x) => x.hasFaqSchema).length}/${verifyResult.faqSchema.length}\n`;
    for (const t of verifyResult.titles) md += `- Title ${t.page}: ${t.title}\n`;
    md += `- Kategori 159: ${verifyResult.categories[159]}\n`;
    md += `- Kategori 160: ${verifyResult.categories[160]}\n`;
    md += `- Kategori 131: ${verifyResult.categories[131]}\n`;
    md += `- /aile-hukuku-rehberi/: HTTP ${verifyResult.aileRehberi?.status}\n`;
  }
  md += `\n## GSC\n\n${gscMd}`;
  writeFileSync(resolve(ROOT, 'reports/seo-phase2-report.md'), md);
  writeFileSync(resolve(ROOT, 'reports/seo-phase2-results.json'), JSON.stringify({ backupDir, log, verify: verifyResult }, null, 2));
  writeFileSync(resolve(ROOT, 'reports/gsc-setup.md'), gscMd);
  console.log('Rapor: reports/seo-phase2-report.md');
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
