import React from 'react';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';

export const FeasibilityReport: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Proje Onaylanan Özellikler</h2>
        
        <div className="grid grid-cols-1 gap-4">
          
          <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl border border-green-100">
            <CheckBadgeIcon className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-green-900">Görsel Benzerliği: %95 Tolerans</h3>
              <p className="text-sm text-green-800 mt-1">
                Photoshop montajı yerine, <strong>Gemini 3 Pro Multimodal</strong> kullanarak "Reference Image" tekniği uygulanacak. Mankenli çekimlerde %95 benzerlik (ürün ruhunu ve ana hatlarını koruma) kabul edildi. Bu, süreci %80 hızlandıracak.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <CheckBadgeIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-blue-900">Strateji: Tek Üretim + Akıllı Kırpma (Crop)</h3>
              <p className="text-sm text-blue-800 mt-1">
                Her ürün için 2 ayrı görsel üretmek yerine, 1 adet <strong>Yüksek Çözünürlüklü (4K/2K) Lifestyle</strong> görsel üretilecek. İkinci görsel (Close-up), bu görselden yazılımsal olarak kırpılarak elde edilecek.
                <br/>
                <span className="font-semibold text-xs uppercase tracking-wide opacity-80">AVANTAJ:</span> Ürün detayları iki görselde de %100 aynı kalır ve maliyet yarıya düşer.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
             <CheckBadgeIcon className="h-6 w-6 text-purple-600 flex-shrink-0 mt-0.5" />
             <div>
               <h3 className="font-bold text-purple-900">Marka Tutarlılığı</h3>
               <p className="text-sm text-purple-800 mt-1">
                 "Marka kimliğine sadık kalsa iyi olur" cevabınıza istinaden, prompt'larımızda sabit bir <strong>"Ana Manken Promptu"</strong> kullanacağız. (Örn: "25-30 yaşlarında, zarif duruşlu, Akdeniz tipi kadın model"). Böylece 1500 görselde bütünlük sağlanacak.
               </p>
             </div>
           </div>

        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Girdi Verileri (Input)</h3>
        <div className="flex gap-4 overflow-x-auto pb-4">
           {/* Mockup of user uploaded images */}
           <div className="flex-shrink-0 w-32 h-32 bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-2">
              <span className="text-xs text-slate-500 mb-2">Ön Açı</span>
              <div className="w-16 h-16 rounded-full bg-amber-100 border-4 border-amber-300 shadow-sm"></div>
           </div>
           <div className="flex-shrink-0 w-32 h-32 bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-2">
              <span className="text-xs text-slate-500 mb-2">Yan Açı</span>
              <div className="w-16 h-12 rounded-lg bg-amber-100 border-4 border-amber-300 shadow-sm rotate-12"></div>
           </div>
           <div className="flex-shrink-0 w-32 h-32 bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-2">
              <span className="text-xs text-slate-500 mb-2">Perspektif</span>
              <div className="w-14 h-14 rounded bg-amber-100 border-4 border-amber-300 shadow-sm rotate-45"></div>
           </div>
        </div>
        <p className="text-sm text-slate-500 italic mt-2">
          *Sisteme yüklenen "Kehribar Yüzük" örnekleri referans alınmıştır.
        </p>
      </div>
    </div>
  );
};