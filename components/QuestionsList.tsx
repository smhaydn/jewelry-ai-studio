import React from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

export const QuestionsList: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl flex items-start gap-4">
        <ChatBubbleLeftRightIcon className="h-8 w-8 text-indigo-600 flex-shrink-0" />
        <div>
          <h2 className="text-lg font-bold text-indigo-900">Uygulamayı yazmadan önce netleştirmemiz gerekenler</h2>
          <p className="text-indigo-700 mt-1">
            Aşağıdaki sorulara vereceğiniz cevaplar, kullanacağımız yapay zeka modelinin konfigürasyonunu ve maliyetleri doğrudan etkileyecektir.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Q1 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-slate-900 text-lg">1. "Birebir" Toleransı Nedir?</h3>
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">KRİTİK</span>
          </div>
          <p className="text-slate-600 mb-4">
            Yapay zeka (dünyadaki en iyisi bile olsa) bir fotoğrafı %100 piksel piksel kopyalamaz, yeniden çizer. Kolyenin ana taşını ve şeklini korur ama zincir baklalarının sayısını veya çok ince detayları %5-10 oranında değiştirebilir.
          </p>
          <div className="p-3 bg-slate-50 rounded border border-slate-100 text-sm text-slate-800">
            <strong>Soru:</strong> Müşteriniz %95 görsel benzerliği (ürün aynı hissettiriyor ama mikroskopla bakınca fark var) kabul eder mi? Yoksa Photoshop ile montajlanmış gibi %100 aynısı mı olmalı?
          </div>
        </div>

        {/* Q2 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-bold text-slate-900 text-lg mb-2">2. Ürün Hacmi ve Maliyet</h3>
          <p className="text-slate-600 mb-4">
            "Çok fazla ürün var" dediniz. Bu 100 mü, 10.000 mi? Gemini 3 Pro modeli yüksek kaliteli görsel üretir ancak her görselin bir maliyeti vardır.
          </p>
          <div className="p-3 bg-slate-50 rounded border border-slate-100 text-sm text-slate-800">
             <strong>Soru:</strong> Tahmini toplam ürün sayısı nedir? Günlük kaç yeni ürün işlenecek? Buna göre size bir API maliyet tablosu çıkarmam gerekir.
          </div>
        </div>

        {/* Q3 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-bold text-slate-900 text-lg mb-2">3. Manken Tercihleri (Marka Kimliği)</h3>
          <p className="text-slate-600 mb-4">
            AI mankenler rastgele oluşturulabilir veya bir marka kimliğine sadık kalabilir.
          </p>
          <div className="p-3 bg-slate-50 rounded border border-slate-100 text-sm text-slate-800">
             <strong>Soru:</strong> Müşterinizin marka yüzü olarak belirlediği sabit bir etnik köken, yaş aralığı veya stil (örn: Sadece İskandinav, 20-25 yaş, minimal makyaj) var mı? Yoksa her takıya göre AI özgür mü olsun?
          </div>
        </div>
        
         {/* Q4 */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-bold text-slate-900 text-lg mb-2">4. Yakın Çekim (Close-up) Detayı</h3>
          <p className="text-slate-600 mb-4">
            Yakın çekim görsellerde ürün hataları daha çok belli olur.
          </p>
          <div className="p-3 bg-slate-50 rounded border border-slate-100 text-sm text-slate-800">
             <strong>Soru:</strong> Yakın çekim görseli, geniş açı görselin içinden "crop" (kırpma) yapılarak mı elde edilmeli (daha tutarlı olur ama çözünürlük düşer), yoksa sıfırdan "makro çekim" olarak mı üretilmeli (daha riskli ama çok yüksek detaylı olur)?
          </div>
        </div>

      </div>
    </div>
  );
};