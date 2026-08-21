#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';
import { extractInternalLinks, stripHtml } from './lib/link-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT = resolve(__dirname, '../reports/adanabosanma-implementation-plan.md');
const SCHEMA_DIR = resolve(__dirname, '../reports/schema-live');
const EXECUTE = process.argv.includes('--execute');
const DRY = !EXECUTE;

const PROTECTED_FULL = new Set(['hakkimizda', 'adana-bosanma-avukati']);
const BASE = () => getWpConfig().baseUrl.replace(/\/$/, '');

const AUTHOR_VARIANTS = {
  bosanma: 'boşanma davası açma, delil toplama ve usul adımları',
  anlasmali: 'anlaşmalı boşanma protokolü, velayet, nafaka ve mal paylaşımı',
  cekismeli: 'çekişmeli boşanma dava süreci, deliller ve tanık anlatımları',
  nafaka: 'tedbir, yoksulluk ve iştirak nafakası',
  velayet: 'çocuğun üstün yararı ilkesi',
  mal: 'mal rejimi tasfiyesi ve katılma alacağı',
  uzaklastirma: '6284 sayılı Kanun kapsamındaki koruma tedbirleri',
  miras: 'miras paylaşımı, veraset ilamı ve mirasçı uyuşmazlıkları',
  ortaklik: 'ortaklığın giderilmesi ve hisseli taşınmaz uyuşmazlıkları',
  zina: 'zina nedeniyle boşanma davasında ispat ve delil süreci',
  default: 'boşanma, nafaka, velayet, miras ve taşınmaz uyuşmazlıkları',
};

function authorBoxHtml(topic) {
  return `<div class="author-note" style="margin-top:2em;padding:1em;border-left:4px solid #ccc;background:#f9f9f9;"><p><strong>Yazar / Hukuki Değerlendirme</strong></p><p>Bu içerik, Adana'da aile hukuku, miras hukuku ve taşınmaz uyuşmazlıkları alanlarında hukuki bilgilendirme amacıyla hazırlanmıştır. ${topic} konusunda somut olayın koşullarına göre değerlendirme değişebileceğinden, dava açmadan önce hukuki destek alınması önemlidir. Av. Ceren Sümer Cilli tarafından genel bilgilendirme çerçevesinde hazırlanan bu metin hukuki tavsiye niteliği taşımaz.</p></div>`;
}

function topicForSlug(slug, title) {
  const t = `${slug} ${title}`.toLowerCase();
  if (t.includes('miras')) return AUTHOR_VARIANTS.miras;
  if (t.includes('ortakligin') || t.includes('ortaklığın')) return AUTHOR_VARIANTS.ortaklik;
  if (t.includes('uzaklastirma') || t.includes('6284')) return AUTHOR_VARIANTS.uzaklastirma;
  if (t.includes('nafaka')) return AUTHOR_VARIANTS.nafaka;
  if (t.includes('velayet')) return AUTHOR_VARIANTS.velayet;
  if (t.includes('mal-paylasim') || t.includes('katilma')) return AUTHOR_VARIANTS.mal;
  if (t.includes('anlasmali')) return AUTHOR_VARIANTS.anlasmali;
  if (t.includes('cekismeli')) return AUTHOR_VARIANTS.cekismeli;
  if (t.includes('zina') || t.includes('aldatma')) return AUTHOR_VARIANTS.zina;
  if (t.includes('bosanma')) return AUTHOR_VARIANTS.bosanma;
  return AUTHOR_VARIANTS.default;
}

function hasAuthorBox(html) {
  return /class="author-note"|Yazar \/ Hukuki Değerlendirme/i.test(html);
}

function insertAuthorBox(html, slug, title) {
  if (hasAuthorBox(html)) return { html, changed: false };
  const box = authorBoxHtml(topicForSlug(slug, title));
  const marker = /(<div class="author-note"|<h2[^>]*>\s*Sık Sorulan|<h2[^>]*>\s*Sıkça Sorulan|<div id="rank-math-faq")/i;
  if (marker.test(html)) {
    return { html: html.replace(marker, `${box}\n$1`), changed: true };
  }
  return { html: html.trim() + `\n\n${box}`, changed: true };
}

function replaceExternalLinks(html) {
  let changed = false;
  const out = html.replace(/href=["'](https?:\/\/(?:www\.)?cerenavukat\.com[^"']*)["']/gi, () => {
    changed = true;
    return `href="${BASE()}/avukat-ceren-sumer-cilli/"`;
  });
  return { html: out, changed };
}

function appendParagraphIfMissing(html, url, paragraphHtml) {
  if (html.includes(url)) return { html, changed: false };
  const marker = /(<div class="author-note"|<h2[^>]*>\s*Sık Sorulan|<h2[^>]*>\s*Sıkça Sorulan)/i;
  if (marker.test(html)) {
    return { html: html.replace(marker, `${paragraphHtml}\n$1`), changed: true };
  }
  return { html: html.trim() + `\n\n${paragraphHtml}`, changed: true };
}

const LEGACY_LINKS = {
  26: [
    { url: `${BASE()}/avukat-ceren-sumer-cilli/`, p: `<p>Velayet sürecinde genel bilgi için <a href="${BASE()}/avukat-ceren-sumer-cilli/">Av. Ceren Sümer Cilli</a> profil sayfasını ve <a href="${BASE()}/adanada-velayet-davasinda-cocugun-ustun-yarari/">velayet davasında çocuğun üstün yararı</a> rehberini inceleyebilirsiniz.</p>` },
    { url: `${BASE()}/iletisim/`, p: `<p>Somut dosyanız için <a href="${BASE()}/iletisim/">iletişim sayfası</a> üzerinden hukuki destek talep edebilirsiniz.</p>` },
  ],
  131: [
    { url: `${BASE()}/adana-cekismeli-bosanma-davasi/`, p: `<p>Çekişmeli boşanma sürecinin başlangıç adımları için <a href="${BASE()}/adana-cekismeli-bosanma-davasi/">Adana'da çekişmeli boşanma davası nasıl açılır</a> rehberine göz atabilirsiniz.</p>` },
    { url: `${BASE()}/avukat-ceren-sumer-cilli/`, p: `<p>Delil ve usul sürecinde <a href="${BASE()}/avukat-ceren-sumer-cilli/">Av. Ceren Sümer Cilli</a> tarafından hazırlanan diğer bilgilendirme içeriklerine de ulaşabilirsiniz.</p>` },
  ],
  134: [
    { url: `${BASE()}/adanada-velayet-davasinda-cocugun-ustun-yarari/`, p: `<p>Çocuğun üstün yararı konusunda ayrıntılı bilgi için <a href="${BASE()}/adanada-velayet-davasinda-cocugun-ustun-yarari/">Adana'da velayet davasında çocuğun üstün yararı</a> yazısını okuyabilirsiniz.</p>` },
    { url: `${BASE()}/iletisim/`, p: `<p>Velâyet dosyanız hakkında <a href="${BASE()}/iletisim/">iletişim</a> kanalından bilgi alabilirsiniz.</p>` },
  ],
};

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

function rehberSectionHtml(compact = false) {
  const items = REHBER_LINKS.map(
    (r) => `<li><a href="${BASE()}${r.url}">${r.title}</a></li>`
  ).join('\n');
  if (compact) {
    return `<div class="ceren-rehberler-compact" style="margin-top:2em;padding:1em;background:#f9f9f9;border-radius:6px;"><p><strong>Bilgilendirme Rehberleri</strong></p><ul style="columns:2;gap:1em;">${items}</ul></div>`;
  }
  return `<div class="ceren-rehberler" style="margin-top:2em;padding:1.5em;background:#f9f9f9;border-radius:8px;"><h2>Bilgilendirme Rehberleri</h2><p>Adana'da aile hukuku, miras ve taşınmaz uyuşmazlıkları hakkında hazırlanan güncel rehberler:</p><ul>${items}</ul><p>Somut olayınız için <a href="${BASE()}/iletisim/">iletişim sayfası</a> üzerinden bilgi alabilirsiniz.</p></div>`;
}

function buildSchema(post, meta) {
  const url = `${BASE()}/${post.slug}/`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: meta.rank_math_title || stripHtml(post.title?.rendered),
      description: meta.rank_math_description || stripHtml(post.excerpt?.rendered),
      url,
      author: { '@type': 'Person', name: 'Av. Ceren Sümer Cilli' },
      reviewer: { '@type': 'Person', name: 'Av. Ceren Sümer Cilli' },
      publisher: { '@type': 'Organization', name: 'adanabosanmaavukati.org' },
      areaServed: { '@type': 'City', name: 'Adana' },
      inLanguage: 'tr-TR',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'LegalService',
      name: 'Adana Aile Hukuku Bilgilendirme',
      areaServed: 'Adana',
      provider: { '@type': 'Person', name: 'Av. Ceren Sümer Cilli' },
    },
  ];
}

async function updatePost(id, payload, dryLabel) {
  if (DRY) return { dry: true, id, ...dryLabel };
  const res = await wpFetch(`/wp-json/wp/v2/posts/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Post ${id} güncellenemedi (${res.status})`);
  return res.json();
}

async function updatePage(id, payload, dryLabel) {
  if (DRY) return { dry: true, id, ...dryLabel };
  const res = await wpFetch(`/wp-json/wp/v2/pages/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Sayfa ${id} güncellenemedi (${res.status})`);
  return res.json();
}

async function main() {
  const log = [];
  const host = new URL(BASE()).hostname;
  if (!existsSync(SCHEMA_DIR)) mkdirSync(SCHEMA_DIR, { recursive: true });

  console.log(DRY ? 'DRY-RUN — canlı değişiklik yok' : 'CANLI UYGULAMA başlıyor...');

  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish' });

  for (const p of posts) {
    const res = await wpFetch(`/wp-json/wp/v2/posts/${p.id}?context=edit`);
    const post = await res.json();
    let html = post.content.raw || '';
    const changes = [];

    const ext = replaceExternalLinks(html);
    if (ext.changed) {
      html = ext.html;
      changes.push('dış link → profil');
    }

    const box = insertAuthorBox(html, post.slug, stripHtml(post.title?.rendered));
    if (box.changed) {
      html = box.html;
      changes.push('author box');
    }

    if (LEGACY_LINKS[post.id]) {
      for (const link of LEGACY_LINKS[post.id]) {
        const added = appendParagraphIfMissing(html, link.url, link.p);
        if (added.changed) {
          html = added.html;
          changes.push(`iç link: ${link.url.split('/').slice(-2, -1)[0]}`);
        }
      }
    }

    const meta = { ...(post.meta || {}) };
    if (post.id === 160 && meta.rank_math_description?.includes('danışmanlığı alın')) {
      meta.rank_math_description =
        "Adana'da miras davaları, veraset ilamı, miras paylaşımı ve saklı pay süreçleri hakkında genel bilgilendirme rehberi. Somut olay koşullarına göre değerlendirme değişebilir.";
      changes.push('meta description yumuşatıldı');
    }

    if (changes.length) {
      await updatePost(post.id, {
        content: html,
        status: 'publish',
        meta: {
          rank_math_title: meta.rank_math_title,
          rank_math_description: meta.rank_math_description,
          rank_math_focus_keyword: meta.rank_math_focus_keyword,
        },
      }, { changes });
      log.push({ type: 'post', id: post.id, slug: post.slug, changes });
    }

    writeFileSync(
      resolve(SCHEMA_DIR, `post-${post.id}-${post.slug}.json`),
      JSON.stringify(buildSchema(post, meta), null, 2)
    );
  }

  // Hizmetler sayfası — rehberler bölümü
  const hizmetler = await wpFetch('/wp-json/wp/v2/pages/98?context=edit');
  const hPage = await hizmetler.json();
  if (!hPage.content.raw.includes('ceren-rehberler')) {
    const html = hPage.content.raw.trim() + `\n\n${rehberSectionHtml(false)}`;
    await updatePage(98, { content: html, status: 'publish' }, { page: 'hizmetler' });
    log.push({ type: 'page', id: 98, slug: 'hizmetler', changes: ['rehberler bölümü'] });
  }

  // Profil sayfası — kompakt rehberler (minimal)
  const profil = await wpFetch('/wp-json/wp/v2/pages/15?context=edit');
  const pPage = await profil.json();
  if (!pPage.content.raw.includes('ceren-rehberler-compact')) {
    const html = pPage.content.raw.trim() + `\n\n${rehberSectionHtml(true)}`;
    await updatePage(15, { content: html, status: 'publish' }, { page: 'profil' });
    log.push({ type: 'page', id: 15, slug: 'avukat-ceren-sumer-cilli', changes: ['kompakt rehberler'] });
  }

  let md = `# adanabosanmaavukati.org — Uygulama Planı ve Sonuç\n\n> ${new Date().toISOString()}\n\n`;
  md += `## Mod\n${DRY ? '**DRY-RUN** (canlı değişiklik yapılmadı)' : '**CANLI UYGULAMA** tamamlandı'}\n\n`;
  md += `## Yapılan İşlemler\n\n`;
  if (!log.length) md += `_Değişiklik gerektiren madde bulunamadı veya zaten uygulanmış._\n\n`;
  for (const item of log) {
    md += `- **${item.type} ${item.id}** (\`${item.slug}\`): ${item.changes.join(', ')}\n`;
  }
  md += `\n## Schema\n`;
  md += `Tüm yayın yazıları için JSON-LD önerileri: \`reports/schema-live/\`\n`;
  md += `Rank Math panelinden Person + Article + FAQ şablonlarını bu dosyalarla eşleştirin.\n\n`;
  md += `## Dokunulmayan Sayfalar\n`;
  md += `- Ana sayfa (\`/adana-bosanma-avukati/\`)\n- \`/hakkimizda/\` (içerik değiştirilmedi)\n\n`;
  md += `## Sonraki Adımlar (Ay 2)\n`;
  md += `1. Ziynet alacağı rehberi\n2. Nafaka alt türleri yazıları\n3. Velayet ve mal paylaşımı hub sayfaları\n4. Hub–yazı canonical netleştirme\n5. Google Search Console + sitemap\n`;

  writeFileSync(REPORT, md, 'utf8');
  console.log(`Rapor: ${REPORT}`);
  console.log(`Güncellenen öğe: ${log.length}`);
  if (DRY) console.log('Canlı uygulamak için: npm run apply:seo -- --execute');
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
