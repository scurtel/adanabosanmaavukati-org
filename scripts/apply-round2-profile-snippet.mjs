/**
 * adanabosanmaavukati.org Round 2 production: profil sayfası snippet only.
 * Article.author / post_author değişmez.
 *
 *   node scripts/apply-round2-profile-snippet.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wpFetch } from './lib/wp-fetch.mjs';
import { getWpConfig, wpAuthHeader } from './lib/env.mjs';
import { buildEntityCleanupSnippetPhp } from './lib/entity-cleanup-snippet.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'reports', 'round2-entity-cleanup-2026-08-21');
const SNIPPET_NAME = 'CSC Round 2 entity cleanup';

function snippetCode() {
  return buildEntityCleanupSnippetPhp()
    .replace(/^<\?php\s*/i, '')
    .replace(/if\s*\(\s*!defined\('ABSPATH'\)\s*\)\s*\{\s*exit;\s*\}/i, '');
}

async function wpPost(path, body) {
  const { baseUrl, username, appPassword } = getWpConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: wpAuthHeader(username, appPassword),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const listRes = await wpFetch('/wp-json/code-snippets/v1/snippets');
  if (!listRes.ok) {
    throw new Error(`code-snippets API ${listRes.status}: ${(await listRes.text()).slice(0, 300)}`);
  }
  const snippets = await listRes.json();
  let snippet = snippets.find((s) => s.name === SNIPPET_NAME);
  const payload = {
    name: SNIPPET_NAME,
    code: snippetCode(),
    desc: 'Profil sayfası H1 + Rank Math Person @id birleştirme. Article.author değişmez. Rank Math global disable = NO.',
    scope: 'global',
    active: true,
  };
  let action;
  if (snippet) {
    snippet = await wpPost(`/wp-json/code-snippets/v1/snippets/${snippet.id}`, payload);
    try {
      await wpPost(`/wp-json/code-snippets/v1/snippets/${snippet.id}/activate`, {});
    } catch {
      /* already active */
    }
    action = 'updated';
  } else {
    snippet = await wpPost('/wp-json/code-snippets/v1/snippets', payload);
    try {
      await wpPost(`/wp-json/code-snippets/v1/snippets/${snippet.id}/activate`, {});
    } catch {
      /* ignore */
    }
    action = 'created';
  }
  const report = {
    generated_at: new Date().toISOString(),
    action,
    id: snippet.id,
    name: SNIPPET_NAME,
    posts_touched: 0,
    article_author_rewritten: false,
  };
  writeFileSync(join(OUT, 'profile-snippet-apply.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
