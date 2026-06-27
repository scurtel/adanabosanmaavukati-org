#!/usr/bin/env node
// adanabosanmaavukati.org — Gemini ile otomatik SEO makale üretip WordPress REST API ile yayınlar.
// Gizli bilgiler (API key, kullanıcı adı, application password) yalnızca ortam değişkenlerinden okunur.
// Kullanım: node scripts/generate-wp-article.mjs  (npm run generate:auto-article)

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
// lib/gemini.mjs import edildiğinde lib/env.mjs üzerinden .env (varsa) yüklenir.
import { callGemini, getGeminiModel } from './lib/gemini.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GEN_DIR = resolve(ROOT, 'generated-articles');
const HISTORY_PATH = resolve(GEN_DIR, 'history.json');
const LAST_RUN_PATH = resolve(GEN_DIR, 'auto-last-run.json');

// ---- Ortam değişkenleri (yeni adlar + mevcut .env uyumu için yedek adlar) ----
const WP_BASE_URL = (
  process.env.WP_BASE_URL ||
  process.env.ADANABOSANMA_WP_BASE_URL ||
  'https://adanabosanmaavukati.org'
).replace(/\/$/, '');
const WP_USERNAME = process.env.WP_USERNAME || process.env.ADANABOSANMA_WP_USERNAME;
const WP_APPLICATION_PASSWORD =
  process.env.WP_APPLICATION_PASSWORD || process.env.ADANABOSANMA_WP_APP_PASSWORD;
const WP_POST_STATUS = process.env.WP_POST_STATUS || 'publish';
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

// ---- Kelime sayısı (yalnızca ÖNERİ; kesin sınır yok) ----
const TARGET_MIN = 1000;
const TARGET_MAX = 1300;

const BANNED = [
  'en iyi', 'kesin kazan', 'garanti', 'en hızlı', 'uzman avukat', 'lider avukat',
  'rakipsiz', 'mutlaka kazan', 'başarı garantisi', 'kesin sonuç', '%100',
];

// ---- Konu havuzu (tema: Adana boşanma / aile hukuku) ----
const TOPICS = [
  { id: 'anlasmali-bosanma', title: "Adana'da Anlaşmalı Boşanma Süreci ve Dikkat Edilmesi Gerekenler", slug: 'adanada-anlasmali-bosanma-sureci', focusKeyword: 'Adana anlaşmalı boşanma avukatı', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'cekismeli-bosanma', title: "Adana'da Çekişmeli Boşanma Davasında Süreç ve Haklar", slug: 'adanada-cekismeli-bosanma-davasi-surec', focusKeyword: 'Adana çekişmeli boşanma avukatı', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'velayet', title: "Adana'da Velayet Davası ve Çocuğun Üstün Yararı İlkesi", slug: 'adanada-velayet-davasi-cocugun-ustun-yarari-rehber', focusKeyword: 'Adana velayet avukatı', categories: ['Velayet', 'Aile Hukuku'] },
  { id: 'nafaka-turleri', title: "Boşanmada Nafaka Türleri: Tedbir, Yoksulluk ve İştirak Nafakası", slug: 'bosanmada-nafaka-turleri-tedbir-yoksulluk-istirak', focusKeyword: 'Adana nafaka avukatı', categories: ['Nafaka', 'Aile Hukuku'] },
  { id: 'mal-paylasimi', title: "Adana'da Boşanmada Mal Paylaşımı ve Katkı Payı", slug: 'adanada-bosanmada-mal-paylasimi-katki-payi', focusKeyword: 'Adana mal paylaşımı avukatı', categories: ['Mal Paylaşımı', 'Aile Hukuku'] },
  { id: 'ziynet', title: "Boşanmada Ziynet (Altın) Alacağı Davası ve İspat", slug: 'bosanmada-ziynet-altin-alacagi-davasi', focusKeyword: 'ziynet alacağı davası', categories: ['Mal Paylaşımı', 'Aile Hukuku'] },
  { id: 'tazminat', title: "Boşanmada Maddi ve Manevi Tazminat Talepleri", slug: 'bosanmada-maddi-manevi-tazminat-talepleri', focusKeyword: 'boşanmada tazminat', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'kisisel-iliski', title: "Boşanmada Çocukla Kişisel İlişki (Görüş) Düzenlemesi", slug: 'bosanmada-cocukla-kisisel-iliski-duzenlemesi', focusKeyword: 'çocukla kişisel ilişki', categories: ['Velayet', 'Aile Hukuku'] },
  { id: 'deliller', title: "Boşanma Davasında Deliller ve İspat Yöntemleri", slug: 'bosanma-davasinda-deliller-ve-ispat', focusKeyword: 'boşanma davasında deliller', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'aile-hukuku-avukati', title: "Adana Aile Hukuku Avukatı Hangi Davalara Bakar?", slug: 'adana-aile-hukuku-avukati-hangi-davalara-bakar', focusKeyword: 'Adana aile hukuku avukatı', categories: ['Aile Hukuku'] },
  { id: 'tedbir-nafakasi', title: "Boşanma Sürecinde Tedbir Nafakası Nasıl Belirlenir?", slug: 'bosanma-surecinde-tedbir-nafakasi', focusKeyword: 'tedbir nafakası', categories: ['Nafaka', 'Aile Hukuku'] },
  { id: 'bosanma-dava-sureci', title: "Adana'da Boşanma Davası Aşamaları ve Süreç Yönetimi", slug: 'adanada-bosanma-davasi-asamalari-surec-yonetimi', focusKeyword: 'Adana boşanma avukatı', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
];

function fail(message) {
  console.error(`HATA: ${message}`);
  process.exit(1);
}

function checkEnv() {
  const missing = [];
  if (!GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  if (!WP_USERNAME) missing.push('WP_USERNAME (veya ADANABOSANMA_WP_USERNAME)');
  if (!WP_APPLICATION_PASSWORD) missing.push('WP_APPLICATION_PASSWORD (veya ADANABOSANMA_WP_APP_PASSWORD)');
  if (missing.length) {
    fail(
      `Eksik ortam değişkenleri: ${missing.join(', ')}.\n` +
      `Yerelde .env dosyası oluşturun (.env.example dosyasını kopyalayın) ya da GitHub Actions secrets tanımlayın.\n` +
      `Gizli değerler asla koda yazılmamalı, yalnızca ortam değişkeni olarak verilmelidir.`
    );
  }
}

function loadHistory() {
  if (!existsSync(HISTORY_PATH)) return { usedTopicIds: [], articles: [] };
  try {
    const data = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
    return { usedTopicIds: data.usedTopicIds || [], articles: data.articles || [] };
  } catch {
    return { usedTopicIds: [], articles: [] };
  }
}

function saveHistory(history) {
  if (!existsSync(GEN_DIR)) mkdirSync(GEN_DIR, { recursive: true });
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
}

function saveLastRun(info) {
  if (!existsSync(GEN_DIR)) mkdirSync(GEN_DIR, { recursive: true });
  writeFileSync(LAST_RUN_PATH, JSON.stringify(info, null, 2), 'utf8');
}

function pickTopic(history) {
  const used = new Set(history.usedTopicIds);
  return TOPICS.find((t) => !used.has(t.id)) || null;
}

function wordCount(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean).length;
}

function buildPrompt(topic) {
  return `Sen Türkiye'de aile hukuku alanında hukuki bilgilendirme içeriği yazan deneyimli bir editörsün.
adanabosanmaavukati.org (Adana merkezli) için Türkçe, yerel SEO uyumlu, özgün bir makale üret.

KONU (H1 başlık): ${topic.title}
ODAK ANAHTAR KELİME: ${topic.focusKeyword}

KURALLAR:
- Dil: Türkçe. Hedef uzunluk: ${TARGET_MIN}-${TARGET_MAX} kelime (gövde metni).
- İlk (giriş) paragrafında odak anahtar kelimeyi ("${topic.focusKeyword}") veya "Adana boşanma avukatı" ifadesini doğal şekilde kullan; anahtar kelime doldurma (keyword stuffing) yapma.
- Yapı: gövdede H1 KULLANMA (H1 WordPress başlığıdır). Sadece <h2> ve <h3> alt başlıklar, <p>, <ul>, <li>, <strong>, <a> kullan.
- Adana yerel bağlamını (aile mahkemeleri, yerel süreç) doğal şekilde geç.
- Hukuki bilgi ver ama kesin sonuç, kesin süre, garanti başarı veya kazanma vaadi VERME.
- Av. Ceren Sümer Cilli'ye doğal, abartısız, güven veren biçimde en fazla 1-2 kez atıf yapılabilir.
- Yasak ifadeler (KULLANMA): ${BANNED.join(', ')}.
- En az 4 adet anlamlı SSS (FAQ) üret.
- Hukuki uyarı cümlesini metne EKLEME; sistem otomatik ekleyecek.

YANIT FORMATI: Yalnızca aşağıdaki şemada GEÇERLİ JSON döndür (başka metin yok):
{
  "title": "WordPress başlığı (H1, ~50-65 karakter)",
  "metaTitle": "SEO meta başlığı (55-60 karakter)",
  "metaDescription": "SEO meta açıklaması (145-160 karakter)",
  "excerpt": "Kısa özet (1-2 cümle)",
  "faq": [{ "question": "...", "answer": "..." }],
  "bodyHtml": "<p>giriş...</p><h2>...</h2><p>...</p><h3>...</h3><p>...</p>"
}`;
}

async function generateOnce(topic) {
  const enhanced = await callGemini(buildPrompt(topic), {
    json: true,
    temperature: 0.5,
    maxOutputTokens: 16384,
  });
  return enhanced;
}

async function generateArticle(topic) {
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const article = await generateOnce(topic);
    last = article;
    const faqText = (article.faq || []).map((f) => `${f.question} ${f.answer}`).join(' ');
    const wc = wordCount(`${article.bodyHtml || ''} ${faqText}`);
    article._wordCount = wc;

    const okStructure = !!article.bodyHtml && (article.faq || []).length >= 4;
    const inTarget = wc >= TARGET_MIN && wc <= TARGET_MAX;
    console.log(`Deneme ${attempt}: kelime sayısı = ${wc} (öneri: ${TARGET_MIN}-${TARGET_MAX}${inTarget ? '' : ' — öneri dışı'})`);

    // İdeal durum: yapı tamam ve öneri aralığında → hemen kabul.
    if (okStructure && inTarget) return article;

    // İlk denemede ideal değilse, öneriye yaklaşmak için bir kez daha dene.
    if (attempt === 1) {
      console.log('Öneri aralığı dışında veya eksik FAQ — bir kez daha deneniyor...');
      continue;
    }

    // İkinci deneme: kelime sayısı yalnızca öneri olduğundan, yapı sağlamsa kabul et.
    if (okStructure) {
      if (!inTarget) console.log('Not: kelime sayısı öneri aralığı dışında ancak kabul ediliyor (kesin sınır yok).');
      return article;
    }
  }
  throw new Error('İçerik üretilemedi: gövde (bodyHtml) boş ya da en az 4 FAQ üretilemedi (2 denemede).');
}

// ---- WordPress REST yardımcıları ----
function wpAuthHeader() {
  const token = Buffer.from(`${WP_USERNAME}:${WP_APPLICATION_PASSWORD}`).toString('base64');
  return `Basic ${token}`;
}

async function wp(path, options = {}) {
  const url = path.startsWith('http') ? path : `${WP_BASE_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: { Accept: 'application/json', Authorization: wpAuthHeader(), ...(options.headers || {}) },
  });
}

async function ensureUniqueSlug(slug) {
  for (const ep of ['posts', 'pages']) {
    const res = await wp(`/wp-json/wp/v2/${ep}?slug=${encodeURIComponent(slug)}&status=publish,draft,pending,future,private&per_page=100`);
    if (res.ok) {
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length) {
        const suffix = new Date().getFullYear();
        return `${slug}-${suffix}`;
      }
    }
  }
  return slug;
}

async function matchCategoryIds(names) {
  const res = await wp('/wp-json/wp/v2/categories?per_page=100');
  if (!res.ok) return [];
  const cats = await res.json();
  const ids = [];
  for (const name of names) {
    const hit = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (hit) ids.push(hit.id);
  }
  return ids;
}

async function ensureTagId(name) {
  try {
    const res = await wp(`/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=100`);
    if (res.ok) {
      const items = await res.json();
      const exact = items.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (exact) return exact.id;
    }
    const create = await wp('/wp-json/wp/v2/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (create.ok) return (await create.json()).id;
  } catch {
    /* etiket eklenemezse sessizce geç */
  }
  return null;
}

function buildContent(article, topic) {
  const faqItems = article.faq || [];
  const faqHtml =
    '<h2>Sıkça Sorulan Sorular</h2>\n' +
    faqItems.map((f) => `<h3>${f.question}</h3>\n<p>${f.answer}</p>`).join('\n');

  const disclaimer =
    '<p style="margin-top:1.5em;font-size:0.95em;color:#555;"><em>Bu yazı genel bilgilendirme amaçlıdır ve hukuki tavsiye niteliği taşımaz. Her dava somut olayın koşullarına göre değişebilir; süreciniz hakkında <a href="https://adanabosanmaavukati.org/avukat-ceren-sumer-cilli/">Av. Ceren Sümer Cilli</a> ile görüşerek bilgi alabilirsiniz.</em></p>';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
  const schemaBlock = `\n<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>`;

  return `${article.bodyHtml}\n\n${faqHtml}\n\n${disclaimer}${schemaBlock}`;
}

async function main() {
  checkEnv();

  console.log(`WordPress: ${WP_BASE_URL} | Durum: ${WP_POST_STATUS} | Gemini model: ${getGeminiModel()}`);

  const history = loadHistory();
  const topic = pickTopic(history);
  if (!topic) {
    console.log('Üretilecek yeni konu kalmadı (tüm konular daha önce üretildi). Çıkılıyor.');
    saveLastRun({ ranAt: new Date().toISOString(), result: 'no-topic' });
    return;
  }
  console.log(`Seçilen konu: ${topic.id} — ${topic.title}`);

  const article = await generateArticle(topic);

  // Yasak ifade güvenlik kontrolü
  const lc = `${article.title} ${article.bodyHtml}`.toLowerCase();
  const banHit = BANNED.find((b) => lc.includes(b));
  if (banHit) throw new Error(`Üretilen içerikte yasak ifade bulundu: "${banHit}"`);

  const slug = await ensureUniqueSlug(topic.slug);
  const content = buildContent(article, topic);

  const categoryIds = await matchCategoryIds(topic.categories);
  const focusTagId = await ensureTagId(topic.focusKeyword);

  const payload = {
    title: article.title || topic.title,
    slug,
    status: process.env.WP_POST_STATUS || 'publish',
    content,
    excerpt: article.excerpt || article.metaDescription || '',
    meta: {
      rank_math_title: article.metaTitle || article.title,
      rank_math_description: article.metaDescription || article.excerpt,
      rank_math_focus_keyword: topic.focusKeyword,
    },
  };
  if (categoryIds.length) payload.categories = categoryIds; // yoksa WordPress default kategoriyi kullanır
  if (focusTagId) payload.tags = [focusTagId];

  const res = await wp('/wp-json/wp/v2/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress'e gönderim başarısız (${res.status}): ${errText.slice(0, 300)}`);
  }
  const post = await res.json();

  const record = {
    topicId: topic.id,
    wpId: post.id,
    title: post.title?.rendered || article.title,
    slug: post.slug,
    url: post.link,
    status: post.status,
    focusKeyword: topic.focusKeyword,
    wordCount: article._wordCount,
    faqCount: (article.faq || []).length,
    date: new Date().toISOString(),
  };

  history.usedTopicIds.push(topic.id);
  history.articles.push(record);
  saveHistory(history);
  saveLastRun({ ranAt: new Date().toISOString(), result: 'ok', ...record });

  console.log('\n=== TAMAMLANDI ===');
  console.log(JSON.stringify(record, null, 2));
}

main().catch((err) => {
  fail(err.message);
});
