import { getGeminiConfig } from './env.mjs';

export async function callGemini(prompt, { temperature = 0.4, maxOutputTokens = 16384, json = true } = {}) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) throw new Error('GEMINI_API_KEY tanımlı değil.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig = { temperature, maxOutputTokens };
  if (json) generationConfig.responseMimeType = 'application/json';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API hatası (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini boş yanıt döndü.');
  if (!json) return text;

  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    throw new Error('Gemini JSON yanıtı ayrıştırılamadı.');
  }
}

export async function testGeminiConnection() {
  const res = await callGemini('Türkçe kısa bir cümle üret: bağlantı başarılı.', {
    json: false,
    maxOutputTokens: 64,
    temperature: 0.2,
  });
  return !!res;
}

export function getGeminiModel() {
  return getGeminiConfig().model;
}
