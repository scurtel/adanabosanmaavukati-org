#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getWpConfig } from './lib/env.mjs';
import { wpFetch, fetchAllPaginated } from './lib/wp-fetch.mjs';
import { callGemini, getGeminiModel, testGeminiConnection } from './lib/gemini.mjs';
import { buildLinkMap, stripHtml, extractInternalLinks, DRAFT_SLUGS } from './lib/link-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRAFT_IDS = [143, 144, 145, 146, 147, 148, 149];
const REPORT_PATH = resolve(__dirname, '../reports/adanabosanma-enhance-publish-report.md');
const SCHEMA_DIR = resolve(__dirname, '../reports/schema-drafts');
const LINK_MAP_PATH = resolve(__dirname, '../data/site-link-map.json');

const BANNED = [
  'en iyi avukat', 'uzman avukat', 'lider avukat', 'garantili sonuç',
  'kesin kazanılır', 'mutlaka kazanılır', 'başarı garantisi', 'davayı kesin kazanır',
  'en başarılı', 'rakipsiz',
];

const TOPIC_HINTS = {
  143: 'boşanma davası açma, delil toplama ve usul adımları',
  144: 'anlaşmalı boşanma protokolü, velayet, nafaka ve mal paylaşımı',
  145: 'çekişmeli boşanma dava süresi, deliller ve tanık anlatımları',
  146: 'tedbir, yoksulluk ve iştirak nafakası',
  147: 'çocuğun üstün yararı ilkesi',
  148: 'mal rejimi tasfiyesi ve katılma alacağı',
  149: '6284 sayılı Kanun ve koruma tedbirleri',
};

function validateEnhanced(html, excerpt, metaDesc) {
  const issues = [];
  const text = `${html} ${excerpt} ${metaDesc}`.toLowerCase();
  for (const p of BANNED) {
    if (text.includes(p)) issues.push(`yasak ifade: ${p}`);
  }
  const { baseUrl } = getWpConfig();
  const host = new URL(baseUrl).hostname;
  const links = extractInternalLinks(html, host);
  if (links.length < 6) issues.push(`iç link az: ${links.length}`);
  if (links.length > 12) issues.push(`iç link fazla olabilir: ${links.length}`);
  if (!/ceren\s+s[üu]mer\s+cilli|av\.\s*ceren/i.test(html)) issues.push('entity sinyali zayıf');
  if (!/hukuki tavsiye|genel bilgilendirme/i.test(html)) issues.push('yazar/uyarı kutusu zayıf');
  const faqCount = (html.match(/<h[34][^>]*>.*?\?/gi) || []).length;
  if (faqCount < 5 && !/sık sorulan|sıkça sorulan|faq/i.test(html)) issues.push('FAQ yetersiz');
  return { issues, links, faqCount };
}

function buildSchemaJson(post, enhanced, liveUrl) {
  const about = enhanced.schema_about || [
    'Boşanma Hukuku', 'Aile Hukuku', 'Adana',
  ];
  const faqItems = enhanced.faq_items || [];
  const graph = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: enhanced.rank_math_title || stripHtml(post.title?.rendered),
      description: enhanced.rank_math_description || enhanced.excerpt,
      url: liveUrl,
      author: { '@type': 'Person', name: 'Av. Ceren Sümer Cilli' },
      reviewer: { '@type': 'Person', name: 'Av. Ceren Sümer Cilli' },
      publisher: { '@type': 'Organization', name: 'adanabosanmaavukati.org' },
      areaServed: { '@type': 'City', name: 'Adana' },
      about: about.map((t) => ({ '@type': 'Thing', name: t })),
      inLanguage: 'tr-TR',
    },
  ];
  if (faqItems.length >= 3) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }
  return graph;
}

async function fetchDraft(id) {
  const res = await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`);
  if (!res.ok) throw new Error(`Draft ${id} alınamadı (${res.status})`);
  return res.json();
}

async function snapshotLive() {
  const posts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish' });
  const pages = await fetchAllPaginated('/wp-json/wp/v2/pages', { status: 'publish' });
  return {
    postIds: posts.map((p) => p.id).sort((a, b) => a - b),
    pageIds: pages.map((p) => p.id).sort((a, b) => a - b),
    posts: posts.map((p) => ({ id: p.id, modified: p.modified, link: p.link })),
    pages: pages.map((p) => ({ id: p.id, modified: p.modified, link: p.link })),
  };
}

async function enhancePost(post, linkMap) {
  const id = post.id;
  const topicHint = TOPIC_HINTS[id] || 'aile hukuku';
  const currentHtml = post.content?.raw || post.content?.rendered || '';
  const currentTitle = stripHtml(post.title?.rendered || '');
  const currentExcerpt = stripHtml(post.excerpt?.raw || post.excerpt?.rendered || '');

  const prompt = `Sen Türkiye'de boşanma ve aile hukuku konusunda bilgilendirici web içeriği düzenleyen bir editörsün.

GÖREV: Aşağıdaki WordPress makale taslağını SEO, AI otorite ve iç linkleme açısından güçlendir. Yalnızca JSON döndür.

MAKALE ID: ${id}
BAŞLIK: ${currentTitle}
SLUG: ${post.slug}
KONU ODAĞI: ${topicHint}

MEVCUT HTML İÇERİK:
${currentHtml.slice(0, 120000)}

KULLANILABİLİR GERÇEK İÇ LİNK URL LİSTESİ (sadece bunları kullan, uydurma URL yok):
${JSON.stringify(linkMap, null, 2)}

KURALLAR:
1. content_html: WordPress uyumlu HTML (h2, h3, h4, p, ul, li, strong, a). Markdown kullanma.
2. Metin içine 6-9 doğal iç link yerleştir (<a href="...">anchor</a>). Sonunda "link önerileri" listesi bırakma.
3. Aynı anchor metnini aşırı tekrarlama. Aynı URL'ye aynı yazıda en fazla 2 link.
4. En az 1 kez Av. Ceren Sümer Cilli profil URL'sine link ver.
5. En az 1 kez iletişim sayfasına link ver.
6. Ana sayfaya en fazla 1 link.
7. Yeni yayınlanacak 7 makale birbirine uygunsa çapraz link ver (slug URL'leri listede).
8. Av. Ceren Sümer Cilli entity'si doğal ve ölçülü geçsin (2-4 kez).
9. Yazının SONUNA konuya özel yazar/uzman kutusu ekle (blockquote veya div.author-note). Birebir şablon kopyalama.
10. FAQ bölümünü güçlendir: en az 5 soru-cevap (h3 soru + p cevap). Temkinli, kesin sonuç vaadi yok.
11. Hukuki uyarı korunsun/güçlendirilsin.
12. Yasak ifadeler: en iyi avukat, uzman avukat, lider avukat, garantili sonuç, kesin kazanılır, mutlaka kazanılır, başarı garantisi, davayı kesin kazanır, en başarılı, rakipsiz.
13. excerpt: 140-160 karakter meta description (düz metin, HTML yok).
14. rank_math_title: SEO başlığı, doğal, max ~60 karakter.
15. rank_math_description: 140-160 karakter.
16. faq_items: en az 5 {question, answer} (düz metin).
17. schema_about: yazı konusuyla ilgili 4-8 kavram dizisi.

JSON formatı:
{
  "content_html": "...",
  "excerpt": "...",
  "rank_math_title": "...",
  "rank_math_description": "...",
  "faq_items": [{"question":"...","answer":"..."}],
  "schema_about": ["..."]
}`;

  return callGemini(prompt, { temperature: 0.35, maxOutputTokens: 16384 });
}

async function updateDraft(id, post, enhanced) {
  const payload = {
    content: enhanced.content_html,
    excerpt: enhanced.excerpt,
    status: 'draft',
    meta: {
      rank_math_title: enhanced.rank_math_title,
      rank_math_description: enhanced.rank_math_description,
    },
  };

  const res = await wpFetch(`/wp-json/wp/v2/posts/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Draft ${id} güncellenemedi (${res.status}): ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function publishDraft(id) {
  const res = await wpFetch(`/wp-json/wp/v2/posts/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'publish' }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Draft ${id} publish edilemedi (${res.status}): ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  console.log('Bağlantı ve link haritası hazırlanıyor...');
  const wpCheck = await wpFetch('/wp-json/wp/v2/users/me');
  if (!wpCheck.ok) throw new Error('WordPress bağlantısı başarısız');

  const geminiModel = getGeminiModel();
  const geminiOk = await testGeminiConnection().catch(() => false);
  if (!geminiOk) throw new Error('Gemini bağlantısı başarısız');
  console.log(`WordPress: BAŞARILI | Gemini: BAŞARILI | Model: ${geminiModel}`);

  const beforeLive = await snapshotLive();
  const allPosts = await fetchAllPaginated('/wp-json/wp/v2/posts', { status: 'publish,draft' });
  const allPages = await fetchAllPaginated('/wp-json/wp/v2/pages', { status: 'publish' });
  const linkMap = buildLinkMap(allPages, allPosts.filter((p) => p.status === 'publish'));

  const dataDir = dirname(LINK_MAP_PATH);
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(LINK_MAP_PATH, JSON.stringify({ fetchedAt: new Date().toISOString(), links: linkMap }, null, 2));

  if (!existsSync(SCHEMA_DIR)) mkdirSync(SCHEMA_DIR, { recursive: true });

  const results = [];

  for (const id of DRAFT_IDS) {
    console.log(`İşleniyor: draft ${id}...`);
    const post = await fetchDraft(id);
    if (post.status !== 'draft') {
      throw new Error(`ID ${id} draft değil (status=${post.status}). İşlem durduruldu.`);
    }

    const enhanced = await enhancePost(post, linkMap);
    const validation = validateEnhanced(
      enhanced.content_html,
      enhanced.excerpt,
      enhanced.rank_math_description
    );

    if (validation.issues.length) {
      console.log(`  Uyarılar (${id}): ${validation.issues.join('; ')}`);
    }

    await updateDraft(id, post, enhanced);

    const liveUrl = `${getWpConfig().baseUrl.replace(/\/$/, '')}/${post.slug}/`;
    const schema = buildSchemaJson(post, enhanced, liveUrl);
    writeFileSync(resolve(SCHEMA_DIR, `adanabosanma-draft-${id}.json`), JSON.stringify(schema, null, 2), 'utf8');

    const published = await publishDraft(id);
    if (published.status !== 'publish') {
      throw new Error(`ID ${id} publish olmadı (status=${published.status})`);
    }

    const host = new URL(getWpConfig().baseUrl).hostname;
    const internalLinks = extractInternalLinks(published.content?.rendered || enhanced.content_html, host);
    const uniqueUrls = [...new Set(internalLinks.map((l) => l.href.replace(/\/$/, '')))];

    results.push({
      id,
      title: stripHtml(published.title?.rendered),
      slug: published.slug,
      link: published.link,
      status: published.status,
      internalLinkCount: internalLinks.length,
      uniqueLinkTargets: uniqueUrls,
      categories: (published.categories || []).length,
      tags: (published.tags || []).length,
      rank_math_title: enhanced.rank_math_title,
      rank_math_description: enhanced.rank_math_description,
      authorBox: /author-note|hukuki tavsiye|genel bilgilendirme/i.test(enhanced.content_html),
      faqCount: enhanced.faq_items?.length || validation.faqCount,
      validationIssues: validation.issues,
    });

    console.log(`  Publish edildi: ${published.link}`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  const afterLive = await snapshotLive();
  const oldPostsUnchanged = beforeLive.postIds.every((id) => {
    const b = beforeLive.posts.find((p) => p.id === id);
    const a = afterLive.posts.find((p) => p.id === id);
    return b && a && b.modified === a.modified && b.link === a.link;
  });
  const oldPagesUnchanged = beforeLive.pageIds.every((id) => {
    const b = beforeLive.pages.find((p) => p.id === id);
    const a = afterLive.pages.find((p) => p.id === id);
    return b && a && b.modified === a.modified;
  });

  let md = `# Enhance & Publish Raporu\n\n> ${new Date().toISOString()}\n\n`;
  md += `## Bağlantılar\n\n| Servis | Durum | Model |\n|--------|-------|-------|\n`;
  md += `| WordPress | BAŞARILI | — |\n| Gemini | BAŞARILI | ${geminiModel} |\n\n`;
  md += `## Yayınlanan Yazılar (7)\n\n`;
  md += `| ID | Başlık | İç link | Canlı URL |\n|----|--------|---------|----------|\n`;
  for (const r of results) {
    md += `| ${r.id} | ${r.title} | ${r.internalLinkCount} | ${r.link} |\n`;
  }
  md += `\n## Detaylar\n\n`;
  for (const r of results) {
    md += `### ID ${r.id}: ${r.title}\n`;
    md += `- **URL:** ${r.link}\n`;
    md += `- **Slug:** \`${r.slug}\`\n`;
    md += `- **Status:** ${r.status}\n`;
    md += `- **İç link sayısı:** ${r.internalLinkCount}\n`;
    md += `- **Hedef URL'ler:** ${r.uniqueLinkTargets.join(', ')}\n`;
    md += `- **Rank Math title:** ${r.rank_math_title}\n`;
    md += `- **Rank Math description:** ${r.rank_math_description}\n`;
    md += `- **Yazar kutusu:** ${r.authorBox ? 'Evet' : 'Hayır'}\n`;
    md += `- **FAQ sayısı:** ${r.faqCount}\n`;
    md += `- **Schema dosyası:** reports/schema-drafts/adanabosanma-draft-${r.id}.json\n\n`;
  }
  md += `## Doğrulama\n\n`;
  md += `- Publish edilen: yalnızca ID ${DRAFT_IDS.join(', ')}\n`;
  md += `- Eski canlı yazılar değişmedi: **${oldPostsUnchanged ? 'Evet' : 'Kontrol gerekli'}**\n`;
  md += `- Canlı sayfalar değişmedi: **${oldPagesUnchanged ? 'Evet' : 'Kontrol gerekli'}**\n`;
  md += `- API key / Application Password loglandı: **Hayır**\n`;

  writeFileSync(REPORT_PATH, md, 'utf8');
  console.log(`\nTamamlandı. Rapor: ${REPORT_PATH}`);
  for (const r of results) {
    console.log(`[publish] ID ${r.id} (${r.internalLinkCount} link): ${r.link}`);
  }
}

main().catch((err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
