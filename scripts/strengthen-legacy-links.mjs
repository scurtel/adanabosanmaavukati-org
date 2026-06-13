#!/usr/bin/env node
import { wpFetch } from './lib/wp-fetch.mjs';
import { getWpConfig } from './lib/env.mjs';
import { extractInternalLinks } from './lib/link-map.mjs';

const BASE = getWpConfig().baseUrl.replace(/\/$/, '');
const EXECUTE = process.argv.includes('--execute');

const EXTRA = {
  26: [
    {
      url: `${BASE}/velayet-davasinda-hakim-karar-kriterleri-2026-7191/`,
      p: `<p>Hakimin velayet kararında dikkate aldığı kriterler için <a href="${BASE}/velayet-davasinda-hakim-karar-kriterleri-2026-7191/">velayet davasında hakim karar kriterleri</a> rehberini inceleyebilirsiniz.</p>`,
    },
    {
      url: `${BASE}/adanada-velayet-davasinda-cocugun-ustun-yarari/`,
      p: `<p>Çocuğun üstün yararı ilkesi hakkında ayrıntılı bilgi için <a href="${BASE}/adanada-velayet-davasinda-cocugun-ustun-yarari/">velayet davasında çocuğun üstün yararı</a> rehberini okuyabilirsiniz.</p>`,
    },
  ],
  131: [
    {
      url: `${BASE}/adanada-bosanma-davasi-nasil-acilir/`,
      p: `<p>Boşanma davasının genel açılış adımları için <a href="${BASE}/adanada-bosanma-davasi-nasil-acilir/">Adana'da boşanma davası nasıl açılır</a> rehberine bakabilirsiniz.</p>`,
    },
    {
      url: `${BASE}/iletisim/`,
      p: `<p>Delil ve ispat stratejisi hakkında somut bilgi için <a href="${BASE}/iletisim/">iletişim</a> kanalından bilgi alabilirsiniz.</p>`,
    },
    {
      url: `${BASE}/adanada-cekismeli-bosanma-davasi-ne-kadar-surer/`,
      p: `<p>Çekişmeli boşanma süresi hakkında <a href="${BASE}/adanada-cekismeli-bosanma-davasi-ne-kadar-surer/">Adana'da çekişmeli boşanma davası ne kadar sürer</a> yazısını okuyabilirsiniz.</p>`,
    },
  ],
  134: [
    {
      url: `${BASE}/adana-velayet-davasi/`,
      p: `<p>Velâyet davasının genel çerçevesi için <a href="${BASE}/adana-velayet-davasi/">Adana velayet davası</a> rehberine göz atabilirsiniz.</p>`,
    },
    {
      url: `${BASE}/avukat-ceren-sumer-cilli/`,
      p: `<p>Velâyet ve aile hukuku alanında <a href="${BASE}/avukat-ceren-sumer-cilli/">Av. Ceren Sümer Cilli</a> tarafından hazırlanan diğer bilgilendirme içeriklerine de ulaşabilirsiniz.</p>`,
    },
  ],
};

function appendIfMissing(html, url, paragraph) {
  if (html.includes(url)) return { html, changed: false };
  const marker = /(<div class="author-note"|<h2[^>]*>\s*Sık Sorulan|<h2[^>]*>\s*Sıkça Sorulan)/i;
  if (marker.test(html)) {
    return { html: html.replace(marker, `${paragraph}\n$1`), changed: true };
  }
  return { html: html.trim() + `\n\n${paragraph}`, changed: true };
}

async function main() {
  const host = new URL(BASE).hostname;
  console.log(EXECUTE ? 'CANLI — eski yazılara ek iç linkler' : 'DRY-RUN');

  for (const [idStr, links] of Object.entries(EXTRA)) {
    const id = Number(idStr);
    const res = await wpFetch(`/wp-json/wp/v2/posts/${id}?context=edit`);
    const post = await res.json();
    let html = post.content.raw;
    const added = [];

    for (const link of links) {
      const r = appendIfMissing(html, link.url, link.p);
      if (r.changed) {
        html = r.html;
        added.push(link.url.split('/').slice(-2, -1)[0]);
      }
    }

    const count = extractInternalLinks(html, host).length;
    console.log(`Post ${id}: +${added.length} paragraf, toplam ${count} iç link`);

    if (added.length && EXECUTE) {
      await wpFetch(`/wp-json/wp/v2/posts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: html, status: 'publish' }),
      });
    }
  }
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
