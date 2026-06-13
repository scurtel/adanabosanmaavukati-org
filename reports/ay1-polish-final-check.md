# Ay 1 Polish — Final Doğrulama Raporu

> **Tarih:** 2026-06-13T22:27:50.887Z  
> **Mod:** CANLI UYGULAMA  
> **Site:** https://adanabosanmaavukati.org

## Yedek

`data/backups/ay1-polish-2026-06-13T22-27-41-401Z`

- Profil sayfası (ID 15) — tam `content.raw`
- Post 143–149 — tam `content.raw`, slug ve title

---

## Uygulanan Değişiklikler

### İş 1 — Profil mobil rehber

| Adım | Sonuç |
|------|-------|
| WordPress `custom_css` REST (`/wp-json/wp/v2/settings`) | POST 200 döndü; canlı HTML'de `#wp-custom-css` veya `@media 640px` **basılmadı** |
| Elementor Custom Code snippet | Daha önce test edildi — CSS canlıya yansımadı |
| **Uygulanan çözüm** | Profil rehber bölümü Gutenberg `wp:columns` + `isStackedOnMobile` ile yeniden yapılandırıldı; filtrelenen `<style>` bloğu kaldırıldı; inline `columns:2` kaldırıldı |

9 rehber linki aynı URL ve anchor metinleriyle korundu (5 + 4 sütun; mobilde stack).

### İş 2 — Author kutuları (143–149)

7 yazıda mevcut yazar/yazar notu bölümü Ay 1 standardına çevrildi. Gövde metni, H1, title, slug ve mevcut iç linkler korundu.

| ID | Slug | Sonuç |
|----|------|-------|
| 143 | `adanada-bosanma-davasi-nasil-acilir` | replaced ✓ |
| 144 | `adanada-anlasmali-bosanma-protokolu` | replaced ✓ |
| 145 | `adanada-cekismeli-bosanma-davasi-ne-kadar-surer` | replaced ✓ |
| 146 | `adanada-nafaka-davasi-ve-nafaka-artirim-sureci` | replaced ✓ |
| 147 | `adanada-velayet-davasinda-cocugun-ustun-yarari` | replaced ✓ |
| 148 | `bosanmada-mal-paylasimi-ve-katilma-alacagi` | replaced ✓ |
| 149 | `adanada-uzaklastirma-karari-nasil-alinir` | replaced ✓ |

**Ay 1 author kutusu standardı:**
- `class="author-note"` + gri kutu stili
- Başlık: **Yazar / Hukuki Değerlendirme**
- Profil iç linki: `/avukat-ceren-sumer-cilli/`
- Uyarı: *"Bu yazı genel bilgilendirme amacı taşır; hukuki tavsiye niteliğinde değildir."*

---

## Doğrulama Tablosu

| # | Kontrol | Sonuç | Not |
|---|---------|-------|-----|
| 1 | Profil canlıda mobil CSS / responsive yapı | **Geçti** | `is-stacked-on-mobile` + `ceren-rehberler-columns` canlı HTML'de; eski `<style>` tag yok |
| 2 | 640px altında tek sütun akışı | **Geçti** | 390px viewport: 2 sütun stack, her sütun ~321px tam genişlik; 9 link dikey akış |
| 3 | 143–149 `author-note` class | **Geçti** | 7/7 |
| 4 | 143–149 “Yazar / Hukuki Değerlendirme” | **Geçti** | 7/7 (canlı HTML spot check: post 143) |
| 5 | 143–149 disclaimer metni | **Geçti** | 7/7 — *hukuki tavsiye niteliğinde değildir* |
| 6 | H1 sayısı = 1 | **Geçti** | 7/7 yazı |
| 7 | Title/slug değişmedi | **Geçti** | Yalnızca `content` güncellendi |
| 8 | Dış link eklenmedi | **Geçti** | Yazı gövdelerinde 0 dış link |
| 9 | Kırık iç link yok | **Geçti** | 0 kırık |

---

## Risk

| Öncelik | Konu | Durum |
|---------|------|-------|
| Düşük | Tema global Additional CSS REST | POST kabul edildi ama canlıda CSS basılmıyor; kalıcı çözüm Gutenberg responsive columns |
| Yok | Author kutusu tutarsızlığı (143–149) | Giderildi |
| Yok | Profil mobil 2 sütun sıkışması | Giderildi — stack layout aktif |

---

## Komutlar

```bash
npm run fix:ay1-polish -- --dry-run
npm run fix:ay1-polish -- --execute
```

---

*Canlı değişiklik uygulandı; push yapılmadı.*
