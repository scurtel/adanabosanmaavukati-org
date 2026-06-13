#!/usr/bin/env node
import { wpFetch } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';

const IDS = [158, 159, 160];

async function main() {
  const { baseUrl } = getWpConfig();
  for (const id of IDS) {
    const res = await wpFetch(`/wp-json/wp/v2/posts/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'publish' }),
    });
    if (!res.ok) throw new Error(`Publish başarısız ID ${id} (${res.status})`);
    const post = await res.json();
    if (post.status !== 'publish') throw new Error(`ID ${id} publish olmadı: ${post.status}`);
    const live = `${baseUrl.replace(/\/$/, '')}/${post.slug}/`;
    console.log(`[publish] ID ${id}: ${live}`);
  }
  console.log('3 makale yayınlandı.');
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
