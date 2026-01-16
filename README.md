# Jewelry AI Factory (Local Mod)

Bu uygulama, sadece bu bilgisayar üzerinde çalışacak şekilde yapılandırılmıştır. Tüm veriler ve üretim süreci sizin kontrolünüzdedir.

## 1. İlk Kurulum (Sadece 1 Kere Yapılır)

Bilgisayarınızda bu uygulamanın çalışması için gerekli motoru (Node.js) kurmanız gerekir.

1.  **Node.js İndir:** [nodejs.org](https://nodejs.org/) adresinden "LTS" (Önerilen) sürümü indirip kurun.
2.  **Kurulumu Tamamla:**
    *   Bu klasörün içinde boş bir yere sağ tıklayıp "Terminalde Aç" (veya cmd) deyin.
    *   Şu komutu yazıp Enter'a basın:
        ```bash
        npm install
        ```
    *   Bu işlem internet hızınıza göre 1-2 dakika sürebilir. `node_modules` diye bir klasör oluşacaktır.

## 2. API Anahtarını Tanımlama (Kritik Adım)

Uygulamanın her açılışta anahtar sormaması ve arka planda Google ile konuşabilmesi için gizli bir ayar dosyası oluşturacağız.

1.  Proje klasörünün içinde yeni bir metin belgesi oluşturun.
2.  Adını `.env` olarak değiştirin. (Dikkat: dosyanın adı sadece `.env` olacak, `.txt` uzantısı kalmamalı).
3.  Bu dosyayı Not Defteri ile açın ve içine şunu yapıştırın:
    ```
    API_KEY=BURAYA_GOOGLE_AI_STUDIO_ANAHTARINIZI_YAPISTIRIN
    ```
4.  `BURAYA_...` yazan yere kendi uzun anahtarınızı yapıştırıp kaydedin.

## 3. Uygulamayı Başlatma

Çalışmaya başlamak istediğinizde:

1.  Proje klasöründe Terminal'i açın.
2.  Şu komutu yazın:
    ```bash
    npm run dev
    ```
3.  Terminal size şöyle bir link verecek: `http://localhost:5173`
4.  Bu linke tıklayın veya tarayıcınıza kopyalayın.

## 4. Kullanım İpuçları

*   **Durdurmak İçin:** Terminal ekranına gelip `CTRL + C` tuşlarına basın.
*   **İnternet:** Uygulama yerel bilgisayarda çalışsa da, görsel üretimi için bilgisayarın internete bağlı olması şarttır.
*   **Maliyet:** Kullandığınız API anahtarı sizin Google hesabınıza bağlıdır. Kotanızı [aistudio.google.com](https://aistudio.google.com) adresinden takip edebilirsiniz.
