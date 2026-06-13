#!/usr/bin/env node
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';
import { extractInternalLinks } from './lib/link-map.mjs';
import { getWpConfig } from './lib/env.mjs';

const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish' });
const host = new URL(getWpConfig().baseUrl).hostname;

for (const p of posts.sort((a, b) => a.id - b.id)) {
  const r = await wpFetch(`/wp-json/wp/v2/posts/${p.id}?context=edit`);
  const post = await r.json();
  const raw = post.content.raw || '';
  const hasBox = /author-note|Yazar \/ Hukuki|hukuki tavsiye niteliği taşımaz/i.test(raw);
  const links = extractInternalLinks(raw, host);
  const ext = [...raw.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((u) => !u.includes('adanabosanmaavukati.org'));
  console.log(`${p.id}\t${p.slug}\tbox:${hasBox ? 'Y' : 'N'}\tlinks:${links.length}\text:${ext.length}`);
}
