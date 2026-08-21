import { getGeminiConfig } from './env.mjs';
import { fetchWithRetry } from './fetch-retry.mjs';

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

/**
 * Extract and parse a JSON value from Gemini text that may include fences or prose.
 * Exported for unit-style offline tests.
 */
export function parseGeminiJsonText(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Gemini boş yanıt döndü.');

  // 1) Direct parse
  try {
    return JSON.parse(raw);
  } catch {
    /* continue */
  }

  // 2) Fenced ```json ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* continue */
    }
  }

  // 3) First balanced {...} object in the text
  const start = raw.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const slice = raw.slice(start, i + 1);
          try {
            return JSON.parse(slice);
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error('Gemini JSON yanıtı ayrıştırılamadı.');
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

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    label: 'Gemini API',
    retries: 3,
    timeoutMs: 90000,
    retryOn403Html: false,
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

  const parsed = parseGeminiJsonText(text);

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
