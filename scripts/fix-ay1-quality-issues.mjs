#!/usr/bin/env node
import { wpFetch } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';

const BASE = getWpConfig().baseUrl.replace(/\/$/, '');
const EXECUTE = process.argv.includes('--execute');

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

function rehberSectionHtml() {
  const items = REHBER_LINKS.map(
    (r) => `<li><a href="${BASE}${r.url}">${r.title}</a></li>`
  ).join('\n');
  return `<div class="ceren-rehberler" style="margin-top:2em;padding:1.5em;background:#f9f9f9;border-radius:8px;"><h2>Bilgilendirme Rehberleri</h2><p>Adana'da aile hukuku, miras ve taşınmaz uyuşmazlıkları hakkında hazırlanan güncel rehberler:</p><ul>${items}</ul><p>Somut olayınız için <a href="${BASE}/iletisim/">iletişim sayfası</a> üzerinden bilgi alabilirsiniz.</p></div>`;
}

function hizmetlerBlockContent() {
  const rehber = rehberSectionHtml();
  return `<!-- wp:query {"queryId":1,"query":{"perPage":50,"pages":0,"offset":0,"postType":"post","order":"desc","orderBy":"date","author":"","search":"","exclude":[],"sticky":"","inherit":false}} -->
<div class="wp-block-query"><!-- wp:post-template {"layout":{"type":"grid","columnCount":3}} -->
<!-- wp:post-featured-image {"isLink":true,"aspectRatio":"4/3"} /-->
<!-- wp:post-title {"isLink":true,"level":3} /-->
<!-- wp:post-excerpt {"moreText":"Devamını Oku »","excerptLength":20} /-->
<!-- /wp:post-template --></div>
<!-- /wp:query -->

<!-- wp:html -->
${rehber}
<!-- /wp:html -->`;
}

function profileRehberHtml(raw) {
  if (!raw.includes('ceren-rehberler-compact')) return raw;
  if (raw.includes('ceren-rehberler-mobile')) return raw;
  const style = `<style>.ceren-rehberler-compact ul{columns:2;gap:1em}@media(max-width:640px){.ceren-rehberler-compact ul{columns:1!important}}</style>`;
  return raw.replace(
    /(<div class="ceren-rehberler-compact"[^>]*>)/i,
    `${style}\n$1`
  );
}

function fixContentH1(html) {
  return html.replace(/<h1(\b[^>]*)>/gi, '<h2$1>').replace(/<\/h1>/gi, '</h2>');
}

async function fixHizmetlerPage() {
  const view = await wpFetch('/wp-json/wp/v2/pages/98?context=view');
  const rendered = (await view.json()).content?.rendered || '';
  if (rendered.includes('ceren-rehberler')) {
    console.log('Hizmetler: rehber bölümü zaten canlıda');
    return { skipped: true };
  }

  const edit = await wpFetch('/wp-json/wp/v2/pages/98?context=edit');
  const page = await edit.json();
  const content = hizmetlerBlockContent();

  if (!EXECUTE) {
    console.log('DRY: Hizmetler block içerik + rehber uygulanacak (Elementor devre dışı)');
    return { dry: true };
  }

  const upd = await wpFetch('/wp-json/wp/v2/pages/98', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      status: 'publish',
      meta: {
        _elementor_edit_mode: '',
      },
    }),
  });
  if (!upd.ok) {
    const err = await upd.text();
    throw new Error(`Hizmetler güncellenemedi (${upd.status}): ${err.slice(0, 300)}`);
  }
  console.log('Hizmetler: yazı listesi + Bilgilendirme Rehberleri canlı içerik olarak eklendi');
  return { updated: true };
}

async function fixProfileMobile() {
  const res = await wpFetch('/wp-json/wp/v2/pages/15?context=edit');
  const page = await res.json();
  const raw = page.content.raw || '';
  const next = profileRehberHtml(raw);
  if (next === raw) {
    console.log('Profil: mobil rehber CSS zaten mevcut veya bölüm yok');
    return;
  }
  if (!EXECUTE) {
    console.log('DRY: Profil sayfasına mobil tek sütun CSS eklenecek');
    return;
  }
  await wpFetch('/wp-json/wp/v2/pages/15', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: next, status: 'publish' }),
  });
  console.log('Profil: mobil rehber listesi tek sütuna düşecek şekilde güncellendi');
}

async function fixDuplicateH1(postIds) {
  for (const id of postIds) {
    const res = await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`);
    const post = await res.json();
    const raw = post.content.raw || '';
    const h1Before = (raw.match(/<h1/gi) || []).length;
    if (h1Before === 0) {
      console.log(`Post ${id}: içerikte H1 yok, atlandı`);
      continue;
    }
    const fixed = fixContentH1(raw);

    if (!EXECUTE) {
      console.log(`DRY: Post ${id} H1 ${h1Before} → 0`);
      continue;
    }

    const upd = await wpFetch(`/wp-json/wp/v2/posts/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: fixed, status: 'publish' }),
    });
    if (!upd.ok) throw new Error(`Post ${id} güncellenemedi (${upd.status})`);
    console.log(`Post ${id}: içerik H1 → H2 (${h1Before} adet düzeltildi)`);
  }
}

async function verifyLive() {
  const hiz = await fetch(`${BASE}/hizmetler/?v=${Date.now()}`);
  const hizHtml = await hiz.text();
  console.log('Canlı hizmetler rehber:', hizHtml.includes('ceren-rehberler'));

  for (const id of [158, 159, 160]) {
    const res = await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`);
    const slug = (await res.json()).slug;
    const r = await fetch(`${BASE}/${slug}/?v=${Date.now()}`);
    const html = await r.text();
    const h1 = (html.match(/<h1/gi) || []).length;
    console.log(`Canlı post ${id} (${slug}): H1 sayısı ${h1}`);
  }
}

async function main() {
  console.log(EXECUTE ? 'CANLI düzeltme başlıyor...' : 'DRY-RUN modu');
  await fixHizmetlerPage();
  await fixProfileMobile();
  await fixDuplicateH1([158, 159, 160]);
  if (EXECUTE) await verifyLive();
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
