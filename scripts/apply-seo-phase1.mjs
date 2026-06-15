#!/usr/bin/env node
/**
 * SEO Phase 1: featured images + hub page internal links.
 * Dry-run: node scripts/apply-seo-phase1.mjs
 * Live:    node scripts/apply-seo-phase1.mjs --execute
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';
import { getWpConfig, wpAuthHeader } from './lib/env.mjs';
import { extractInternalLinks, stripHtml } from './lib/link-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EXECUTE = process.argv.includes('--execute');
const BASE = getWpConfig().baseUrl.replace(/\/$/, '');

const SOURCE_IMAGES = {
  cekismeli: `${BASE}/wp-content/uploads/2026/02/adana-cekismeli-bosanma-avukati-img.jpg`,
  anlasmali: `${BASE}/wp-content/uploads/2026/02/adanada-anlasmali-bosanma-avukati-img.jpg`,
  nafaka: `${BASE}/wp-content/uploads/2026/02/adana-nafaka-davasi-avukati-img.jpg`,
  velayet: `${BASE}/wp-content/uploads/2026/04/velayet-davasinda-hakim-neye-karar-v-sidecar-cmnkqi-wp.webp`,
};

/** Post ID → featured image plan */
const FEATURED_PLAN = [
  { postId: 26, source: 'velayet', filename: 'featured-adana-velayet-davasi.webp', alt: 'Adana velayet davası süreci ve çocuğun üstün yararı' },
  { postId: 131, source: 'cekismeli', filename: 'featured-aldatma-zina-bosanma-2026.jpg', alt: 'Aldatma ve zina nedeniyle boşanma davasında ispat ve deliller' },
  { postId: 143, source: 'cekismeli', filename: 'featured-bosanma-davasi-nasil-acilir.jpg', alt: "Adana'da boşanma davası açma süreci ve gerekli adımlar" },
  { postId: 144, source: 'anlasmali', filename: 'featured-anlasmali-bosanma-protokolu.jpg', alt: "Adana'da anlaşmalı boşanma protokolü hazırlama süreci" },
  { postId: 145, source: 'cekismeli', filename: 'featured-cekismeli-bosanma-suresi.jpg', alt: "Adana'da çekişmeli boşanma davası süresi ve aşamaları" },
  { postId: 146, source: 'nafaka', filename: 'featured-nafaka-davasi-artirim.jpg', alt: "Adana'da nafaka davası ve nafaka artırım süreci" },
  { postId: 147, source: 'velayet', filename: 'featured-velayet-ustun-yarar.webp', alt: "Velayet davasında çocuğun üstün yararı ilkesi" },
  { postId: 148, source: 'anlasmali', filename: 'featured-mal-paylasimi-katilma.jpg', alt: 'Boşanmada mal paylaşımı ve katılma alacağı hesaplama süreci' },
  { postId: 149, source: 'cekismeli', filename: 'featured-uzaklastirma-6284.jpg', alt: '6284 sayılı Kanun kapsamında uzaklaştırma kararı süreci' },
  { postId: 158, source: 'cekismeli', filename: 'featured-cekismeli-bosanma-nasil-acilir.jpg', alt: "Adana'da çekişmeli boşanma davası nasıl açılır" },
  { postId: 159, source: 'nafaka', filename: 'featured-ortakligin-giderilmesi.jpg', alt: "Adana'da ortaklığın giderilmesi davası ve izale-i şuyu süreci" },
  { postId: 160, source: 'nafaka', filename: 'featured-miras-davalari.jpg', alt: "Adana'da miras davaları ve miras paylaşımı süreci" },
];

const HUB_PAGES = [
  {
    pageId: 123,
    slug: 'adana-cekismeli-bosanma-avukati',
    links: [
      { url: '/adana-cekismeli-bosanma-davasi/', label: "Adana'da çekişmeli boşanma davası nasıl açılır" },
      { url: '/adanada-cekismeli-bosanma-davasi-ne-kadar-surer/', label: 'Çekişmeli boşanma davası ne kadar sürer' },
      { url: '/hizmetler/', label: 'Tüm bilgilendirme rehberleri' },
      { url: '/avukat-ceren-sumer-cilli/', label: 'Av. Ceren Sümer Cilli' },
      { url: '/adana-bosanma-avukati-rehberi/', label: 'Adana boşanma avukatı rehberi' },
      { url: '/iletisim/', label: 'İletişim' },
    ],
  },
  {
    pageId: 121,
    slug: 'adanada-anlasmali-bosanma-avukati',
    links: [
      { url: '/adanada-anlasmali-bosanma-protokolu/', label: 'Anlaşmalı boşanma protokolü nasıl hazırlanır' },
      { url: '/adanada-bosanma-davasi-nasil-acilir/', label: 'Boşanma davası nasıl açılır' },
      { url: '/hizmetler/', label: 'Tüm bilgilendirme rehberleri' },
      { url: '/avukat-ceren-sumer-cilli/', label: 'Av. Ceren Sümer Cilli' },
      { url: '/adana-bosanma-avukati-rehberi/', label: 'Adana boşanma avukatı rehberi' },
      { url: '/iletisim/', label: 'İletişim' },
    ],
  },
  {
    pageId: 117,
    slug: 'adana-nafaka-davasi-avukati',
    links: [
      { url: '/adanada-nafaka-davasi-ve-nafaka-artirim-sureci/', label: 'Nafaka davası ve artırım süreci' },
      { url: '/bosanmada-mal-paylasimi-ve-katilma-alacagi/', label: 'Mal paylaşımı ve katılma alacağı' },
      { url: '/hizmetler/', label: 'Tüm bilgilendirme rehberleri' },
      { url: '/avukat-ceren-sumer-cilli/', label: 'Av. Ceren Sümer Cilli' },
      { url: '/adana-bosanma-avukati-rehberi/', label: 'Adana boşanma avukatı rehberi' },
      { url: '/iletisim/', label: 'İletişim' },
    ],
  },
  {
    pageId: 39,
    slug: 'iletisim',
    links: [
      { url: '/hizmetler/', label: 'Bilgilendirme rehberleri' },
      { url: '/adana-bosanma-avukati-rehberi/', label: 'Adana boşanma avukatı rehberi' },
      { url: '/avukat-ceren-sumer-cilli/', label: 'Av. Ceren Sümer Cilli profil sayfası' },
      { url: '/adanada-bosanma-davasi-nasil-acilir/', label: 'Boşanma davası nasıl açılır' },
    ],
  },
];

const HUB_MARKER = 'ceren-hub-links';

function hubLinksHtml(links) {
  const items = links.map((l) => `<li><a href="${BASE}${l.url}">${l.label}</a></li>`).join('\n');
  return `<!-- wp:html -->
<div class="${HUB_MARKER}" style="margin-top:2em;padding:1.25em;background:#f9f9f9;border-radius:8px;border-left:4px solid #ccc;">
<p><strong>İlgili Rehberler</strong></p>
<ul>${items}</ul>
</div>
<!-- /wp:html -->`;
}

async function uploadFeaturedImage({ filename, source, alt, title }) {
  const { username, appPassword, baseUrl } = getWpConfig();
  const imgRes = await fetch(source);
  if (!imgRes.ok) throw new Error(`Kaynak görsel indirilemedi: ${source}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const ext = filename.split('.').pop().toLowerCase();
  const mime = ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime }), filename);
  fd.append('alt_text', alt);
  fd.append('title', title);

  const res = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: { Authorization: wpAuthHeader(username, appPassword) },
    body: fd,
  });
  if (!res.ok) throw new Error(`Medya yüklenemedi (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function findExistingMediaBySlug(filename) {
  const slug = filename.replace(/\.[^.]+$/, '');
  const res = await wpFetch(`/wp-json/wp/v2/media?slug=${encodeURIComponent(slug)}&context=edit`);
  if (!res.ok) return null;
  const items = await res.json();
  return items[0] || null;
}

async function backupState() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = resolve(ROOT, `data/backups/seo-phase1-${ts}`);
  mkdirSync(dir, { recursive: true });
  const backup = { posts: [], pages: [] };

  for (const plan of FEATURED_PLAN) {
    const post = await (await wpFetch(`/wp-json/wp/v2/posts/${plan.postId}?context=edit`)).json();
    backup.posts.push({
      id: post.id,
      slug: post.slug,
      featured_media: post.featured_media,
      title: stripHtml(post.title?.rendered),
    });
  }
  for (const hub of HUB_PAGES) {
    const page = await (await wpFetch(`/wp-json/wp/v2/pages/${hub.pageId}?context=edit`)).json();
    backup.pages.push({
      id: page.id,
      slug: page.slug,
      content: page.content?.raw || '',
    });
  }
  writeFileSync(resolve(dir, 'backup.json'), JSON.stringify(backup, null, 2));
  return dir;
}

async function applyFeaturedImages() {
  const results = [];
  for (const plan of FEATURED_PLAN) {
    const post = await (await wpFetch(`/wp-json/wp/v2/posts/${plan.postId}?context=edit`)).json();
    if (post.featured_media) {
      results.push({ postId: plan.postId, slug: post.slug, action: 'skipped-has-featured', mediaId: post.featured_media });
      continue;
    }

    let media = await findExistingMediaBySlug(plan.filename);
    if (!media && EXECUTE) {
      media = await uploadFeaturedImage({
        filename: plan.filename,
        source: SOURCE_IMAGES[plan.source],
        alt: plan.alt,
        title: plan.filename,
      });
    } else if (!media) {
      results.push({ postId: plan.postId, slug: post.slug, action: 'dry-upload', filename: plan.filename, alt: plan.alt });
      continue;
    }

    if (!EXECUTE) {
      results.push({ postId: plan.postId, slug: post.slug, action: 'dry-assign', mediaId: media.id, alt: plan.alt });
      continue;
    }

    const upd = await wpFetch(`/wp-json/wp/v2/posts/${plan.postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured_media: media.id, status: 'publish' }),
    });
    if (!upd.ok) throw new Error(`Post ${plan.postId} featured_media güncellenemedi`);
    results.push({ postId: plan.postId, slug: post.slug, action: 'assigned', mediaId: media.id, alt: plan.alt });
  }
  return results;
}

async function applyHubLinks() {
  const results = [];
  for (const hub of HUB_PAGES) {
    const page = await (await wpFetch(`/wp-json/wp/v2/pages/${hub.pageId}?context=edit`)).json();
    const raw = page.content?.raw || '';
    if (raw.includes(HUB_MARKER)) {
      results.push({ pageId: hub.pageId, slug: hub.slug, action: 'skipped-already-present' });
      continue;
    }
    const block = hubLinksHtml(hub.links);
    const next = `${raw.trim()}\n\n${block}`;
    const linksBefore = extractInternalLinks(raw, 'adanabosanmaavukati.org').length;

    if (!EXECUTE) {
      results.push({
        pageId: hub.pageId,
        slug: hub.slug,
        action: 'dry-append',
        linksBefore,
        linksAfter: linksBefore + hub.links.length,
      });
      continue;
    }

    const upd = await wpFetch(`/wp-json/wp/v2/pages/${hub.pageId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: next, status: 'publish' }),
    });
    if (!upd.ok) throw new Error(`Sayfa ${hub.pageId} güncellenemedi`);
    results.push({
      pageId: hub.pageId,
      slug: hub.slug,
      action: 'appended',
      linksBefore,
      linksAfter: linksBefore + hub.links.length,
    });
  }
  return results;
}

async function verify() {
  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish' });
  const missingFm = [];
  for (const p of posts) {
    if (!p.featured_media) missingFm.push({ id: p.id, slug: p.slug });
    else {
      const m = await (await wpFetch(`/wp-json/wp/v2/media/${p.featured_media}?context=edit`)).json();
      if (!m.alt_text?.trim()) missingFm.push({ id: p.id, slug: p.slug, issue: 'empty-alt', mediaId: p.featured_media });
    }
  }

  const hubVerify = [];
  for (const hub of HUB_PAGES) {
    const live = await fetch(`${BASE}/${hub.slug}/?v=${Date.now()}`, {
      headers: { 'User-Agent': 'seo-phase1-verify/1.0' },
    });
    const html = await live.text();
    hubVerify.push({
      slug: hub.slug,
      markerVisible: html.includes(HUB_MARKER),
      internalLinks: extractInternalLinks(html, 'adanabosanmaavukati.org').length,
    });
  }
  return { missingFm, hubVerify };
}

async function main() {
  console.log(EXECUTE ? 'CANLI UYGULAMA' : 'DRY-RUN');
  const backupDir = await backupState();
  console.log('Yedek:', backupDir);

  const featuredResults = await applyFeaturedImages();
  const hubResults = await applyHubLinks();
  const verifyResult = EXECUTE ? await verify() : null;

  const report = {
    mode: EXECUTE ? 'execute' : 'dry-run',
    backupDir,
    featuredResults,
    hubResults,
    verify: verifyResult,
  };
  writeFileSync(resolve(ROOT, 'reports/seo-phase1-results.json'), JSON.stringify(report, null, 2));

  let md = `# SEO Phase 1 — Featured Image + Hub İç Link\n\n`;
  md += `> ${new Date().toISOString()} | ${EXECUTE ? 'CANLI' : 'DRY-RUN'}\n\n`;
  md += `Yedek: \`${backupDir}\`\n\n`;
  md += `## Featured images\n\n| Post | Sonuç | Media | Alt |\n|------|-------|-------|-----|\n`;
  for (const r of featuredResults) {
    md += `| ${r.postId} \`${r.slug}\` | ${r.action} | ${r.mediaId ?? '—'} | ${r.alt ?? ''} |\n`;
  }
  md += `\n## Hub iç linkler\n\n| Sayfa | Sonuç | Link (önce→sonra) |\n|-------|-------|-------------------|\n`;
  for (const r of hubResults) {
    md += `| ${r.slug} | ${r.action} | ${r.linksBefore ?? '—'} → ${r.linksAfter ?? '—'} |\n`;
  }
  if (verifyResult) {
    md += `\n## Doğrulama\n\n`;
    md += `- Featured eksik: ${verifyResult.missingFm.length}\n`;
    for (const h of verifyResult.hubVerify) {
      md += `- \`/${h.slug}/\` hub bölümü: ${h.markerVisible ? 'canlı ✓' : 'yok ✗'} | iç link: ${h.internalLinks}\n`;
    }
  }
  writeFileSync(resolve(ROOT, 'reports/seo-phase1-report.md'), md);
  console.log('Rapor: reports/seo-phase1-report.md');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
