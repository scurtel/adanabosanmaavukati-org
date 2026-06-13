# Ay 1 Canlı Kalite Kontrol Raporu

> **Tarih:** 2026-06-13  
> **Site:** https://adanabosanmaavukati.org  
> **Yöntem:** WordPress REST API (`context=edit`) + canlı HTML fetch + tarayıcı (masaüstü 1280px / mobil 390px)  
> **Kapsam:** 13 yayın yazısı, `/hizmetler/` (ID 98), `/avukat-ceren-sumer-cilli/` (ID 15)  
> **Canlı değişiklik yapılmadı.**

---

## Genel Durum

Ay 1 SEO uygulamalarının büyük kısmı yazı gövdelerinde başarıyla yansımış durumda:

| Metrik | Sonuç |
|--------|-------|
| Denetlenen yazı | 13/13 |
| Yazı gövdesinde dış link | **0** |
| Author / uzman kutusu (canlıda görünür) | **13/13** |
| Kırık iç link (21 benzersiz URL test edildi) | **0** |
| Boş anchor (yazı gövdeleri) | **0** |

**Ancak** iki önemli sapma tespit edildi:

1. **`/hizmetler/` sayfasındaki “Bilgilendirme Rehberleri” bölümü canlıda görünmüyor** — WordPress `content.raw` alanında mevcut, fakat sayfa Elementor ile render edildiği için bu HTML ön yüzde basılmıyor.
2. **158, 159, 160 numaralı yazılarda çift H1** — Tema başlığı + içerikteki `<h1>` birlikte render ediliyor.

Bu iki konu giderilmeden Ay 1’in “tamamlandı” sayılması önerilmez.

---

## Kritik Hata Var mı?

### Evet — 1 kritik, 2 orta öncelik

| Öncelik | Sorun | Etki |
|---------|-------|------|
| **Kritik** | `/hizmetler/` rehber bölümü canlıda yok | Ay 1 UX / iç link omurgası hedefi karşılanmadı |
| **Orta** | Post **158, 159, 160** — sayfa başına **2 adet H1** | SEO / erişilebilirlik (tek H1 kuralı) |
| **Orta** | Author kutusu **tasarım tutarsızlığı** (143–149 vs 26/131/134/158–160) | E-E-A-T sinyali var ama görsel/marka tutarlılığı zayıf |

**Bloker olmayan uyarılar:**

- Post **26**: Aynı profile giden tekrarlayan link (2× “Avukat Ceren Sümer Cilli”).
- `/hizmetler/` Elementor kart ızgarasında **boş anchor’lu link** (görsel/thumbnail linki, metinsiz).
- Profil sayfası mobilde 2 sütun CSS hâlâ aktif — **bozulma yok**, ancak dar ekranda sıkışık.

---

## Dış Link Kontrolü

### Yazı gövdeleri (13/13) — TEMİZ

WordPress `content.raw` ve canlı HTML birlikte tarandı. **Hiçbir yazı gövdesinde** `cerenavukat.com`, `adanabosanmaavukati.at` veya başka harici alan adı kalmadı.

| Yazı ID | Slug | Gövdede dış link |
|---------|------|------------------|
| 26 | adana-velayet-davasi | 0 |
| 131 | aldatma-zina-…-1002 | 0 |
| 134 | velayet-davasinda-hakim-… | 0 |
| 143–149 | (7 otorite yazısı) | 0 |
| 158–160 | (3 yeni SEO yazısı) | 0 |

**Not:** Sayfa `<head>` / footer / tema kaynaklı `gmpg.org/xfn/11`, `wa.me/…` gibi global linkler vardır; bunlar yazı içeriği değildir ve beklenen davranıştır.

### Spot kontroller

| Kontrol | Beklenen | Canlı sonuç |
|---------|----------|-------------|
| **Post 158** — `.at` domain kaldırıldı mı? | Evet | **Evet** — `adanabosanmaavukati.at` yok |
| **Post 158** — velayet iç linki | `/adana-velayet-davasi/` | **Evet** — `https://adanabosanmaavukati.org/adana-velayet-davasi/` |
| **Post 131** — `cerenavukat.com` | Profil sayfasına yönlensin | **Evet** — `cerenavukat.com` yok; 2 adet `/avukat-ceren-sumer-cilli/` iç linki var |

---

## Author Box Kontrolü

### Görünürlük: 13/13 — geçti

Tüm yazılarda canlıda author/uzman kutusu render ediliyor.

### Tasarım tutarlılığı: kısmen geçti

**Ay 1 standardı** (26, 131, 134, 158, 159, 160):

- `class="author-note"` + inline stil (gri kutu, sol border)
- Başlık: **“Yazar / Hukuki Değerlendirme”**
- “hukuki tavsiye niteliği taşımaz” uyarısı

**Enhance:publish batch** (143, 144, 145, 146, 147, 149 — ve kısmen 148):

- `class="author-note"` var
- Başlık: **“Yazar Notu: Av. Ceren Sümer Cilli”** (farklı format)
- Inline kutu stili yok (düz `<div>`)
- Bazılarında standart hukuki uyarı metni eksik

| Grup | Yazı ID | Canlıda görünür | Standart Ay 1 formatı |
|------|---------|-----------------|----------------------|
| Ay 1 batch | 26, 131, 134, 158, 159, 160 | Evet | **Evet** |
| Publish batch | 143, 144, 145, 146, 147, 149 | Evet | **Hayır** |
| Karma | 148 | Evet | Kısmen (disclaimer var, başlık farklı) |

**Sonuç:** Entity sinyali mevcut; tasarım ve metin standardizasyonu Ay 2 öncesi önerilir.

---

## İç Link Kontrolü

### Kırık link: yok

Yazılardan çıkarılan **21 benzersiz iç URL** canlıda HTTP 200 döndü.

### Boş anchor: yazılarda yok

13 yazının `content.raw` alanında boş `<a>` etiketi tespit edilmedi.

### Duplicate H1

| Yazı ID | Canlı H1 sayısı | Durum |
|---------|-----------------|-------|
| 26, 131, 134, 143–149 | 1 | OK (H1 tema tarafından) |
| **158** | **2** | Tema + içerik H1 |
| **159** | **2** | Tema + içerik H1 |
| **160** | **2** | Tema + içerik H1 |

158/159/160 içeriğinde `<h1>` kullanılmış; Astra/tema zaten yazı başlığını H1 olarak basıyor.

### Aşırı tekrar eden anchor

4+ tekrar eşiğiyle **kritik spam anchor yok**.

Hafif tekrarlar (izleme önerisi):

| Yazı | Tekrar | Anchor |
|------|--------|--------|
| 26 | 2× | “Avukat Ceren Sümer Cilli” → profil |
| 144, 146, 148, 149, 159 | 2× | “Av. Ceren Sümer Cilli” → profil |

Post **131** profil linklerinde anchor metni bağlam dışı (“içerik arşivine”, uzun başlık metni) — boş değil, UX açısından iyileştirilebilir.

### İç link sayıları (yazı gövdesi)

| ID | Slug | İç link |
|----|------|---------|
| 26 | adana-velayet-davasi | 6 |
| 131 | aldatma-zina-… | 6 |
| 134 | velayet-hakim-… | 6 |
| 143 | bosanma-davasi-nasil-acilir | 10 |
| 144–149 | … | 9–11 |
| 158 | cekismeli-bosanma-davasi | 12 |
| 159 | ortakligin-giderilmesi | 8 |
| 160 | miras-davalari | 7 |

Hedef aralık (6–9) dışında kalanlar: 143 (10), 146 (10), 148 (11), 158 (12) — kritik değil, izlenebilir.

---

## Mobil UX Kontrolü

### `/hizmetler/` — Bilgilendirme Rehberleri

| Viewport | Rehber bölümü | Elementor yazı ızgarası |
|----------|---------------|-------------------------|
| Masaüstü (~1280px) | **Görünmüyor** | Görünüyor (13 yazı kartı) |
| Mobil (390px) | **Görünmüyor** | Görünüyor |

**Kök neden:** Sayfa Elementor ile oluşturulmuş. `apply:seo` scripti `content.raw` alanına HTML eklemiş; Elementor sayfalarında ön yüz render’ı `_elementor_data` meta alanından gelir, `content.raw` yok sayılır.

WordPress admin’de `content.raw` içeriği yalnızca rehber `<div>` iken (~1524 karakter), canlı HTML’de `ceren-rehberler` / “Bilgilendirme Rehberleri” string’i **hiç yok**.

**Sonuç:** Ay 1 hedefi **canlıda karşılanmadı**. Düzeltme Elementor editöründe widget/HTML bloğu olarak eklenmeli veya sayfa Elementor dışı render kullanacak şekilde yapılandırılmalı.

### `/avukat-ceren-sumer-cilli/` — 2 sütun rehber listesi

| Viewport | Bölüm | Sonuç |
|----------|-------|-------|
| Masaüstü | `ceren-rehberler-compact` — 9 link, 2 sütun | **Düzgün** |
| Mobil (390px) | `columns: 2` aktif, 9 madde ~5 satır | **Bozulma yok**, dar ekranda sıkışık ama okunabilir |

Mobilde tek sütuna düşmüyor (`column-count: 2` korunuyor). Kritik layout kırığı yok; `@media (max-width: 600px) { columns: 1 }` ile iyileştirilebilir.

---

## Schema Manuel Adım Notları

Local JSON-LD dosyaları `reports/schema-live/` altında 13 yazı için hazır.

**Canlı Rank Math / tema schema durumu bu denetimde otomatik doğrulanmadı** (REST API schema çıktısı tutarsız olabilir).

Manuel kontrol listesi:

1. **Person schema** → `/avukat-ceren-sumer-cilli/` (profil sayfasında `@graph` Person bloğu canlı HTML’de görülüyor — kısmen mevcut)
2. **Article + FAQPage** → her blog yazısı (Rank Math panelinden)
3. **BreadcrumbList** → site geneli
4. Doğrulanmamış alanları (baro sicil no, adres vb.) schema’ya **eklemeyin**

Schema dosyaları referans: `reports/schema-live/post-{id}-{slug}.json`

---

## Ay 2’ye Geçilebilir mi?

### Öneri: **Koşullu evet** — 2 düzeltme sonrası tam geçiş

| Durum | Açıklama |
|-------|----------|
| **Ay 2 taslak üretimine başlanabilir mi?** | **Evet** — yeni içerik üretimi mevcut yazıları bozmaz |
| **Ay 1 tam kapanış onayı** | **Hayır** — `/hizmetler/` rehber bölümü canlıda eksik |
| **Publish / toplu canlı müdahale** | Önce aşağıdaki 2 fix önerilir |

### Ay 2 öncesi önerilen düzeltmeler (öncelik sırası)

1. **`/hizmetler/`** — “Bilgilendirme Rehberleri” bölümünü Elementor HTML/widget ile canlıya al (veya Elementor şablonuna entegre et)
2. **Post 158, 159, 160** — içerikteki `<h1>` → `<h2>` (tema H1’i korunsun)
3. *(Opsiyonel)* Post 143–149 author kutularını Ay 1 standardına hizala
4. *(Opsiyonel)* Profil mobil rehber listesinde `columns: 1` media query

### Ay 2 içerik planı (değişmedi)

1. Ziynet alacağı rehberi  
2. Nafaka alt türleri (tedbir / yoksulluk / iştirak)  
3. Velayet hub sayfası  
4. Mal paylaşımı hub sayfası  
5. 6284 / uzaklaştırma hub  

---

## Denetim Özeti Tablosu

| # | Kontrol maddesi | Sonuç |
|---|-----------------|-------|
| 1 | 13 yazıda gövde dış linki | **Geçti** (0) |
| 2 | Author kutusu görünür + tasarım | **Kısmen** (görünür 13/13, tasarım tutarsız) |
| 3 | `/hizmetler/` rehber bölümü | **KALDI** (canlıda yok) |
| 4 | Profil 2 sütun mobil | **Geçti** (bozulma yok, iyileştirme opsiyonel) |
| 5 | Post 158 `.at` → velayet iç link | **Geçti** |
| 6 | Post 131 cerenavukat → profil | **Geçti** |
| 7 | Kırık link / boş anchor / çift H1 / anchor spam | **Kısmen** (çift H1: 158–160) |

---

*Rapor yalnızca okuma/denetim amaçlıdır; canlı sitede değişiklik yapılmamıştır.*
