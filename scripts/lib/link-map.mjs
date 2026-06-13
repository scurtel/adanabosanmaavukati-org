import { getWpConfig } from './env.mjs';

const DRAFT_SLUGS = {
  143: 'adanada-bosanma-davasi-nasil-acilir',
  144: 'adanada-anlasmali-bosanma-protokolu',
  145: 'adanada-cekismeli-bosanma-davasi-ne-kadar-surer',
  146: 'adanada-nafaka-davasi-ve-nafaka-artirim-sureci',
  147: 'adanada-velayet-davasinda-cocugun-ustun-yarari',
  148: 'bosanmada-mal-paylasimi-ve-katilma-alacagi',
  149: 'adanada-uzaklastirma-karari-nasil-alinir',
};

export function buildLinkMap(pages, posts, draftIds = Object.keys(DRAFT_SLUGS).map(Number)) {
  const { baseUrl } = getWpConfig();
  const host = new URL(baseUrl).hostname.replace(/^www\./, '');
  const links = [];

  const add = (label, item, type) => {
    if (!item?.link) return;
    links.push({
      label,
      title: stripHtml(item.title?.rendered || ''),
      url: item.link,
      slug: item.slug,
      type,
      status: item.status,
    });
  };

  const pageBySlug = Object.fromEntries(pages.map((p) => [p.slug, p]));
  const postBySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

  add('Ana sayfa / Adana boşanma avukatı', pageBySlug['adana-bosanma-avukati'], 'page');
  add('Av. Ceren Sümer Cilli profil', pageBySlug['avukat-ceren-sumer-cilli'], 'page');
  add('Hakkımızda', pageBySlug['hakkimizda'], 'page');
  add('İletişim', pageBySlug['iletisim'], 'page');
  add('Adana boşanma avukatı rehberi', pageBySlug['adana-bosanma-avukati-rehberi'], 'page');
  add('Anlaşmalı boşanma', pageBySlug['adanada-anlasmali-bosanma-avukati'], 'page');
  add('Çekişmeli boşanma', pageBySlug['adana-cekismeli-bosanma-avukati'], 'page');
  add('Nafaka', pageBySlug['adana-nafaka-davasi-avukati'], 'page');
  add('Hizmetler', pageBySlug['hizmetler'], 'page');
  add('Adana velayet davası (yazı)', postBySlug['adana-velayet-davasi'], 'post');

  for (const id of draftIds) {
    const slug = DRAFT_SLUGS[id];
    const url = `${baseUrl.replace(/\/$/, '')}/${slug}/`;
    links.push({
      label: `Yeni makale: ${slug}`,
      title: slug,
      url,
      slug,
      type: 'post',
      status: 'draft',
      draftId: id,
    });
  }

  const seen = new Set();
  return links.filter((l) => {
    const key = l.url.replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return l.url.includes(host) || l.url.startsWith(baseUrl);
  });
}

export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractInternalLinks(html, siteHost) {
  const host = siteHost.replace(/^www\./, '');
  const links = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html || '')) !== null) {
    try {
      const url = new URL(m[1], `https://${host}`);
      if (url.hostname.replace(/^www\./, '') === host) {
        links.push({ href: url.href.replace(/\/$/, ''), anchor: stripHtml(m[2]) });
      }
    } catch {
      /* skip */
    }
  }
  return links;
}

export { DRAFT_SLUGS };
