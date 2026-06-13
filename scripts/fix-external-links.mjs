#!/usr/bin/env node
import { wpFetch } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';

const BASE = getWpConfig().baseUrl.replace(/\/$/, '');

async function fixPost(id) {
  const res = await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`);
  const post = await res.json();
  let html = post.content.raw;
  const before = html;
  html = html.replace(/href=["']https?:\/\/(?:www\.)?cerenavukat\.com[^"']*["']/gi, `href="${BASE}/avukat-ceren-sumer-cilli/"`);
  html = html.replace(/href=["']https?:\/\/arsiv[^"']*["']/gi, `href="${BASE}/adana-bosanma-avukati-rehberi/"`);
  html = html.replace(/href=["']https?:\/\/(?:www\.)?adanabosanmaavukati\.at[^"']*["']/gi, `href="${BASE}/adana-velayet-davasi/"`);
  if (html === before) return console.log(`Post ${id}: değişiklik yok`);
  await wpFetch(`/wp-json/wp/v2/posts/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: html, status: 'publish' }),
  });
  console.log(`Post ${id}: dış linkler iç linke çevrildi`);
}

for (const id of [134, 158]) await fixPost(id);
