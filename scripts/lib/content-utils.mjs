export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractLinks(html, siteHost) {
  const internal = [];
  const external = [];
  if (!html) return { internal, external };

  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const anchor = stripHtml(m[2]);
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    try {
      const url = new URL(href, `https://${siteHost}`);
      const entry = { href: url.href, anchor };
      if (url.hostname.replace(/^www\./, '') === siteHost.replace(/^www\./, '')) {
        internal.push(entry);
      } else {
        external.push(entry);
      }
    } catch {
      /* skip invalid URLs */
    }
  }
  return { internal, external };
}

export function countWords(text) {
  const t = stripHtml(text);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export const TARGET_KEYWORDS = {
  primary: [
    'Adana boşanma avukatı',
    'Adana aile hukuku avukatı',
    'Adana anlaşmalı boşanma avukatı',
    'Adana çekişmeli boşanma avukatı',
    'Adana nafaka avukatı',
    'Adana velayet avukatı',
    'Adana mal paylaşımı avukatı',
  ],
  topics: [
    'anlaşmalı boşanma',
    'çekişmeli boşanma',
    'nafaka',
    'velayet',
    'mal paylaşımı',
    'ziynet alacağı',
    'uzaklaştırma kararı',
    'tedbir nafakası',
    'yoksulluk nafakası',
    'iştirak nafakası',
    'mal rejimi',
    '6284',
    'aile mahkemesi',
  ],
  entityName: 'Ceren Sümer Cilli',
  entityFull: 'Av. Ceren Sümer Cilli',
};

export const PRIORITY_ARTICLES = [
  {
    title: 'Adana\'da Boşanma Davası Nasıl Açılır?',
    slug: 'adanada-bosanma-davasi-nasil-acilir',
    focus: 'Adana boşanma avukatı',
  },
  {
    title: 'Adana\'da Anlaşmalı Boşanma Protokolü Nasıl Hazırlanır?',
    slug: 'adanada-anlasmali-bosanma-protokolu',
    focus: 'anlaşmalı boşanma',
  },
  {
    title: 'Adana\'da Çekişmeli Boşanma Davası Ne Kadar Sürer?',
    slug: 'adanada-cekismeli-bosanma-davasi-ne-kadar-surer',
    focus: 'çekişmeli boşanma',
  },
  {
    title: 'Adana\'da Nafaka Davası ve Nafaka Artırım Süreci',
    slug: 'adanada-nafaka-davasi-ve-nafaka-artirim-sureci',
    focus: 'nafaka',
  },
  {
    title: 'Adana\'da Velayet Davasında Çocuğun Üstün Yararı',
    slug: 'adanada-velayet-davasinda-cocugun-ustun-yarari',
    focus: 'velayet',
  },
  {
    title: 'Boşanmada Mal Paylaşımı ve Katılma Alacağı Nasıl Hesaplanır?',
    slug: 'bosanmada-mal-paylasimi-ve-katilma-alacagi',
    focus: 'mal paylaşımı',
  },
  {
    title: 'Adana\'da Uzaklaştırma Kararı Nasıl Alınır?',
    slug: 'adanada-uzaklastirma-karari-nasil-alinir',
    focus: '6284 uzaklaştırma',
  },
];

export const HUB_SLUGS = [
  '',
  'hakkimizda',
  'hakkimda',
  'av-ceren-sumer-cilli',
  'ceren-sumer-cilli',
  'adana-bosanma-avukati',
  'adana-aile-hukuku-avukati',
  'anlasmali-bosanma',
  'anlasmali-bosanma-avukati',
  'cekismeli-bosanma',
  'cekismeli-bosanma-avukati',
  'nafaka',
  'nafaka-avukati',
  'velayet',
  'velayet-avukati',
  'mal-paylasimi',
  'mal-paylasimi-avukati',
  'uzaklastirma-karari',
  'iletisim',
  'contact',
];
