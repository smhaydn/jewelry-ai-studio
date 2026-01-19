# Antigravity Kit Kullanım Kılavuzu 🚀

Bu doküman, projenize entegre edilen **Antigravity Kit**'in (AG Kit) nasıl kullanılacağını, hangi komutların ne işe yaradığını ve uzman ajanları nasıl çağıracağınızı detaylıca açıklar.

---

## ⚡ 1. Slash Komutları (Hızlı İşlemler)

Sohbet penceresine `/` (slash) işareti koyarak aşağıdaki komutları çalıştırabilirsiniz. Bu komutlar, karmaşık süreçleri tek bir hamlede başlatmanızı sağlar.

| Komut | Ne İşe Yarar? | Örnek Kullanım |
| :--- | :--- | :--- |
| **/brainstorm** | **Beyin Fırtınası:** Yeni bir fikir veya özellik için olası yolları, eksileri/artıları tartışır. Kod yazmadan önce strateji belirlemek için idealdir. | `/brainstorm "Kullanıcılar için puan sistemi ekleyelim"` |
| **/create** | **Yeni Uygulama/Modül:** Sıfırdan bir uygulama veya büyük bir modül oluşturmak için kullanılır. "App Builder" yeteneğini tetikler. | `/create "Next.js ile bir yönetim paneli"` |
| **/debug** | **Hata Ayıklama:** Sistematik bir şekilde hatanın kök nedenini bulur. Rastgele denemeler yapmak yerine bilimsel bir yöntem (hipotez -> test) izler. | `/debug "Login olunca sayfa beyaz ekranda kalıyor"` |
| **/deploy** | **Yayına Alma:** Projeyi canlı ortama (Production) almak için gerekli tüm kontrolleri (test, güvenlik, build) yapar ve deploy eder. | `/deploy` |
| **/enhance** | **Geliştirme:** Mevcut bir özelliği geliştirmek veya değiştirmek için kullanılır. "Bunu daha iyi yap" demenin teknik yoludur. | `/enhance "Ana sayfadaki slider'ı daha modern yap"` |
| **/orchestrate** | **Orkestrasyon:** Çok karmaşık bir iş için birden fazla ajanı (Örn: Frontend + Backend + Security) aynı anda çalıştırır. | `/orchestrate "Tüm ödeme sistemini baştan yazalım"` |
| **/plan** | **Planlama:** Kod yazmadan önce detaylı bir "Implementation Plan" (Uygulama Planı) hazırlar. Görevleri fazlara böler. | `/plan "Kullanıcı profil sayfası tasarımı"` |
| **/preview** | **Önizleme:** Lokal sunucuyu (localhost) yönetir. Başlatır, durdurur veya durumunu kontrol eder. | `/preview` |
| **/status** | **Durum Raporu:** Projenin o anki durumunu, açık görevleri ve ajanların ne üzerinde çalıştığını özetler. | `/status` |
| **/test** | **Test Etme:** Kodunuz için otomatik testler yazar ve çalıştırır. | `/test "Sepet fonksiyonlarını test et"` |
| **/ui-ux-pro-max** | **Arayüz Tasarımı:** Projenin UI/UX kalitesini "Premium" seviyeye çıkarmak için kullanılır. En modern tasarım trendlerini uygular. | `/ui-ux-pro-max "Ürün detay sayfasını tasarla"` |

---

## 🕵️ 2. Uzman Ajanlar (Specialist Agents)

Bu ajanlar, belirli bir alanda uzmanlaşmış sanal personel gibidir. Onları çağırmak için **"X uzmanını çağır"** veya **"Frontend uzmanı baksın"** gibi cümleler kurmanız (veya etiketlemeniz) yeterlidir.

### 🎨 Tasarım ve Ön Yüz
*   **`frontend-specialist`**: React, Next.js, CSS, Tailwind konularında uzmandır. Görsel hataları çözer, komponent yazar.
*   **`mobile-developer`**: iOS, Android, React Native, Flutter uzmanıdır. Mobil uygulama dinamiklerine hakimdir.
*   **`ui-ux-pro-max`** (Skill/Agent): Tasarımın estetik ve kullanıcı deneyimi tarafına odaklanır. Renk paletleri, fontlar, animasyonlar onun işidir.

### ⚙️ Arka Plan ve Sistem
*   **`backend-specialist`**: Sunucu, veritabanı (SQL), API ve mimari konularında uzmandır.
*   **`database-architect`**: Veritabanı şemaları, tablo ilişkileri ve performans optimizasyonu yapar.
*   **`devops-engineer`**: Sunucu kurulumu, Docker, CI/CD ve deployment süreçlerini yönetir.
*   **`security-auditor`**: Kodunuzdaki güvenlik açıklarını arar ve kapatır.

### 🧠 Yönetim ve Planlama
*   **`orchestrator`**: (Benim ana modum) Diğer ajanları yönetir, işleri dağıtır ve sonuçları birleştirir.
*   **`project-planner`**: Görevleri listeler, `.md` dosyaları oluşturur ve proje takvimini yönetir.
*   **`documentation-writer`**: Kod dokümantasyonu (README, API docs) yazar.

### 🛠️ Özel Görevler
*   **`debugger`**: Sadece hata çözmeye odaklanır.
*   **`performance-optimizer`**: Uygulamanın hızını artırır (Site hızı, sorgu hızı vb.).
*   **`seo-specialist`**: Arama motoru optimizasyonu (SEO) için gerekli ayarları yapar.
*   **`test-engineer`**: Test senaryoları yazar ve kalite kontrol yapar.

---

## 📚 3. Skill (Yetenek) Sistemi Nasıl Çalışır?

Skill'ler, ajanların kullandığı "bilgi kitapçıklarıdır". Siz bunları doğrudan çağırmazsınız, **ben ihtiyaca göre otomatik yüklerim.**

**Örnek Senaryo:**
Siz: *"Sitedeki görseller çok yavaş yükleniyor."*
Ben:
1.  Hemen `performance-profiling` yeteneğini yüklerim.
2.  Gerekirse `frontend-specialist` ajanını devreye sokarım.
3.  Size çözüm önerisi sunarım.

**Önemli Skill'ler:**
*   `clean-code`: Temiz ve okunabilir kod yazma kuralları.
*   `api-patterns`: Doğru API tasarımı standartları.
*   `security-scanner`: Güvenlik taraması yapma yeteneği.
*   `git-history`: Versiyon kontrol geçmişini anlama.

---

## 🚀 Nasıl Başlayalım?

Eğer şu an ne yapacağınızdan emin değilseniz, en genel komut olan planlama ile başlayabilirsiniz:

> **`/plan [yapmak istediğiniz iş]`**

Örneğin:
` /plan "Müşteriler için favorilere ekleme özelliği" `

Bu komutla ben:
1.  Frontend ve Backend gereksinimlerini çıkarırım.
2.  Hangi dosyaların değişeceğini planlarım.
3.  Size onaylamanız için bir yol haritası sunarım.
