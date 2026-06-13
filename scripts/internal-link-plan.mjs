#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HUB_SLUGS } from './lib/content-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../data/adanabosanma-content.json');
const REPORT = resolve(__dirname, '../reports/adanabosanma-internal-link-plan.md');

const ANCHOR_POOL = [
  { text: 'Adana boşanma avukatı', targets: ['adana-bosanma-avukati', ''] },
  { text: 'Adana aile hukuku avukatı', targets: ['adana-aile-hukuku-avukati', 'adana-bosanma-avukati'] },
  { text: 'Av. Ceren Sümer Cilli', targets: ['hakkimizda', 'av-ceren-sumer-cilli', 'ceren-sumer-cilli'] },
  { text: 'anlaşmalı boşanma davası', targets: ['anlasmali-bosanma', 'anlasmali-bosanma-avukati'] },
  { text: 'çekişmeli boşanma davası', targets: ['cekismeli-bosanma', 'cekismeli-bosanma-avukati'] },
  { text: 'nafaka davası', targets: ['nafaka', 'nafaka-avukati'] },
  { text: 'velayet davası', targets: ['velayet', 'velayet-avukati'] },
  { text: 'mal paylaşımı davası', targets: ['mal-paylasimi', 'mal-paylasimi-avukati'] },
  { text: 'uzaklaştırma kararı', targets: ['uzaklastirma-karari'] },
  { text: 'boşanma sürecinde hukuki destek', targets: ['iletisim', 'contact', 'adana-bosanma-avukati'] },
];

function topicOf(item) {
  const t = `${item.title} ${item.slug} ${(item.categories || []).map((c) => c.name).join(' ')}`.toLowerCase();
  if (t.includes('nafaka')) return 'nafaka';
  if (t.includes('velayet')) return 'velayet';
  if (t.includes('mal')) return 'mal';
  if (t.includes('uzaklaş') || t.includes('6284')) return 'uzaklastirma';
  if (t.includes('anlaşmal') || t.includes('anlasmali')) return 'anlasmali';
  if (t.includes('çekişmel') || t.includes('cekismeli')) return 'cekismeli';
  return 'bosanma';
}

function resolveHub(pages, slugCandidates) {
  for (const slug of slugCandidates) {
    const p = pages.find((x) => x.slug === slug || x.slug.includes(slug));
    if (p) return p;
  }
  return null;
}

function suggestLinks(item, pages, usedAnchors) {
  const topic = topicOf(item);
  const suggestions = [];
  const existingHrefs = new Set((item.internalLinks || []).map((l) => l.href));

  const topicAnchors = {
    nafaka: ['nafaka davası', 'Adana aile hukuku avukatı', 'Av. Ceren Sümer Cilli'],
    velayet: ['velayet davası', 'Adana aile hukuku avukatı', 'Av. Ceren Sümer Cilli'],
    mal: ['mal paylaşımı davası', 'Adana boşanma avukatı', 'Av. Ceren Sümer Cilli'],
    uzaklastirma: ['uzaklaştırma kararı', 'Adana aile hukuku avukatı'],
    anlasmali: ['anlaşmalı boşanma davası', 'Adana boşanma avukatı', 'Av. Ceren Sümer Cilli'],
    cekismeli: ['çekişmeli boşanma davası', 'Adana boşanma avukatı'],
    bosanma: ['Adana boşanma avukatı', 'anlaşmalı boşanma davası', 'çekişmeli boşanma davası', 'Av. Ceren Sümer Cilli'],
  };

  const preferred = topicAnchors[topic] || topicAnchors.bosanma;
  for (const anchorText of preferred) {
    if (suggestions.length >= 5) break;
    const pool = ANCHOR_POOL.find((a) => a.text === anchorText);
    if (!pool) continue;
    const hub = resolveHub(pages, pool.targets);
    if (!hub || hub.id === item.id) continue;
    if (existingHrefs.has(hub.link)) continue;
    if (usedAnchors.has(`${item.id}:${anchorText}`)) continue;
    suggestions.push({ anchor: anchorText, targetTitle: hub.title, targetUrl: hub.link, targetSlug: hub.slug });
    usedAnchors.add(`${item.id}:${anchorText}`);
  }

  if (suggestions.length < 3) {
    const contact = resolveHub(pages, ['iletisim', 'contact']);
    if (contact && !existingHrefs.has(contact.link) && suggestions.length < 6) {
      suggestions.push({
        anchor: 'boşanma sürecinde hukuki destek',
        targetTitle: contact.title,
        targetUrl: contact.link,
        targetSlug: contact.slug,
      });
    }
  }

  return suggestions;
}

async function main() {
  if (!existsSync(DATA)) throw new Error('Önce npm run fetch:wp çalıştırın.');
  const data = JSON.parse(readFileSync(DATA, 'utf8'));
  const allContent = data.allContent || [...data.posts, ...data.pages];
  const pages = data.pages || [];
  const usedAnchors = new Set();

  const hubInventory = HUB_SLUGS.map((slug) => {
    const p = pages.find((x) => x.slug === slug || (slug && x.slug.includes(slug)));
    return { slug: slug || '(anasayfa)', found: !!p, title: p?.title, url: p?.link };
  });

  let md = `# adanabosanmaavukati.org — İç Linkleme Planı

> Oluşturulma: ${new Date().toISOString()}  
> **Canlı değişiklik yapılmadı — yalnızca öneri**

## Hub Sayfa Envanteri

| Hedef slug | Bulundu | Başlık |
|------------|---------|--------|
`;

  for (const h of hubInventory) {
    md += `| ${h.slug} | ${h.found ? '✓' : '✗'} | ${h.title || '—'} |\n`;
  }

  md += `\n## İçerik Bazlı Link Önerileri\n\n`;
  md += `_Her yazı için 3–6 doğal iç link hedeflenmiştir. Aynı anchor tekrarından kaçınılmalıdır._\n\n`;

  for (const item of allContent.filter((i) => i.type === 'post' || i.slug !== 'iletisim')) {
    const links = suggestLinks(item, [...pages, ...allContent], usedAnchors);
    if (!links.length) continue;
    md += `### ${item.title}\n`;
    md += `- **Kaynak:** ${item.link}\n`;
    md += `- **Mevcut iç link:** ${(item.internalLinks || []).length}\n`;
    md += `- **Önerilen linkler:**\n`;
    for (const l of links) {
      md += `  - Anchor: "${l.anchor}" → [${l.targetTitle}](${l.targetUrl}) (\`${l.targetSlug}\`)\n`;
    }
    md += '\n';
  }

  md += `## Genel Kurallar\n\n`;
  md += `- Sayfa başına 3–6 iç link yeterli\n`;
  md += `- Aynı anchor metnini site genelinde aşırı tekrarlama\n`;
  md += `- Hub sayfalar (boşanma, nafaka, velayet, profil, iletişim) öncelikli hedef\n`;
  md += `- Uygulama öncesi manuel onay gerekir\n`;

  const dir = dirname(REPORT);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(REPORT, md, 'utf8');
  console.log(`Plan kaydedildi: ${REPORT}`);
}

main().catch((err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
