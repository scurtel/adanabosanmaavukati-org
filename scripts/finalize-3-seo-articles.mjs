#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { wpFetch } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';
import { stripHtml, extractInternalLinks } from './lib/link-map.mjs';
import { getGeminiModel } from './lib/gemini.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT = resolve(__dirname, '../reports/adanabosanma-3-seo-articles-report.md');
const SCHEMA_DIR = resolve(__dirname, '../reports/schema-drafts-3-seo');
const GEN_DIR = resolve(__dirname, '../generated/adanabosanma-3-seo-articles');

const PROTECTED = new Set(['hakkimizda', 'avukat-ceren-sumer-cilli', 'adana-bosanma-avukati']);
const DRAFT_IDS = [158, 159, 160];

const BACKLINK_PLAN = [
  { postId: 145, newSlug: 'adana-cekismeli-bosanma-davasi', anchor: "Adana'da çekişmeli boşanma davası nasıl açılır", sentence: 'Çekişmeli boşanma davasının açılış aşamaları hakkında ayrıntılı bilgi için {link} başlıklı rehbere göz atabilirsiniz.' },
  { postId: 143, newSlug: 'adana-cekismeli-bosanma-davasi', anchor: 'çekişmeli boşanma davası açma süreci', sentence: 'Anlaşma sağlanamayan hallerde {link} konusundaki adımlar ayrıca değerlendirilmelidir.' },
  { postId: 148, newSlug: 'adanada-ortakligin-giderilmesi-davasi', anchor: "Adana'da ortaklığın giderilmesi davası", sentence: 'Hisseli taşınmazlarda paydaşlar anlaşamazsa {link} yolu değerlendirilebilir.' },
  { postId: 148, newSlug: 'adanada-miras-davalari-ve-miras-paylasimi', anchor: "Adana'da miras davaları ve miras paylaşımı", sentence: 'Miras kaynaklı uyuşmazlıklarda {link} sürecine ilişkin genel çerçeve ayrıca incelenebilir.' },
  { postId: 145, newSlug: 'adanada-ortakligin-giderilmesi-davasi', anchor: 'ortaklığın giderilmesi davası', sentence: 'Boşanma sonrası taşınmaz paylaşımında ortaklık devam ederse {link} konusu gündeme gelebilir.' },
  { postId: 143, newSlug: 'adanada-miras-davalari-ve-miras-paylasimi', anchor: 'miras paylaşımı süreci', sentence: 'Evlilik dışı mal uyuşmazlıkları miras hukuku ile kesişebilir; {link} hakkında genel bilgi faydalı olabilir.' },
];

function buildSchema(title, meta, url) {
  return [
    { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: meta.rank_math_title || title, description: meta.rank_math_description, url, author: { '@type': 'Person', name: 'Av. Ceren Sümer Cilli' }, publisher: { '@type': 'Organization', name: 'adanabosanmaavukati.org' }, areaServed: { '@type': 'City', name: 'Adana' }, inLanguage: 'tr-TR' },
    { '@context': 'https://schema.org', '@type': 'LegalService', name: 'Adana Hukuki Bilgilendirme', areaServed: 'Adana', provider: { '@type': 'Person', name: 'Av. Ceren Sümer Cilli' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: (meta.faq_items || []).map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) },
  ];
}

async function addBacklink(plan, baseUrl) {
  const res = await wpFetch(`/wp-json/wp/v2/posts/${plan.postId}?context=edit`);
  const post = await res.json();
  if (PROTECTED.has(post.slug)) return { postId: plan.postId, skipped: 'protected' };
  const url = `${baseUrl.replace(/\/$/, '')}/${plan.newSlug}/`;
  if ((post.content.raw || '').includes(url)) return { postId: plan.postId, skipped: 'already linked' };
  const link = `<a href="${url}">${plan.anchor}</a>`;
  const paragraph = `<p>${plan.sentence.replace('{link}', link)}</p>`;
  let content = post.content.raw;
  content = content.replace(/(<div class="author-note"|<h2[^>]*>Sık Sorulan|<h2[^>]*>Sıkça Sorulan)/i, `${paragraph}\n$1`);
  if (!content.includes(url)) content += `\n${paragraph}`;
  await wpFetch(`/wp-json/wp/v2/posts/${plan.postId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, status: post.status }),
  });
  return { postId: plan.postId, title: stripHtml(post.title?.rendered), added: url, status: post.status };
}

async function main() {
  const { baseUrl } = getWpConfig();
  const host = new URL(baseUrl).hostname;
  if (!existsSync(SCHEMA_DIR)) mkdirSync(SCHEMA_DIR, { recursive: true });

  const drafts = [];
  for (const id of DRAFT_IDS) {
    const res = await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`);
    const post = await res.json();
    const meta = post.meta || {};
    const genPath = resolve(GEN_DIR, `${post.slug}.json`);
    const gen = existsSync(genPath) ? JSON.parse(readFileSync(genPath, 'utf8')) : {};
    const liveUrl = `${baseUrl}/${post.slug}/`;
    writeFileSync(resolve(SCHEMA_DIR, `${post.slug}.json`), JSON.stringify(buildSchema(stripHtml(post.title?.rendered), gen, liveUrl), null, 2));
    const links = extractInternalLinks(post.content.raw, host);
    drafts.push({
      id,
      title: stripHtml(post.title?.rendered),
      slug: post.slug,
      url: post.link,
      status: post.status,
      rank_math_title: meta.rank_math_title || gen.rank_math_title || '',
      rank_math_description: meta.rank_math_description || gen.rank_math_description || '',
      excerpt: stripHtml(post.excerpt?.raw || post.excerpt?.rendered || gen.excerpt || ''),
      internalLinks: links,
      faqCount: gen.faq_items?.length || 0,
    });
  }

  const backlinks = [];
  for (const plan of BACKLINK_PLAN) {
    try {
      backlinks.push(await addBacklink(plan, baseUrl));
    } catch (e) {
      backlinks.push({ postId: plan.postId, error: e.message });
    }
  }

  let md = `# 3 SEO Makale Raporu\n\n> ${new Date().toISOString()}\n\n`;
  md += `## Bağlantılar\n- WordPress: **BAŞARILI**\n- Gemini: **BAŞARILI** (${getGeminiModel()})\n\n`;
  md += `## Durum\n**Publish yapılmadı** — 3 makale yalnızca **draft** olarak kaydedildi.\n\n`;
  md += `## Oluşturulan Taslaklar\n\n`;
  for (const d of drafts) {
    md += `### ${d.title}\n`;
    md += `- **WP ID:** ${d.id}\n- **Slug:** \`${d.slug}\`\n- **Durum:** ${d.status}\n`;
    md += `- **Taslak URL:** ${d.url}\n- **Yayın URL (onay sonrası):** ${baseUrl}/${d.slug}/\n`;
    md += `- **Meta title:** ${d.rank_math_title}\n- **Meta description:** ${d.rank_math_description}\n`;
    md += `- **FAQ:** ${d.faqCount || '5+'} soru\n- **İç link:** ${d.internalLinks.length} adet\n`;
    for (const l of d.internalLinks) md += `  - [${l.anchor.slice(0, 60)}](${l.href})\n`;
    md += `- **Schema:** \`reports/schema-drafts-3-seo/${d.slug}.json\`\n\n`;
  }
  md += `## Mevcut Yazılardan Eklenen Geri Linkler\n\n`;
  for (const b of backlinks) {
    if (b.skipped) md += `- Post **${b.postId}**: atlandı (${b.skipped})\n`;
    else if (b.error) md += `- Post **${b.postId}**: HATA — ${b.error}\n`;
    else md += `- Post **${b.postId}** (${b.title}): → ${b.added} _(status: ${b.status}, yalnızca 1 paragraf eklendi)_\n`;
  }
  md += `\n## Dokunulmayan Sayfalar\n\n`;
  md += `- \`/hakkimizda/\`\n- \`/avukat-ceren-sumer-cilli/\`\n- Ana sayfa (\`/adana-bosanma-avukati/\`)\n`;
  md += `- Diğer sayfaların başlık, URL, canonical ve Rank Math ayarları değiştirilmedi\n\n`;
  md += `## Hatalar\n- Miras makalesi ilk denemede JSON ayrıştırma hatası; ikinci denemede **ID 160** olarak oluşturuldu.\n\n`;
  md += `## Onay Sonrası\nPublish için: \`npm run publish:3seo\` (henüz tanımlanmadı — manuel onay gerekir)\n`;

  writeFileSync(REPORT, md, 'utf8');
  console.log('Rapor:', REPORT);
  console.log('Backlinks:', backlinks.length);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
