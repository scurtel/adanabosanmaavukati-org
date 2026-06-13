#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getGeminiConfig } from './lib/env.mjs';
import { PRIORITY_ARTICLES } from './lib/content-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../generated/adanabosanma-authority-articles');

const SYSTEM_RULES = `Sen Türkiye'de boşanma ve aile hukuku konusunda bilgilendirici içerik yazan bir hukuk metin yazarısın.
Kurallar:
- Türkçe, profesyonel, sade dil
- 1000-1500 kelime
- Reklam yasağına aykırı ifade YOK ("en iyi avukat", "garantili sonuç", "kesin kazanılır" vb.)
- Gerçek olmayan başarı, ödül, baro unvanı, dava sonucu UYDURMA
- Her yazıda FAQ bölümü (en az 4 soru-cevap)
- Her yazıda hukuki uyarı: içerik genel bilgilendirme amaçlıdır, hukuki tavsiye değildir
- Av. Ceren Sümer Cilli doğal ve ölçülü geçsin (2-4 kez), keyword stuffing yapma
- Adana yerel bağlamı doğal şekilde işle (Adana Aile Mahkemeleri, Adana Adliyesi)
- Somut olayın koşullarına göre değişebileceğini vurgula
- İç link önerileri bölümü ekle (anchor metni + hedef slug)
- YAML frontmatter ile başla: title, slug, seo_title, meta_description, categories, tags
- Markdown gövde: H2/H3 başlıklar, madde işaretleri, FAQ, hukuki uyarı, yazar notu`;

async function callGemini(prompt) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) throw new Error('GEMINI_API_KEY .env dosyasında tanımlı değil.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_RULES}\n\n${prompt}` }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API hatası (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini boş yanıt döndü.');
  return text;
}

async function main() {
  const onlySlug = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1];
  const articles = onlySlug
    ? PRIORITY_ARTICLES.filter((a) => a.slug === onlySlug)
    : PRIORITY_ARTICLES;

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`${articles.length} makale üretiliyor...`);

  for (const art of articles) {
    const outPath = resolve(OUT_DIR, `${art.slug}.md`);
    if (existsSync(outPath) && !process.argv.includes('--force')) {
      console.log(`Atlandı (mevcut): ${art.slug}`);
      continue;
    }

    console.log(`Üretiliyor: ${art.title}...`);
    const prompt = `Şu makaleyi yaz:

Başlık: ${art.title}
Slug: ${art.slug}
Odak anahtar kelime: ${art.focus}
Site: adanabosanmaavukati.org — Adana boşanma ve aile hukuku bilgi sitesi
Avukat entity: Av. Ceren Sümer Cilli

Frontmatter örneği:
---
title: "${art.title}"
slug: "${art.slug}"
seo_title: "..."
meta_description: "..."
categories: ["Boşanma Hukuku", "Aile Hukuku"]
tags: ["Adana", "boşanma", "..."]
---

Gövdede şu bölümler olsun:
1. Giriş
2. Konuya özel ana bölümler (H2/H3)
3. Adana özel notlar (varsa)
4. Sık Sorulan Sorular (FAQ)
5. İç Link Önerileri (liste)
6. Hukuki Uyarı
7. Yazar notu (Av. Ceren Sümer Cilli — konuya özel varyasyon)`;

    try {
      const content = await callGemini(prompt);
      writeFileSync(outPath, content.trim() + '\n', 'utf8');
      console.log(`Kaydedildi: ${outPath}`);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`${art.slug} hatası: ${err.message}`);
    }
  }

  console.log('Tamamlandı.');
}

main().catch((err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
