/**
 * Shared fetch helper with timeout, exponential backoff, and transient-error retry.
 * No secrets are logged.
 */

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const TRANSIENT_ERROR_RE =
  /fetch failed|econnreset|etimedout|econnrefused|enotfound|und_err_connect_timeout|socket hang up|network|abort|timed? ?out/i;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function backoffMs(attempt, baseMs = 2000, capMs = 30000) {
  const exp = Math.min(capMs, baseMs * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 400);
  return exp + jitter;
}

export function isTransientNetworkError(err) {
  if (!err) return false;
  const msg = String(err.message || err.cause?.message || err);
  const code = String(err.code || err.cause?.code || '');
  return TRANSIENT_ERROR_RE.test(msg) || TRANSIENT_ERROR_RE.test(code);
}

export function classifyHttpError(status, contentType = '', bodyPreview = '') {
  const ct = String(contentType || '').toLowerCase();
  const preview = String(bodyPreview || '').slice(0, 300);
  if (status === 401) return 'AUTH_FAILURE';
  if (status === 403) {
    if (ct.includes('text/html') || /<!DOCTYPE html|<html|cf-challenge|just a moment|refresh/i.test(preview)) {
      return 'TEMPORARY_WAF_OR_CDN_BLOCK';
    }
    // WordPress REST sometimes returns JSON 403 for capability issues
    if (ct.includes('application/json') || /rest_forbidden|cannot_create/i.test(preview)) {
      return 'AUTH_FAILURE';
    }
    return 'TEMPORARY_WAF_OR_CDN_BLOCK';
  }
  if (RETRYABLE_STATUS.has(status)) return 'TRANSIENT_HTTP';
  return 'PERMANENT_HTTP';
}

/**
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number, retries?: number, retryOn403Html?: boolean, label?: string, retryDelaysMs?: number[] }} options
 */
export async function fetchWithRetry(url, options = {}) {
  const {
    timeoutMs = 45000,
    retries = 3,
    retryOn403Html = false,
    label = 'fetch',
    retryDelaysMs,
    ...fetchOptions
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) return res;

      const contentType = res.headers.get('content-type') || '';
      const bodyPreview = (await res.clone().text().catch(() => '')).slice(0, 300);
      const kind = classifyHttpError(res.status, contentType, bodyPreview);
      const retryAfterHeader = res.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;

      const shouldRetry =
        attempt < retries &&
        (kind === 'TRANSIENT_HTTP' || (kind === 'TEMPORARY_WAF_OR_CDN_BLOCK' && retryOn403Html));

      if (!shouldRetry) {
        const err = new Error(
          `${label} failed (${res.status}, ${kind}): ${bodyPreview.replace(/\s+/g, ' ').slice(0, 200)}`,
        );
        err.status = res.status;
        err.errorType = kind;
        err.contentType = contentType;
        err.bodyPreview = bodyPreview;
        err.response = res;
        throw err;
      }

      const wait =
        (Number.isFinite(retryAfterMs) && retryAfterMs > 0
          ? retryAfterMs
          : retryDelaysMs?.[attempt - 1]) ?? backoffMs(attempt, kind === 'TEMPORARY_WAF_OR_CDN_BLOCK' ? 5000 : 2000);
      console.warn(
        `${label}: attempt ${attempt}/${retries} → HTTP ${res.status} (${kind}); waiting ${Math.round(wait / 1000)}s`,
      );
      await sleep(wait);
      continue;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err.errorType) throw err; // already classified permanent/transient HTTP error above

      if (attempt < retries && (isTransientNetworkError(err) || err.name === 'AbortError')) {
        const wait = retryDelaysMs?.[attempt - 1] ?? backoffMs(attempt);
        console.warn(
          `${label}: attempt ${attempt}/${retries} → network error (${err.message || err.name}); waiting ${Math.round(wait / 1000)}s`,
        );
        await sleep(wait);
        continue;
      }
      const wrapped = new Error(`${label}: ${err.message || err}`);
      wrapped.errorType = isTransientNetworkError(err) || err.name === 'AbortError' ? 'NETWORK_TRANSIENT' : 'NETWORK';
      wrapped.cause = err;
      throw wrapped;
    }
  }

  throw lastError || new Error(`${label}: exhausted retries`);
}
