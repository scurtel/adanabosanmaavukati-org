#!/usr/bin/env node
/**
 * Eksik FAQ schema: 26, 134, 146, 148 (farklı HTML formatları).
 * npm run fix:missing-faq -- --execute
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';
import { stripHtml } from './lib/link-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASE = getWpConfig().baseUrl.replace(/\/$/, '');
const EXECUTE = process.argv.includes('--execute');
const SCHEMA_MARKER = 'ceren-faq-schema';
const POST_IDS = [26, 134, 146, 148];

function extractFaqFromHtml(html) {
  const items = [];
  const seen = new Set();

  const add = (q, a) => {
    const question = stripHtml(q).replace(/^S\d+:\s*/i, '').replace(/^\d+\.\s*/, '').trim();
    let answer = stripHtml(a).replace(/^C\d+:\s*/i, '').trim();
    if (!question || !answer) return;
    const key = question.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      question: question.endsWith('?') ? question : `${question}?`,
      answer,
    });
  };

  const rmMatch = html.match(/wp:rank-math\/faq-block\s*(\{[\s\S]*?\})\s*-->/);
  if (rmMatch) {
    try {
      const data = JSON.parse(rmMatch[1]);
      for (const q of data.questions || []) {
        add(q.title || '', q.content || '');
      }
    } catch {
      /* ignore */
    }
  }

  const section = html.split(/Sık Sorulan|Sıkça Sorulan|FAQ/i).slice(1).join('') || html;

  const h3pRe = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = h3pRe.exec(section)) !== null) {
    add(m[1], m[2]);
  }

  const h3rawRe =
    /<h3[^>]*>([\s\S]*?)<\/h3>\s*(?:<p[^>]*>([\s\S]*?)<\/p>|([^<][\s\S]*?)(?=\s*<h3|\s*<div class="author-note|\s*<!-- wp:html|\s*$))/gi;
  while ((m = h3rawRe.exec(section)) !== null) {
    add(m[1], m[2] || m[3] || '');
  }

  const strongRe = /<p[^>]*>\s*<strong>\s*(?:\d+\.\s*)?([^<]+\?)\s*<\/strong>\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = strongRe.exec(section)) !== null) {
    add(m[1], m[2]);
  }

  return items.filter((f) => f.question.includes('?')).slice(0, 12);
}

function faqSchemaBlock(items) {
  if (items.length < 3) return '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
  return `<!-- wp:html -->
<script type="application/ld+json" class="${SCHEMA_MARKER}">${JSON.stringify(schema)}</script>
<!-- /wp:html -->`;
}

async function verify() {
  const out = [];
  for (const id of POST_IDS) {
    const post = await (await wpFetch(`/wp-json/wp/v2/posts/${id}`)).json();
    const live = await fetch(`${BASE}/${post.slug}/?v=${Date.now()}`, {
      headers: { 'User-Agent': 'fix-missing-faq/1.0' },
    });
    const html = await live.text();
    out.push({
      id,
      slug: post.slug,
      hasFaqSchema: html.includes('FAQPage') || html.includes(SCHEMA_MARKER),
    });
  }
  return out;
}

async function main() {
  console.log(EXECUTE ? 'CANLI fix missing FAQ' : 'DRY-RUN fix missing FAQ');
  const log = [];

  for (const id of POST_IDS) {
    const post = await (await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`)).json();
    const raw = post.content?.raw || '';
    if (raw.includes(SCHEMA_MARKER)) {
      log.push({ id, slug: post.slug, action: 'skipped-has-marker' });
      continue;
    }
    const items = extractFaqFromHtml(raw);
    const block = faqSchemaBlock(items);
    if (!block) {
      log.push({ id, slug: post.slug, action: 'no-faq-extracted', count: items.length });
      continue;
    }
    if (!EXECUTE) {
      log.push({ id, slug: post.slug, action: 'dry', faqCount: items.length, sample: items[0]?.question });
      continue;
    }
    const next = `${raw.trim()}\n\n${block}`;
    const res = await wpFetch(`/wp-json/wp/v2/posts/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: next, status: 'publish' }),
    });
    if (!res.ok) throw new Error(`Post ${id} güncellenemedi (${res.status})`);
    log.push({ id, slug: post.slug, action: 'applied', faqCount: items.length });
  }

  const verifyResult = EXECUTE ? await verify() : null;
  writeFileSync(
    resolve(ROOT, 'reports/fix-missing-faq-results.json'),
    JSON.stringify({ log, verify: verifyResult }, null, 2)
  );
  for (const e of log) console.log(e.id, e.slug || '', e.action, e.faqCount || '');
  if (verifyResult) {
    console.log('Doğrulama:', verifyResult.filter((x) => x.hasFaqSchema).length, '/', verifyResult.length);
  }
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
