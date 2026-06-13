#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getWpConfig } from './lib/env.mjs';
import { fetchAllPaginated } from './lib/wp-fetch.mjs';
import { stripHtml, extractLinks } from './lib/content-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../data/adanabosanma-content.json');

function mapItem(item, type, categoryMap, tagMap) {
  const { baseUrl } = getWpConfig();
  const host = new URL(baseUrl).hostname;
  const content = item.content?.rendered || '';
  const { internal, external } = extractLinks(content, host);

  const categories = (item.categories || [])
    .map((id) => categoryMap[id])
    .filter(Boolean);
  const tags = (item.tags || []).map((id) => tagMap[id]).filter(Boolean);

  return {
    id: item.id,
    title: stripHtml(item.title?.rendered || ''),
    slug: item.slug,
    link: item.link,
    type,
    status: item.status,
    date: item.date,
    modified: item.modified,
    excerpt: stripHtml(item.excerpt?.rendered || ''),
    contentLength: content.length,
    wordCount: stripHtml(content).split(/\s+/).filter(Boolean).length,
    categories,
    tags,
    internalLinks: internal,
    externalLinks: external,
    authorId: item.author,
    _rawContent: content,
  };
}

async function main() {
  console.log('WordPress içerikleri çekiliyor...');

  const categoriesRaw = await fetchAllPaginated('/wp-json/wp/v2/categories');
  const tagsRaw = await fetchAllPaginated('/wp-json/wp/v2/tags');
  const postsRaw = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish,draft,private' });
  const pagesRaw = await fetchAllPaginated('/wp-json/wp/v2/pages', { status: 'publish,draft,private' });

  const categoryMap = Object.fromEntries(categoriesRaw.map((c) => [c.id, { id: c.id, name: c.name, slug: c.slug }]));
  const tagMap = Object.fromEntries(tagsRaw.map((t) => [t.id, { id: t.id, name: t.name, slug: t.slug }]));

  const posts = postsRaw.map((p) => mapItem(p, 'post', categoryMap, tagMap));
  const pages = pagesRaw.map((p) => mapItem(p, 'page', categoryMap, tagMap));

  const output = {
    fetchedAt: new Date().toISOString(),
    site: getWpConfig().baseUrl,
    summary: {
      posts: posts.length,
      pages: pages.length,
      categories: categoriesRaw.length,
      tags: tagsRaw.length,
    },
    categories: categoriesRaw.map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: c.count })),
    tags: tagsRaw.map((t) => ({ id: t.id, name: t.name, slug: t.slug, count: t.count })),
    posts,
    pages,
    allContent: [...posts, ...pages],
  };

  const dir = dirname(OUT);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(OUT, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Kaydedildi: ${OUT}`);
  console.log(`Yazılar: ${posts.length}, Sayfalar: ${pages.length}`);
  console.log(`Kategoriler: ${categoriesRaw.length}, Etiketler: ${tagsRaw.length}`);
}

main().catch((err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
