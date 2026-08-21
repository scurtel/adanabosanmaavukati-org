/**
 * Read-only: WP users + all posts authorship vs live Rank Math Article.author.
 * Does not write to WordPress.
 *
 *   node scripts/audit-article-authors-readonly.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'reports', 'round2-entity-cleanup-2026-08-21');

function strip(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLd(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore */
    }
  }
  return blocks;
}

function walk(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, acc));
    return acc;
  }
  if (typeof node === 'object') {
    acc.push(node);
    Object.values(node).forEach((v) => walk(v, acc));
  }
  return acc;
}

function typesOf(n) {
  const t = n['@type'];
  return Array.isArray(t) ? t : t ? [t] : [];
}

function classifyAuthor({ user, visible, schemaName, schemaId, contentHint }) {
  const slug = (user?.slug || '').toLowerCase();
  const login = (user?.username || user?.slug || '').toLowerCase();
  const name = `${user?.name || ''} ${visible || ''} ${schemaName || ''}`.toLowerCase();
  const yigitSlug = slug.includes('yigit') || login.includes('yigit');
  const cerenSlug = slug.includes('ceren') || login.includes('ceren');
  const yigitName = /yi[gğ]it/.test(name) || /yi[gğ]it/.test(contentHint);
  const cerenName = /ceren/.test(name);

  if (yigitSlug && !cerenSlug) {
    return {
      verdict: 'yigit_or_unverified_wp_user',
      recommended: 'DEĞİŞTİRME — WP user slug Yiğit hesabı; gerçek yazarlık Ceren olarak doğrulanamadı',
      changeSchema: false,
    };
  }
  if (cerenSlug && !yigitSlug) {
    return {
      verdict: 'ceren',
      recommended: 'Ceren Sümer Cilli',
      changeSchema: true,
    };
  }
  if (yigitName && !cerenName) {
    return {
      verdict: 'yigit',
      recommended: 'DEĞİŞTİRME — gerçek yazar Yiğit',
      changeSchema: false,
    };
  }
  return {
    verdict: 'unverified',
    recommended: 'DEĞİŞTİRME — gerçek yazarlık doğrulanamadı',
    changeSchema: false,
  };
}

async function fetchLiveAuthor(url) {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}v=auth-${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache' },
  });
  const html = await res.text();
  const nodes = [];
  extractLd(html).forEach((b) => walk(b, nodes));
  const articles = nodes.filter((n) =>
    typesOf(n).some((t) => ['Article', 'BlogPosting', 'NewsArticle'].includes(t))
  );
  const author = articles[0]?.author || null;
  const byline =
    (html.match(/class=["'][^"']*author[^"']*["'][^>]*>[\s\S]{0,200}/i) || [])[0] || '';
  const postedBy = strip(
    (html.match(/rel=["']author["'][^>]*>([\s\S]*?)<\/a>/i) || [])[1] ||
      (html.match(/class=["'][^"']*posted-by[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|a)>/i) || [])[1] ||
      ''
  );
  return {
    status: res.status,
    schemaAuthor: author,
    visibleAuthor: postedBy || strip(byline).slice(0, 120),
    authorArchiveHref:
      (html.match(/href=["']([^"']*\/author\/[^"']+)/i) || [])[1] || '',
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const usersRes = await wpFetch('/wp-json/wp/v2/users?per_page=100&context=edit');
  const users = usersRes.ok ? await usersRes.json() : [];
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', {
    status: 'publish',
    context: 'edit',
    _embed: '1',
  });

  const rows = [];
  for (const p of posts) {
    const user = userById[p.author] || (p._embedded?.author || [])[0] || null;
    const live = await fetchLiveAuthor(p.link);
    const contentHint = strip(p.content?.raw || p.content?.rendered || '').slice(0, 400);
    const schema = live.schemaAuthor;
    const schemaId = typeof schema === 'object' ? schema['@id'] || '' : '';
    const schemaName = typeof schema === 'object' ? schema.name || '' : String(schema || '');
    const decision = classifyAuthor({
      user,
      visible: live.visibleAuthor,
      schemaName,
      schemaId,
      contentHint,
    });
    rows.push({
      id: p.id,
      url: p.link,
      slug: p.slug,
      title: strip(p.title?.raw || p.title?.rendered),
      wp_post_author_id: p.author,
      wp_user_slug: user?.slug || '',
      wp_user_login: user?.username || user?.slug || '',
      wp_display_name: user?.name || '',
      wp_email: user?.email ? '(redacted)' : '',
      visible_author: live.visibleAuthor,
      author_archive: live.authorArchiveHref,
      schema_author_id: schemaId,
      schema_author_name: schemaName,
      verdict: decision.verdict,
      recommended_final_author: decision.recommended,
      change_schema: decision.changeSchema,
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    live_wp_write: false,
    users: users.map((u) => ({
      id: u.id,
      slug: u.slug,
      username: u.username || u.slug,
      name: u.name,
      roles: u.roles,
    })),
    total_posts: rows.length,
    ceren: rows.filter((r) => r.verdict === 'ceren').length,
    yigit: rows.filter((r) => r.verdict === 'yigit' || r.verdict === 'yigit_or_unverified_wp_user').length,
    unverified: rows.filter((r) => r.verdict === 'unverified').length,
    schema_will_change: rows.filter((r) => r.change_schema).length,
    rows,
  };

  writeFileSync(join(OUT, 'article-author-audit.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify({
    total_posts: summary.total_posts,
    ceren: summary.ceren,
    yigit: summary.yigit,
    unverified: summary.unverified,
    schema_will_change: summary.schema_will_change,
    users: summary.users,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
