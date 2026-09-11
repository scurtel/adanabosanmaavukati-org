/**
 * Ana sayfa Milliyet yayın bölümü (Gutenberg).
 * Kaynak: cerensumer.av.tr üzerindeki doğrulanmış Milliyet URL’leri.
 */

export const CEREN_CANONICAL_PROFILE =
  'https://www.cerensumer.av.tr/av-ceren-sumer-cilli/';

/** Aile / boşanma odaklı Milliyet seçkisi */
export const MILLIYET_ARTICLES_DIVORCE = [
  {
    title: 'Çekişmeli Boşanma Davası',
    url: 'https://blog.milliyet.com.tr/cekismeli-bosanma-davasi/Blog/?BlogNo=636105',
  },
  {
    title: 'Boşanma Davaları',
    url: 'https://blog.milliyet.com.tr/bosanma-davalari/Blog/?BlogNo=633766',
  },
  {
    title: 'Evlenen Eski Eş Nafaka Alır Mı',
    url: 'https://blog.milliyet.com.tr/evlenen-eski-es-nafaka-alir-mi/Blog/?BlogNo=632603',
  },
  {
    title: 'Çocuğun Velayeti Kime Verilir?',
    url: 'https://blog.milliyet.com.tr/cocugun-velayeti-kime-verilir-/Blog/?BlogNo=631566',
  },
  {
    title: 'Boşanma ve Sadakat Yükümlülüğü',
    url: 'https://blog.milliyet.com.tr/bosanma-ve-sadakat-yukumlulugu/Blog/?BlogNo=627448',
  },
];

const INTERNAL = {
  cekismeli: 'https://adanabosanmaavukati.org/adana-cekismeli-bosanma-avukati/',
  anlasmali: 'https://adanabosanmaavukati.org/adanada-anlasmali-bosanma-avukati/',
  mal: 'https://adanabosanmaavukati.org/bosanmada-mal-paylasimi-ve-katilma-alacagi/',
};

export function buildMilliyetHomepageSection() {
  const items = MILLIYET_ARTICLES_DIVORCE.map(
    (a) =>
      `<li><a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.title}</a></li>`,
  ).join('\n');

  return `<!-- wp:heading {"anchor":"milliyet-hukuk-yazilari"} -->
<h2 class="wp-block-heading" id="milliyet-hukuk-yazilari">Av. Ceren Sümer Cilli’nin Milliyet Gazetesi’nde Yayımlanan Hukuk Yazıları</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Av. Ceren Sümer Cilli’nin Milliyet Gazetesi’nde yayımlanan aile hukuku alanındaki yazılarından seçmeler. Bu seçkide çekişmeli boşanma, velayet ve nafaka konuları öne çıkar.</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul>${items}</ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>Bu yayınlar, Adana’da <a href="${INTERNAL.cekismeli}">çekişmeli boşanma</a>, <a href="${INTERNAL.anlasmali}">anlaşmalı boşanma</a> ve <a href="${INTERNAL.mal}">mal paylaşımı</a> süreçlerine ilişkin genel bilgilendirmeyi tamamlar.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><a href="${CEREN_CANONICAL_PROFILE}">Av. Ceren Sümer Cilli’nin mesleki özgeçmişi ve yayınları</a></p>
<!-- /wp:paragraph -->
`;
}

/**
 * Ana sayfa raw Gutenberg içeriğine Milliyet bölümünü ekler.
 * Konum: “Boşanma Süreci” bölümünden sonra, “Sık Sorulan 3 Soru” öncesi.
 * Duplicate varsa dokunmaz.
 */
export function insertMilliyetSection(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Geçersiz homepage raw içerik');
  }
  if (raw.includes('id="milliyet-hukuk-yazilari"') || raw.includes('milliyet-hukuk-yazilari')) {
    return { content: raw, inserted: false, reason: 'already_present' };
  }

  const marker =
    '<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">Sık Sorulan 3 Soru</h3>';
  const idx = raw.indexOf(marker);
  if (idx === -1) {
    return { content: raw, inserted: false, reason: 'marker_not_found' };
  }

  const section = buildMilliyetHomepageSection().trimEnd() + '\n\n';
  return {
    content: raw.slice(0, idx) + section + raw.slice(idx),
    inserted: true,
    reason: 'ok',
  };
}
