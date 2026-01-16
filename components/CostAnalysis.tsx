import React from 'react';
import { CurrencyDollarIcon, HandThumbUpIcon } from '@heroicons/react/24/outline';

export const CostAnalysis: React.FC = () => {
  return (
    <div className="space-y-6">
      
      {/* Answer Block */}
      <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-start gap-4">
          <CurrencyDollarIcon className="h-8 w-8 text-indigo-300 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-bold mb-2">Soru: "API ile yaparsak maliyet olacak mı?"</h2>
            <p className="text-indigo-100 leading-relaxed">
              <strong>Evet, ancak çok makul.</strong> Gemini'nin web arayüzü (gemini.google.com) son kullanıcı için ücretsizdir fakat manueldir (tek tek yazmanız gerekir). 1500 ürünü otomatize etmek için kullandığımız "API" (yazılım bağlantısı) genellikle "üretilen görsel başına" ücretlendirilir.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cost Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-900 mb-4">Maliyet Tahmini (1500 Ürün)</h3>
           
           <div className="space-y-4">
             <div className="flex justify-between items-center pb-2 border-b border-slate-100">
               <span className="text-sm text-slate-600">Tekil Görsel Üretimi (Yaklaşık)</span>
               <span className="font-mono font-medium text-slate-900">$0.04 / görsel</span>
             </div>
             <div className="flex justify-between items-center pb-2 border-b border-slate-100">
               <span className="text-sm text-slate-600">Toplam Ürün</span>
               <span className="font-mono font-medium text-slate-900">1,500 Adet</span>
             </div>
             <div className="flex justify-between items-center pb-2 border-b border-slate-100 bg-green-50 px-2 -mx-2 rounded">
               <span className="text-sm font-bold text-green-700">Tahmini Toplam Maliyet</span>
               <span className="font-mono font-bold text-green-700">$60.00</span>
             </div>
           </div>

           <p className="text-xs text-slate-400 mt-4 italic">
             *Bu fiyatlar Google Cloud Vertex AI / AI Studio güncel tarifelerine göre tahmindir. Ücretler değişebilir, ancak bir firma için 1500 manken çekimi için 60 Dolar, bedavadan farksızdır.
           </p>
        </div>

        {/* Time Comparison */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-900 mb-4">Zaman Tasarrufu</h3>
           
           <div className="space-y-4">
             <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-500">Manuel (Web Arayüzü)</span>
                  <span className="text-red-500">~125 Saat</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                   <div className="bg-red-400 h-2 rounded-full w-full"></div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Her ürün için prompt yaz, bekle, indir, crop yap (5 dk/ürün)</p>
             </div>

             <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-500">Otomatik (API)</span>
                  <span className="text-green-600">~2 Saat</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                   <div className="bg-green-500 h-2 rounded-full w-[2%]"></div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Sistem kendi kendine çalışır. Siz kahvenizi içersiniz.</p>
             </div>
           </div>
        </div>
      </div>

      <div className="p-4 border-l-4 border-indigo-500 bg-indigo-50 rounded-r-xl">
        <h4 className="font-bold text-indigo-900 text-sm">Öneri:</h4>
        <p className="text-sm text-indigo-800 mt-1">
          İlk etapta <strong>AI Studio Free Tier (Ücretsiz Katman)</strong> deneyebiliriz. Hız limiti vardır (dakikada 2-3 işlem) ama 1500 ürünü günde parça parça işleyerek maliyeti 0'a indirebiliriz. Acelemiz varsa "Paid Tier" (Ücretli) açıp 1 saatte bitirebiliriz.
        </p>
      </div>

    </div>
  );
};