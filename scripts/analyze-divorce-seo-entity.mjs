#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  stripHtml,
  TARGET_KEYWORDS,
  HUB_SLUGS,
  PRIORITY_ARTICLES,
} from './lib/content-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../data/adanabosanma-content.json');
const REPORT = resolve(__dirname, '../reports/adanabosanma-entity-seo-report.md');
const UPDATE_PLAN = resolve(__dirname, '../reports/adanabosanma-content-update-plan.md');

function loadData() {
  if (!existsSync(DATA)) throw new Error('Önce npm run fetch:wp çalıştırın.');
  return JSON.parse(readFileSync(DATA, 'utf8'));
}

function textOf(item) {
  return `${item.title} ${item.excerpt} ${item.slug}`.toLowerCase();
}

function fullText(item, rawContent) {
  return `${item.title} ${item.excerpt} ${rawContent || ''}`.toLowerCase();
}

function findEntityMentions(allContent, rawById) {
  const patterns = [
    'ceren sümer cilli',
    'ceren sumer cilli',
    'av. ceren',
    'sümer cilli',
    'sumer cilli',
  ];
  return allContent.filter((item) => {
    const t = fullText(item, rawById[item.id]);
    return patterns.some((p) => t.includes(p));
  });
}

function keywordCoverage(allContent) {
  const clusters = {};
  for (const kw of [...TARGET_KEYWORDS.primary, ...TARGET_KEYWORDS.topics]) {
    const key = kw.toLowerCase();
    clusters[kw] = allContent.filter((item) => textOf(item).includes(key));
  }
  return clusters;
}

function hasAuthorBox(text) {
  const markers = [
    'hukuki tavsiye niteliği taşımaz',
    'genel bilgilendirme amacıyla',
    'author box',
    'yazar kutusu',
    'uzman kutusu',
    'reviewer',
    'denetleyen',
  ];
  const t = (text || '').toLowerCase();
  return markers.some((m) => t.includes(m));
}

function hasFaq(text) {
  const t = (text || '').toLowerCase();
  return t.includes('sık sorulan') || t.includes('sss') || t.includes('faq') || (t.match(/\?/g) || []).length >= 3;
}

function hasSchemaHints(text) {
  const t = (text || '').toLowerCase();
  return t.includes('application/ld+json') || t.includes('"@type"');
}

function findHubPages(pages) {
  const hubs = {};
  for (const slug of HUB_SLUGS) {
    const match = pages.find((p) => p.slug === slug || p.slug.includes(slug));
    if (match) hubs[slug || 'home'] = match;
  }
  return hubs;
}

function scoreWeakness(item, rawContent) {
  let score = 0;
  const words = item.wordCount || 0;
  const t = fullText(item, rawContent);
  if (words < 400) score += 3;
  else if (words < 700) score += 1;
  if (!t.includes('ceren')) score += 2;
  if (!t.includes('adana')) score += 1;
  if ((item.internalLinks || []).length < 2) score += 2;
  if (!hasFaq(rawContent)) score += 1;
  if (!hasAuthorBox(rawContent)) score += 1;
  if ((item.excerpt || '').length < 80) score += 1;
  return score;
}

function buildEntityStrategy() {
  return `## Entity ve Otorite Stratejisi

### Ana entity
**Av. Ceren Sümer Cilli** — Adana merkezli boşanma ve aile hukuku avukatı

### Konu entity kümeleri (içerik ve schema ile güçlendirilecek)
| Küme | Hedef ifadeler | Öncelik |
|------|----------------|---------|
| Boşanma genel | Adana boşanma avukatı, boşanma davası | Yüksek |
| Anlaşmalı boşanma | anlaşmalı boşanma protokolü, Adana anlaşmalı boşanma avukatı | Yüksek |
| Çekişmeli boşanma | çekişmeli boşanma süreci, Adana çekişmeli boşanma avukatı | Yüksek |
| Nafaka | tedbir/yoksulluk/iştirak nafakası, Adana nafaka avukatı | Yüksek |
| Velayet | geçici velayet, çocuğun üstün yararı, Adana velayet avukatı | Yüksek |
| Mal paylaşımı | mal rejimi tasfiyesi, katılma alacağı, Adana mal paylaşımı avukatı | Orta-Yüksek |
| Ziynet | ziynet eşyası alacağı, Adana ziynet alacağı avukatı | Orta |
| Koruma | 6284 sayılı Kanun, uzaklaştırma kararı | Orta-Yüksek |
| Yerel | Adana Aile Mahkemeleri, Adana Adliyesi | Orta |

### İçerik ilkeleri
- Bilgilendirici, temkinli dil; somut olayın koşullarına göre değişebileceği vurgusu
- Reklam yasağına aykırı iddia yok ("en iyi", "garantili sonuç" vb.)
- Av. Ceren Sümer Cilli ismi doğal ve ölçülü geçsin
- Her küme için en az 1 hub sayfa + 2 destekleyici yazı hedefi
`;
}

function buildAuthorBoxPlan(allContent, rawById) {
  const lines = ['## Yazar / Uzman Kutusu Planı', ''];
  const topicVariants = {
    bosanma: 'boşanma davası ve boşanma süreci',
    nafaka: 'tedbir, yoksulluk ve iştirak nafakası',
    velayet: 'çocuğun üstün yararı ilkesi',
    mal: 'mal rejimi tasfiyesi ve katılma alacağı',
    uzaklastirma: '6284 sayılı Kanun kapsamındaki koruma tedbirleri',
    default: 'boşanma, nafaka, velayet, mal paylaşımı ve aile hukuku süreçleri',
  };

  for (const item of allContent) {
    if (hasAuthorBox(rawById[item.id])) continue;
    const t = textOf(item);
    let topic = topicVariants.default;
    if (t.includes('nafaka')) topic = topicVariants.nafaka;
    else if (t.includes('velayet')) topic = topicVariants.velayet;
    else if (t.includes('mal paylaş') || t.includes('mal rejimi') || t.includes('katılma')) topic = topicVariants.mal;
    else if (t.includes('uzaklaştır') || t.includes('6284')) topic = topicVariants.uzaklastirma;
    else if (t.includes('boşanma') || t.includes('bosanma')) topic = topicVariants.bosanma;

    lines.push(`### ${item.title} (\`${item.slug}\`)`);
    lines.push(`> Bu içerik, Adana'da ${topic} üzerine çalışan Av. Ceren Sümer Cilli tarafından genel bilgilendirme amacıyla hazırlanmıştır. İçerik hukuki tavsiye niteliği taşımaz; her somut olay kendi koşulları içinde değerlendirilmelidir.`);
    lines.push('');
  }
  return lines.join('\n');
}

function buildSchemaPlan(allContent, rawById, hubs) {
  const lines = [
    '## Schema / Structured Data Planı',
    '',
    '### Site geneli (tema veya eklenti ile)',
    '- **Person**: Av. Ceren Sümer Cilli — yalnızca sitede doğrulanan bilgiler',
    '- **LegalService**: Adana merkezli aile hukuku ve boşanma hukuku bilgilendirme/hizmet sayfası',
    '- **Attorney**: Person ile birlikte değerlendirilebilir (doğrulanmış alanlarla)',
    '- **BreadcrumbList**: sayfa hiyerarşisi için',
    '',
    '### JSON-LD alan önerileri (doğrulanmış bilgilerle)',
    '- author / reviewer: Av. Ceren Sümer Cilli',
    '- publisher: site adı',
    '- areaServed: Adana',
    '- knowsAbout: Boşanma Hukuku, Aile Hukuku, Nafaka, Velayet, Mal Paylaşımı, Ziynet Alacağı, Uzaklaştırma Kararı, Adana Aile Mahkemeleri',
    '',
    '**Uyarı:** Telefon, adres, baro sicil, mezuniyet gibi sitede doğrulanmayan alanlar eklenmemeli.',
    '',
    '### Sayfa bazlı öneriler',
  ];

  if (hubs['hakkimizda'] || hubs['av-ceren-sumer-cilli']) {
    lines.push('- **Person + Attorney/LegalService**: Hakkımızda / avukat profil sayfası');
  } else {
    lines.push('- **Person + Attorney/LegalService**: Hakkımızda sayfası oluşturulmalı (henüz yok veya zayıf)');
  }

  for (const item of allContent) {
    const t = fullText(item, rawById[item.id]);
    const rec = [];
    if (item.type === 'post') rec.push('Article/BlogPosting');
    if (hasFaq(rawById[item.id]) || t.includes('?')) rec.push('FAQPage (SSS bölümü eklendikten sonra)');
    if (rec.length && !hasSchemaHints(rawById[item.id])) {
      lines.push(`- \`${item.slug}\` (${item.title}): ${rec.join(', ')}`);
    }
  }
  return lines.join('\n');
}

function buildUpdatePlan(allContent, rawById, entityPages, clusters, weak) {
  const lines = [
    '# adanabosanmaavukati.org — İçerik Güncelleme Planı',
    '',
    `> Oluşturulma: ${new Date().toISOString().slice(0, 10)} | **Canlı değişiklik yapılmadı — yalnızca öneri**`,
    '',
    '## Özet',
    '',
    `- Toplam içerik: ${allContent.length}`,
    `- Entity geçen sayfa: ${entityPages.length}`,
    `- Güncelleme adayı (zayıf skor ≥4): ${weak.filter((w) => w.score >= 4).length}`,
    '',
    '## Güncellenmesi Önerilen İçerikler',
    '',
  ];

  for (const w of weak.filter((x) => x.score >= 3).slice(0, 30)) {
    const item = w.item;
    lines.push(`### ${item.title}`);
    lines.push(`- **URL:** ${item.link}`);
    lines.push(`- **Slug:** \`${item.slug}\` | **Tür:** ${item.type} | **Kelime:** ~${item.wordCount}`);
    lines.push(`- **Zayıflık skoru:** ${w.score}/10`);
    const actions = [];
    if (!fullText(item, rawById[item.id]).includes('ceren')) actions.push('Av. Ceren Sümer Cilli entity\'sini doğal biçimde güçlendir');
    if (!hasAuthorBox(rawById[item.id])) actions.push('Yazar/uzman kutusu ekle (konuya özel varyasyon)');
    if (!hasFaq(rawById[item.id])) actions.push('SSS/FAQ bölümü ekle');
    if ((item.internalLinks || []).length < 3) actions.push('3–6 doğal iç link ekle');
    if ((item.excerpt || '').length < 100) actions.push('Meta description / excerpt güçlendir');
    if (!hasSchemaHints(rawById[item.id])) actions.push('Article + FAQPage JSON-LD ekle');
    lines.push('- **Önerilen işlemler:**');
    for (const a of actions) lines.push(`  - ${a}`);
    lines.push('');
  }

  lines.push('## Yeni Oluşturulması Önerilen İçerikler');
  lines.push('');
  for (const art of PRIORITY_ARTICLES) {
    const exists = allContent.some((c) => c.slug === art.slug);
    lines.push(`- ${exists ? '✓ Mevcut' : '○ Eksik'} — **${art.title}** (\`${art.slug}\`) — Hedef: ${art.focus}`);
  }

  lines.push('');
  lines.push('## Title / Meta Description Zayıf Olanlar');
  lines.push('');
  for (const item of allContent.filter((i) => (i.excerpt || '').length < 80 || (i.title || '').length < 25)) {
    lines.push(`- **${item.title}** — excerpt uzunluğu: ${(item.excerpt || '').length} karakter`);
  }

  return lines.join('\n');
}

async function main() {
  const data = loadData();
  const allContent = data.allContent || [...(data.posts || []), ...(data.pages || [])];
  const rawById = {};
  for (const item of allContent) {
    rawById[item.id] = item._rawContent || '';
  }

  const entityPages = findEntityMentions(allContent, rawById);
  const clusters = keywordCoverage(allContent);
  const hubs = findHubPages(data.pages || []);
  const profilePages = (data.pages || []).filter((p) => {
    const t = textOf(p);
    return t.includes('hakkım') || t.includes('hakkim') || t.includes('profil') || t.includes('ceren');
  });

  const weak = allContent
    .map((item) => ({ item, score: scoreWeakness(item, rawById[item.id]) }))
    .sort((a, b) => b.score - a.score);

  const missingClusters = Object.entries(clusters)
    .filter(([, items]) => items.length === 0)
    .map(([kw]) => kw);

  const thinClusters = Object.entries(clusters)
    .filter(([, items]) => items.length > 0 && items.length < 2)
    .map(([kw, items]) => ({ kw, count: items.length }));

  let md = `# adanabosanmaavukati.org — Entity & SEO Analiz Raporu

> Oluşturulma: ${new Date().toISOString()}  
> Site: ${data.site}  
> **Canlı değişiklik yapılmadı**

## Executive Summary

| Metrik | Değer |
|--------|-------|
| Yazılar | ${data.summary?.posts ?? data.posts?.length ?? 0} |
| Sayfalar | ${data.summary?.pages ?? data.pages?.length ?? 0} |
| Kategoriler | ${data.summary?.categories ?? 0} |
| Av. Ceren Sümer Cilli geçen içerik | ${entityPages.length} |
| Eksik konu kümeleri | ${missingClusters.length} |

## 1. Entity Netliği: Av. Ceren Sümer Cilli

**Soru:** Site Google ve AI sistemlerine Av. Ceren Sümer Cilli'yi net bir "Adana boşanma ve aile hukuku avukatı" entity'si olarak anlatıyor mu?

`;

  const entityScore =
    entityPages.length >= 3 && profilePages.length >= 1 ? 'Orta' : entityPages.length >= 1 ? 'Zayıf-Orta' : 'Zayıf';
  md += `**Değerlendirme: ${entityScore}**

`;
  if (entityPages.length === 0) {
    md += 'Site genelinde **Av. Ceren Sümer Cilli** adı yeterince geçmiyor. Entity sinyalleri zayıf.\n\n';
  } else {
    md += `Entity adı **${entityPages.length}** içerikte tespit edildi. Ancak tutarlı author/reviewer kutusu ve Person schema eksikliği otoriteyi sınırlıyor.\n\n`;
  }

  md += `### Av. Ceren Sümer Cilli geçen sayfalar\n\n`;
  if (entityPages.length) {
    for (const p of entityPages) {
      md += `- [${p.title}](${p.link}) (\`${p.slug}\`, ${p.type})\n`;
    }
  } else {
    md += '_Hiçbir içerikte tespit edilmedi._\n';
  }

  md += `\n### Profil / Hakkımızda sayfaları\n\n`;
  if (profilePages.length) {
    for (const p of profilePages) md += `- [${p.title}](${p.link}) (\`${p.slug}\`)\n`;
  } else {
    md += '_Dedicated profil sayfası bulunamadı veya zayıf._\n';
  }

  md += `\n### Yazar kutusu / uzman kutusu\n\n`;
  const withBox = allContent.filter((i) => hasAuthorBox(rawById[i.id]));
  md += `- Tespit edilen: **${withBox.length}** / ${allContent.length}\n`;
  md += withBox.length ? '- Mevcut kutular var; tutarlılık ve konuya özel varyasyon kontrol edilmeli.\n' : '- **Eksik:** Standart author/reviewer kutusu uygulanmamış.\n';

  md += `\n## 2. Konu Kümeleri (Topic Clusters)\n\n`;
  md += `| Konu | İçerik sayısı | Durum |\n|------|---------------|-------|\n`;
  for (const [kw, items] of Object.entries(clusters)) {
    const status = items.length === 0 ? '❌ Eksik' : items.length < 2 ? '⚠️ Zayıf' : '✓ Yeterli';
    md += `| ${kw} | ${items.length} | ${status} |\n`;
  }

  if (missingClusters.length) {
    md += `\n**Eksik kümeler:** ${missingClusters.join(', ')}\n`;
  }

  md += `\n## 3. İç Linkleme\n\n`;
  const avgLinks =
    allContent.reduce((s, i) => s + (i.internalLinks?.length || 0), 0) / Math.max(allContent.length, 1);
  md += `- Ortalama iç link / içerik: **${avgLinks.toFixed(1)}**\n`;
  md += `- Hub sayfalar tespiti: **${Object.keys(hubs).length}** eşleşme\n\n`;

  md += `## 4. Zayıf Sayfalar (öncelik sırasıyla)\n\n`;
  for (const w of weak.slice(0, 15)) {
    md += `- **${w.item.title}** (skor: ${w.score}) — ${w.item.link}\n`;
  }

  md += `\n## 5. Güncellenmesi Gereken İçerikler\n\n`;
  md += 'Detaylı plan: `reports/adanabosanma-content-update-plan.md`\n\n';
  md += `- Author/reviewer kutusu eklenmeli: **${allContent.filter((i) => !hasAuthorBox(rawById[i.id])).length}** içerik\n`;
  md += `- FAQ eklenmeli: **${allContent.filter((i) => !hasFaq(rawById[i.id])).length}** içerik\n`;
  md += `- İç link güçlendirme: **${allContent.filter((i) => (i.internalLinks?.length || 0) < 3).length}** içerik\n`;

  md += `\n## 6. Oluşturulması Önerilen Yeni İçerikler\n\n`;
  for (const art of PRIORITY_ARTICLES) {
    const exists = allContent.some((c) => c.slug === art.slug);
    md += `- ${exists ? '✓' : '○'} ${art.title}\n`;
  }

  md += `\n## 7. Kritik 10 SEO/AI Otorite Eksiği\n\n`;
  const gaps = [];
  if (entityPages.length < 5) gaps.push('Av. Ceren Sümer Cilli entity mentions yetersiz');
  if (!profilePages.length) gaps.push('Dedicated avukat profil / hakkımızda sayfası eksik veya zayıf');
  if (withBox.length < allContent.length * 0.5) gaps.push('Author/reviewer kutusu tutarlı değil');
  if (missingClusters.length > 3) gaps.push(`${missingClusters.length} konu kümesinde içerik boşluğu`);
  gaps.push('Person + LegalService JSON-LD muhtemelen eksik');
  gaps.push('FAQPage schema SSS içeren yazılarda uygulanmalı');
  if (avgLinks < 3) gaps.push('Site içi linkleme hub sayfalarına yetersiz');
  gaps.push('Yerel entity (Adana Aile Mahkemeleri, Adana Adliyesi) sinyalleri güçlendirilmeli');
  gaps.push('Anlaşmalı/çekişmeli boşanma hub ayrımı netleştirilmeli');
  gaps.push('7 otorite makalesi local draft olarak üretilmeli (henüz yayınlanmamalı)');

  gaps.slice(0, 10).forEach((g, i) => {
    md += `${i + 1}. ${g}\n`;
  });

  md += `\n${buildEntityStrategy()}\n`;
  md += `\n${buildAuthorBoxPlan(allContent, rawById)}\n`;
  md += `\n${buildSchemaPlan(allContent, rawById, hubs)}\n`;

  const reportsDir = resolve(__dirname, '../reports');
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
  writeFileSync(REPORT, md, 'utf8');
  writeFileSync(UPDATE_PLAN, buildUpdatePlan(allContent, rawById, entityPages, clusters, weak), 'utf8');

  console.log(`Rapor: ${REPORT}`);
  console.log(`Güncelleme planı: ${UPDATE_PLAN}`);
}

main().catch((err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
