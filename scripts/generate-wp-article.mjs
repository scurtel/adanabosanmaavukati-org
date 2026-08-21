#!/usr/bin/env node
// adanabosanmaavukati.org — Gemini ile otomatik SEO makale üretip WordPress REST API ile yayınlar.
// Gizli bilgiler (API key, kullanıcı adı, application password) yalnızca ortam değişkenlerinden okunur.
// Kullanım: node scripts/generate-wp-article.mjs  (npm run generate:auto-article)

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
// lib/gemini.mjs import edildiğinde lib/env.mjs üzerinden .env (varsa) yüklenir.
import { callGemini, getGeminiModel } from './lib/gemini.mjs';
import { fetchWithRetry, sleep, classifyHttpError } from './lib/fetch-retry.mjs';
import { validateArticlePayload } from './lib/article-schema.mjs';

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
const GEMINI_ATTEMPTS = 3;
const GEMINI_RETRY_DELAYS_MS = [2000, 5000, 10000];
const WP_PUBLISH_RETRY_DELAYS_MS = [5000, 15000, 30000];

const BANNED = [
  'en iyi', 'kesin kazan', 'garanti', 'en hızlı', 'uzman avukat', 'lider avukat',
  'rakipsiz', 'mutlaka kazan', 'başarı garantisi', 'kesin sonuç', '%100',
];

// ---- Konu havuzu (tema: Adana boşanma / aile hukuku) ----
// Sırayla işlenir; daha önce üretilen (history.json) konu atlanır.
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

  // --- Genişletilmiş konular ---
  { id: 'uzaklastirma-6284', title: "6284 Sayılı Kanun Kapsamında Uzaklaştırma ve Koruma Kararı", slug: 'bosanma-surecinde-uzaklastirma-ve-koruma-karari-6284', focusKeyword: 'uzaklaştırma kararı', categories: ['Koruma ve Uzaklaştırma', 'Aile Hukuku'] },
  { id: 'miras', title: "Adana'da Miras Davası ve Mirasçıların Hakları", slug: 'adanada-miras-davasi-ve-mirascilarin-haklari', focusKeyword: 'Adana miras avukatı', categories: ['Aile Hukuku'] },
  { id: 'ortakligin-giderilmesi', title: "İzale-i Şuyu: Ortaklığın Giderilmesi Davası Süreci", slug: 'izale-i-suyu-ortakligin-giderilmesi-davasi-sureci', focusKeyword: 'ortaklığın giderilmesi davası', categories: ['Mal Paylaşımı', 'Aile Hukuku'] },
  { id: 'aldatma-zina', title: "Aldatma (Zina) Nedeniyle Boşanma Davası ve Tazminat", slug: 'aldatma-zina-nedeniyle-bosanma-davasi-ve-tazminat', focusKeyword: 'zina nedeniyle boşanma', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'terk', title: "Terk Nedeniyle Boşanma Davası ve İhtar Şartı", slug: 'terk-nedeniyle-bosanma-davasi-ve-ihtar-sarti', focusKeyword: 'terk nedeniyle boşanma', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'siddetli-gecimsizlik', title: "Evlilik Birliğinin Temelinden Sarsılması (Şiddetli Geçimsizlik)", slug: 'evlilik-birliginin-temelinden-sarsilmasi-bosanma', focusKeyword: 'şiddetli geçimsizlik nedeniyle boşanma', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'bosanma-sgk-tazminat', title: "Boşanmada SGK, Dul-Yetim Aylığı ve Tazminat İlişkisi", slug: 'bosanmada-sgk-dul-yetim-ayligi-ve-tazminat', focusKeyword: 'boşanma ve dul aylığı', categories: ['Aile Hukuku'] },
  { id: 'anlasmali-protokol', title: "Anlaşmalı Boşanma Protokolünde Bulunması Gereken Unsurlar", slug: 'anlasmali-bosanma-protokolunde-bulunmasi-gerekenler', focusKeyword: 'anlaşmalı boşanma protokolü', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'nafaka-artirim', title: "Nafaka Artırım ve Azaltım Davası: Şartlar ve Süreç", slug: 'nafaka-artirim-ve-azaltim-davasi-sartlar', focusKeyword: 'nafaka artırım davası', categories: ['Nafaka', 'Aile Hukuku'] },
  { id: 'velayetin-degistirilmesi', title: "Velayetin Değiştirilmesi Davası ve Şartları", slug: 'velayetin-degistirilmesi-davasi-ve-sartlari', focusKeyword: 'velayetin değiştirilmesi', categories: ['Velayet', 'Aile Hukuku'] },
  { id: 'mal-rejimi', title: "Edinilmiş Mallara Katılma Rejimi ve İstisnaları", slug: 'edinilmis-mallara-katilma-rejimi-ve-istisnalari', focusKeyword: 'mal rejimi', categories: ['Mal Paylaşımı', 'Aile Hukuku'] },
  { id: 'tanima-tenfiz', title: "Yabancı Mahkeme Boşanma Kararının Türkiye'de Tanınması ve Tenfizi", slug: 'yabanci-bosanma-kararinin-taninmasi-ve-tenfizi', focusKeyword: 'boşanma kararı tanıma tenfiz', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'bosanma-masraflari', title: "Boşanma Davası Masrafları ve Yargılama Süreci", slug: 'bosanma-davasi-masraflari-ve-yargilama-sureci', focusKeyword: 'boşanma davası masrafları', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
  { id: 'cekismeli-sure', title: "Çekişmeli Boşanma Ne Kadar Sürer? Süreci Etkileyen Faktörler", slug: 'cekismeli-bosanma-ne-kadar-surer-etkileyen-faktorler', focusKeyword: 'çekişmeli boşanma süresi', categories: ['Boşanma Davaları', 'Aile Hukuku'] },
];

function warnQuality(message) {
  console.warn(`::warning title=Makale kalite uyarısı::${message}`);
}

function fail(message, errorType = 'UNKNOWN') {
  console.error(`HATA: ${message}`);
  console.error(`ERROR_TYPE=${errorType}`);
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
        `Gizli değerler asla koda yazılmamalı, yalnızca ortam değişkeni olarak verilmelidir.`,
      'MISSING_ENV',
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

function buildInternalLinkInstruction(internalLinks) {
  if (!internalLinks || !internalLinks.length) return '';
  const list = internalLinks.map((l) => ({ anchor: l.title, url: l.url }));
  return `
İÇ LİNKLER (yerel SEO için önemli):
- Aşağıdaki gerçek URL'lerden konuyla ALAKALI olanlardan 3-6 tanesini gövde metnine doğal <a href="URL">anlamlı anchor</a> olarak yerleştir.
- SADECE bu listedeki URL'leri kullan; uydurma/başka URL EKLEME. Alakasız link ekleme, zorlama yapma.
${JSON.stringify(list, null, 2)}
`;
}

function buildPrompt(topic, internalLinks) {
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
${buildInternalLinkInstruction(internalLinks)}
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

async function generateOnce(topic, internalLinks) {
  // forceJson: true → responseMimeType=application/json (grounding ile JSON mime çakışmasını önler)
  return callGemini(buildPrompt(topic, internalLinks), {
    json: true,
    forceJson: true,
    temperature: 0.5,
    maxOutputTokens: 16384,
  });
}

async function generateArticle(topic, internalLinks) {
  let lastQualityArticle = null;
  let lastError = null;

  for (let attempt = 1; attempt <= GEMINI_ATTEMPTS; attempt++) {
    try {
      const article = await generateOnce(topic, internalLinks);
      const schemaErrors = validateArticlePayload(article);
      if (schemaErrors.length) {
        console.warn(`Gemini attempt ${attempt}/${GEMINI_ATTEMPTS}: invalid schema (${schemaErrors.join('; ')})`);
        lastError = new Error(`GEMINI_INVALID_SCHEMA: ${schemaErrors.join('; ')}`);
        if (attempt < GEMINI_ATTEMPTS) {
          await sleep(GEMINI_RETRY_DELAYS_MS[attempt - 1] || 10000);
          continue;
        }
        break;
      }

      const faqText = (article.faq || []).map((f) => `${f.question} ${f.answer}`).join(' ');
      const wc = wordCount(`${article.bodyHtml || ''} ${faqText}`);
      article._wordCount = wc;

      const idealStructure = (article.faq || []).length >= 4;
      const inTarget = wc >= TARGET_MIN && wc <= TARGET_MAX;
      console.log(
        `Gemini attempt ${attempt}/${GEMINI_ATTEMPTS}: success (words=${wc}, faq=${(article.faq || []).length}${inTarget ? '' : ', outside word target'})`,
      );

      if (idealStructure && inTarget) return article;

      lastQualityArticle = article;
      // One quality retry only (attempt 1 → try again for better length/FAQ)
      if (attempt === 1 && (!idealStructure || !inTarget)) {
        console.log('Öneri aralığı dışında veya eksik FAQ — kaliteyi iyileştirmek için bir kez daha deneniyor...');
        await sleep(GEMINI_RETRY_DELAYS_MS[0]);
        continue;
      }

      // Quality issues are warnings only — publish continues.
      if (!inTarget) {
        warnQuality(
          `Kelime sayısı hedef aralığında değil. Hedef ${TARGET_MIN}-${TARGET_MAX}, mevcut: ${wc}. Makale yine de yayınlanacak.`,
        );
      }
      if ((article.faq || []).length < 4) {
        warnQuality(
          `FAQ sayısı hedefin altında (${(article.faq || []).length}; hedef ≥4). Yine de yayınlanıyor.`,
        );
      }
      return article;
    } catch (err) {
      lastError = err;
      const msg = String(err.message || err);
      const isParse = /JSON yanıtı ayrıştırılamadı|boş yanıt/i.test(msg);
      console.warn(
        `Gemini attempt ${attempt}/${GEMINI_ATTEMPTS}: ${isParse ? 'invalid JSON' : 'error'} (${msg.slice(0, 120)})`,
      );
      if (attempt < GEMINI_ATTEMPTS) {
        await sleep(GEMINI_RETRY_DELAYS_MS[attempt - 1] || 10000);
      }
    }
  }

  if (lastQualityArticle && validateArticlePayload(lastQualityArticle).length === 0) {
    warnQuality('Gemini kalite hedefi tutturulamadı; son geçerli payload ile devam ediliyor.');
    return lastQualityArticle;
  }

  const err = lastError || new Error('Gemini üretimi başarısız');
  err.errorType = /JSON/i.test(String(err.message)) ? 'GEMINI_INVALID_JSON' : 'GEMINI_FAILED';
  throw err;
}

// ---- WordPress REST yardımcıları ----
function wpAuthHeader() {
  const token = Buffer.from(`${WP_USERNAME}:${WP_APPLICATION_PASSWORD}`).toString('base64');
  return `Basic ${token}`;
}

async function wp(path, options = {}) {
  const url = path.startsWith('http') ? path : `${WP_BASE_URL}${path}`;
  const {
    retries = 3,
    retryOn403Html = true,
    timeoutMs = 45000,
    label = `WP ${options.method || 'GET'} ${path.split('?')[0]}`,
    retryDelaysMs,
    ...fetchOptions
  } = options;

  return fetchWithRetry(url, {
    ...fetchOptions,
    headers: {
      Accept: 'application/json',
      Authorization: wpAuthHeader(),
      ...(fetchOptions.headers || {}),
    },
    retries,
    retryOn403Html,
    timeoutMs,
    label,
    retryDelaysMs,
  });
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#8217;|&#8216;|&#039;|&#39;/g, "'")
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function findPostsBySlug(slug) {
  try {
    const res = await wp(
      `/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=publish,draft,pending,future,private&per_page=10`,
      { label: `WP find slug ${slug}`, retries: 3, retryOn403Html: true },
    );
    if (!res.ok) return [];
    const arr = await res.json();
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    console.warn(`Slug lookup failed (${err.message}); continuing.`);
    return [];
  }
}

// Mevcut yayındaki yazı/sayfaları çekip iç link adaylarını döndürür (salt-okunur).
async function fetchInternalLinks(limit = 40) {
  const out = [];
  for (const ep of ['posts', 'pages']) {
    try {
      const res = await wp(`/wp-json/wp/v2/${ep}?status=publish&per_page=100&_fields=title,link`, {
        label: `WP list ${ep}`,
        retries: 3,
        retryOn403Html: true,
      });
      if (!res.ok) continue;
      const arr = await res.json();
      for (const it of arr) {
        const title = decodeEntities(it.title?.rendered);
        if (it.link && title) out.push({ title, url: it.link });
      }
    } catch (err) {
      console.warn(`İç link adayları alınamadı (${ep}): ${err.message} — linksiz devam.`);
    }
  }
  const seen = new Set();
  return out.filter((l) => (seen.has(l.url) ? false : seen.add(l.url))).slice(0, limit);
}

async function ensureUniqueSlug(slug) {
  for (const ep of ['posts', 'pages']) {
    try {
      const res = await wp(
        `/wp-json/wp/v2/${ep}?slug=${encodeURIComponent(slug)}&status=publish,draft,pending,future,private&per_page=100`,
        { label: `WP unique-slug ${ep}`, retries: 3 },
      );
      if (res.ok) {
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length) {
          const suffix = new Date().getFullYear();
          return `${slug}-${suffix}`;
        }
      }
    } catch (err) {
      console.warn(`Slug uniqueness check failed (${ep}): ${err.message}`);
    }
  }
  return slug;
}

async function matchCategoryIds(names) {
  try {
    const res = await wp('/wp-json/wp/v2/categories?per_page=100', {
      label: 'WP categories',
      retries: 3,
    });
    if (!res.ok) return [];
    const cats = await res.json();
    const ids = [];
    for (const name of names) {
      const hit = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (hit) ids.push(hit.id);
    }
    return ids;
  } catch (err) {
    console.warn(`Kategori eşlemesi başarısız: ${err.message} — default kategori kullanılacak.`);
    return [];
  }
}

async function ensureTagId(name) {
  try {
    const res = await wp(`/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=100`, {
      label: 'WP tags search',
      retries: 3,
    });
    if (res.ok) {
      const items = await res.json();
      const exact = items.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (exact) return exact.id;
    }
    const create = await wp('/wp-json/wp/v2/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      label: 'WP tag create',
      retries: 3,
      retryOn403Html: true,
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

/**
 * Publish with retries. On transient 403/5xx/network, re-check slug before re-POSTing
 * to avoid duplicate posts if the first POST actually succeeded server-side.
 */
async function publishPost(payload) {
  const maxAttempts = 3;
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Idempotency: if a post with this slug already exists, reuse it.
    const existing = await findPostsBySlug(payload.slug);
    if (existing.length) {
      console.log(
        `WordPress publish: existing post found for slug "${payload.slug}" (id=${existing[0].id}) — skipping duplicate POST`,
      );
      return existing[0];
    }

    try {
      console.log(`WordPress publish: POST attempt ${attempt}/${maxAttempts}`);
      const res = await wp('/wp-json/wp/v2/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        label: 'WP publish',
        retries: 1, // outer loop handles retries with slug re-check
        retryOn403Html: false,
        timeoutMs: 60000,
      });

      if (res.ok) {
        const post = await res.json();
        console.log(`WordPress publish: POST attempt ${attempt}/${maxAttempts} → ${res.status} ✓`);
        return post;
      }

      // Should rarely reach here because fetchWithRetry throws on !ok with retries:1
      const contentType = res.headers.get('content-type') || '';
      const bodyPreview = (await res.text()).slice(0, 300);
      const kind = classifyHttpError(res.status, contentType, bodyPreview);
      const err = new Error(`WordPress'e gönderim başarısız (${res.status}, ${kind})`);
      err.errorType = kind === 'AUTH_FAILURE' ? 'WORDPRESS_AUTH' : kind === 'TEMPORARY_WAF_OR_CDN_BLOCK' ? 'WORDPRESS_TEMPORARY_403' : 'WORDPRESS_HTTP';
      err.status = res.status;
      err.contentType = contentType;
      err.bodyPreview = bodyPreview;
      throw err;
    } catch (err) {
      lastErr = err;
      const type = err.errorType || 'WORDPRESS_HTTP';
      const status = err.status || '?';
      const ct = err.contentType || '';
      console.warn(
        `WordPress publish: attempt ${attempt}/${maxAttempts} → status=${status} type=${type} content-type=${ct || 'n/a'}`,
      );
      if (err.bodyPreview) {
        console.warn(`WordPress response preview: ${String(err.bodyPreview).replace(/\s+/g, ' ').slice(0, 300)}`);
      }
      if (type === 'TEMPORARY_WAF_OR_CDN_BLOCK') {
        console.warn('WordPress API returned HTML instead of JSON — Possible firewall/CDN/WAF temporary challenge');
      }

      if (type === 'AUTH_FAILURE' || type === 'WORDPRESS_AUTH') {
        err.errorType = 'WORDPRESS_AUTH';
        throw err;
      }

      const retryable =
        type === 'TEMPORARY_WAF_OR_CDN_BLOCK' ||
        type === 'TRANSIENT_HTTP' ||
        type === 'NETWORK_TRANSIENT' ||
        type === 'WORDPRESS_TEMPORARY_403' ||
        /fetch failed|network|timeout|503|502|429|408/i.test(String(err.message));

      if (!retryable || attempt >= maxAttempts) {
        err.errorType =
          type === 'TEMPORARY_WAF_OR_CDN_BLOCK' ? 'WORDPRESS_TEMPORARY_403' : type || 'WORDPRESS_FAILED';
        throw err;
      }

      const wait = WP_PUBLISH_RETRY_DELAYS_MS[attempt - 1] || 30000;
      console.warn(`waiting ${Math.round(wait / 1000)}s before publish retry...`);
      await sleep(wait);
    }
  }

  throw lastErr || new Error('WordPress publish failed');
}

async function main() {
  checkEnv();

  console.log('[1/6] Ortam kontrolü tamam');
  console.log(`WordPress: ${WP_BASE_URL} | Durum: ${WP_POST_STATUS} | Gemini model: ${getGeminiModel()}`);

  const history = loadHistory();
  const topic = pickTopic(history);
  if (!topic) {
    console.log('Üretilecek yeni konu kalmadı (tüm konular daha önce üretildi). Çıkılıyor.');
    saveLastRun({ ranAt: new Date().toISOString(), result: 'no-topic' });
    return;
  }
  console.log(`[2/6] Konu seçildi: ${topic.id} — ${topic.title}`);

  // Re-run / race guard: if slug already published, mark history and exit cleanly
  const already = await findPostsBySlug(topic.slug);
  if (already.length) {
    console.log(
      `Slug "${topic.slug}" zaten WordPress'te var (id=${already[0].id}). Duplicate üretimi atlanıyor; history güncelleniyor.`,
    );
    if (!history.usedTopicIds.includes(topic.id)) {
      history.usedTopicIds.push(topic.id);
      history.articles.push({
        topicId: topic.id,
        wpId: already[0].id,
        title: already[0].title?.rendered || topic.title,
        slug: already[0].slug || topic.slug,
        url: already[0].link,
        status: already[0].status,
        focusKeyword: topic.focusKeyword,
        date: new Date().toISOString(),
        note: 'pre-existing-on-rerun',
      });
      saveHistory(history);
    }
    saveLastRun({ ranAt: new Date().toISOString(), result: 'already-exists', topicId: topic.id, wpId: already[0].id });
    console.log('[6/6] History güncellendi (pre-existing)');
    return;
  }

  console.log('[3/6] Gemini makale üretimi');
  const internalLinks = await fetchInternalLinks();
  console.log(`İç link adayı: ${internalLinks.length} mevcut içerik bulundu.`);

  const article = await generateArticle(topic, internalLinks);

  // Yasaklı ifadeler: yalnızca tespit + GHA warning. Sanitize / silme / retry / red yok.
  {
    const articleText = `${article.title || ''} ${article.bodyHtml || ''} ${article.metaDescription || ''} ${article.excerpt || ''}`;
    const banHits = BANNED.filter((b) =>
      articleText.toLocaleLowerCase('tr-TR').includes(String(b).toLocaleLowerCase('tr-TR')),
    );
    for (const phrase of banHits) {
      console.warn(
        `::warning title=Yasaklı ifade uyarısı::Makalede kontrol listesindeki ifade bulundu: ${phrase}. İçerik değiştirilmeden yayınlanıyor.`,
      );
    }
  }

  if (!article.title && !topic.title) {
    throw Object.assign(new Error('Başlık üretilemedi — teknik hata'), { errorType: 'GEMINI_INVALID_SCHEMA' });
  }

  console.log('[4/6] Makale doğrulandı');
  console.log(`      Words: ${article._wordCount}`);
  console.log(`      FAQ: ${(article.faq || []).length}`);

  const slug = await ensureUniqueSlug(topic.slug);
  const content = buildContent(article, topic);
  if (!String(content).trim()) {
    throw Object.assign(new Error('Birleştirilmiş içerik boş — teknik hata'), { errorType: 'GEMINI_INVALID_SCHEMA' });
  }
  const internalLinkCount = (content.match(/href="https?:\/\/[^"]*adanabosanmaavukati\.org/gi) || []).length;
  console.log(`      Internal links: ${internalLinkCount}`);
  if (internalLinkCount === 0) {
    warnQuality('Gövdeye site içi link eklenemedi (0 iç link). Yayın devam ediyor.');
  }

  const desc = article.metaDescription || article.excerpt || '';
  if (!desc) {
    warnQuality('Meta description / excerpt eksik.');
  } else if (desc.length < 120 || desc.length > 170) {
    warnQuality(`Meta description uzunluğu hedef dışı (${desc.length} karakter; hedef 145-160).`);
  }

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
  if (categoryIds.length) payload.categories = categoryIds;
  if (focusTagId) payload.tags = [focusTagId];

  // Article payload is ready — publish retries reuse this payload (no Gemini re-call).
  console.log('[5/6] WordPress publish');
  const post = await publishPost(payload);

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
    internalLinkCount,
    date: new Date().toISOString(),
  };

  // History ONLY after confirmed WP success
  history.usedTopicIds.push(topic.id);
  history.articles.push(record);
  saveHistory(history);
  saveLastRun({ ranAt: new Date().toISOString(), result: 'ok', ...record });

  console.log('[6/6] History güncellendi');
  console.log('\n=== TAMAMLANDI ===');
  console.log(JSON.stringify(record, null, 2));
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((err) => {
    fail(err.message, err.errorType || 'UNKNOWN');
  });
}
