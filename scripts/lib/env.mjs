import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function loadDotEnv() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

export function getWpConfig() {
  const baseUrl = (
    process.env.ADANABOSANMA_WP_BASE_URL ||
    process.env.ADANAAVUKAT_WP_BASE_URL ||
    'https://adanabosanmaavukati.org'
  ).replace(/\/$/, '');

  let username =
    process.env.ADANABOSANMA_WP_USERNAME || process.env.ADANAAVUKAT_WP_USERNAME;
  let appPassword =
    process.env.ADANABOSANMA_WP_APP_PASSWORD || process.env.ADANAAVUKAT_WP_APP_PASSWORD;

  // Yaygın yapılandırma hatası: alanlar ters atanmışsa otomatik düzelt (değerler loglanmaz)
  const looksLikeAppPassword = (v) => typeof v === 'string' && /^[A-Za-z0-9]{4}(\s[A-Za-z0-9]{4}){3,}$/.test(v.trim());
  const looksLikeEmail = (v) => typeof v === 'string' && v.includes('@');
  if (username && appPassword && looksLikeAppPassword(username) && looksLikeEmail(appPassword)) {
    [username, appPassword] = [appPassword, username];
  }

  return { baseUrl, username, appPassword };
}

export function getGeminiConfig() {
  return {
    apiKey:
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    searchGrounding:
      process.env.GEMINI_GOOGLE_SEARCH_ENABLED === 'true' ||
      process.env.GEMINI_ENABLE_SEARCH_GROUNDING === 'true',
  };
}

export function wpAuthHeader(username, appPassword) {
  const token = Buffer.from(`${username}:${appPassword}`).toString('base64');
  return `Basic ${token}`;
}

export { ROOT };
