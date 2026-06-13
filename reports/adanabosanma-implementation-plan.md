# adanabosanmaavukati.org — Uygulama Planı ve Sonuç

> 2026-06-13T22:15:00.000Z

## Mod
**CANLI UYGULAMA** tamamlandı (Ay 1 öncelikleri)

## Yapılan İşlemler

### Author box + entity (13/13 yazı)
- **post 26, 131, 134, 158, 159, 160** — konuya özel yazar/hukuki değerlendirme kutusu
- **post 143–149** — daha önce enhance:publish ile eklenmişti (korundu)

### Dış link temizliği (13/13 yazı ext:0)
- **post 131** — `cerenavukat.com` → profil sayfası
- **post 134** — `arsiv.*` → rehber sayfası
- **post 158** — `adanabosanmaavukati.at` → `/adana-velayet-davasi/`

### İç link güçlendirme
- **post 26, 131, 134** — ek paragraflarla 6 iç linke çıkarıldı
- **post 26, 131, 134** — profil, iletişim, ilgili rehberler bağlandı

### Meta düzeltme
- **post 160** — meta description yumuşatıldı (“danışmanlığı alın” kaldırıldı)

### UX / bilgi mimarisi
- **page 98** (`hizmetler`) — “Bilgilendirme Rehberleri” bölümü (9 yazı linki)
- **page 15** (`avukat-ceren-sumer-cilli`) — kompakt 2 sütun rehberler listesi

## Denetim Özeti (13 yazı)

| Metrik | Durum |
|--------|-------|
| Author box | 13/13 |
| Dış link | 0 (tüm yazılar) |
| İç link min | 6 (eski yazılar) |
| İç link max | 12 (158) |

## Schema
Tüm yayın yazıları için JSON-LD önerileri: `reports/schema-live/`

**Manuel adım (Rank Math paneli):**
1. Person → `/avukat-ceren-sumer-cilli/`
2. Article + FAQPage → blog yazıları
3. BreadcrumbList → site geneli

Telefon, adres, baro sicil gibi alanları sitede doğrulanmıyorsa schema’ya eklemeyin.

## Dokunulmayan Sayfalar
- Ana sayfa (`/adana-bosanma-avukati/`) — içerik değiştirilmedi
- `/hakkimizda/` — içerik değiştirilmedi

## Kullanılabilir Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run apply:seo` | Dry-run (değişiklik önizleme) |
| `npm run apply:seo -- --execute` | Ay 1 iyileştirmeleri |
| `npm run strengthen:legacy` | Eski 3 yazı link dry-run |
| `npm run strengthen:legacy -- --execute` | Eski 3 yazı link canlı |
| `node scripts/fix-external-links.mjs` | Dış link düzeltme |
| `node scripts/audit-posts.mjs` | Yazı denetimi |

## Sonraki Adımlar (Ay 2 — onay gerekir)

1. Ziynet alacağı rehberi (yeni yazı)
2. Nafaka alt türleri: tedbir / yoksulluk / iştirak (1 veya 3 yazı)
3. Velayet hub sayfası (landing + mevcut yazılara link)
4. Mal paylaşımı hub sayfası
5. 6284 / uzaklaştırma hub (149 numaralı yazı merkez)
6. Hub–yazı canonical netleştirme (çekişmeli boşanma kümesi)
7. Google Search Console + sitemap gönderimi (manuel)
