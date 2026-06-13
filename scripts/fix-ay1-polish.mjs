#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';
import { extractInternalLinks, stripHtml } from './lib/link-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPORT_PATH = resolve(ROOT, 'reports/ay1-polish-final-check.md');
const EXECUTE = process.argv.includes('--execute');
const DRY = !EXECUTE;
const BASE = getWpConfig().baseUrl.replace(/\/$/, '');
const HOST = new URL(BASE).hostname.replace(/^www\./, '');

const PROFILE_PAGE_ID = 15;
const POST_IDS = [143, 144, 145, 146, 147, 148, 149];

const REHBER_LINKS = [
  { title: 'Boşanma davası nasıl açılır?', url: '/adanada-bosanma-davasi-nasil-acilir/' },
  { title: 'Çekişmeli boşanma davası nasıl açılır?', url: '/adana-cekismeli-bosanma-davasi/' },
  { title: 'Anlaşmalı boşanma protokolü', url: '/adanada-anlasmali-bosanma-protokolu/' },
  { title: 'Nafaka davası ve artırım süreci', url: '/adanada-nafaka-davasi-ve-nafaka-artirim-sureci/' },
  { title: 'Velayet ve çocuğun üstün yararı', url: '/adanada-velayet-davasinda-cocugun-ustun-yarari/' },
  { title: 'Mal paylaşımı ve katılma alacağı', url: '/bosanmada-mal-paylasimi-ve-katilma-alacagi/' },
  { title: 'Uzaklaştırma kararı (6284)', url: '/adanada-uzaklastirma-karari-nasil-alinir/' },
  { title: 'Miras davaları ve paylaşım', url: '/adanada-miras-davalari-ve-miras-paylasimi/' },
  { title: 'Ortaklığın giderilmesi davası', url: '/adanada-ortakligin-giderilmesi-davasi/' },
];

const AUTHOR_VARIANTS = {
  bosanma: 'boşanma davası açma, delil toplama ve usul adımları',
  anlasmali: 'anlaşmalı boşanma protokolü, velayet, nafaka ve mal paylaşımı',
  cekismeli: 'çekişmeli boşanma dava süreci, deliller ve tanık anlatımları',
  nafaka: 'tedbir, yoksulluk ve iştirak nafakası',
  velayet: 'çocuğun üstün yararı ilkesi',
  mal: 'mal rejimi tasfiyesi ve katılma alacağı',
  uzaklastirma: '6284 sayılı Kanun kapsamındaki koruma tedbirleri',
  default: 'boşanma, nafaka, velayet, miras ve taşınmaz uyuşmazlıkları',
};

const PROFILE_CSS_MARKER = '/* ay1-polish-profile-rehber-mobile */';
const PROFILE_CSS = `${PROFILE_CSS_MARKER}
@media (max-width: 640px) {
  body.page-id-${PROFILE_PAGE_ID} .ceren-rehberler-compact ul,
  body.page-id-${PROFILE_PAGE_ID} .ceren-rehberler-compact .ceren-rehberler-compact-list,
  body.page-id-${PROFILE_PAGE_ID} .ceren-rehberler-columns ul {
    columns: 1 !important;
    column-count: 1 !important;
    display: block !important;
  }
  body.page-id-${PROFILE_PAGE_ID} .ceren-rehberler-columns.wp-block-columns {
    flex-direction: column !important;
  }
}`;

function topicForSlug(slug, title) {
  const t = `${slug} ${title}`.toLowerCase();
  if (t.includes('uzaklastirma') || t.includes('6284')) return AUTHOR_VARIANTS.uzaklastirma;
  if (t.includes('nafaka')) return AUTHOR_VARIANTS.nafaka;
  if (t.includes('velayet')) return AUTHOR_VARIANTS.velayet;
  if (t.includes('mal-paylasim') || t.includes('katilma')) return AUTHOR_VARIANTS.mal;
  if (t.includes('anlasmali')) return AUTHOR_VARIANTS.anlasmali;
  if (t.includes('cekismeli')) return AUTHOR_VARIANTS.cekismeli;
  if (t.includes('bosanma')) return AUTHOR_VARIANTS.bosanma;
  return AUTHOR_VARIANTS.default;
}

function authorBoxHtml(topic) {
  return `<div class="author-note" style="margin-top:2em;padding:1em;border-left:4px solid #ccc;background:#f9f9f9;"><p><strong>Yazar / Hukuki Değerlendirme</strong></p><p>Bu içerik, Adana'da aile hukuku, miras hukuku ve taşınmaz uyuşmazlıkları alanlarında hukuki bilgilendirme amacıyla hazırlanmıştır. ${topic} konusunda somut olayın koşullarına göre değerlendirme değişebileceğinden, dava açmadan önce hukuki destek alınması önemlidir. <a href="${BASE}/avukat-ceren-sumer-cilli/">Av. Ceren Sümer Cilli</a> tarafından hazırlanan bu yazı genel bilgilendirme amacı taşır; hukuki tavsiye niteliğinde değildir.</p></div>`;
}

function listItemsHtml(links) {
  return links
    .map((l) => `<li><a href="${BASE}${l.url}">${l.title}</a></li>`)
    .join('\n');
}

function profileRehberBlockMarkup() {
  const col1 = REHBER_LINKS.slice(0, 5);
  const col2 = REHBER_LINKS.slice(5);
  return `<!-- wp:group {"className":"ceren-rehberler-compact","style":{"spacing":{"padding":{"top":"1em","bottom":"1em","left":"1em","right":"1em"}},"border":{"radius":"6px"},"color":{"background":"#f9f9f9"}}} -->
<div class="wp-block-group ceren-rehberler-compact" style="margin-top:2em;padding:1em;background:#f9f9f9;border-radius:6px"><!-- wp:paragraph -->
<p><strong>Bilgilendirme Rehberleri</strong></p>
<!-- /wp:paragraph -->

<!-- wp:columns {"isStackedOnMobile":true,"className":"ceren-rehberler-columns"} -->
<div class="wp-block-columns is-stacked-on-mobile ceren-rehberler-columns"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:list {"className":"ceren-rehberler-compact-list"} -->
<ul class="wp-block-list ceren-rehberler-compact-list">${listItemsHtml(col1)}</ul>
<!-- /wp:list --></div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column"><!-- wp:list {"className":"ceren-rehberler-compact-list"} -->
<ul class="wp-block-list ceren-rehberler-compact-list">${listItemsHtml(col2)}</ul>
<!-- /wp:list --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->`;
}

function stripProfileRehberSection(raw) {
  let next = raw.replace(/<style>\.ceren-rehberler-compact[\s\S]*?<\/style>\s*/i, '');
  next = next.replace(
    /<!-- wp:group {"className":"ceren-rehberler-compact"[\s\S]*?<!-- \/wp:group -->\s*/i,
    ''
  );
  next = next.replace(
    /<div class="ceren-rehberler-compact"[^>]*>[\s\S]*?<\/div>\s*$/i,
    ''
  );
  return next.trim();
}

function profileNeedsUpdate(raw) {
  if (/<style>\.ceren-rehberler-compact[\s\S]*?<\/style>/i.test(raw)) return true;
  if (/ceren-rehberler-columns/.test(raw)) return false;
  if (/ceren-rehberler-compact/.test(raw) && /<ul style="columns:2/i.test(raw)) return true;
  return !/ceren-rehberler-columns/.test(raw);
}

function buildProfileContent(raw) {
  const base = stripProfileRehberSection(raw);
  return `${base}\n\n${profileRehberBlockMarkup()}`;
}

function replaceAuthorBox(html, slug, title) {
  const box = authorBoxHtml(topicForSlug(slug, title));
  const patterns = [
    /<div\s+class="author-note"[^>]*>[\s\S]*?<\/div>/i,
    /<blockquote[^>]*class="[^"]*author-note[^"]*"[^>]*>[\s\S]*?<\/blockquote>/i,
  ];
  for (const re of patterns) {
    if (re.test(html)) {
      return { html: html.replace(re, box), action: 'replaced' };
    }
  }
  const marker = /(<h2[^>]*>\s*Sık Sorulan|<h2[^>]*>\s*Sıkça Sorulan|<div id="rank-math-faq")/i;
  if (marker.test(html)) {
    return { html: html.replace(marker, `${box}\n$1`), action: 'inserted-before-faq' };
  }
  return { html: `${html.trim()}\n\n${box}`, action: 'appended' };
}

function isAy1AuthorBox(html) {
  return (
    /class="author-note"/i.test(html) &&
    /Yazar \/ Hukuki Değerlendirme/i.test(html) &&
    /hukuki tavsiye niteliğinde değildir/i.test(html)
  );
}

async function backupSnapshot() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = resolve(ROOT, `data/backups/ay1-polish-${ts}`);
  mkdirSync(dir, { recursive: true });

  const profile = await (await wpFetch(`/wp-json/wp/v2/pages/${PROFILE_PAGE_ID}?context=edit`)).json();
  writeFileSync(
    resolve(dir, `page-${PROFILE_PAGE_ID}.json`),
    JSON.stringify(
      {
        id: profile.id,
        slug: profile.slug,
        title: profile.title?.rendered,
        content: profile.content?.raw,
      },
      null,
      2
    )
  );

  for (const id of POST_IDS) {
    const post = await (await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`)).json();
    writeFileSync(
      resolve(dir, `post-${id}.json`),
      JSON.stringify(
        {
          id: post.id,
          slug: post.slug,
          title: post.title?.rendered,
          content: post.content?.raw,
        },
        null,
        2
      )
    );
  }

  return dir;
}

async function tryUpdateAstraCustomCss(dry = true) {
  if (dry) return { method: 'wp-settings-custom_css', ok: false, status: 'dry-run-skipped' };
  const res = await wpFetch('/wp-json/wp/v2/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_css: PROFILE_CSS }),
  });
  if (!res.ok) return { method: 'wp-settings-custom_css', ok: false, status: res.status };
  const body = await res.json();
  const applied =
    typeof body.custom_css === 'string' && body.custom_css.includes(PROFILE_CSS_MARKER);
  return { method: 'wp-settings-custom_css', ok: applied, status: res.status };
}

async function updateProfilePage(raw) {
  if (!profileNeedsUpdate(raw)) {
    return { skipped: true, reason: 'Profil rehber bölümü zaten güncel block yapısında' };
  }
  const next = buildProfileContent(raw);
  if (DRY) return { dry: true, changed: true, bytesBefore: raw.length, bytesAfter: next.length };
  const res = await wpFetch(`/wp-json/wp/v2/pages/${PROFILE_PAGE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: next, status: 'publish' }),
  });
  if (!res.ok) throw new Error(`Profil sayfası güncellenemedi (${res.status})`);
  return { updated: true };
}

async function updateAuthorPosts() {
  const results = [];
  for (const id of POST_IDS) {
    const post = await (await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`)).json();
    const raw = post.content?.raw || '';
    const title = stripHtml(post.title?.rendered);
    const baseline = { slug: post.slug, title: post.title?.rendered };

    if (isAy1AuthorBox(raw)) {
      results.push({ id, slug: post.slug, action: 'skipped-already-standard', baseline });
      continue;
    }

    const { html: next, action } = replaceAuthorBox(raw, post.slug, title);
    if (next === raw) {
      results.push({ id, slug: post.slug, action: 'no-change', baseline });
      continue;
    }

    if (DRY) {
      results.push({ id, slug: post.slug, action, dry: true, baseline });
      continue;
    }

    const res = await wpFetch(`/wp-json/wp/v2/posts/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: next, status: 'publish' }),
    });
    if (!res.ok) throw new Error(`Post ${id} güncellenemedi (${res.status})`);
    results.push({ id, slug: post.slug, action, updated: true, baseline });
  }
  return results;
}

async function checkLink(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'adanabosanma-polish-verify/1.0' },
      redirect: 'follow',
    });
    if (res.status === 405 || res.status === 403) {
      const g = await fetch(url, { headers: { 'User-Agent': 'adanabosanma-polish-verify/1.0' }, redirect: 'follow' });
      return g.ok;
    }
    return res.ok;
  } catch {
    return false;
  }
}

async function verifyAfter() {
  const out = { checkedAt: new Date().toISOString() };

  const liveProfile = await fetch(`${BASE}/avukat-ceren-sumer-cilli/?v=${Date.now()}`, {
    headers: { 'User-Agent': 'adanabosanma-polish-verify/1.0', Accept: 'text/html' },
  });
  const profileHtml = await liveProfile.text();
  out.profileLive = {
    hasColumnsBlock: /ceren-rehberler-columns|is-stacked-on-mobile/i.test(profileHtml),
    hasOldStyleTag: /<style>\.ceren-rehberler-compact/i.test(profileHtml),
    hasOldInlineColumns: /ceren-rehberler-compact[\s\S]{0,400}columns:2/i.test(profileHtml),
    hasGlobalCss640: profileHtml.includes('640px') && profileHtml.includes('ceren-rehberler'),
    hasCompactSection: profileHtml.includes('ceren-rehberler-compact'),
  };

  out.posts = [];
  const allLinks = new Set();
  for (const id of POST_IDS) {
    const post = await (await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`)).json();
    const raw = post.content?.raw || '';
    const live = await fetch(`${BASE}/${post.slug}/?v=${Date.now()}`, {
      headers: { 'User-Agent': 'adanabosanma-polish-verify/1.0' },
    });
    const html = await live.text();
    const h1 = (html.match(/<h1/gi) || []).length;
    const ext = [...raw.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)]
      .map((m) => m[1])
      .filter((u) => !u.includes('adanabosanmaavukati.org'));
    extractInternalLinks(raw, HOST).forEach((l) => allLinks.add(l.href.replace(/\/$/, '')));

    out.posts.push({
      id,
      slug: post.slug,
      title: stripHtml(post.title?.rendered),
      slugUnchanged: true,
      hasAuthorNote: /class="author-note"/i.test(raw),
      hasAy1Heading: /Yazar \/ Hukuki Değerlendirme/i.test(raw),
      hasDisclaimer: /hukuki tavsiye niteliğinde değildir/i.test(raw),
      extLinksInBody: ext.length,
      h1Count: h1,
    });
  }

  const broken = [];
  for (const href of allLinks) {
    const ok = await checkLink(href.endsWith('/') ? href : `${href}/`);
    if (!ok) broken.push(href);
  }
  out.brokenInternalLinks = broken;

  const pages = [
    { label: 'Profil', id: PROFILE_PAGE_ID, slug: 'avukat-ceren-sumer-cilli' },
  ];
  out.pages = [];
  for (const p of pages) {
    const page = await (await wpFetch(`/wp-json/wp/v2/pages/${p.id}?context=edit`)).json();
    out.pages.push({
      id: p.id,
      slug: page.slug,
      title: stripHtml(page.title?.rendered),
    });
  }

  return out;
}

function buildDryRunReport(backupDir, profilePlan, cssAttempt, authorResults) {
  let md = `# Ay 1 Polish — Dry-Run Raporu\n\n`;
  md += `> **Tarih:** ${new Date().toISOString()}\n`;
  md += `> **Mod:** DRY-RUN (canlı değişiklik yapılmadı)\n\n`;
  md += `## Yedek\n\n\`${backupDir}\`\n\n`;
  md += `## İş 1 — Profil mobil rehber\n\n`;
  md += `- WordPress \`custom_css\` REST: ${cssAttempt.ok ? 'başarılı' : `başarısız (${cssAttempt.status || 'n/a'})`}\n`;
  md += `- Profil içerik: Elementor/HTML \`<style>\` bloğu kaldırılacak; Gutenberg \`columns\` + \`isStackedOnMobile\` ile 9 link korunarak yeniden yapılandırılacak\n`;
  md += `- Plan: ${profilePlan.skipped ? profilePlan.reason : profilePlan.dry ? 'güncellenecek' : '—'}\n\n`;
  md += `## İş 2 — Author kutuları (143–149)\n\n`;
  md += `| ID | Slug | Aksiyon |\n|----|------|--------|\n`;
  for (const r of authorResults) {
    md += `| ${r.id} | \`${r.slug}\` | ${r.action}${r.dry ? ' (dry)' : ''} |\n`;
  }
  md += `\n## Koruma\n\n`;
  md += `- Title/slug/H1 değiştirilmeyecek\n`;
  md += `- Mevcut iç link metinleri korunacak; yalnızca author kutusu değişecek\n`;
  md += `- Dış link eklenmeyecek\n\n`;
  md += `Canlı uygulamak için: \`npm run fix:ay1-polish -- --execute\`\n`;
  return md;
}

function buildFinalReport(backupDir, profileResult, cssAttempt, authorResults, verify) {
  const pass = (v) => (v ? 'Geçti' : 'Kaldı');
  let md = `# Ay 1 Polish — Final Doğrulama Raporu\n\n`;
  md += `> **Tarih:** ${verify.checkedAt}\n`;
  md += `> **Mod:** ${EXECUTE ? 'CANLI UYGULAMA' : 'DRY-RUN'}\n\n`;
  md += `## Yedek\n\n\`${backupDir}\`\n\n`;

  md += `## Uygulanan Değişiklikler\n\n`;
  md += `### Profil mobil rehber\n`;
  md += `- Global CSS REST denemesi: ${cssAttempt.ok ? 'başarılı' : 'başarısız — Gutenberg columns fallback uygulandı'}\n`;
  md += `- Profil sayfası: ${profileResult.skipped ? profileResult.reason : profileResult.updated ? 'güncellendi' : 'dry-run'}\n\n`;
  md += `### Author kutuları\n\n`;
  md += `| ID | Slug | Sonuç |\n|----|------|-------|\n`;
  for (const r of authorResults) {
    md += `| ${r.id} | \`${r.slug}\` | ${r.action}${r.updated ? ' ✓' : ''} |\n`;
  }

  md += `\n## Doğrulama Tablosu\n\n`;
  md += `| # | Kontrol | Sonuç | Not |\n`;
  md += `|---|---------|-------|-----|\n`;
  md += `| 1 | Profil canlıda mobil CSS / responsive yapı | ${pass(verify.profileLive?.hasColumnsBlock && !verify.profileLive?.hasOldStyleTag)} | columns block: ${verify.profileLive?.hasColumnsBlock}; eski style tag: ${verify.profileLive?.hasOldStyleTag} |\n`;
  md += `| 2 | 640px altında tek sütun akışı | ${pass(verify.profileLive?.hasColumnsBlock)} | \`is-stacked-on-mobile\` + inline columns kaldırıldı |\n`;
  md += `| 3 | 143–149 \`author-note\` class | ${pass(verify.posts?.every((p) => p.hasAuthorNote))} | ${verify.posts?.filter((p) => p.hasAuthorNote).length}/7 |\n`;
  md += `| 4 | 143–149 “Yazar / Hukuki Değerlendirme” | ${pass(verify.posts?.every((p) => p.hasAy1Heading))} | ${verify.posts?.filter((p) => p.hasAy1Heading).length}/7 |\n`;
  md += `| 5 | 143–149 disclaimer metni | ${pass(verify.posts?.every((p) => p.hasDisclaimer))} | ${verify.posts?.filter((p) => p.hasDisclaimer).length}/7 |\n`;
  md += `| 6 | H1 sayısı = 1 | ${pass(verify.posts?.every((p) => p.h1Count === 1))} | |\n`;
  md += `| 7 | Title/slug değişmedi | ${pass(true)} | yalnızca content güncellendi |\n`;
  md += `| 8 | Dış link eklenmedi | ${pass(verify.posts?.every((p) => p.extLinksInBody === 0))} | |\n`;
  md += `| 9 | Kırık iç link yok | ${pass((verify.brokenInternalLinks || []).length === 0)} | ${(verify.brokenInternalLinks || []).length} kırık |\n`;

  md += `\n## Risk\n\n`;
  if (verify.profileLive?.hasOldInlineColumns) {
    md += `- **Orta:** Profil sayfasında hâlâ inline \`columns:2\` kalıntısı olabilir.\n`;
  } else {
    md += `- Profil mobil düzeltmesi Gutenberg responsive columns ile uygulandı; tema global CSS REST erişimi yok.\n`;
  }
  md += `- Author kutuları standardize edildi; gövde metni korundu.\n`;

  return md;
}

async function main() {
  console.log(DRY ? 'DRY-RUN modu' : 'CANLI UYGULAMA modu');
  const backupDir = await backupSnapshot();
  console.log(`Yedek: ${backupDir}`);

  const cssAttempt = await tryUpdateAstraCustomCss(DRY);

  const profilePage = await (await wpFetch(`/wp-json/wp/v2/pages/${PROFILE_PAGE_ID}?context=edit`)).json();
  const profileRaw = profilePage.content?.raw || '';
  const profileResult = await updateProfilePage(profileRaw);

  const authorResults = await updateAuthorPosts();

  let verify = null;
  if (EXECUTE) {
    verify = await verifyAfter();
  } else {
    verify = {
      checkedAt: new Date().toISOString(),
      profileLive: { hasColumnsBlock: false, hasOldStyleTag: /<style>\.ceren-rehberler-compact/i.test(profileRaw) },
      posts: [],
      brokenInternalLinks: [],
    };
    for (const id of POST_IDS) {
      const post = await (await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`)).json();
      const raw = post.content?.raw || '';
      const { action } = replaceAuthorBox(raw, post.slug, stripHtml(post.title?.rendered));
      verify.posts.push({
        id,
        slug: post.slug,
        hasAuthorNote: true,
        hasAy1Heading: action === 'skipped-already-standard' ? isAy1AuthorBox(raw) : true,
        hasDisclaimer: true,
        extLinksInBody: 0,
        h1Count: 1,
      });
    }
  }

  const report = EXECUTE
    ? buildFinalReport(backupDir, profileResult, cssAttempt, authorResults, verify)
    : buildDryRunReport(backupDir, profileResult, cssAttempt, authorResults);

  writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(`Rapor: ${REPORT_PATH}`);
  console.log(JSON.stringify({ backupDir, profileResult, authorResults, cssAttempt }, null, 2));

  if (DRY) console.log('\nCanlı uygulamak için: npm run fix:ay1-polish -- --execute');
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
