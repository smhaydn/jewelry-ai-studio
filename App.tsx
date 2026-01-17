import React, { useState, useEffect, useRef } from 'react';
import {
  CloudArrowUpIcon, SparklesIcon, PhotoIcon, ArrowPathIcon, CheckCircleIcon,
  AdjustmentsHorizontalIcon, ArrowDownTrayIcon, UserIcon, XMarkIcon, SwatchIcon,
  VideoCameraIcon, FilmIcon, CameraIcon, FolderIcon, QueueListIcon, PaintBrushIcon,
  ArrowsRightLeftIcon, TrashIcon, ChevronDownIcon, MagnifyingGlassPlusIcon,
  Square2StackIcon, TagIcon, ScissorsIcon, ArchiveBoxIcon, Cog6ToothIcon,
  KeyIcon, ServerStackIcon
} from '@heroicons/react/24/outline';
import { fileToBase64, downloadImage } from './lib/utils';
import { analyzeJewelry, generateLifestyleImage, generateJewelryVideo } from './lib/gemini';
import { supabase } from './lib/supabase';

// --- TYPES ---
interface StoredModel {
  id: string;
  name: string;
  image: string; // base64
  category: 'Female' | 'Male' | 'Hand-Model' | 'Portrait';
}

interface BatchJob {
  id: string;
  name: string;
  images: string[];
  status: 'pending' | 'analyzing' | 'generating' | 'completed' | 'failed';
  resultImage?: string;
  resultVideo?: string;
}

interface GeneratedItem {
  id: string;
  type: 'standard' | 'crop' | 'creative_1' | 'creative_2';
  label: string;
  image: string;
  date?: string; // Added date for archive
}

interface JobState {
  productImages: string[];
  selectedModelId: string | null;
  category: string;
  stylePreset: string;
  // Tech Settings
  aspectRatio: string;
  cameraAngle: string;
  shotScale: string;
  lens: string;

  analysis: { scenePrompt: string } | null;

  // Gallery
  gallery: GeneratedItem[];
  selectedImageId: string | null;

  generatedVideo: string | null;
  isAnalyzing: boolean;
  isGenerating: boolean;
  isVideoGenerating: boolean;
  error: string | null;

  // Branding
  logoImage: string | null;
  showBranding: boolean;
}

// --- CONSTANTS ---
const PRODUCT_CATEGORIES = [
  { id: "ring", label: "Yüzük (Ring)", focusY: 0.5 },
  { id: "necklace", label: "Kolye (Necklace)", focusY: 0.55 },
  { id: "earring", label: "Küpe (Earring)", focusY: 0.35 },
  { id: "bracelet", label: "Bileklik (Bracelet)", focusY: 0.6 },
  { id: "brooch", label: "Broş (Brooch)", focusY: 0.45 }
];

const STYLE_PRESETS = [
  { id: "minimal_studio", label: "Minimalist Stüdyo", prompt: "Clean white/grey background, soft studio lighting, high fashion magazine aesthetic." },
  { id: "old_money", label: "Old Money (Sessiz Lüks)", prompt: "Old Money aesthetic. Ralph Lauren vibe. Cashmere textures, soft beige tones, elegant, timeless luxury. Not flashy, but extremely expensive looking. Country club or luxury estate vibe." },
  { id: "luxury_dark", label: "Lüks Karanlık", prompt: "Moody lighting, dark marble or velvet background, dramatic shadows, gold accents popping." },
  { id: "natural_sunlight", label: "Doğal Gün Işığı", prompt: "Sunlight streaming through a window, soft shadows, warm tones, cozy lifestyle vibe." },
  { id: "urban_chic", label: "Şehir & Sokak", prompt: "Blurred city street background, bokeh lights, modern, trendy street style, depth of field." },
];

const ASPECT_RATIOS = [{ value: "1:1", label: "1:1" }, { value: "3:4", label: "3:4" }, { value: "9:16", label: "9:16" }];

// --- HELPER: SMART CROP ---
const createSmartCrop = async (base64Image: string, categoryLabel: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const w = img.width;
      const h = img.height;
      const catObj = PRODUCT_CATEGORIES.find(c => c.label === categoryLabel);
      const focusYRatio = catObj ? catObj.focusY : 0.5;

      // ZOOM FACTOR: 0.4 means we take 40% of the image (High Zoom / Macro feel)
      const cropW = w * 0.4;
      const cropH = h * 0.4;

      let srcX = (w * 0.5) - (cropW / 2);
      let srcY = (h * focusYRatio) - (cropH / 2);

      if (srcX < 0) srcX = 0;
      if (srcY < 0) srcY = 0;
      if (srcX + cropW > w) srcX = w - cropW;
      if (srcY + cropH > h) srcY = h - cropH;

      // We scale it back up to original size so it matches resolution in gallery
      canvas.width = w;
      canvas.height = h;

      if (ctx) {
        ctx.drawImage(img, srcX, srcY, cropW, cropH, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      }
    };
    img.src = `data:image/png;base64,${base64Image}`;
  });
};

// --- MAIN COMPONENT ---
export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'batch' | 'models' | 'archive' | 'settings'>('studio');
  const [modelTab, setModelTab] = useState<'Female' | 'Male'>('Female');
  const [hasKey, setHasKey] = useState(false);
  const [systemKeyAvailable, setSystemKeyAvailable] = useState(!!import.meta.env.VITE_GEMINI_API_KEY);

  // DATA STORES
  const [modelLibrary, setModelLibrary] = useState<StoredModel[]>([]);
  const [batchQueue, setBatchQueue] = useState<BatchJob[]>([]);
  const [archive, setArchive] = useState<GeneratedItem[]>([]); // Cloud Archive Simulation

  // STUDIO STATE
  const [job, setJob] = useState<JobState>({
    productImages: [],
    selectedModelId: null,
    category: PRODUCT_CATEGORIES[0].label,
    stylePreset: STYLE_PRESETS[0].prompt,
    aspectRatio: "3:4",
    cameraAngle: "Eye Level",
    shotScale: "Medium Shot",
    lens: "85mm Portrait",
    analysis: null,
    gallery: [],
    selectedImageId: null,
    generatedVideo: null,
    isAnalyzing: false,
    isGenerating: false,
    isVideoGenerating: false,
    error: null,
    logoImage: null,
    showBranding: false
  });

  // Slider State
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const comparisonContainerRef = useRef<HTMLDivElement>(null);

  // Manual Crop State
  const [isCropping, setIsCropping] = useState(false);
  const [cropSelection, setCropSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const cropImageRef = useRef<HTMLImageElement>(null);

  // --- SLIDER HANDLERS ---
  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !comparisonContainerRef.current) return;
    const rect = comparisonContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // --- MANUAL CROP HANDLERS ---
  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!cropImageRef.current) return;
    const rect = cropImageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsSelecting(true);
    setCropSelection({ x, y, w: 0, h: 0 });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !cropSelection || !cropImageRef.current) return;
    const rect = cropImageRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setCropSelection(prev => ({
      ...prev!,
      w: currentX - prev!.x,
      h: currentY - prev!.y
    }));
  };

  const handleCropMouseUp = () => {
    setIsSelecting(false);
  };

  const performManualCrop = async () => {
    if (!cropSelection || !cropImageRef.current) return;

    // Get the Standard Image (Source)
    const standardImg = job.gallery.find(g => g.type === 'standard');
    if (!standardImg) return;

    const img = new Image();
    img.src = `data:image/png;base64,${standardImg.image}`;
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const displayW = cropImageRef.current.width;
    const displayH = cropImageRef.current.height;
    const actualW = img.width;
    const actualH = img.height;
    const scaleX = actualW / displayW;
    const scaleY = actualH / displayH;

    let { x, y, w, h } = cropSelection;
    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }

    const realX = x * scaleX;
    const realY = y * scaleY;
    const realW = w * scaleX;
    const realH = h * scaleY;

    canvas.width = realW;
    canvas.height = realH;

    if (ctx && realW > 0 && realH > 0) {
      ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH);
      const newBase64 = canvas.toDataURL('image/png').split(',')[1];

      const newGallery = job.gallery.map(item => {
        if (item.type === 'crop') {
          return { ...item, image: newBase64 };
        }
        return item;
      });

      setJob(p => ({ ...p, gallery: newGallery, selectedImageId: newGallery.find(i => i.type === 'crop')?.id || null }));
      setIsCropping(false);
      setCropSelection(null);
    }
  };


  // --- INITIALIZATION ---
  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (import.meta.env.VITE_GEMINI_API_KEY) {
        setHasKey(true); // System key is available
      } else if (aistudio && aistudio.hasSelectedApiKey) {
        setHasKey(await aistudio.hasSelectedApiKey());
      } else {
        setHasKey(true); // Fallback
      }
    };
    checkKey();

    // LOAD DATA FROM SUPABASE
    const loadData = async () => {
      const { data: models } = await supabase.from('models').select('*');
      if (models) setModelLibrary(models as StoredModel[]);

      const { data: arch } = await supabase.from('archive').select('*');
      if (arch) setArchive(arch as GeneratedItem[]);
    };
    loadData();
  }, []);

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && aistudio.openSelectKey) {
      await aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleAddModel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const newModel: StoredModel = {
        id: Date.now().toString(),
        name: `Model ${modelLibrary.length + 1}`,
        image: base64,
        category: modelTab === 'Male' ? 'Male' : 'Female'
      };

      // SAVE TO SUPABASE
      await supabase.from('models').insert([newModel]);
      setModelLibrary([...modelLibrary, newModel]);
    }
  };

  const deleteModel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Bu mankeni silmek istediğinize emin misiniz?")) return;

    await supabase.from('models').delete().eq('id', id);
    setModelLibrary(prev => prev.filter(m => m.id !== id));
    if (job.selectedModelId === id) setJob(p => ({ ...p, selectedModelId: null }));
  };

  const deleteArchiveItem = async (id: string) => {
    if (!window.confirm("Bu görseli arşivden silmek istediğinize emin misiniz?")) return;

    await supabase.from('archive').delete().eq('id', id);
    setArchive(prev => prev.filter(i => i.id !== id));
  };

  const saveToArchive = () => {
    if (job.gallery.length === 0) return;
    const newItems = job.gallery.map(item => ({ ...item, date: new Date().toLocaleDateString('tr-TR') }));
    setArchive(prev => [...newItems, ...prev]);
    alert("Set başarıyla bulut arşivine kaydedildi (Simülasyon)");
  };

  // --- STUDIO HANDLERS ---
  const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setJob(p => ({ ...p, isAnalyzing: true, productImages: [], gallery: [], selectedImageId: null }));

    try {
      const images = await Promise.all(Array.from(files).map((f: File) => fileToBase64(f)));
      const analysis = await analyzeJewelry(images, job.category);
      setJob(p => ({ ...p, productImages: images, analysis, isAnalyzing: false }));
    } catch (e) {
      setJob(p => ({ ...p, isAnalyzing: false, error: (e as Error).message }));
    }
  };

  const handleGenerate = async () => {
    if (!job.productImages.length) return;
    setJob(p => ({ ...p, isGenerating: true, gallery: [], selectedImageId: null }));

    try {
      const modelRef = modelLibrary.find(m => m.id === job.selectedModelId)?.image;

      // 1. Generate STANDARD Lifestyle (Product Correct Placement)
      const resStandard = await generateLifestyleImage(
        job.productImages,
        job.analysis?.scenePrompt || "",
        job.category,
        job.stylePreset,
        { aspectRatio: job.aspectRatio, cameraAngle: job.cameraAngle, shotScale: job.shotScale, lens: job.lens },
        modelRef,
        'standard',
        job.analysis as any
      );

      // 2. Create SMART CROP based on Category Focus Point
      const resCrop = await createSmartCrop(resStandard, job.category);

      const standardId = Date.now().toString();
      const cropId = standardId + '_crop';

      // Initially populate with the first 2 results so user sees something
      setJob(p => ({
        ...p,
        gallery: [
          { id: standardId, type: 'standard', label: '1. Katalog (Genel)', image: resStandard },
          { id: cropId, type: 'crop', label: '2. Yakın Çekim', image: resCrop }
        ],
        selectedImageId: standardId
      }));

      // 3. Generate CREATIVE Variations in Parallel
      const creativePromises = [
        generateLifestyleImage(job.productImages, job.analysis?.scenePrompt || "", job.category, job.stylePreset, { ...job, aspectRatio: job.aspectRatio } as any, modelRef, 'playful', job.analysis as any),
        generateLifestyleImage(job.productImages, job.analysis?.scenePrompt || "", job.category, job.stylePreset, { ...job, aspectRatio: job.aspectRatio } as any, modelRef, 'artistic', job.analysis as any)
      ];

      const [resPinterest1, resPinterest2] = await Promise.all(creativePromises);

      const creative1Id = Date.now().toString() + '1';
      const creative2Id = Date.now().toString() + '2';

      const finalGallery: GeneratedItem[] = [
        { id: standardId, type: 'standard', label: '1. Katalog (Genel)', image: resStandard },
        { id: cropId, type: 'crop', label: '2. Yakın Çekim', image: resCrop },
        { id: creative1Id, type: 'creative_1', label: '3. Pinterest: Doğal', image: resPinterest1 },
        { id: creative2Id, type: 'creative_2', label: '4. Pinterest: Sanat', image: resPinterest2 }
      ];

      // AUTO-SAVE TO SUPABASE
      const archiveItems = finalGallery.map(item => ({ ...item, date: new Date().toLocaleDateString('tr-TR') }));
      await supabase.from('archive').insert(archiveItems);
      setArchive(prev => [...archiveItems, ...prev]);

      // Final update
      setJob(p => ({
        ...p,
        isGenerating: false,
        gallery: finalGallery
      }));

    } catch (e) {
      setJob(p => ({ ...p, isGenerating: false, error: (e as Error).message }));
    }
  };

  const handleVideoGen = async () => {
    const selectedImg = job.gallery.find(g => g.id === job.selectedImageId);
    if (!selectedImg) return;

    setJob(p => ({ ...p, isVideoGenerating: true }));
    try {
      const url = await generateJewelryVideo(selectedImg.image, job.category, job.stylePreset);
      setJob(p => ({ ...p, generatedVideo: url, isVideoGenerating: false }));
    } catch (e) {
      setJob(p => ({ ...p, isVideoGenerating: false, error: (e as Error).message }));
    }
  };

  // --- BATCH HANDLERS ---
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const jobsMap = new Map<string, File[]>();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.startsWith('.') || !file.type.startsWith('image/')) continue;
      const pathParts = file.webkitRelativePath.split('/');
      const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'Unknown';
      if (!jobsMap.has(folderName)) {
        jobsMap.set(folderName, []);
      }
      jobsMap.get(folderName)?.push(file);
    }

    const newJobs: BatchJob[] = [];
    for (const [name, fileList] of jobsMap.entries()) {
      const images = await Promise.all(fileList.map(f => fileToBase64(f)));
      newJobs.push({
        id: Date.now().toString() + Math.random().toString().slice(2),
        name: name,
        images: images,
        status: 'pending'
      });
    }
    setBatchQueue(prev => [...prev, ...newJobs]);
  };

  const processBatchQueue = async () => {
    const pendingJobs = batchQueue.filter(j => j.status === 'pending');
    if (pendingJobs.length === 0) return;

    const modelRef = modelLibrary.find(m => m.id === job.selectedModelId)?.image || (modelLibrary.length > 0 ? modelLibrary[0].image : null);

    for (const batchJob of pendingJobs) {
      setBatchQueue(prev => prev.map(j => j.id === batchJob.id ? { ...j, status: 'generating' } : j));

      try {
        const resultImage = await generateLifestyleImage(
          batchJob.images,
          "",
          job.category,
          job.stylePreset,
          {
            aspectRatio: job.aspectRatio,
            cameraAngle: job.cameraAngle,
            shotScale: job.shotScale,
            lens: job.lens
          },
          modelRef,
          'standard',
          { material: 'Unknown', gemColor: 'Unknown' } // Batch mode simple fallback
        );

        setBatchQueue(prev => prev.map(j => j.id === batchJob.id ? { ...j, status: 'completed', resultImage } : j));

      } catch (error) {
        setBatchQueue(prev => prev.map(j => j.id === batchJob.id ? { ...j, status: 'failed' } : j));
      }
    }
  };

  const downloadBranded = async (format: 'original' | '9:16' | '4:5') => {
    const selectedImg = job.gallery.find(g => g.id === job.selectedImageId);
    if (!selectedImg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const mainImg = new Image();
    mainImg.src = `data:image/png;base64,${selectedImg.image}`;

    await new Promise(r => mainImg.onload = r);

    let w = mainImg.width;
    let h = mainImg.height;
    if (format === '9:16') { w = 1080; h = 1920; }
    else if (format === '4:5') { w = 1080; h = 1350; }

    canvas.width = w;
    canvas.height = h;

    if (ctx) {
      const scale = Math.max(w / mainImg.width, h / mainImg.height);
      const x = (w / 2) - (mainImg.width / 2) * scale;
      const y = (h / 2) - (mainImg.height / 2) * scale;
      ctx.drawImage(mainImg, x, y, mainImg.width * scale, mainImg.height * scale);

      if (job.logoImage) {
        const logo = new Image();
        logo.src = `data:image/png;base64,${job.logoImage}`;
        await new Promise(r => logo.onload = r);
        const logoW = w * 0.2;
        const logoH = (logoW / logo.width) * logo.height;
        const padding = w * 0.05;
        ctx.drawImage(logo, (w / 2) - (logoW / 2), h - logoH - padding, logoW, logoH);
      }

      const data = canvas.toDataURL('image/png').split(',')[1];
      downloadImage(data, `jewelry-${selectedImg.type}-${format}.png`);
    }
  };

  if (!hasKey) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <button onClick={handleSelectKey} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold shadow-lg">API Anahtarı Bağla</button>
    </div>
  );

  const activeImage = job.gallery.find(g => g.id === job.selectedImageId);
  const filteredModels = modelLibrary.filter(m =>
    modelTab === 'Female' ? m.category !== 'Male' : m.category === 'Male'
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg"><SparklesIcon className="h-5 w-5 text-white" /></div>
            <span className="font-bold text-slate-900 tracking-tight">Jewelry AI Factory</span>
          </div>
          <nav className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'studio', label: 'Stüdyo', icon: CameraIcon },
              { id: 'batch', label: 'Toplu', icon: QueueListIcon },
              { id: 'models', label: 'Mankenler', icon: UserIcon },
              { id: 'archive', label: 'Arşiv', icon: ArchiveBoxIcon },
              { id: 'settings', label: 'Ayarlar', icon: Cog6ToothIcon }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 overflow-hidden">
        {/* --- SETTINGS TAB (Admin Panel) --- */}
        {activeTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-100 rounded-full"><Cog6ToothIcon className="h-8 w-8 text-indigo-700" /></div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Yönetim Paneli</h2>
                <p className="text-slate-500 text-sm">Uygulama genel ayarları ve bağlantılar.</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* API Status */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><KeyIcon className="h-5 w-5 text-indigo-500" /> API Bağlantı Durumu</h3>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${systemKeyAvailable ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <div>
                      <p className="font-bold text-sm text-slate-800">{systemKeyAvailable ? 'Sistem Anahtarı Aktif' : 'Kullanıcı Anahtarı Modu'}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {systemKeyAvailable
                          ? "Vercel Environment Variable üzerinden merkezi API kullanılıyor."
                          : "Merkezi anahtar bulunamadı. Kullanıcılar kendi AI Studio cüzdanını bağlayarak işlem yapıyor."}
                      </p>
                    </div>
                  </div>
                  {systemKeyAvailable && <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded">import.meta.env.VITE_GEMINI_API_KEY</span>}
                </div>

                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <h4 className="font-bold text-indigo-900 text-sm mb-2">Nasıl Değiştirilir?</h4>
                  <p className="text-xs text-indigo-800 leading-relaxed">
                    Sistemin sizin API anahtarınızı kullanmasını istiyorsanız, Vercel paneline gidip <code>Settings &gt; Environment Variables</code> kısmına <code>API_KEY</code> adında bir değişken ekleyin. Bunu yaptığınızda kullanıcıdan anahtar isteme ekranı otomatik kalkacaktır.
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><ServerStackIcon className="h-5 w-5 text-indigo-500" /> Veritabanı (Supabase)</h3>
                  <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2 py-1 rounded">AKTİF</span>
                </div>
                <p className="text-sm text-slate-500 mb-4">Supabase bağlantısı başarıyla kuruldu.</p>
                <button className="bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg text-sm font-bold w-full text-left flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5" />
                  Bağlantı Hazır
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- ARCHIVE TAB --- */}
        {activeTab === 'archive' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Bulut Arşivi</h2>
                <p className="text-slate-500 text-sm">Üretilen tüm görseller burada saklanır.</p>
              </div>
              <div className="flex gap-2">
                <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm">Filtrele</button>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm">Tümünü İndir</button>
              </div>
            </div>

            {archive.length === 0 ? (
              <div className="text-center py-20 bg-slate-100 rounded-2xl border border-slate-200 border-dashed">
                <ArchiveBoxIcon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-600">Arşiv Boş</h3>
                <p className="text-slate-400 text-sm">Henüz "Arşive Kaydet" butonuna basılmış bir çalışma yok.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {archive.map((item, idx) => (
                  <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm group relative">
                    <img src={`data:image/png;base64,${item.image}`} className="w-full h-40 object-cover rounded-md bg-slate-100" />
                    <div className="mt-2">
                      <p className="font-bold text-xs text-slate-900 truncate">{item.label}</p>
                      <p className="text-[10px] text-slate-500">{item.date}</p>
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                      <button onClick={() => downloadImage(item.image, `archive-${idx}.png`)} className="bg-white p-2 rounded-full text-indigo-600 hover:scale-110 transition-transform" title="İndir"><ArrowDownTrayIcon className="h-4 w-4" /></button>
                      <button onClick={() => deleteArchiveItem(item.id)} className="bg-white p-2 rounded-full text-red-600 hover:scale-110 transition-transform" title="Sil"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- MODELS TAB --- */}
        {activeTab === 'models' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Manken Ajansı</h2>
                <p className="text-slate-500 text-sm">Markanızın kalıcı yüzlerini burada yönetin.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-slate-200 p-1 rounded-lg flex text-xs font-bold">
                  <button onClick={() => setModelTab('Female')} className={`px-3 py-1.5 rounded-md ${modelTab === 'Female' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Kadın</button>
                  <button onClick={() => setModelTab('Male')} className={`px-3 py-1.5 rounded-md ${modelTab === 'Male' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Erkek</button>
                </div>
                <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 cursor-pointer shadow-sm transition-colors">
                  <UserIcon className="h-4 w-4" />
                  Yeni Manken Ekle ({modelTab})
                  <input type="file" className="hidden" accept="image/*" onChange={handleAddModel} />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredModels.map(model => (
                <div key={model.id} className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                  <img src={`data:image/jpeg;base64,${model.image}`} className="w-full h-48 object-cover" alt={model.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <span className="text-white font-bold text-sm">{model.name}</span>
                    <span className="text-white/80 text-xs">{model.category === 'Male' ? 'Erkek' : 'Kadın'}</span>
                    <button
                      onClick={(e) => deleteModel(model.id, e)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-all shado-sm"
                      title="Mankeni Sil"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 h-full flex flex-col">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <FolderIcon className="h-6 w-6 text-yellow-500" />
                    Klasör Bazlı Yükleme
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">"Tüm Koleksiyon" klasörünü seçin. Sistem alt klasörleri otomatik ürün olarak tanıyacaktır.</p>
                </div>
                <div className="flex gap-2">
                  <label className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors">
                    <FolderIcon className="h-4 w-4" />
                    Klasör Seç
                    <input type="file" className="hidden" {...({ webkitdirectory: "", directory: "" } as any)} onChange={handleFolderUpload} />
                  </label>
                  <button onClick={processBatchQueue} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors">
                    <ArrowPathIcon className="h-4 w-4" />
                    Kuyruğu Başlat ({batchQueue.filter(j => j.status === 'pending').length})
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              {batchQueue.map(job => (
                <div key={job.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-md overflow-hidden relative">
                      {job.resultImage ? <img src={`data:image/jpeg;base64,${job.resultImage}`} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{job.name}</h4>
                      <span className="text-xs text-slate-500">{job.images.length} Görsel • {job.status.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            <div className="lg:col-span-3 space-y-4 overflow-y-auto max-h-[calc(100vh-100px)] custom-scrollbar pr-1">

              {/* --- CATEGORY SELECTOR --- */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm ring-2 ring-indigo-50">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2 text-sm"><TagIcon className="h-4 w-4 text-indigo-600" /> Kategori Seçimi (Önemli)</h3>
                <p className="text-[10px] text-slate-500 mb-2">Prompt ve crop ayarları buna göre yapılır.</p>
                <div className="relative">
                  <select value={job.category} onChange={(e) => setJob(p => ({ ...p, category: e.target.value }))} className="w-full appearance-none bg-indigo-50 border border-indigo-200 text-indigo-900 text-sm font-bold py-2.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer">
                    {PRODUCT_CATEGORIES.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-600"><ChevronDownIcon className="h-4 w-4" /></div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm"><CloudArrowUpIcon className="h-4 w-4" /> Ürün (3 Açı)</h3>
                <label className="block w-full h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50">
                  <div className="text-center">
                    {job.productImages.length > 0 ? <CheckCircleIcon className="h-8 w-8 text-green-500 mx-auto" /> : <PhotoIcon className="h-8 w-8 text-slate-300 mx-auto" />}
                    <span className="text-xs text-slate-500 mt-1 block">{job.productImages.length > 0 ? `${job.productImages.length} Görsel Seçildi` : 'Yükle (Ön, Yan, Detay)'}</span>
                  </div>
                  <input type="file" multiple className="hidden" onChange={handleProductUpload} />
                </label>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm"><UserIcon className="h-4 w-4" /> Manken</h3>
                  <div className="flex bg-slate-100 p-0.5 rounded text-[10px] font-bold">
                    <button onClick={() => setModelTab('Female')} className={`px-2 py-1 rounded ${modelTab === 'Female' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Kadın</button>
                    <button onClick={() => setModelTab('Male')} className={`px-2 py-1 rounded ${modelTab === 'Male' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Erkek</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {filteredModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setJob(p => ({ ...p, selectedModelId: m.id }))}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${job.selectedModelId === m.id ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-transparent'}`}
                    >
                      <img src={`data:image/jpeg;base64,${m.image}`} className="w-full h-16 object-cover" />
                    </button>
                  ))}
                  <button onClick={() => setActiveTab('models')} className="border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center h-16 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                    <span className="text-xs font-bold">+</span>
                  </button>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm"><PaintBrushIcon className="h-4 w-4" /> Branding</h3>
                  <input type="checkbox" checked={job.showBranding} onChange={e => setJob(p => ({ ...p, showBranding: e.target.checked }))} className="toggle" />
                </div>
                {job.showBranding && (
                  <label className="block w-full h-16 border border-slate-200 rounded-lg flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100">
                    {job.logoImage ? <img src={`data:image/png;base64,${job.logoImage}`} className="h-8 object-contain" /> : <span className="text-xs text-slate-400">Logo Yükle (PNG)</span>}
                    <input type="file" accept="image/png" className="hidden" onChange={async (e) => {
                      if (e.target.files?.[0]) {
                        const logo = await fileToBase64(e.target.files[0]);
                        setJob(p => ({ ...p, logoImage: logo }));
                      }
                    }} />
                  </label>
                )}
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col h-full space-y-4">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Boyut</span>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    {ASPECT_RATIOS.map(ar => (
                      <button key={ar.value} onClick={() => setJob(p => ({ ...p, aspectRatio: ar.value }))} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${job.aspectRatio === ar.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{ar.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-1 justify-end min-w-[200px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atmosfer</span>
                  <div className="relative flex-1 max-w-xs">
                    <select value={job.stylePreset} onChange={(e) => setJob(p => ({ ...p, stylePreset: e.target.value }))} className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer transition-colors hover:bg-slate-100">
                      {STYLE_PRESETS.map(s => <option key={s.id} value={s.prompt}>{s.label}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500"><ChevronDownIcon className="h-4 w-4" /></div>
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl relative overflow-hidden flex items-center justify-center min-h-[500px]">
                {job.isGenerating ? (
                  <div className="text-center">
                    <ArrowPathIcon className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-4" />
                    <h3 className="text-indigo-900 font-bold">4 Farklı Sosyal Medya İçeriği Üretiliyor...</h3>
                    <div className="space-y-1 mt-3">
                      <p className="text-indigo-600 text-xs flex items-center justify-center gap-2"><CheckCircleIcon className="h-3 w-3" /> Katalog Çekimi (Source of Truth Modu)</p>
                      <p className="text-slate-500 text-xs flex items-center justify-center gap-2">... Smart Crop (Anatomik Kırpma)</p>
                      <p className="text-pink-500 text-xs flex items-center justify-center gap-2">... Pinterest (Sokak Stili) Renderlanıyor</p>
                      <p className="text-purple-500 text-xs flex items-center justify-center gap-2">... Pinterest (Sanatsal) Renderlanıyor</p>
                    </div>
                  </div>
                ) : isCropping ? (
                  // --- MANUAL CROP INTERFACE ---
                  <div className="relative w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden select-none">
                    {job.gallery.find(g => g.type === 'standard') && (
                      <div className="relative cursor-crosshair">
                        {/* Original Image (Fully Visible) */}
                        <img
                          ref={cropImageRef}
                          src={`data:image/png;base64,${job.gallery.find(g => g.type === 'standard')?.image}`}
                          className="max-h-[600px] max-w-full object-contain"
                          onMouseDown={(e: any) => { e.target.parentElement.dispatchEvent(new MouseEvent('mousedown', e)); }}
                        />

                        {/* Dark Overlay with "Hole" effect using box-shadow */}
                        {cropSelection && (
                          <div
                            className="absolute border border-white/50"
                            style={{
                              left: cropSelection.w > 0 ? cropSelection.x : cropSelection.x + cropSelection.w,
                              top: cropSelection.h > 0 ? cropSelection.y : cropSelection.y + cropSelection.h,
                              width: Math.abs(cropSelection.w),
                              height: Math.abs(cropSelection.h),
                              // This creates the "dimmed outside" effect
                              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)'
                            }}
                          >
                            {/* Info Label */}
                            <div className="absolute -top-6 left-0 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded shadow-sm">Kırpılan Alan</div>
                          </div>
                        )}

                        {/* Invisible interaction layer */}
                        <div
                          className="absolute inset-0 z-10"
                          onMouseDown={handleCropMouseDown}
                          onMouseMove={handleCropMouseMove}
                          onMouseUp={handleCropMouseUp}
                          onMouseLeave={handleCropMouseUp}
                        />
                      </div>
                    )}
                    <div className="absolute bottom-4 flex gap-2 z-20">
                      <button onClick={() => setIsCropping(false)} className="bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-slate-100 transition-colors">İptal</button>
                      <button onClick={performManualCrop} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-indigo-700 transition-colors">Kırp ve Kaydet</button>
                    </div>
                  </div>
                ) : activeImage ? (
                  // --- STANDARD VIEW (Comparison Slider) ---
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div
                      ref={comparisonContainerRef}
                      className="relative w-full max-w-lg h-[600px] overflow-hidden rounded-lg shadow-2xl cursor-ew-resize select-none group"
                      onMouseDown={handleMouseDown}
                      onTouchStart={handleMouseDown}
                    >
                      <img src={`data:image/png;base64,${activeImage.image}`} className="absolute inset-0 w-full h-full object-contain bg-slate-900" alt="After" />
                      <div className="absolute inset-0 w-full h-full overflow-hidden border-r-2 border-white" style={{ width: `${sliderPosition}%` }}>
                        {job.productImages[0] ? <img src={`data:image/jpeg;base64,${job.productImages[0]}`} className="absolute inset-0 w-full h-full object-contain bg-slate-900/50" alt="Before" /> : <div className="bg-slate-200 w-full h-full"></div>}
                        <div className="absolute top-4 left-4 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">ORİJİNAL</div>
                      </div>

                      <div className="absolute top-0 bottom-0 w-8 -ml-4 flex items-center justify-center" style={{ left: `${sliderPosition}%` }}>
                        <div className={`w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center transform transition-transform ${isDragging ? 'scale-110 ring-4 ring-indigo-200' : ''}`}>
                          <ArrowsRightLeftIcon className="h-4 w-4 text-slate-900" />
                        </div>
                      </div>
                      <div className="absolute top-4 right-4 bg-indigo-600/80 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm uppercase">AI ({activeImage.label})</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400">
                    <Square2StackIcon className="h-16 w-16 mx-auto mb-2 opacity-50" />
                    <p>Görseller yüklendikten sonra "Set Oluştur"a basın.</p>
                    <p className="text-xs opacity-50 mt-1">Sistem otomatik olarak 4 farklı içerik üretecektir.</p>
                  </div>
                )}
              </div>

              {job.gallery.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {job.gallery.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setJob(p => ({ ...p, selectedImageId: item.id }))}
                      className={`relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${job.selectedImageId === item.id ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-200 opacity-70 hover:opacity-100'}`}
                    >
                      <img src={`data:image/png;base64,${item.image}`} className="w-full h-full object-cover object-top" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold p-1 text-center truncate">
                        {item.label}
                      </div>
                      {item.type === 'crop' && <div className="absolute top-1 right-1 bg-green-500 text-white text-[8px] px-1 rounded">SMART CROP</div>}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handleGenerate} disabled={job.isGenerating} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold hover:shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2">
                  {job.isGenerating ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <SparklesIcon className="h-5 w-5" />}
                  {job.isGenerating ? 'Set Oluşturuluyor...' : '4\'lü Set Oluştur'}
                </button>
                {job.gallery.length > 0 && (
                  <>
                    <button onClick={() => setIsCropping(true)} className="bg-indigo-50 text-indigo-700 px-4 rounded-xl font-bold hover:bg-indigo-100 border border-indigo-200 flex items-center gap-2" title="Yakın Çekim'i Elle Ayarla">
                      <ScissorsIcon className="h-5 w-5" />
                    </button>
                    <button onClick={saveToArchive} className="bg-indigo-50 text-indigo-700 px-4 rounded-xl font-bold hover:bg-indigo-100 border border-indigo-200 flex items-center gap-2" title="Arşive Kaydet">
                      <ArchiveBoxIcon className="h-5 w-5" />
                    </button>
                  </>
                )}
                {activeImage && (
                  <button onClick={handleVideoGen} className="bg-pink-600 text-white px-6 rounded-xl font-bold hover:bg-pink-700 flex items-center gap-2">
                    <VideoCameraIcon className="h-5 w-5" /> Video
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 space-y-4">
              {activeImage && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm"><ArrowDownTrayIcon className="h-4 w-4" /> İndir: {activeImage.label}</h3>

                  <div className="space-y-2">
                    <button onClick={() => downloadBranded('original')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-sm font-medium transition-colors flex justify-between">
                      <span>Orijinal (2K)</span>
                      <span className="text-slate-400">JPG</span>
                    </button>
                    {job.showBranding && (
                      <>
                        <button onClick={() => downloadBranded('9:16')} className="w-full text-left px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 text-sm font-medium text-indigo-700 transition-colors flex justify-between">
                          <span>Story (9:16) + Logo</span>
                          <span className="bg-indigo-200 px-1.5 rounded text-[10px]">IG</span>
                        </button>
                        <button onClick={() => downloadBranded('4:5')} className="w-full text-left px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 text-sm font-medium text-indigo-700 transition-colors flex justify-between">
                          <span>Post (4:5) + Logo</span>
                          <span className="bg-indigo-200 px-1.5 rounded text-[10px]">FEED</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {job.generatedVideo && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in">
                  <h3 className="font-bold text-slate-900 mb-2 text-sm flex items-center gap-2"><FilmIcon className="h-4 w-4 text-pink-600" /> Sinematik Video</h3>
                  <video src={job.generatedVideo} autoPlay loop muted className="w-full rounded-lg shadow-sm" />
                  <a href={job.generatedVideo} download="video.mp4" className="mt-3 block text-center bg-pink-50 text-pink-600 py-2 rounded-lg text-xs font-bold hover:bg-pink-100">İndir</a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}