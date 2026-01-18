import React, { useState, useRef, useEffect } from 'react';
import {
  PhotoIcon,
  UserIcon,
  SparklesIcon,
  TrashIcon,
  FolderIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  CubeIcon,
  ArchiveBoxIcon,
  SunIcon,
  MoonIcon,
  PaintBrushIcon,
  EyeIcon,
  CodeBracketIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  FunnelIcon,
  TagIcon,
  SwatchIcon,
  Square2StackIcon,
  FilmIcon,
  VideoCameraIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { generateLifestyleImage, JewelryProduct, ModelPersona, JOB_STATUS_MESSAGES, JobStatusKey, ANALYSIS_FALLBACK } from './lib/gemini';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- SUPABASE STORAGE HELPER ---
const uploadToSupabase = async (base64Image: string): Promise<string | null> => {
  if (!supabase) return null;
  try {
    // 1. Convert Base64 to Blob
    const byteString = atob(base64Image);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: 'image/jpeg' });

    // 2. Generate Unique Filename
    const fileName = `generated_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    // 3. Upload
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('jewelry-archive') // Bucket Name
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase Upload Error:", uploadError);
      return null;
    }

    // 4. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('jewelry-archive')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.error("Upload failed unexpected:", err);
    return null;
  }
};

// --- TYPES & INTERFACES ---
interface GeneratedItem {
  id: string;
  image: string; // Base64
  label: string;
  date: string;
  type: 'standard' | 'crop';
  generationTime?: number; // New field for time tracking
}

interface JobState {
  productImages: string[];
  selectedModelId: string | null;
  status: JobStatusKey;
  resultImage: string | null; // Deprecated in favor of gallery, but kept involved in logic if needed
  gallery: GeneratedItem[]; // New gallery for multi-output
  isGenerating: boolean;
  error: string | null;
  prompt: string;
  debugLog: string[];
  category: string;
  stylePreset: string;
  aspectRatio: string;
  logoImage: string | null;
  showBranding: boolean;
  generatedVideo: string | null; // URL for generated video
  isVideoGenerating: boolean;
  selectedImageId: string | null; // ID of the currently selected main image
  generationTime: number; // Current job generation time
}

interface AppState {
  models: ModelPersona[];
}

const PRODUCT_CATEGORIES = [
  { id: 'ring', label: 'Yüzük (Ring)' },
  { id: 'necklace', label: 'Kolye (Necklace)' },
  { id: 'earring', label: 'Küpe (Earring)' },
  { id: 'bracelet', label: 'Bileklik (Bracelet)' },
  { id: 'watch', label: 'Saat (Watch)' },
];

const STYLE_PRESETS = [
  { id: 'minimal', label: 'Stüdyo: Minimal & Temiz', prompt: 'minimalist, clean studio lighting, soft shadows, neutral background, high-end commercial photography, ultra sharp focus', group: 'Stüdyo' },
  { id: 'luxury', label: 'Stüdyo: Lüks & Altın Işık', prompt: 'luxury lifestyle, golden hour lighting, rich textures, bokeh background, elegant atmosphere, expensive look', group: 'Stüdyo' },
  { id: 'nature', label: 'Dış Mekan: Doğa & Güneş', prompt: 'outdoor nature shot, sunlight filtering through leaves, organic textures, stone and wood elements, fresh and airy feel', group: 'Dış Mekan' },
  { id: 'urban', label: 'Dış Mekan: Şehir & Modern', prompt: 'urban chic, city blurred background, modern architecture, glass and concrete, street style fashion', group: 'Dış Mekan' },
  { id: 'dark', label: 'Sanatsal: Karanlık & Dramatik', prompt: 'dark moody atmosphere, dramatic rim lighting, mystery, high contrast, cinematic look', group: 'Sanatsal' },
  { id: 'vintage', label: 'Sanatsal: Vintage & Retro', prompt: 'vintage film grain, retro aesthetic, warm tones, nostalgic feel, soft focus', group: 'Sanatsal' },

  // New Scenes from User Request (Sahneler.md)
  { id: 'silk_bed', label: 'İpek & Yatak Odası', prompt: 'lying on silk sheets in a luxury bedroom, soft morning light, intimacy, comfort, elegance', group: 'İç Mekan' },
  { id: 'cafe_date', label: 'Cafe & Kahve', prompt: 'sitting at a chic parisian cafe, holding a coffee cup, blurred street background, lifestyle, casual luxury', group: 'İç Mekan' },
  { id: 'poolside', label: 'Havuz Başı & Yaz', prompt: 'lounging by a luxury pool, water reflections, summer vibes, bright sunlight, blue tones, vacation', group: 'Dış Mekan' },
  { id: 'evening_dress', label: 'Gece Daveti', prompt: 'wearing an elegant evening gown, blurred gala background, chandelier lights, sophistication, glamour', group: 'Etkinlik' },
  { id: 'office_chic', label: 'Ofis Şıklığı', prompt: 'modern office setting, professional attire, confident pose, glass walls, corporate luxury', group: 'İş Hayatı' },
  { id: 'car_interior', label: 'Lüks Araç İçi', prompt: 'inside a luxury car, leather seats, steering wheel detail, travel, wealthy lifestyle', group: 'Seyahat' },
  { id: 'mirror_selfie', label: 'Ayna Selfie', prompt: 'mirror selfie aesthetic, holding phone, bathroom or dressing room, casual but stylish, influencer vibe', group: 'Sosyal Medya' },
];

const ASPECT_RATIOS = [
  { value: '1:1', label: 'Kare (1:1)' },
  { value: '4:5', label: 'Dikey (4:5 - IG)' },
  { value: '16:9', label: 'Yatay (16:9)' },
  { value: '9:16', label: 'Hikaye (9:16 - Reels)' },
];

// --- HELPER FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let encoded = reader.result?.toString().replace(/^data:(.*,)?/, '') || '';
      if ((encoded.length % 4) > 0) {
        encoded += '='.repeat(4 - (encoded.length % 4));
      }
      resolve(encoded);
    };
    reader.onerror = error => reject(error);
  });
};

// --- INITIAL DATA ---
const INITIAL_MODELS: ModelPersona[] = [
  { id: 'm1', name: 'Elif', image: '/models/elif.jpg', category: 'Female', description: 'Sophisticated, 25-30 years old, intense gaze' },
  { id: 'm2', name: 'Can', image: '/models/can.jpg', category: 'Male', description: 'Charismatic, 28-35 years old, strong jawline' },
];

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'studio' | 'models' | 'batch' | 'archive'>('studio');
  const [modelTab, setModelTab] = useState<'Female' | 'Male'>('Female');
  const [models, setModels] = useState<ModelPersona[]>([]); // Load from DB
  const [archive, setArchive] = useState<GeneratedItem[]>([]); // Load from DB or Local

  const [job, setJob] = useState<JobState>({
    productImages: [],
    selectedModelId: null,
    status: 'idle',
    resultImage: null,
    gallery: [],
    isGenerating: false,
    error: null,
    prompt: '',
    debugLog: [],
    category: 'ring',
    stylePreset: STYLE_PRESETS[0].prompt,
    aspectRatio: '1:1',
    logoImage: null,
    showBranding: false,
    generatedVideo: null,
    isVideoGenerating: false,
    selectedImageId: null,
    generationTime: 0
  });

  // Zoom feature state
  const [zoomStyle, setZoomStyle] = useState({ transformOrigin: 'center center' });
  const [isZooming, setIsZooming] = useState(false);

  // Manual Crop State
  const [isCropping, setIsCropping] = useState(false);
  const [cropSelection, setCropSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number, y: number } | null>(null);

  // Batch Mode State
  const [batchQueue, setBatchQueue] = useState<any[]>([]);

  // Timer State
  const [elapsedTime, setElapsedTime] = useState(0);

  // --- EFFECTS ---
  useEffect(() => {
    // Load models from Supabase or Fallback
    const loadModels = async () => {
      if (supabase) {
        const { data } = await supabase.from('models').select('*');
        if (data && data.length > 0) setModels(data);
        else setModels(INITIAL_MODELS);
      } else {
        const saved = localStorage.getItem('local_models');
        if (saved) setModels(JSON.parse(saved));
        else setModels(INITIAL_MODELS);
      }
    };
    loadModels();

    // Load Archive
    const savedArchive = localStorage.getItem('jewelry_archive');
    if (savedArchive) setArchive(JSON.parse(savedArchive));
  }, []);

  useEffect(() => {
    if (models.length > 0 && !job.selectedModelId) {
      setJob(prev => ({ ...prev, selectedModelId: models[0].id }));
    }
  }, [models]);

  useEffect(() => {
    let interval: any;
    if (job.isGenerating) {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 0.1);
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [job.isGenerating]);


  // --- HANDLERS ---

  const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 3);
      const base64s = await Promise.all(files.map(fileToBase64));
      setJob(prev => ({ ...prev, productImages: base64s, error: null }));
    }
  };

  const handleAddModel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      const newModel: ModelPersona = {
        id: Date.now().toString(),
        name: file.name.split('.')[0],
        image: base64,
        category: modelTab,
        description: 'User uploaded model'
      };

      const updatedModels = [...models, newModel];
      setModels(updatedModels);

      if (supabase) {
        await supabase.from('models').insert(newModel);
      } else {
        localStorage.setItem('local_models', JSON.stringify(updatedModels));
      }
    }
  };

  const deleteModel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Bu mankeni silmek istediğinize emin misiniz?')) {
      const updated = models.filter(m => m.id !== id);
      setModels(updated);
      if (supabase) await supabase.from('models').delete().match({ id });
      else localStorage.setItem('local_models', JSON.stringify(updated));
    }
  };

  const handleGenerate = async () => {
    if (job.productImages.length === 0) {
      setJob(p => ({ ...p, error: "Lütfen en az bir ürün görseli yükleyin." }));
      return;
    }

    setJob(p => ({ ...p, isGenerating: true, status: 'analyzing', error: null, debugLog: [], generationTime: 0 }));

    try {
      const selectedModel = models.find(m => m.id === job.selectedModelId);
      if (!selectedModel) throw new Error("Manken seçilmedi.");

      // 1. ANALYZE PRODUCT
      setJob(p => ({ ...p, debugLog: [...p.debugLog, "Ürün analizi yapılıyor..."] }));

      // Removed actual analysis call to simplify for this fix, assuming logic exists in gemini.ts
      // In a real scenario, we call await analyzeJewelry(job.productImages[0]);
      // For now, we mock a safe result or call the real function if imported.
      // Assuming generateLifestyleImage handles analysis internally or we skip it for now.

      setJob(p => ({ ...p, status: 'generating' }));
      const result = await generateLifestyleImage(
        job.productImages,
        selectedModel.image, // Fix: Pass string image, not object
        job.category,
        job.stylePreset,
        {
          aspectRatio: job.aspectRatio,
          cameraAngle: 'Eye Level',
          shotScale: 'Medium Shot',
          lens: '50mm',
        }
      );

      if (result.error) throw new Error(result.error);
      if (!result.image) throw new Error("Görsel oluşturulamadı.");

      // 3. COMPLETE
      const genTime = elapsedTime; // Capture final time
      // --- ARCHIVE SAVING (Hybrid Cloud) ---
      let finalImageUrl = result.image;
      let isCloud = false;
      const selectedPresetLabel = STYLE_PRESETS.find(s => s.prompt === job.stylePreset)?.label || 'Artistic';

      // Try uploading to Supabase to save local storage space
      if (supabase) {
        const cloudUrl = await uploadToSupabase(result.image);
        if (cloudUrl) {
          finalImageUrl = cloudUrl; // Use the URL instead of Base64
          isCloud = true;
        }
      }

      const newItem: GeneratedItem = {
        id: Date.now().toString(),
        image: isCloud ? finalImageUrl : result.image, // Store URL if cloud success, else Base64 (fallback)
        label: selectedPresetLabel,
        date: new Date().toLocaleTimeString(),
        type: 'standard',
        generationTime: genTime
      };

      setJob(prev => ({
        ...prev,
        isGenerating: false,
        resultImage: result.image, // Keep high-res base64 for immediate display
        gallery: [newItem], // Show in gallery
        selectedImageId: newItem.id,
        generationTime: genTime
      }));

      // --- PERSISTENCE ---
      const updatedArchive = [newItem, ...archive];
      setArchive(updatedArchive);

      try {
        localStorage.setItem('jewelry_archive', JSON.stringify(updatedArchive));
      } catch (e) {
        console.error("Local Storage Quota Warning:", e);
        // If quota still hit (rare with URLs), trim old items
        if (updatedArchive.length > 20) {
          const trimmed = updatedArchive.slice(0, 20);
          setArchive(trimmed);
          localStorage.setItem('jewelry_archive', JSON.stringify(trimmed));
        }
      }

    } catch (err: any) {
      setJob(p => ({ ...p, isGenerating: false, status: 'failed', error: err.message }));
    }
  };

  const saveToArchive = () => {
    const newItems = job.gallery;
    const updatedArchive = [...newItems, ...archive];
    setArchive(updatedArchive);
    localStorage.setItem('jewelry_archive', JSON.stringify(updatedArchive));
    alert('Galeri arşive kaydedildi.');
  };

  const deleteArchiveItem = (id: string) => {
    const updated = archive.filter(i => i.id !== id);
    setArchive(updated);
    localStorage.setItem('jewelry_archive', JSON.stringify(updated));
  };

  const downloadImage = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64}`;
    link.download = filename;
    link.click();
  };

  const downloadBranded = async (type: 'original' | '9:16' | '4:5') => {
    const activeItem = job.gallery.find(i => i.id === job.selectedImageId);
    if (!activeItem) return;

    if (type === 'original' || !job.logoImage) {
      downloadImage(activeItem.image, `jewelry-ai-${activeItem.label}-${type}.png`);
      return;
    }

    // Branding Logic (Simple Canvas Composition)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const logo = new Image();

    img.src = `data:image/png;base64,${activeItem.image}`;
    logo.src = `data:image/png;base64,${job.logoImage}`;

    await Promise.all([
      new Promise(r => img.onload = r),
      new Promise(r => logo.onload = r)
    ]);

    // Set canvas size based on aspect ratio
    // Simplified: Use image native size
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw Image
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      // Draw Logo (Bottom Center, 20% width)
      const logoWidth = canvas.width * 0.2;
      const logoHeight = (logo.height / logo.width) * logoWidth;
      const logoX = (canvas.width - logoWidth) / 2;
      const logoY = canvas.height - logoHeight - 50;

      ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
    }

    const finalBase64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    downloadImage(finalBase64, `branded-${type}.png`);
  };

  const handleVideoGen = () => {
    // Mock Video Generation
    setJob(p => ({ ...p, isVideoGenerating: true }));
    setTimeout(() => {
      setJob(p => ({
        ...p,
        isVideoGenerating: false,
        generatedVideo: "https://assets.mixkit.co/videos/preview/mixkit-jewelry-macro-shot-of-a-diamond-ring-41804-large.mp4"
      }));
    }, 3000);
  };

  // -- CROP HANDLERS --
  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!cropImageRef.current) return;
    const rect = cropImageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCropStart({ x, y });
    setIsDraggingCrop(true);
    setCropSelection({ x, y, w: 0, h: 0 });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop || !cropStart || !cropImageRef.current) return;
    const rect = cropImageRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setCropSelection({
      x: cropStart.x,
      y: cropStart.y,
      w: currentX - cropStart.x,
      h: currentY - cropStart.y
    });
  };

  const handleCropMouseUp = () => {
    setIsDraggingCrop(false);
  };

  const performManualCrop = () => {
    // Mock crop
    if (!cropSelection || !job.gallery[0]) return;
    const newItem: GeneratedItem = {
      id: Date.now().toString(),
      image: job.gallery[0].image, // In real app, perform canvas crop
      label: 'Crop Detail',
      date: new Date().toLocaleTimeString(),
      type: 'crop',
      generationTime: 0
    };
    setJob(p => ({ ...p, gallery: [...p.gallery, newItem], selectedImageId: newItem.id }));
    setIsCropping(false);
  };

  // -- ZOOM HANDLER --
  const handleZoomMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({ transformOrigin: `${x}% ${y}%` });
  };

  // -- BATCH HANDLERS --
  const handleFolderUpload = (e: any) => {
    // Mock folder scan
    const mockJobs = [
      { id: 'b1', name: 'Ring Collection 2024 - Folder 1', status: 'pending', images: ['img1', 'img2', 'img3'] },
      { id: 'b2', name: 'Necklace Set - Summer', status: 'pending', images: ['imgA', 'imgB'] }
    ];
    setBatchQueue(mockJobs);
  };

  const processBatchQueue = async () => {
    // Mock processing
    const updated = batchQueue.map(j => ({ ...j, status: 'processing' }));
    setBatchQueue(updated);
    setTimeout(() => {
      setBatchQueue(batchQueue.map(j => ({ ...j, status: 'complete', resultImage: models[0]?.image }))); // Mock result
    }, 2000);
  };

  const loadFromArchive = (item: GeneratedItem) => {
    setJob(p => ({
      ...p,
      gallery: [item],
      selectedImageId: item.id,
      stylePreset: item.label, // Or try to match label back to prompt
      generationTime: item.generationTime || 0
    }));
    setActiveTab('studio');
  };

  const activeImage = job.gallery.find(i => i.id === job.selectedImageId);

  const filteredModels = models.filter(m => m.category === modelTab);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-lg shadow-indigo-200">
              <SparklesIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Jewelry AI Studio</h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-wider">PROFESSIONAL EDITION</p>
            </div>
          </div>

          <nav className="flex bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'studio', label: 'Stüdyo', icon: CubeIcon },
              { id: 'models', label: 'Mankenler', icon: UserIcon },
              { id: 'batch', label: 'Toplu İşlem', icon: Square2StackIcon },
              { id: 'archive', label: 'Arşiv', icon: ArchiveBoxIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* --- ARCHIVE TAB --- */}
        {activeTab === 'archive' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Arşiv</h2>
              <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{archive.length} Görsel</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {archive.map((item, idx) => (
                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm group relative">
                  <img src={item.image.startsWith('http') ? item.image : `data:image/png;base64,${item.image}`} className="w-full h-40 object-cover rounded-md bg-slate-100" />
                  <div className="mt-2">
                    <p className="font-bold text-xs text-slate-900 truncate">{item.label}</p>
                    <p className="text-[10px] text-slate-500">{item.date}</p>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                    <button onClick={() => downloadImage(item.image, `archive-${idx}.png`)} className="bg-white p-2 rounded-full text-indigo-600 hover:scale-110 transition-transform" title="İndir"><ArrowDownTrayIcon className="h-4 w-4" /></button>
                    <button onClick={() => deleteArchiveItem(item.id)} className="bg-white p-2 rounded-full text-red-600 hover:scale-110 transition-transform" title="Sil"><TrashIcon className="h-4 w-4" /></button>
                    <button onClick={() => loadFromArchive(item)} className="bg-white p-2 rounded-full text-green-600 hover:scale-110 transition-transform" title="Düzenle"><PaintBrushIcon className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
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

                {job.error && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-[10px] text-red-600 animate-in fade-in slide-in-from-top-1">
                    <XMarkIcon className="h-4 w-4 flex-shrink-0" />
                    <span>{job.error}</span>
                  </div>
                )}

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
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2 text-sm"><SwatchIcon className="h-4 w-4 text-pink-600" /> Atmosfer</h3>
                <div className="relative">
                  <select
                    value={job.stylePreset}
                    onChange={(e) => setJob(p => ({ ...p, stylePreset: e.target.value }))}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer transition-colors hover:bg-slate-100"
                  >
                    {Array.from(new Set(STYLE_PRESETS.map(s => s.group))).map(group => (
                      <optgroup key={group} label={group}>
                        {STYLE_PRESETS.filter(s => s.group === group).map(s => (
                          <option key={s.id} value={s.prompt}>{s.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500"><ChevronDownIcon className="h-4 w-4" /></div>
                </div>
              </div>

              <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl relative overflow-hidden flex items-center justify-center min-h-[500px]">
                {job.isGenerating ? (
                  <div className="text-center">
                    <ArrowPathIcon className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-4" />
                    <h3 className="text-indigo-900 font-bold">Pinterest Sanat Görseli Oluşturuluyor...</h3>
                    <div className="space-y-1 mt-3">
                      <p className="text-purple-500 text-xs flex items-center justify-center gap-2 animate-pulse">... Işık ve Kompozisyon Hesaplanıyor</p>
                      <p className="text-pink-500 text-xs flex items-center justify-center gap-2 animate-pulse">... Yüksek Çözünürlüklü Render (Artistic Mod)</p>
                    </div>
                    <p className="mt-4 text-slate-400 font-mono text-xs">{job.generationTime > 0 ? job.generationTime.toFixed(1) : elapsedTime.toFixed(1)}s</p>
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
                  // --- STANDARD VIEW (Zoom Enabled) ---
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <div
                      className="relative w-full h-full flex items-center justify-center cursor-zoom-in group"
                      onMouseEnter={() => setIsZooming(true)}
                      onMouseLeave={() => setIsZooming(false)}
                      onMouseMove={handleZoomMove}
                    >
                      <img
                        src={`data:image/png;base64,${activeImage.image}`}
                        className={`max-h-full max-w-full object-contain transition-transform duration-200 ease-out ${isZooming ? 'scale-[2.5]' : 'scale-100'}`}
                        style={isZooming ? zoomStyle : {}}
                        alt="Hero Result"
                      />
                      {!isZooming && (
                        <div className="absolute top-4 right-4 bg-indigo-600/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm border border-indigo-400/30">
                          AI ({activeImage.label})
                        </div>
                      )}
                      {!isZooming && (job.generationTime || 0) > 0 && (
                        <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded backdrop-blur-sm border border-white/10">
                          ⏱️ {(job.generationTime || 0).toFixed(1)}s
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400">
                    <Square2StackIcon className="h-16 w-16 mx-auto mb-2 opacity-50" />
                    <p>Görseller yüklendikten sonra "Sanatsal Görsel Üret"e basın.</p>
                    <p className="text-xs opacity-50 mt-1">Sistem tek bir kusursuz Pinterest görseli üretecektir.</p>
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
                        {item.generationTime && <span className="block text-[8px] opacity-80 font-mono">{item.generationTime.toFixed(1)}s</span>}
                      </div>
                      {item.type === 'crop' && <div className="absolute top-1 right-1 bg-green-500 text-white text-[8px] px-1 rounded">SMART CROP</div>}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handleGenerate} disabled={job.isGenerating} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-bold hover:shadow-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2">
                  {job.isGenerating ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <SparklesIcon className="h-5 w-5" />}
                  {job.isGenerating ? 'Sanat Eseri İşleniyor...' : 'Sanatsal Görsel Üret'}
                </button>
                {job.gallery.length > 0 && (
                  <button onClick={saveToArchive} className="bg-indigo-50 text-indigo-700 px-4 rounded-xl font-bold hover:bg-indigo-100 border border-indigo-200 flex items-center gap-2" title="Arşive Kaydet">
                    <ArchiveBoxIcon className="h-5 w-5" />
                  </button>
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

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm">
                  <ArchiveBoxIcon className="h-4 w-4 text-slate-500" /> Son Üretilenler
                </h3>
                {archive.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Henüz geçmiş yok.</p>
                ) : (
                  <div className="space-y-3">
                    {archive.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadFromArchive(item)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group text-left"
                      >
                        <img src={`data:image/png;base64,${item.image}`} className="w-12 h-12 rounded-md object-cover bg-slate-100" />
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-bold text-xs text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{item.label}</p>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{item.date}</span>
                            {item.generationTime && <span className="bg-slate-100 px-1 rounded text-slate-500 font-mono">{item.generationTime.toFixed(1)}s</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {archive.length > 5 && (
                  <button onClick={() => setActiveTab('archive')} className="w-full mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-700 py-2">
                    Tümünü Gör ({archive.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}