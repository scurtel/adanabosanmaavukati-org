#!/usr/bin/env node
import { getGeminiConfig } from './lib/env.mjs';

async function main() {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    console.log('SONUÇ: BAŞARISIZ — GEMINI_API_KEY tanımlı değil');
    process.exit(1);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Türkçe kısa bir cümle üret: bağlantı başarılı.' }] }],
        generationConfig: { maxOutputTokens: 64, temperature: 0.2 },
      }),
    });

    if (res.ok) {
      console.log('SONUÇ: BAŞARILI');
      console.log(`Model: ${model}`);
      process.exit(0);
    }

    console.log('SONUÇ: BAŞARISIZ');
    console.log(`HTTP durum kodu: ${res.status}`);
    process.exit(1);
  } catch (err) {
    console.log('SONUÇ: BAŞARISIZ');
    console.log(`Bağlantı hatası: ${err.message}`);
    process.exit(1);
  }
}

main();
