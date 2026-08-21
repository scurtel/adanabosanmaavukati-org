/**
 * adanabosanmaavukati.org — Av. Ceren Sümer Cilli aile hukuku profili (yerel taslak).
 * Metin, cerensumer.av.tr ve adanaavukat.org kopyası değildir.
 */

export const BASE = 'https://adanabosanmaavukati.org';
export const PROFILE_URL = `${BASE}/avukat-ceren-sumer-cilli/`;
export const PROFILE_PAGE_ID = 15;
export const PERSON_ID = `${PROFILE_URL}#person`;
export const LEGAL_SERVICE_ID = `${BASE}/#legalservice`;
export const CANONICAL_PERSON_URL =
  'https://www.cerensumer.av.tr/av-ceren-sumer-cilli/';
export const MILLIYET_BLOG_URL = 'https://blog.milliyet.com.tr/avcerensumercilli';

export const ALUMNI_OF = {
  '@type': 'CollegeOrUniversity',
  name: 'Dokuz Eylül Üniversitesi Hukuk Fakültesi',
};

export const SAME_AS = [
  CANONICAL_PERSON_URL,
  MILLIYET_BLOG_URL,
  'https://www.linkedin.com/in/avukat-ceren-s%C3%BCmer-cilli-375873b0/',
  'https://www.instagram.com/av.cerensumercilli/',
  'https://www.facebook.com/cerensumercilli/',
];

const REHBER_LINKS = [
  { title: 'Boşanma davası nasıl açılır?', url: '/adanada-bosanma-davasi-nasil-acilir/' },
  { title: 'Çekişmeli boşanma davası nasıl açılır?', url: '/adana-cekismeli-bosanma-davasi/' },
  { title: 'Anlaşmalı boşanma protokolü', url: '/adanada-anlasmali-bosanma-protokolu/' },
  { title: 'Nafaka davası ve artırım süreci', url: '/adanada-nafaka-davasi-ve-nafaka-artirim-sureci/' },
  { title: 'Velayet ve çocuğun üstün yararı', url: '/adanada-velayet-davasinda-cocugun-ustun-yarari/' },
  { title: 'Mal paylaşımı ve katılma alacağı', url: '/bosanmada-mal-paylasimi-ve-katilma-alacagi/' },
  { title: 'Uzaklaştırma kararı (6284)', url: '/adanada-uzaklastirma-karari-nasil-alinir/' },
  { title: 'Miras davaları ve paylaşım', url: '/adanada-miras-davalari-ve-miras-paylasimi/' },
  { title: 'Ortaklığın giderilmesi davası', url: '/adanada-ortakligin-giderilmesi-davasi/' },
];

export function buildProfileHtml() {
  const items = REHBER_LINKS.map(
    (r) => `<li><a href="${BASE}${r.url}">${r.title}</a></li>`
  ).join('\n');

  return `<!-- csc-family-profile-v1 -->
<style>
.csc-family-profile{max-width:920px}
.csc-family-profile h1{margin:0 0 .6em;font-size:1.85rem;line-height:1.25}
.csc-family-profile h2{margin:1.5em 0 .5em;font-size:1.3rem}
.csc-family-profile p,.csc-family-profile li{line-height:1.65}
.csc-family-profile ul{margin:.4em 0 1.1em;padding-left:1.2em}
.csc-family-profile .ceren-rehberler-compact{margin-top:2em;padding:1em;background:#f9f9f9;border-radius:6px}
@media (max-width:767px){.csc-family-profile .ceren-rehberler-compact ul{columns:1}}
</style>
<article class="csc-family-profile">
<h1>Avukat Ceren Sümer Cilli</h1>
<p>Avukat Ceren Sümer Cilli, Adana’da boşanma hukuku, aile hukuku, mal rejimleri ve arabuluculuk konularında çalışan bir avukattır. Bu sayfa, aile hukuku alanındaki eğitim geçmişini, mesleki yeterliliklerini ve sitedeki boşanma rehberlerine bağlantıyı bir arada sunar.</p>

<h2>Eğitim</h2>
<p>Dokuz Eylül Üniversitesi Hukuk Fakültesinden 2012 yılında 80,06 akademik ortalamayla mezun olmuş ve Onur Listesi’nde yer almaya hak kazanmıştır.</p>

<h2>Aile hukuku ve mal rejimleri eğitimleri</h2>
<p>Boşanma ve mal rejimi uyuşmazlıklarında kullanılan hesaplama ve tasfiye konuları, belgelenmiş ileri eğitim programlarıyla desteklenmektedir:</p>
<ul>
<li>Türkiye Avukatları Sosyal Dayanışma ve Yardımlaşma Vakfı (TÜRAVAK) tarafından düzenlenen <strong>“Aile Hukuku ve Mal Rejimi”</strong> İleri Eğitim Sertifika Programı — 24–25–26 Mayıs 2019, 24 saat. Program başarıyla tamamlanmıştır.</li>
<li>Adana Barosu ve Aile Hukuku Derneği tarafından birlikte düzenlenen <strong>“Aile Hukukundan Kaynaklı Mal Rejimleri ve Miras Hukukunda Nitelikli Hesaplamalar”</strong> — 24–25–26 Kasım 2023, 24 saat. Program tamamlanmıştır.</li>
</ul>
<p>6 Ocak 2020 tarihinde Arabulucular Siciline kayıtlı olarak arabuluculuk yetkisini almıştır. Aile hukuku dosyalarında arabuluculuk, çekişmeli yargılama kadar her somut olayda uygun olmayabilir; protokol zemini ile dava yolu dosyanın koşullarına göre birlikte değerlendirilir.</p>

<h2>Boşanma ve aile hukuku çalışma çerçevesi</h2>
<p>Adana’da anlaşmalı ve çekişmeli boşanma, velayet, nafaka, mal rejiminin tasfiyesi, ziynet alacağı, maddi-manevi tazminat ve aile konutu gibi boşanmanın fer’i sonuçları bu sitenin asıl konusu içindedir. Aile hukuku uyuşmazlıkları tarafların kişisel, ekonomik ve sosyal hayatını doğrudan etkilediğinden her dosya kendi delilleri ve yaşam düzeni içinde ele alınır.</p>
<p>Mal rejimleri ve miras hesaplamalarına ilişkin eğitimler, boşanma sonrası katılma alacağı ve mal paylaşımı içerikleriyle birlikte okunmalıdır. Bu sayfadaki açıklamalar genel bilgilendirme niteliğindedir; kişiye özel hukuki değerlendirme yerine geçmez.</p>

<h2>Yayınlar</h2>
<p>Av. Ceren Sümer Cilli’nin Milliyet Blog’da hukuk alanında yayımlanmış yazıları bulunmaktadır. Milliyet Blog yazar profili: <a href="${MILLIYET_BLOG_URL}">blog.milliyet.com.tr/avcerensumercilli</a>.</p>
<p>Kişiye ilişkin kanonik özgeçmiş ve tam eğitim kaydı <a href="${CANONICAL_PERSON_URL}">cerensumer.av.tr üzerindeki Avukat Ceren Sümer Cilli profilinde</a> yer alır.</p>

<h2>Resmî profiller</h2>
<ul>
<li><a href="${CANONICAL_PERSON_URL}">Avukat Ceren Sümer Cilli — cerensumer.av.tr</a></li>
<li><a href="${MILLIYET_BLOG_URL}">Milliyet Blog yazar profili</a></li>
<li><a href="https://www.linkedin.com/in/avukat-ceren-s%C3%BCmer-cilli-375873b0/">LinkedIn</a></li>
<li><a href="https://www.instagram.com/av.cerensumercilli/">Instagram</a></li>
<li><a href="https://www.facebook.com/cerensumercilli/">Facebook</a></li>
</ul>

<p>Bu sayfa, Avukat Ceren Sümer Cilli’nin Adana’da yürüttüğü aile hukuku çalışmaları hakkında genel bilgilendirme amacıyla hazırlanmıştır. Hukuki süreçlere ilişkin ayrıntı, somut olayın koşullarına göre değişir.</p>

<div class="ceren-rehberler-compact">
<p><strong>Bilgilendirme Rehberleri</strong></p>
<ul style="columns:2;gap:1em;">
${items}
</ul>
</div>
</article>`;
}

export function buildProfileJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${PROFILE_URL}#profilepage`,
        url: PROFILE_URL,
        name: 'Avukat Ceren Sümer Cilli',
        isPartOf: { '@id': `${BASE}/#website` },
        mainEntity: { '@id': PERSON_ID },
        about: { '@id': PERSON_ID },
      },
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: 'Ceren Sümer Cilli',
        honorificPrefix: 'Av.',
        alternateName: ['Avukat Ceren Sümer Cilli', 'Av. Ceren Sümer Cilli'],
        jobTitle: 'Avukat',
        description:
          'Adana’da boşanma hukuku, aile hukuku, mal rejimleri ve arabuluculuk alanlarında çalışan avukat. Dokuz Eylül Üniversitesi Hukuk Fakültesi mezunu.',
        url: PROFILE_URL,
        alumniOf: ALUMNI_OF,
        worksFor: { '@id': LEGAL_SERVICE_ID },
        knowsAbout: [
          'Aile Hukuku',
          'Boşanma Hukuku',
          'Mal Rejimleri',
          'Miras Hukuku',
          'Velayet',
          'Nafaka',
          'Arabuluculuk',
        ],
        sameAs: SAME_AS,
      },
      {
        '@type': 'LegalService',
        '@id': LEGAL_SERVICE_ID,
        name: 'Avukat Ceren Sümer Cilli - Adana Boşanma Avukatı',
        url: BASE,
        employee: { '@id': PERSON_ID },
        areaServed: { '@type': 'City', name: 'Adana' },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${PROFILE_URL}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Ana Sayfa',
            item: `${BASE}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Avukat Ceren Sümer Cilli',
            item: PROFILE_URL,
          },
        ],
      },
    ],
  };
}

export function injectProfileSchema(html, jsonLd = buildProfileJsonLd()) {
  const block = `<script type="application/ld+json" id="csc-family-profile-jsonld">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
  if (html.includes('id="csc-family-profile-jsonld"')) {
    return html.replace(
      /<script type="application\/ld\+json" id="csc-family-profile-jsonld">[\s\S]*?<\/script>/,
      block
    );
  }
  return `${html}\n${block}\n`;
}
