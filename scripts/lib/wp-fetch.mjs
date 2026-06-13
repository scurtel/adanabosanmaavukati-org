import { getWpConfig, wpAuthHeader } from './env.mjs';

export async function wpFetch(path, options = {}) {
  const { baseUrl, username, appPassword } = getWpConfig();
  if (!username || !appPassword) {
    throw new Error('WordPress kimlik bilgileri .env dosyasında tanımlı değil.');
  }

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const headers = {
    Accept: 'application/json',
    Authorization: wpAuthHeader(username, appPassword),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  return res;
}

export async function fetchAllPaginated(endpoint, params = {}) {
  const items = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const qs = new URLSearchParams({
      per_page: '100',
      page: String(page),
      ...params,
    });
    const res = await wpFetch(`${endpoint}?${qs}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WP API hatası (${res.status}): ${endpoint} — ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    items.push(...data);
    totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
    page++;
  }
  return items;
}
