#!/usr/bin/env node
/**
 * Offline resilience tests for auto-article helpers.
 * No network / no WordPress / no Gemini calls.
 */
import { parseGeminiJsonText } from './lib/gemini.mjs';
import { classifyHttpError, isTransientNetworkError, backoffMs } from './lib/fetch-retry.mjs';
import { validateArticlePayload } from './lib/article-schema.mjs';

let passed = 0;
let failed = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    console.log(`PASS  ${name}`);
    passed++;
  } else {
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ---- Test A: fenced JSON ----
{
  const text = '```json\n{"title":"T","bodyHtml":"<p>x</p>","faq":[{"question":"q","answer":"a"}]}\n```';
  try {
    const parsed = parseGeminiJsonText(text);
    assert('A fenced JSON parses', parsed.title === 'T' && parsed.bodyHtml.includes('p'));
  } catch (e) {
    assert('A fenced JSON parses', false, e.message);
  }
}

// ---- Test A2: prose + JSON ----
{
  const text = 'İşte JSON:\n{"title":"Başlık","bodyHtml":"<p>gövde</p>","faq":[{"question":"S?","answer":"C."}]}\nTeşekkürler.';
  try {
    const parsed = parseGeminiJsonText(text);
    assert('A2 prose-wrapped JSON parses', parsed.title === 'Başlık');
  } catch (e) {
    assert('A2 prose-wrapped JSON parses', false, e.message);
  }
}

// ---- Test B: invalid then valid (parser level) ----
{
  let ok = false;
  try {
    parseGeminiJsonText('not json at all');
  } catch {
    ok = true;
  }
  assert('B invalid JSON throws', ok);

  const valid = parseGeminiJsonText('{"title":"ok","bodyHtml":"<p>a</p>","faq":[]}');
  assert('B valid JSON after invalid path works', valid.title === 'ok');
}

// ---- Test schema validation ----
{
  const bad = validateArticlePayload({ title: '', bodyHtml: '', faq: 'x' });
  assert('Schema rejects empty/invalid', bad.length >= 3);

  const good = validateArticlePayload({
    title: 'Adana Nafaka',
    bodyHtml: '<p>Giriş</p>',
    faq: [{ question: 'Soru?', answer: 'Cevap.' }],
  });
  assert('Schema accepts minimal valid article', good.length === 0);
}

// ---- Test C/D classification ----
{
  assert(
    'C 503 is TRANSIENT_HTTP',
    classifyHttpError(503, 'application/json', '{}') === 'TRANSIENT_HTTP',
  );
  assert(
    'D 403 HTML is TEMPORARY_WAF_OR_CDN_BLOCK',
    classifyHttpError(403, 'text/html', '<!DOCTYPE html><html><meta http-equiv="refresh" content="30">') ===
      'TEMPORARY_WAF_OR_CDN_BLOCK',
  );
  assert(
    'F 401 is AUTH_FAILURE',
    classifyHttpError(401, 'application/json', '{"code":"rest_forbidden"}') === 'AUTH_FAILURE',
  );
  assert(
    'F 403 JSON capability is AUTH_FAILURE',
    classifyHttpError(403, 'application/json', '{"code":"rest_cannot_create"}') === 'AUTH_FAILURE',
  );
  assert('C fetch failed is transient network', isTransientNetworkError(new Error('fetch failed')));
  assert('backoff increases', backoffMs(1, 1000, 10000) <= backoffMs(3, 1000, 10000) + 400);
}

// ---- Test G: word count is advisory (documented by validate not checking words) ----
{
  const longOk = validateArticlePayload({
    title: 'Uzun makale',
    bodyHtml: '<p>' + 'kelime '.repeat(2000) + '</p>',
    faq: [
      { question: '1?', answer: 'a' },
      { question: '2?', answer: 'b' },
      { question: '3?', answer: 'c' },
      { question: '4?', answer: 'd' },
    ],
  });
  assert('G long article still schema-valid (word count not hard fail)', longOk.length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
