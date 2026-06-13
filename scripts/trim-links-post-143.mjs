#!/usr/bin/env node
import { wpFetch } from './lib/wp-fetch.mjs';
import { extractInternalLinks } from './lib/link-map.mjs';
import { getWpConfig } from './lib/env.mjs';

const POST_ID = 143;

const KEEP_URLS_ORDERED = [
  'https://adanabosanmaavukati.org/avukat-ceren-sumer-cilli',
  'https://adanabosanmaavukati.org/iletisim',
  'https://adanabosanmaavukati.org/adana-bosanma-avukati-rehberi',
  'https://adanabosanmaavukati.org/adanada-anlasmali-bosanma-protokolu',
  'https://adanabosanmaavukati.org/adanada-cekismeli-bosanma-davasi-ne-kadar-surer',
  'https://adanabosanmaavukati.org/adanada-nafaka-davasi-ve-nafaka-artirim-sureci',
  'https://adanabosanmaavukati.org/adanada-velayet-davasinda-cocugun-ustun-yarari',
  'https://adanabosanmaavukati.org/bosanmada-mal-paylasimi-ve-katilma-alacagi',
];

function normalizeUrl(href, baseUrl) {
  try {
    const url = new URL(href, baseUrl);
    return url.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function trimInternalLinks(html, baseUrl) {
  const keepSet = new Set(KEEP_URLS_ORDERED.map((u) => u.replace(/\/$/, '')));
  const keptCounts = Object.fromEntries(KEEP_URLS_ORDERED.map((u) => [u.replace(/\/$/, ''), 0]));
  const maxPerUrl = 1;

  return html.replace(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi, (full, pre, href, post, inner) => {
    const norm = normalizeUrl(href, baseUrl);
    if (!norm) return inner;

    const host = new URL(baseUrl).hostname.replace(/^www\./, '');
    const linkHost = new URL(norm).hostname.replace(/^www\./, '');
    if (linkHost !== host) return full;

    if (!keepSet.has(norm)) return inner;

    if (keptCounts[norm] >= maxPerUrl) return inner;

    keptCounts[norm]++;
    return full;
  });
}

async function main() {
  const { baseUrl } = getWpConfig();
  const res = await wpFetch(`/wp-json/wp/v2/posts/${POST_ID}?context=edit`);
  if (!res.ok) throw new Error(`Post ${POST_ID} alınamadı`);
  const post = await res.json();
  const host = new URL(baseUrl).hostname;

  const before = extractInternalLinks(post.content.raw, host);
  console.log(`Mevcut iç link: ${before.length}`);

  const trimmed = trimInternalLinks(post.content.raw, baseUrl);
  const after = extractInternalLinks(trimmed, host);
  console.log(`Yeni iç link: ${after.length}`);

  if (after.length < 6 || after.length > 9) {
    throw new Error(`Link sayısı hedef dışı: ${after.length}`);
  }

  const upd = await wpFetch(`/wp-json/wp/v2/posts/${POST_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: trimmed, status: 'publish' }),
  });
  if (!upd.ok) throw new Error(`Güncelleme başarısız (${upd.status})`);

  const updated = await upd.json();
  console.log(`Güncellendi: ${updated.link}`);
  after.forEach((l, i) => console.log(`${i + 1}. ${l.anchor.slice(0, 55)} → ${l.href}`));
}

main().catch((err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
