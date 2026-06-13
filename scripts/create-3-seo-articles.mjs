#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getWpConfig } from './lib/env.mjs';
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';
import { callGemini, getGeminiModel, testGeminiConnection } from './lib/gemini.mjs';
import { buildLinkMap, stripHtml, extractInternalLinks } from './lib/link-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../generated/adanabosanma-3-seo-articles');
const SCHEMA_DIR = resolve(__dirname, '../reports/schema-drafts-3-seo');
const REPORT_PATH = resolve(__dirname, '../reports/adanabosanma-3-seo-articles-report.md');

const PROTECTED_SLUGS = new Set([
  'hakkimizda',
  'avukat-ceren-sumer-cilli',
  'adana-bosanma-avukati',
]);

const BANNED = [
  'en iyi avukat', 'uzman avukat', 'lider avukat', 'garantili sonuç',
  'kesin kazanılır', 'mutlaka kazanılır', 'başarı garantisi', 'kesin sonuç',
  'garanti kazanılır', 'en başarılı', 'rakipsiz',
];

const ARTICLES = [
  {
    key: 'cekismeli',
    title: "Adana'da Çekişmeli Boşanma Davası Nasıl Açılır?",
    slug: 'adana-cekismeli-bosanma-davasi',
    keywords: ['Adana çekişmeli boşanma avukatı', 'çekişmeli boşanma davası', 'Adana boşanma avukatı', 'boşanma davası nasıl açılır'],
    requiredSections: [
      'Çekişmeli boşanma nedir?',
      'Anlaşmalı boşanmadan farkı nedir?',
      'Hangi durumlarda çekişmeli boşanma davası açılır?',
      'Kusur, delil, tanık, mesaj kayıtları ve sosyal medya kayıtlarının önemi',
      'Velayet, nafaka, maddi-manevi tazminat talepleri',
      'Adana Aile Mahkemelerinde süreç nasıl işler?',
      'Avukat desteğinin dava stratejisi açısından önemi',
    ],
    entityFocus: 'aile hukuku ve boşanma davaları',
    categories: ['Boşanma Davaları', 'Aile Hukuku'],
    tags: ['Adana çekişmeli boşanma avukatı', 'çekişmeli boşanma davası', 'Adana boşanma avukatı', 'Av. Ceren Sümer Cilli'],
    authorNoteVariant: 'boşanma davası açma, delil ve usul adımları',
  },
  {
    key: 'ortaklik',
    title: "Adana'da Ortaklığın Giderilmesi Davası Nasıl Açılır?",
    slug: 'adanada-ortakligin-giderilmesi-davasi',
    keywords: ['Adana ortaklığın giderilmesi avukatı', 'ortaklığın giderilmesi davası', 'izale-i şuyu davası', 'hisseli taşınmaz satışı'],
    requiredSections: [
      'Ortaklığın giderilmesi davası nedir?',
      'Hangi mallar için açılabilir?',
      'Hisseli taşınmazlarda süreç nasıl işler?',
      'Aynen taksim ve satış yoluyla ortaklığın giderilmesi farkı',
      'Miras kalan taşınmazlarda ortaklığın giderilmesi',
      'Sulh Hukuk Mahkemesi süreci',
      'Bilirkişi, keşif, satış ve ihale aşamaları',
      'Davada avukat desteğinin önemi',
    ],
    entityFocus: 'gayrimenkul, miras ve aile bağlantılı uyuşmazlıklar',
    categories: ['Aile Hukuku', 'Mal Paylaşımı'],
    tags: ['ortaklığın giderilmesi davası', 'izale-i şuyu', 'hisseli taşınmaz', 'Av. Ceren Sümer Cilli'],
    authorNoteVariant: 'ortaklığın giderilmesi ve hisseli taşınmaz uyuşmazlıkları',
  },
  {
    key: 'miras',
    title: "Adana'da Miras Davaları ve Miras Paylaşımı Süreci",
    slug: 'adanada-miras-davalari-ve-miras-paylasimi',
    keywords: ['Adana miras avukatı', 'miras davası', 'miras paylaşımı', 'veraset ilamı', 'mirasçılar arasında uyuşmazlık'],
    requiredSections: [
      'Miras davası nedir?',
      'Veraset ilamı nasıl alınır?',
      'Miras paylaşımı nasıl yapılır?',
      'Saklı pay, tenkis davası, mirastan mal kaçırma ve tapu iptal tescil konularına genel giriş',
      'Mirasçılar arasında anlaşmazlık çıkarsa ne olur?',
      'Miras kalan taşınmazlarda ortaklığın giderilmesi bağlantısı',
      "Adana'da miras davalarında görevli/yetkili mahkeme genel açıklaması",
      'Miras davalarında belge, tapu kaydı ve hukuki stratejinin önemi',
    ],
    entityFocus: 'miras ve taşınmaz uyuşmazlıkları',
    categories: ['Aile Hukuku'],
    tags: ['Adana miras avukatı', 'miras davası', 'miras paylaşımı', 'veraset ilamı', 'Av. Ceren Sümer Cilli'],
    authorNoteVariant: 'miras paylaşımı ve veraset süreçleri',
  },
];

const BACKLINK_PLAN = [
  { postId: 145, newSlug: 'adana-cekismeli-bosanma-davasi', anchor: 'Adana\'da çekişmeli boşanma davası nasıl açılır', sentence: 'Çekişmeli boşanma davasının açılış aşamaları hakkında ayrıntılı bilgi için {link} başlıklı rehbere göz atabilirsiniz.' },
  { postId: 143, newSlug: 'adana-cekismeli-bosanma-davasi', anchor: 'çekişmeli boşanma davası açma süreci', sentence: 'Anlaşma sağlanamayan hallerde {link} konusundaki adımlar ayrıca değerlendirilmelidir.' },
  { postId: 148, newSlug: 'adanada-ortakligin-giderilmesi-davasi', anchor: 'Adana\'da ortaklığın giderilmesi davası', sentence: 'Hisseli taşınmazlarda paydaşlar anlaşamazsa {link} yolu değerlendirilebilir.' },
  { postId: 148, newSlug: 'adanada-miras-davalari-ve-miras-paylasimi', anchor: 'Adana\'da miras davaları ve miras paylaşımı', sentence: 'Miras kaynaklı uyuşmazlıklarda {link} sürecine ilişkin genel çerçeve ayrıca incelenebilir.' },
  { postId: 145, newSlug: 'adanada-ortakligin-giderilmesi-davasi', anchor: 'ortaklığın giderilmesi davası', sentence: 'Boşanma sonrası taşınmaz paylaşımında ortaklık devam ederse {link} konusu gündeme gelebilir.' },
  { postId: 143, newSlug: 'adanada-miras-davalari-ve-miras-paylasimi', anchor: 'miras paylaşımı süreci', sentence: 'Evlilik dışı mal uyuşmazlıkları miras hukuku ile kesişebilir; {link} hakkında genel bilgi faydalı olabilir.' },
];

function authorNoteHtml(variant) {
  return `<div class="author-note" style="margin-top:2em;padding:1em;border-left:4px solid #ccc;background:#f9f9f9;"><p><strong>Yazar / Hukuki Değerlendirme</strong></p><p>Bu içerik, Adana'da aile hukuku, miras hukuku ve taşınmaz uyuşmazlıkları alanlarında hukuki bilgilendirme amacıyla hazırlanmıştır. ${variant} konusunda somut olayın koşullarına göre değerlendirme değişebileceğinden, dava açmadan önce hukuki destek alınması önemlidir. Av. Ceren Sümer Cilli tarafından genel bilgilendirme çerçevesinde hazırlanan bu metin hukuki tavsiye niteliği taşımaz.</p></div>`;
}

function buildSchema(article, meta, liveUrl) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: meta.rank_math_title || article.title,
      description: meta.rank_math_description || meta.excerpt,
      url: liveUrl,
      author: { '@type': 'Person', name: 'Av. Ceren Sümer Cilli' },
      publisher: { '@type': 'Organization', name: 'adanabosanmaavukati.org' },
      areaServed: { '@type': 'City', name: 'Adana' },
      about: meta.schema_about?.map((n) => ({ '@type': 'Thing', name: n })) || [],
      inLanguage: 'tr-TR',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'LegalService',
      name: 'Adana Aile Hukuku ve Boşanma Hukuku Bilgilendirme',
      areaServed: 'Adana',
      provider: { '@type': 'Person', name: 'Av. Ceren Sümer Cilli' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (meta.faq_items || []).map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
  ];
}

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
  if (!create.ok) throw new Error(`Term oluşturulamadı: ${name}`);
  return (await create.json()).id;
}

async function generateArticle(article, linkMap, crossLinks) {
  const prompt = `Sen Türkiye'de hukuki bilgilendirme içeriği yazan bir editörsün. adanabosanmaavukati.org için makale yaz.

BAŞLIK (H1): ${article.title}
SLUG: ${article.slug}
ANAHTAR KELİMELER: ${article.keywords.join(', ')}
ZORUNLU BÖLÜMLER (H2/H3 olarak işle):
${article.requiredSections.map((s) => `- ${s}`).join('\n')}

ENTITY: Av. Ceren Sümer Cilli — ${article.entityFocus} alanında doğal, ölçülü atıf (2-4 kez).

KURALLAR:
- 1200-1800 kelime Türkçe HTML (h1, h2, h3, p, ul, li, strong, a)
- Tek H1
- İlk paragrafta konuyu net anlat
- FAQ: en az 5 soru-cevap (h3 soru + p cevap)
- Son bölümde temkinli hukuki destek çağrısı (reklam dili yok)
- Yasak: ${BANNED.join(', ')}
- 6-8 doğal iç link (<a href>) metin içine; sadece şu gerçek URL'ler:
${JSON.stringify(linkMap.map((l) => ({ label: l.label, url: l.url })), null, 2)}
- Yeni makale çapraz linkleri (publish sonrası slug URL):
${JSON.stringify(crossLinks, null, 2)}
- author_note_html: ayrı alan (makale sonuna eklenecek, ${article.authorNoteVariant} vurgusu)
- rank_math_title: 55-60 karakter
- rank_math_description: 145-160 karakter
- excerpt: meta description ile aynı veya kısa
- faq_items: [{question, answer}] en az 5
- schema_about: 5-8 kavram

JSON döndür:
{
  "content_html": "...",
  "excerpt": "...",
  "rank_math_title": "...",
  "rank_math_description": "...",
  "faq_items": [],
  "schema_about": [],
  "author_note_html": "...",
  "internal_link_suggestions": [{"anchor":"","url":"","placed":true}]
}`;

  return callGemini(prompt, { temperature: 0.45, maxOutputTokens: 16384 });
}

async function createDraft(article, enhanced) {
  const categoryIds = [];
  for (const c of article.categories) categoryIds.push(await findOrCreateTerm('/wp-json/wp/v2/categories', c));
  const tagIds = [];
  for (const t of article.tags) tagIds.push(await findOrCreateTerm('/wp-json/wp/v2/tags', t));

  const fullContent = `${enhanced.content_html}\n${enhanced.author_note_html || authorNoteHtml(article.authorNoteVariant)}`;

  const payload = {
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
  };

  const res = await wpFetch('/wp-json/wp/v2/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Draft oluşturulamadı (${article.slug}): ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function addBacklink({ postId, newSlug, anchor, sentence }, baseUrl) {
  if (PROTECTED_SLUGS.has(newSlug)) return null;

  const res = await wpFetch(`/wp-json/wp/v2/posts/${postId}?context=edit`);
  if (!res.ok) throw new Error(`Post ${postId} okunamadı`);
  const post = await res.json();
  const slug = post.slug;
  if (PROTECTED_SLUGS.has(slug)) return { skipped: true, reason: 'protected' };

  const url = `${baseUrl.replace(/\/$/, '')}/${newSlug}/`;
  const link = `<a href="${url}">${anchor}</a>`;
  const paragraph = `<p>${sentence.replace('{link}', link)}</p>`;

  let content = post.content.raw || post.content.rendered;
  if (content.includes(url)) return { skipped: true, reason: 'already linked' };

  content = content.replace(/(<div class="author-note"|<h2[^>]*>Sık Sorulan|<h2[^>]*>Sıkça Sorulan)/i, `${paragraph}\n$1`);
  if (!content.includes(url)) content += `\n${paragraph}`;

  const upd = await wpFetch(`/wp-json/wp/v2/posts/${postId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, status: post.status }),
  });
  if (!upd.ok) throw new Error(`Backlink post ${postId} güncellenemedi`);
  const updated = await upd.json();
  return { postId, title: stripHtml(updated.title?.rendered), added: url, status: updated.status };
}

async function main() {
  console.log('Ön kontroller...');
  const wpCheck = await wpFetch('/wp-json/wp/v2/users/me');
  if (!wpCheck.ok) throw new Error('WordPress bağlantısı başarısız');
  const geminiOk = await testGeminiConnection().catch(() => false);
  if (!geminiOk) throw new Error('Gemini bağlantısı başarısız');
  const model = getGeminiModel();
  console.log(`WordPress: OK | Gemini: OK | Model: ${model}`);

  const { baseUrl } = getWpConfig();
  const pages = await fetchAllPaginated('/wp-json/wp/v2/pages', { status: 'publish' });
  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish' });
  const linkMap = buildLinkMap(pages, posts);

  const crossSlugs = ARTICLES.map((a) => ({
    title: a.title,
    url: `${baseUrl}/${a.slug}/`,
  }));

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  if (!existsSync(SCHEMA_DIR)) mkdirSync(SCHEMA_DIR, { recursive: true });

  const results = [];
  const host = new URL(baseUrl).hostname;

  for (const article of ARTICLES) {
    console.log(`Gemini ile üretiliyor: ${article.slug}...`);
    const others = crossSlugs.filter((c) => !c.url.includes(article.slug));
    const enhanced = await generateArticle(article, linkMap, others);
    writeFileSync(resolve(OUT_DIR, `${article.slug}.json`), JSON.stringify(enhanced, null, 2));

    const draft = await createDraft(article, enhanced);
    const draftUrl = draft.link;
    const internalLinks = extractInternalLinks(
      `${enhanced.content_html}${enhanced.author_note_html || ''}`,
      host
    );

    writeFileSync(
      resolve(SCHEMA_DIR, `${article.slug}.json`),
      JSON.stringify(buildSchema(article, enhanced, `${baseUrl}/${article.slug}/`), null, 2)
    );

    results.push({
      title: article.title,
      slug: article.slug,
      wpId: draft.id,
      draftUrl,
      status: draft.status,
      rank_math_title: enhanced.rank_math_title,
      rank_math_description: enhanced.rank_math_description,
      excerpt: enhanced.excerpt,
      internalLinks,
      faqCount: enhanced.faq_items?.length || 0,
    });
    console.log(`  Draft ID ${draft.id}: ${draftUrl}`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('Mevcut yazılara geri linkler ekleniyor...');
  const backlinkResults = [];
  for (const plan of BACKLINK_PLAN) {
    try {
      const r = await addBacklink(plan, baseUrl);
      if (r) backlinkResults.push(r);
    } catch (e) {
      backlinkResults.push({ postId: plan.postId, error: e.message });
    }
  }

  let md = `# 3 SEO Makale Raporu\n\n> ${new Date().toISOString()}\n\n`;
  md += `## Bağlantılar\n- WordPress: **BAŞARILI**\n- Gemini: **BAŞARILI** (${model})\n\n`;
  md += `## Oluşturulan Taslaklar (publish yapılmadı)\n\n`;
  for (const r of results) {
    md += `### ${r.title}\n`;
    md += `- **WP ID:** ${r.wpId}\n`;
    md += `- **Slug:** \`${r.slug}\`\n`;
    md += `- **Durum:** ${r.status}\n`;
    md += `- **Taslak URL:** ${r.draftUrl}\n`;
    md += `- **Meta title:** ${r.rank_math_title}\n`;
    md += `- **Meta description:** ${r.rank_math_description}\n`;
    md += `- **FAQ:** ${r.faqCount} soru\n`;
    md += `- **İç link (${r.internalLinks.length}):**\n`;
    for (const l of r.internalLinks) md += `  - [${l.anchor}](${l.href})\n`;
    md += `- **Schema:** reports/schema-drafts-3-seo/${r.slug}.json\n\n`;
  }

  md += `## Mevcut Yazılardan Eklenen Geri Linkler\n\n`;
  for (const b of backlinkResults) {
    if (b.skipped) md += `- Post ${b.postId}: atlandı (${b.reason})\n`;
    else if (b.error) md += `- Post ${b.postId}: **HATA** — ${b.error}\n`;
    else md += `- Post ${b.postId} (${b.title}): ${b.added} [status: ${b.status}]\n`;
  }

  md += `\n## Dokunulmayan Sayfalar\n\n`;
  md += PROTECTED_SLUGS.size
    ? [...PROTECTED_SLUGS].map((s) => `- \`/${s}/\` ve ana sayfa içeriği`).join('\n') + '\n'
    : '';
  md += `- Diğer tüm sayfalar (başlık, URL, canonical, Rank Math ayarları değiştirilmedi)\n`;
  md += `- Publish yapılmadı — yalnızca **draft** oluşturuldu\n\n`;
  md += `## Local Dosyalar\n- \`generated/adanabosanma-3-seo-articles/\`\n- \`reports/schema-drafts-3-seo/\`\n`;

  writeFileSync(REPORT_PATH, md, 'utf8');
  console.log(`\nRapor: ${REPORT_PATH}`);
  console.log('Publish yapılmadı — 3 taslak oluşturuldu.');
}

main().catch((err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
