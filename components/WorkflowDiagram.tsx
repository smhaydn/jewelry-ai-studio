import React from 'react';

export const WorkflowDiagram: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl">
        <h2 className="text-2xl font-bold mb-8">Güncellenmiş İş Akışı (Crop Stratejisi)</h2>
        
        <div className="relative">
          {/* Step 1 */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-12 relative z-10">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0 text-lg font-bold">1</div>
            <div className="flex-1 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <h3 className="text-base font-semibold text-blue-400">Ürün Analizi & Prompt</h3>
              <p className="text-slate-400 text-xs mt-1">Gemini 2.5 Flash, yüklediğiniz yüzüğü analiz eder ve sabit manken tanımıyla birleştirir.</p>
            </div>
          </div>

          <div className="absolute left-6 top-12 bottom-12 w-0.5 bg-slate-800 -z-0 hidden md:block"></div>

          {/* Step 2 */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-12 relative z-10">
             <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0 text-lg font-bold">2</div>
            <div className="flex-1 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <h3 className="text-base font-semibold text-purple-400">Tekil Üretim (High-Res)</h3>
              <p className="text-slate-400 text-xs mt-1">
                Gemini 3 Pro Image, <span className="text-white">tek bir yüksek çözünürlüklü</span> lifestyle görsel üretir.
              </p>
              <div className="mt-2 h-32 bg-slate-700 rounded-lg relative overflow-hidden border border-slate-600">
                 {/* Visual representation of a wide shot */}
                 <div className="absolute inset-0 flex items-center justify-center opacity-30 text-4xl">👩</div>
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-amber-400 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.8)] animate-pulse"></div>
                 <span className="absolute bottom-2 right-2 text-[10px] text-slate-300 bg-black/50 px-1 rounded">Original (2048px)</span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-2 relative z-10">
             <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 flex-shrink-0 text-lg font-bold">3</div>
            <div className="flex-1 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <h3 className="text-base font-semibold text-green-400">Otomatik Kırpma (Post-Process)</h3>
              <p className="text-slate-400 text-xs mt-1">
                Yazılım, görseldeki yüzüğün konumunu tespit eder ve o bölgeyi kırparak 2. görseli oluşturur.
              </p>
              <div className="flex gap-4 mt-3">
                 <div className="w-1/3 bg-slate-700 rounded border border-slate-600 p-2 opacity-50">
                    <div className="text-[10px] text-center mb-1">Orijinal</div>
                    <div className="h-12 w-full bg-slate-600 rounded"></div>
                 </div>
                 <div className="flex items-center text-slate-500">➔</div>
                 <div className="w-1/3 bg-slate-700 rounded border-2 border-green-500 p-2 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                    <div className="text-[10px] text-center mb-1 text-green-400">Close-up (Crop)</div>
                    <div className="h-12 w-full bg-amber-400/20 rounded flex items-center justify-center">
                       <div className="w-4 h-4 bg-amber-400 rounded-full"></div>
                    </div>
                 </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};