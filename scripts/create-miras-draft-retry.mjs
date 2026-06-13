#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getWpConfig } from './lib/env.mjs';
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';
import { callGemini, getGeminiModel } from './lib/gemini.mjs';
import { buildLinkMap, extractInternalLinks } from './lib/link-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../generated/adanabosanma-3-seo-articles');
const SCHEMA_DIR = resolve(__dirname, '../reports/schema-drafts-3-seo');

const article = {
  title: "Adana'da Miras Davaları ve Miras Paylaşımı Süreci",
  slug: 'adanada-miras-davalari-ve-miras-paylasimi',
  keywords: ['Adana miras avukatı', 'miras davası', 'miras paylaşımı', 'veraset ilamı'],
  categories: ['Aile Hukuku'],
  tags: ['Adana miras avukatı', 'miras davası', 'miras paylaşımı', 'veraset ilamı', 'Av. Ceren Sümer Cilli'],
  authorNoteVariant: 'miras paylaşımı ve veraset süreçleri',
  entityFocus: 'miras ve taşınmaz uyuşmazlıkları',
};

async function findOrCreateTerm(endpoint, name) {
  const search = await wpFetch(`${endpoint}?search=${encodeURIComponent(name)}&per_page=100`);
  const items = await search.json();
  const exact = items.find((i) => i.name.toLowerCase() === name.toLowerCase());
  if (exact) return exact.id;
  const create = await wpFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return (await create.json()).id;
}

async function generateWithRetry(linkMap, crossLinks, attempts = 3) {
  const prompt = `adanabosanmaavukati.org için miras makalesi yaz. JSON döndür.

BAŞLIK: ${article.title}
SLUG: ${article.slug}
1200-1600 kelime HTML (h1,h2,h3,p,ul,a). 5+ FAQ. Yasak: en iyi avukat, garantili sonuç, kesin kazanılır.
Av. Ceren Sümer Cilli doğal geçsin. Adana odaklı. 6-7 iç link:
${JSON.stringify(linkMap.slice(0, 12).map((l) => l.url))}
Çapraz: ${JSON.stringify(crossLinks)}

Zorunlu konular: miras davası, veraset ilamı, miras paylaşımı, saklı pay/tenkis genel giriş, mirasçı anlaşmazlığı, ortaklığın giderilmesi bağlantısı, Adana mahkeme, belge/tapu stratejisi.

JSON alanları: content_html, excerpt, rank_math_title (55-60 char), rank_math_description (145-160 char), faq_items[{question,answer}] (5+), schema_about[], author_note_html`;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await callGemini(prompt, { temperature: 0.35 + i * 0.05, maxOutputTokens: 16384 });
    } catch (e) {
      if (i === attempts) throw e;
      console.log(`Deneme ${i} başarısız, tekrar...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function main() {
  const { baseUrl } = getWpConfig();
  const pages = await fetchAllPaginated('/wp-json/wp/v2/pages', { status: 'publish' });
  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish' });
  const linkMap = buildLinkMap(pages, posts);
  const crossLinks = [
    `${baseUrl}/adana-cekismeli-bosanma-davasi/`,
    `${baseUrl}/adanada-ortakligin-giderilmesi-davasi/`,
  ];

  const enhanced = await generateWithRetry(linkMap, crossLinks);
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, `${article.slug}.json`), JSON.stringify(enhanced, null, 2));

  const categoryIds = [];
  for (const c of article.categories) categoryIds.push(await findOrCreateTerm('/wp-json/wp/v2/categories', c));
  const tagIds = [];
  for (const t of article.tags) tagIds.push(await findOrCreateTerm('/wp-json/wp/v2/tags', t));

  const fullContent = `${enhanced.content_html}\n${enhanced.author_note_html || ''}`;
  const res = await wpFetch('/wp-json/wp/v2/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: article.title,
      slug: article.slug,
      status: 'draft',
      excerpt: enhanced.excerpt,
      content: fullContent,
      categories: categoryIds,
      tags: tagIds,
      meta: {
        rank_math_title: enhanced.rank_math_title,
        rank_math_description: enhanced.rank_math_description,
      },
    }),
  });
  if (!res.ok) throw new Error(`Draft hatası ${res.status}`);
  const draft = await res.json();
  const host = new URL(baseUrl).hostname;
  const links = extractInternalLinks(fullContent, host);
  console.log(`Draft ID ${draft.id}: ${draft.link}`);
  console.log(`İç link: ${links.length} | FAQ: ${enhanced.faq_items?.length || 0}`);
  console.log(`Model: ${getGeminiModel()}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
