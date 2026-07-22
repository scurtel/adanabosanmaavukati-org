import { getGeminiConfig } from './env.mjs';

export function extractGroundingMetadata(data) {
  const gm = data?.candidates?.[0]?.groundingMetadata;
  if (!gm) return null;

  const chunks = gm.groundingChunks || [];
  const sources = chunks
    .map((chunk) => ({
      title: chunk.web?.title || chunk.retrievedContext?.title || null,
      url: chunk.web?.uri || chunk.retrievedContext?.uri || null,
    }))
    .filter((source) => source.url);

  return {
    sources,
    webSearchQueries: gm.webSearchQueries || [],
    groundingSupports: gm.groundingSupports || [],
    searchEntryPoint: gm.searchEntryPoint || null,
  };
}

export async function callGemini(
  prompt,
  {
    temperature = 0.4,
    maxOutputTokens = 16384,
    json = true,
    grounding,
    includeGrounding = false,
    forceJson = false,
  } = {}
) {
  const config = getGeminiConfig();
  const { apiKey, model } = config;
  if (!apiKey) throw new Error('GEMINI_API_KEY tanımlı değil.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Prefer Google Search when enabled; JSON mime type is incompatible with grounding.
  const searchWanted = config.searchGrounding && grounding !== false;
  const useGrounding = searchWanted && forceJson !== true;
  // `json` arg still controls response parsing; mime type only when grounding is off.
  const useJsonMime = Boolean(json) && !useGrounding;

  const generationConfig = { temperature, maxOutputTokens };
  if (useJsonMime) generationConfig.responseMimeType = 'application/json';

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (useGrounding) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API hatası (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini boş yanıt döndü.');

  const groundingMeta = extractGroundingMetadata(data);

  if (!json) {
    if (includeGrounding) return { text, grounding: groundingMeta };
    return text;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) parsed = JSON.parse(fenced[1]);
    else throw new Error('Gemini JSON yanıtı ayrıştırılamadı.');
  }

  if (includeGrounding) {
    return { data: parsed, grounding: groundingMeta };
  }
  return parsed;
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
