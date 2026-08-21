#!/usr/bin/env node
/**
 * Kritik SEO / dönüşüm düzeltmeleri (2026-07-22)
 * npm run apply:critical-fixes -- --execute
 *
 * Uygular: iletişim CTA, ana sayfa iç linkleri, yazar adı,
 * menü (velayet/mal), /blog/ 301 sayfası, author noindex meta,
 * ana sayfa OG görseli (meta), yedekleme.
 *
 * Uygulamaz: Rank Math Titles settings (#site_title — API 500),
 * sitemap DB onarımı (manuel), güvenlik başlıkları (host),
 * author slug değişimi (301 planı raporda), cannibalization 301.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch } from './lib/wp-fetch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EXECUTE = process.argv.includes('--execute');
const BASE = 'https://adanabosanmaavukati.org';
const TEL = '+905336342425';
const TEL_DISPLAY = '0533 634 24 25';
const WA =
  'https://wa.me/905336342425?text=Merhaba%20Avukat%20Ceren%20S%C3%BCmer%20Cilli%2C%20hukuki%20dan%C4%B1%C5%9Fmanl%C4%B1k%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum.';
const OG_IMAGE_ID = 200; // featured-bosanma-davasi-nasil-acilir.jpg 1600x906
const DISPLAY_NAME = 'Avukat Ceren Sümer Cilli';

const log = [];

function record(item) {
  log.push({ ts: new Date().toISOString(), ...item });
  const icon = item.ok === false ? '✗' : item.dry ? '·' : '✓';
  console.log(`${icon} ${item.step}${item.detail ? ' — ' + item.detail : ''}`);
}

async function getPage(id) {
  const res = await wpFetch(`/wp-json/wp/v2/pages/${id}?context=edit`);
  if (!res.ok) throw new Error(`page ${id}: ${res.status}`);
  return res.json();
}

async function updatePage(id, payload) {
  if (!EXECUTE) {
    record({ step: `dry page ${id}`, dry: true, detail: Object.keys(payload).join(',') });
    return { dry: true };
  }
  const res = await wpFetch(`/wp-json/wp/v2/pages/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`update page ${id}: ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function rankMathMeta(objectID, objectType, meta) {
  if (!EXECUTE) {
    record({ step: `dry rankmeta ${objectType}:${objectID}`, dry: true });
    return { dry: true };
  }
  const res = await wpFetch('/wp-json/rankmath/v1/updateMeta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectID, objectType, meta }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rankmeta ${objectType}:${objectID}: ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function rankMathRedirect(objectID, objectType, urlTo) {
  if (!EXECUTE) {
    record({ step: `dry redirect ${objectID} → ${urlTo}`, dry: true });
    return { dry: true };
  }
  const res = await wpFetch('/wp-json/rankmath/v1/updateRedirection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      objectID,
      objectType,
      hasRedirect: true,
      redirectionUrl: urlTo,
      redirectionType: '301',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`redirect ${objectID}: ${res.status} ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function buildContactContent() {
  return `<!-- wp:heading -->
<h2 class="wp-block-heading">İletişim Bilgileri</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Adana’da boşanma ve aile hukuku kapsamındaki hukuki süreçleriniz için Avukat Ceren Sümer Cilli’ye aşağıdaki iletişim kanallarından ulaşabilirsiniz.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>Telefon:</strong> <a href="tel:${TEL}" aria-label="Avukat Ceren Sümer Cilli'yi arayın">${TEL_DISPLAY}</a><br><strong>Adres:</strong> Gazipaşa Mh, Ordu Cd. Dinçkan Apt No:7 A Blok Daire:3, 01010 Seyhan/Adana</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2 class="wp-block-heading">Hızlı İletişim</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Dilerseniz kısa bir ön bilgi vererek randevu talep edebilirsiniz. Mesajınız mümkün olan en kısa sürede değerlendirilir.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>✅ <strong>WhatsApp:</strong> <a href="${WA}" target="_blank" rel="noopener noreferrer" aria-label="Avukat Ceren Sümer Cilli ile WhatsApp üzerinden iletişime geçin">WhatsApp’tan mesaj gönderin</a></p>
<!-- /wp:paragraph -->

<!-- wp:html -->
<div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px;">
  <iframe 
    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d12747.031111011287!2d35.3114188554199!3d36.99171459999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x15288f6f3764072f%3A0x51c862d3a8658c0d!2sAdana%20Avukat%20Ceren%20S%C3%BCmer%20Cilli%20%7C%20Adana%20Bo%C5%9Fanma%20Avukat%C4%B1!5e0!3m2!1str!2str!4v1769366580660!5m2!1str!2str"
    style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"
    allowfullscreen=""
    loading="lazy"
    referrerpolicy="no-referrer-when-downgrade">
  </iframe>
</div>
<!-- /wp:html -->

<!-- wp:html -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LegalService",
  "@id": "https://adanabosanmaavukati.org/#legalservice",
  "name": "Avukat Ceren Sümer Cilli - Adana Boşanma Avukatı",
  "url": "https://adanabosanmaavukati.org/",
  "telephone": "+905336342425",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Gazipaşa Mh, Ordu Cd. Dinçkan Apt No:7 A Blok Daire:3",
    "postalCode": "01010",
    "addressLocality": "Seyhan",
    "addressRegion": "Adana",
    "addressCountry": "TR"
  },
  "areaServed": [
    { "@type": "City", "name": "Adana" },
    { "@type": "AdministrativeArea", "name": "Çukurova" },
    { "@type": "AdministrativeArea", "name": "Seyhan" },
    { "@type": "AdministrativeArea", "name": "Yüreğir" }
  ],
  "sameAs": [
    "https://www.cerensumer.av.tr/adana-bosanma-avukati-ceren-sumer-cilli-kimdir/",
    "https://www.linkedin.com/in/avukat-ceren-s%C3%BCmer-cilli-375873b0/",
    "https://www.instagram.com/av.cerensumercilli/",
    "https://www.facebook.com/cerensumercilli/"
  ]
}
</script>
<!-- /wp:html -->

<!-- wp:html -->
<div class="ceren-hub-links" style="margin-top:2em;padding:1.25em;background:#f9f9f9;border-radius:8px;border-left:4px solid #ccc;">
<p><strong>İlgili Rehberler</strong></p>
<ul><li><a href="https://adanabosanmaavukati.org/hizmetler/">Bilgilendirme rehberleri</a></li>
<li><a href="https://adanabosanmaavukati.org/adana-bosanma-avukati-rehberi/">Adana boşanma avukatı rehberi</a></li>
<li><a href="https://adanabosanmaavukati.org/avukat-ceren-sumer-cilli/">Av. Ceren Sümer Cilli profil sayfası</a></li>
<li><a href="https://adanabosanmaavukati.org/adanada-bosanma-davasi-nasil-acilir/">Boşanma davası nasıl açılır</a></li></ul>
</div>
<!-- /wp:html -->
`;
}

function patchHomepage(raw) {
  let html = raw;

  // Fix broken profile / rehberi anchors (href missing)
  html = html.replace(
    /✅ Avukat profili: <a>https:\/\/adanabosanmaavukati\.org\/avukat-ceren-sumer-cilli\/<\/a>/,
    `✅ Avukat profili: <a href="https://adanabosanmaavukati.org/avukat-ceren-sumer-cilli/">Avukat Ceren Sümer Cilli</a>`
  );
  html = html.replace(
    /✅ Boşanma rehberi: <a>https:\/\/adanabosanmaavukati\.org\/adana-bosanma-avukati-rehberi\/<\/a>/,
    `✅ Boşanma rehberi: <a href="https://adanabosanmaavukati.org/adana-bosanma-avukati-rehberi/">Adana boşanma avukatı rehberi</a>`
  );

  // Anlaşmalı + çekişmeli — first process paragraph
  if (!html.includes('/adanada-anlasmali-bosanma-avukati/')) {
    html = html.replace(
      /Anlaşmalı boşanma davalarında tarafların boşanmanın tüm sonuçları üzerinde mutabık kalması gerekirken, çekişmeli boşanma davalarında kusur, nafaka, velayet ve mal paylaşımı gibi hususlar mahkeme tarafından değerlendirilir\./,
      `Anlaşmalı boşanma davalarında tarafların boşanmanın tüm sonuçları üzerinde mutabık kalması gerekirken, çekişmeli boşanma davalarında kusur, nafaka, velayet ve mal paylaşımı gibi hususlar mahkeme tarafından değerlendirilir. Konuya özel bilgilendirme için <a href="${BASE}/adanada-anlasmali-bosanma-avukati/">Adana anlaşmalı boşanma avukatı</a> ve <a href="${BASE}/adana-cekismeli-bosanma-avukati/">Adana çekişmeli boşanma avukatı</a> sayfalarına bakabilirsiniz.`
    );
  }

  // Nafaka
  if (!html.includes('/adana-nafaka-davasi-avukati/')) {
    html = html.replace(
      /Adana’da nafaka davalarında yoksulluk nafakası, iştirak nafakası ve tedbir nafakası gibi farklı nafaka türleri değerlendirilir\./,
      `Adana’da nafaka davalarında yoksulluk nafakası, iştirak nafakası ve tedbir nafakası gibi farklı nafaka türleri değerlendirilir. Ayrıntılı bilgi için <a href="${BASE}/adana-nafaka-davasi-avukati/">Adana nafaka davası avukatı</a> sayfasını inceleyebilirsiniz.`
    );
  }

  // Velayet
  if (!html.includes('/adana-velayet-davasi/')) {
    html = html.replace(
      /Velayet davalarında temel kriter, çocuğun üstün yararının korunmasıdır\./,
      `Velayet davalarında temel kriter, çocuğun üstün yararının korunmasıdır. Süreç hakkında <a href="${BASE}/adana-velayet-davasi/">Adana velayet davası</a> rehberine göz atabilirsiniz.`
    );
  }

  // Mal paylaşımı
  if (!html.includes('/bosanmada-mal-paylasimi-ve-katilma-alacagi/')) {
    html = html.replace(
      /Mal paylaşımı davaları, boşanma kararının kesinleşmesinden sonra açılan ve eşlerin evlilik süresince edindikleri malların paylaşımını konu alan davalardır\./,
      `Mal paylaşımı davaları, boşanma kararının kesinleşmesinden sonra açılan ve eşlerin evlilik süresince edindikleri malların paylaşımını konu alan davalardır. Hesaplama ve süreç için <a href="${BASE}/bosanmada-mal-paylasimi-ve-katilma-alacagi/">boşanmada mal paylaşımı</a> rehberini inceleyebilirsiniz.`
    );
  }

  // Soften homepage WA rel to include noreferrer (keep working design)
  html = html.replace(
    /href="https:\/\/wa\.me\/905336342425" target="_blank" rel="nofollow noopener"/,
    `href="${WA}" target="_blank" rel="noopener noreferrer"`
  );

  return html;
}

async function backup(pages, user) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = resolve(ROOT, `data/backups/critical-fixes-${ts}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, 'backup.json'),
    JSON.stringify(
      {
        pages: pages.map((p) => ({
          id: p.id,
          slug: p.slug,
          content: p.content?.raw,
          title: p.title?.raw,
        })),
        user: {
          id: user.id,
          name: user.name,
          slug: user.slug,
          nickname: user.nickname,
          first_name: user.first_name,
          last_name: user.last_name,
        },
      },
      null,
      2
    )
  );
  return dir;
}

async function fixUser() {
  const res = await wpFetch('/wp-json/wp/v2/users/1?context=edit');
  const user = await res.json();
  record({
    step: 'user before',
    detail: `name=${user.name} slug=${user.slug} nickname=${user.nickname}`,
  });

  if (!EXECUTE) {
    record({ step: 'dry user name', dry: true, detail: DISPLAY_NAME });
    return user;
  }

  // WordPress uses `name` as display name in REST
  const upd = await wpFetch('/wp-json/wp/v2/users/1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DISPLAY_NAME,
      first_name: 'Avukat Ceren',
      last_name: 'Sümer Cilli',
      nickname: DISPLAY_NAME,
    }),
  });
  const text = await upd.text();
  if (!upd.ok) throw new Error(`user update: ${upd.status} ${text.slice(0, 200)}`);
  const after = JSON.parse(text);
  record({ step: 'user display name', ok: true, detail: `→ ${after.name}` });

  // Author archives noindex (both users)
  for (const uid of [1, 2]) {
    try {
      await rankMathMeta(uid, 'user', { rank_math_robots: ['noindex', 'follow'] });
      record({ step: `author noindex user ${uid}`, ok: true });
    } catch (e) {
      record({ step: `author noindex user ${uid}`, ok: false, detail: e.message });
    }
  }

  return after;
}

async function ensureBlogRedirect() {
  // Find existing blog page
  const find = await wpFetch('/wp-json/wp/v2/pages?slug=blog&context=edit');
  let pages = await find.json();
  let page = pages[0];

  if (!page) {
    if (!EXECUTE) {
      record({ step: 'dry create /blog/ page', dry: true });
      return null;
    }
    const create = await wpFetch('/wp-json/wp/v2/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Blog',
        slug: 'blog',
        status: 'publish',
        content:
          '<!-- wp:paragraph --><p>Bu adres bilgilendirme rehberlerine taşınmıştır. <a href="/hizmetler/">Hizmetler</a> sayfasına gidin.</p><!-- /wp:paragraph -->',
      }),
    });
    const text = await create.text();
    if (!create.ok) throw new Error(`create blog: ${create.status} ${text.slice(0, 200)}`);
    page = JSON.parse(text);
    record({ step: 'create /blog/ page', ok: true, detail: `id=${page.id}` });
  } else {
    record({ step: 'existing /blog/ page', ok: true, detail: `id=${page.id}` });
  }

  // Rank Math 301 + noindex (page should not compete)
  try {
    await rankMathRedirect(page.id, 'post', `${BASE}/hizmetler/`);
    record({ step: 'Rank Math 301 /blog/ → /hizmetler/', ok: true });
  } catch (e) {
    try {
      await rankMathRedirect(page.id, 'page', `${BASE}/hizmetler/`);
      record({ step: 'Rank Math 301 /blog/ (page type)', ok: true });
    } catch (e2) {
      record({ step: 'Rank Math 301 /blog/', ok: false, detail: e2.message });
    }
  }

  try {
    await rankMathMeta(page.id, 'page', {
      rank_math_robots: ['noindex', 'follow'],
      rank_math_canonical_url: `${BASE}/hizmetler/`,
    });
    record({ step: '/blog/ noindex + canonical', ok: true });
  } catch (e) {
    try {
      await rankMathMeta(page.id, 'post', {
        rank_math_robots: ['noindex', 'follow'],
        rank_math_canonical_url: `${BASE}/hizmetler/`,
      });
      record({ step: '/blog/ noindex + canonical (post type)', ok: true });
    } catch (e2) {
      record({ step: '/blog/ noindex', ok: false, detail: e2.message });
    }
  }

  return page;
}

async function addMenuItems() {
  const menuId = 2; // Ana Menü
  const parentId = 105; // Hizmetler
  const existing = await (
    await wpFetch('/wp-json/wp/v2/menu-items?menus=2&per_page=100')
  ).json();

  const wanted = [
    {
      title: 'Adana Velayet Davası',
      url: `${BASE}/adana-velayet-davasi/`,
      object: 'post',
      object_id: 26,
      type: 'post_type',
    },
    {
      title: 'Boşanmada Mal Paylaşımı',
      url: `${BASE}/bosanmada-mal-paylasimi-ve-katilma-alacagi/`,
      object: 'post',
      object_id: 148,
      type: 'post_type',
    },
  ];

  for (const item of wanted) {
    const already = existing.find(
      (e) => e.url?.replace(/\/$/, '') === item.url.replace(/\/$/, '') && e.parent === parentId
    );
    if (already) {
      record({ step: `menu skip ${item.title}`, ok: true, detail: 'zaten var' });
      continue;
    }
    if (!EXECUTE) {
      record({ step: `dry menu ${item.title}`, dry: true });
      continue;
    }
    const res = await wpFetch('/wp-json/wp/v2/menu-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: item.title,
        url: item.url,
        menus: menuId,
        parent: parentId,
        status: 'publish',
        type: item.type,
        object: item.object,
        object_id: item.object_id,
        menu_order: 6,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      // Fallback: custom link
      const res2 = await wpFetch('/wp-json/wp/v2/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          url: item.url,
          menus: menuId,
          parent: parentId,
          status: 'publish',
          type: 'custom',
          object: 'custom',
          menu_order: 6,
        }),
      });
      const text2 = await res2.text();
      if (!res2.ok) {
        record({ step: `menu ${item.title}`, ok: false, detail: text2.slice(0, 150) });
        continue;
      }
      record({ step: `menu ${item.title}`, ok: true, detail: 'custom link' });
      continue;
    }
    record({ step: `menu ${item.title}`, ok: true });
  }
}

async function setHomepageOg(pageId) {
  const media = await (await wpFetch(`/wp-json/wp/v2/media/${OG_IMAGE_ID}`)).json();
  const url = media.source_url;
  try {
    await rankMathMeta(pageId, 'page', {
      rank_math_facebook_image: url,
      rank_math_facebook_image_id: OG_IMAGE_ID,
      rank_math_twitter_image: url,
      rank_math_twitter_image_id: OG_IMAGE_ID,
      rank_math_twitter_card_type: 'summary_large_image',
    });
    record({ step: 'homepage OG/Twitter image', ok: true, detail: url });
  } catch (e) {
    try {
      await rankMathMeta(pageId, 'post', {
        rank_math_facebook_image: url,
        rank_math_facebook_image_id: OG_IMAGE_ID,
        rank_math_twitter_image: url,
        rank_math_twitter_image_id: OG_IMAGE_ID,
      });
      record({ step: 'homepage OG image (post type)', ok: true, detail: url });
    } catch (e2) {
      record({ step: 'homepage OG image', ok: false, detail: e2.message });
    }
  }
}

async function main() {
  console.log(EXECUTE ? '=== EXECUTE MODE ===' : '=== DRY RUN (pass --execute) ===');

  const contactBefore = await getPage(39);
  const homeBefore = await getPage(19);
  const userBefore = await (await wpFetch('/wp-json/wp/v2/users/1?context=edit')).json();
  const backupDir = await backup([contactBefore, homeBefore], userBefore);
  record({ step: 'backup', ok: true, detail: backupDir });

  // 1) Contact
  const contactHtml = buildContactContent();
  await updatePage(39, { content: contactHtml });
  record({ step: 'contact CTA + empty h2 removed', ok: true });

  // 2) Homepage links
  const patched = patchHomepage(homeBefore.content.raw);
  if (patched === homeBefore.content.raw) {
    record({ step: 'homepage patch', ok: false, detail: 'içerik eşleşmedi / zaten uygulanmış olabilir' });
  } else {
    await updatePage(19, { content: patched });
    record({ step: 'homepage internal links + broken anchors', ok: true });
  }

  // 3) User display name + author noindex
  await fixUser();

  // 4) Blog redirect page
  await ensureBlogRedirect();

  // 5) Menu
  await addMenuItems();

  // 6) Homepage OG
  await setHomepageOg(19);

  // Persist log
  const reportPath = resolve(ROOT, 'reports/critical-fixes-2026-07-22.json');
  writeFileSync(reportPath, JSON.stringify({ execute: EXECUTE, log }, null, 2));
  record({ step: 'report written', ok: true, detail: reportPath });
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
