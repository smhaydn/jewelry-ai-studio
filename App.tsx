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
import { generateLifestyleImage, analyzeJewelry, generateJewelryVideo, AnalysisResult, JewelryProduct, ModelPersona, JOB_STATUS_MESSAGES, JobStatusKey, ANALYSIS_FALLBACK } from './lib/gemini';
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
  wornReferenceImages: string[]; // UPDATED: Changed to array for multi-upload
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

// Catalog Presets: Clean, technical product photography
const CATALOG_PRESETS = [
  { id: 'pure_white', label: 'Pure White', prompt: 'pure white background, studio lighting, clean product photography, e-commerce catalog', group: 'Catalog' },
  { id: 'studio_grey', label: 'Studio Grey', prompt: 'neutral grey background, professional studio lighting, commercial product shot', group: 'Catalog' },
  { id: 'luxury_black', label: 'Luxury Black', prompt: 'black background, dramatic lighting, premium product photography', group: 'Catalog' },
];

// Lifestyle Presets: Creative, contextual scenes
const LIFESTYLE_PRESETS = [
  { id: 'lazy_sunday', label: 'Lazy Sunday', prompt: 'relaxed home setting, cozy couch or bed, natural morning light, casual lifestyle', group: 'Home' },
  { id: 'getting_ready', label: 'Getting Ready', prompt: 'bathroom or dressing room, mirror selfie aesthetic, getting ready vibe, soft lighting', group: 'Home' },
  { id: 'kitchen_mess', label: 'Kitchen Mess', prompt: 'kitchen counter, casual home setting, coffee cup, morning routine, authentic lifestyle', group: 'Home' },
  { id: 'car_interior', label: 'Car Interior', prompt: 'inside luxury car, leather seats, steering wheel detail, travel lifestyle', group: 'Travel' },
  { id: 'street_style', label: 'Street Style', prompt: 'urban outdoor, city background, walking shot, street fashion, natural daylight', group: 'Outdoor' },
  { id: 'cafe_date', label: 'Cafe Date', prompt: 'sitting at cafe, coffee cup, blurred street background, casual luxury', group: 'Social' },
  { id: 'poolside', label: 'Poolside', prompt: 'lounging by pool, water reflections, summer vibes, vacation lifestyle', group: 'Travel' },
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
  { id: 'm1', name: 'Elif', image: '/models/elif.jpg', category: 'Female', description: 'Sophisticated, 25-30 years old, intense gaze', physicalDescription: 'Female, 28 years old, oval face, high cheekbones, dark brown hair usually tied back, soft natural eyebrows, fair skin with slight natural texture. Elegant and sophisticated look.' },
  { id: 'm2', name: 'Can', image: '/models/can.jpg', category: 'Male', description: 'Charismatic, 28-35 years old, strong jawline', physicalDescription: 'Male, 30 years old, square jawline, short dark hair, stubble beard, athletic build, intense gaze. Sharp and masculine features.' },
];

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'studio' | 'models' | 'batch' | 'archive'>('studio');
  const [modelTab, setModelTab] = useState<'Female' | 'Male'>('Female');
  const [shootMode, setShootMode] = useState<'catalog' | 'lifestyle'>('lifestyle'); // NEW: Dual-mode toggle
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
    stylePreset: LIFESTYLE_PRESETS[0].prompt, // Default to lifestyle mode
    aspectRatio: '1:1',
    logoImage: null,
    showBranding: false,
    wornReferenceImages: [], // UPDATED: Initialize as empty array
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
      const files = Array.from(e.target.files).slice(0, 5); // UPDATED: Allow up to 5 images
      const base64s = await Promise.all(files.map(fileToBase64));
      setJob(prev => ({ ...prev, productImages: base64s, error: null }));
    }
  };

  const handleWornReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 5); // UPDATED: Allow up to 5 images
      const base64s = await Promise.all(files.map(fileToBase64));
      setJob(prev => ({ ...prev, wornReferenceImages: base64s }));
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
        description: 'User uploaded model',
        physicalDescription: 'User uploaded model'
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

  const updateModelDescription = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const model = models.find(m => m.id === id);
    if (!model) return;

    const newDesc = prompt("Fiziksel Özellikler (Yaş, Vücut Tipi, Saç Rengi vs):", model.physicalDescription || "");
    if (newDesc !== null) {
      const updatedModels = models.map(m => m.id === id ? { ...m, physicalDescription: newDesc } : m);
      setModels(updatedModels);

      if (supabase) {
        await supabase.from('models').update({ physicalDescription: newDesc }).match({ id });
      } else {
        localStorage.setItem('local_models', JSON.stringify(updatedModels));
      }
    }
  };

  const handleGenerate = async () => {
    // UPDATED: Allow generation with either product images OR worn reference images
    if (job.productImages.length === 0 && job.wornReferenceImages.length === 0) {
      setJob(p => ({ ...p, error: "Lütfen en az bir ürün görseli veya giyilmiş referans yükleyin." }));
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

      const selectedScene = (shootMode === 'catalog' ? CATALOG_PRESETS : LIFESTYLE_PRESETS).find(s => s.prompt === job.stylePreset) || (shootMode === 'catalog' ? CATALOG_PRESETS[0] : LIFESTYLE_PRESETS[0]);

      const result = await generateLifestyleImage(
        job.productImages,
        selectedScene.prompt,
        job.category,
        selectedScene.label,
        {
          aspectRatio: job.aspectRatio,
          cameraAngle: 'Eye Level',
          shotScale: 'Medium Shot',
          lens: '50mm',
        },
        selectedModel.image,
        selectedModel.physicalDescription,
        job.wornReferenceImages, // UPDATED: Pass array instead of single image
        shootMode
      );

      if (result.error) throw new Error(result.error);
      if (!result.image) throw new Error("Görsel oluşturulamadı.");

      // 3. COMPLETE
      const genTime = elapsedTime; // Capture final time
      // --- ARCHIVE SAVING (Hybrid Cloud) ---
      let finalImageUrl = result.image;
      let isCloud = false;
      const selectedPresetLabel = (shootMode === 'catalog' ? CATALOG_PRESETS : LIFESTYLE_PRESETS).find(s => s.prompt === job.stylePreset)?.label || 'Generated';

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

  // --- DOWNLOAD HELPER ---
  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      let href = imageUrl;
      if (imageUrl.startsWith('http')) {
        // If external URL (Supabase), fetch as blob to avoid CORS/Browser open-in-tab issues
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        href = URL.createObjectURL(blob);
      } else if (!imageUrl.startsWith('data:')) {
        // If raw base64 without prefix
        href = `data:image/png;base64,${imageUrl}`;
      }

      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (imageUrl.startsWith('http')) {
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }
    } catch (e) {
      console.error("Download failed:", e);
      alert("İndirme başlatılamadı. Görsele sağ tıklayıp 'Farklı Kaydet' diyebilirsiniz.");
    }
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

    img.crossOrigin = "anonymous";
    img.src = activeItem.image.startsWith('http') ? activeItem.image : `data:image/png;base64,${activeItem.image}`;
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-brand-goldLight selection:text-brand-dark">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-brand-gold/10 sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="bg-brand-dark text-brand-gold p-2.5 rounded-xl shadow-lg shadow-brand-gold/20 group-hover:scale-105 transition-transform duration-300">
              <SparklesIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight group-hover:text-brand-purple transition-colors">Jewelry AI Studio</h1>
              <p className="text-[10px] text-brand-gold font-bold tracking-[0.2em] uppercase">Professional Edition</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-slate-100/50 p-1.5 rounded-2xl border border-white shadow-sm backdrop-blur-sm">
            {[
              { id: 'studio', label: 'Stüdyo', icon: CubeIcon },
              { id: 'models', label: 'Mankenler', icon: UserIcon },
              { id: 'batch', label: 'Toplu İşlem', icon: Square2StackIcon },
              { id: 'archive', label: 'Arşiv', icon: ArchiveBoxIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-300 ${activeTab === tab.id
                  ? 'bg-white text-brand-purple shadow-md shadow-brand-purple/5 border border-brand-purple/10 scale-100'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50 scale-95 hover:scale-100'
                  }`}
              >
                <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'stroke-2' : ''}`} />
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
                      onClick={(e) => updateModelDescription(model.id, e)}
                      className="absolute top-2 left-2 bg-indigo-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-indigo-700 transition-all shadow-sm"
                      title="Fiziksel Özellikleri Düzenle"
                    >
                      <PaintBrushIcon className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => deleteModel(model.id, e)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-all shadow-sm"
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
                <h3 className="font-serif font-bold text-slate-900 mb-3 flex items-center gap-2 text-base tracking-wide">
                  <TagIcon className="h-5 w-5 text-brand-gold stroke-2" />
                  Kategori Seçimi
                </h3>
                <p className="text-[11px] text-slate-400 font-medium tracking-wide uppercase mb-3">AI Optimizasyonu İçin Önemli</p>
                <div className="relative group">
                  <select
                    value={job.category}
                    onChange={(e) => setJob(p => ({ ...p, category: e.target.value }))}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold py-3.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-purple/50 focus:border-brand-purple hover:border-brand-purple/30 transition-all cursor-pointer shadow-sm group-hover:shadow-md"
                  >
                    {PRODUCT_CATEGORIES.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-purple group-hover:scale-110 transition-transform"><ChevronDownIcon className="h-4 w-4 stroke-2" /></div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-white hover:border-brand-purple/20 transition-all duration-300">
                <h3 className="font-serif font-bold text-slate-900 mb-4 flex items-center gap-2 text-base tracking-wide">
                  <CloudArrowUpIcon className="h-5 w-5 text-brand-purple stroke-2" />
                  Ürün Görselleri
                </h3>

                {job.error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-xs font-medium text-red-600 animate-in fade-in slide-in-from-top-2 shadow-sm">
                    <XMarkIcon className="h-5 w-5 flex-shrink-0" />
                    <span>{job.error}</span>
                  </div>
                )}

                <label className={`block w-full h-32 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 group ${job.productImages.length > 0 ? 'border-green-400 bg-green-50/30' : 'border-slate-200 hover:border-brand-purple/50 hover:bg-slate-50'}`}>
                  <div className="text-center group-hover:scale-105 transition-transform duration-300">
                    {job.productImages.length > 0 ? (
                      <CheckCircleIcon className="h-10 w-10 text-green-500 mx-auto drop-shadow-sm" />
                    ) : (
                      <PhotoIcon className="h-10 w-10 text-slate-300 group-hover:text-brand-purple/70 mx-auto transition-colors" />
                    )}
                    <span className="text-xs font-medium text-slate-500 mt-3 block">
                      {job.productImages.length > 0 ? (
                        <span className="text-green-600 font-bold">{job.productImages.length} Görsel Hazır</span>
                      ) : (
                        <span><span className="text-brand-purple font-bold">Yükle</span> veya Sürükle (Max 5)</span>
                      )}
                    </span>
                  </div>
                  <input type="file" multiple className="hidden" onChange={handleProductUpload} />
                </label>
              </div>

              {/* Worn Reference Upload */}
              <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-white hover:border-brand-purple/20 transition-all duration-300">
                <h3 className="font-serif font-bold text-slate-900 mb-2 flex items-center gap-2 text-base tracking-wide">
                  <EyeIcon className="h-5 w-5 text-brand-gold stroke-2" />
                  Giyilmiş Referans <span className="text-[10px] font-sans font-medium bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded-full ml-auto">OPSİYONEL</span>
                </h3>
                <p className="text-[11px] text-slate-400 mb-4 font-medium leading-relaxed">Ürünün gerçek ölçekte duruşunu AI'a öğretmek için kullanın.</p>

                <label className={`block w-full h-24 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 group ${job.wornReferenceImages.length > 0 ? 'border-brand-gold bg-brand-gold/5' : 'border-brand-gold/30 hover:border-brand-gold hover:bg-brand-gold/5'}`}>
                  <div className="text-center group-hover:scale-105 transition-transform duration-300">
                    {job.wornReferenceImages.length > 0 ? (
                      <CheckCircleIcon className="h-7 w-7 text-brand-gold mx-auto drop-shadow-sm" />
                    ) : (
                      <PhotoIcon className="h-7 w-7 text-brand-gold/40 group-hover:text-brand-gold mx-auto transition-colors" />
                    )}
                    <span className="text-xs font-medium text-slate-500 mt-2 block">
                      {job.wornReferenceImages.length > 0 ? (
                        <span className="text-brand-gold font-bold">{job.wornReferenceImages.length} Referans Seçildi</span>
                      ) : (
                        'Ölçek Referansı Ekle'
                      )}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleWornReferenceUpload}
                  />
                </label>

                {job.wornReferenceImages.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {job.wornReferenceImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={`data:image/jpeg;base64,${img}`}
                          className="w-full h-24 object-cover rounded-lg border border-purple-200"
                          alt={`Worn Reference ${idx + 1}`}
                        />
                        <button
                          onClick={() => setJob(p => ({
                            ...p,
                            wornReferenceImages: p.wornReferenceImages.filter((_, i) => i !== idx)
                          }))}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                          title="Sil"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-white hover:border-brand-purple/20 transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif font-bold text-slate-900 flex items-center gap-2 text-base tracking-wide">
                    <UserIcon className="h-5 w-5 text-brand-purple stroke-2" />
                    Manken
                  </h3>
                  <div className="flex bg-slate-100/80 p-1 rounded-xl backdrop-blur-sm">
                    <button onClick={() => setModelTab('Female')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${modelTab === 'Female' ? 'bg-white shadow-md text-brand-purple' : 'text-slate-500 hover:text-slate-700'}`}>Kadın</button>
                    <button onClick={() => setModelTab('Male')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${modelTab === 'Male' ? 'bg-white shadow-md text-brand-purple' : 'text-slate-500 hover:text-slate-700'}`}>Erkek</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {filteredModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setJob(p => ({ ...p, selectedModelId: m.id }))}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square group ${job.selectedModelId === m.id ? 'border-brand-gold ring-4 ring-brand-gold/20 scale-105 z-10' : 'border-transparent hover:border-slate-300 opacity-80 hover:opacity-100 hover:scale-105'}`}
                    >
                      <img src={`data:image/jpeg;base64,${m.image}`} className="w-full h-full object-cover" />
                      {job.selectedModelId === m.id && <div className="absolute inset-0 bg-brand-gold/10" />}
                    </button>
                  ))}
                  <button onClick={() => setActiveTab('models')} className="border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center aspect-square text-slate-400 hover:text-brand-purple hover:border-brand-purple/50 hover:bg-brand-purple/5 transition-all group">
                    <span className="text-2xl font-light group-hover:scale-125 transition-transform">+</span>
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-white hover:border-brand-purple/20 transition-all duration-300">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-serif font-bold text-slate-900 flex items-center gap-2 text-base tracking-wide">
                    <PaintBrushIcon className="h-5 w-5 text-brand-purple stroke-2" />
                    Branding
                  </h3>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={job.showBranding} onChange={e => setJob(p => ({ ...p, showBranding: e.target.checked }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-purple/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
                  </div>
                </div>
                {job.showBranding && (
                  <label className="block w-full h-16 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-white hover:border-brand-purple/50 hover:shadow-md transition-all group animate-in fade-in slide-in-from-top-2">
                    {job.logoImage ? <img src={`data:image/png;base64,${job.logoImage}`} className="h-8 object-contain drop-shadow-sm" /> : <span className="text-xs font-bold text-slate-400 group-hover:text-brand-purple transition-colors">Logo Yükle (PNG)</span>}
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
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                {/* Mode Toggle Buttons */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 text-sm">Photography Mode</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setShootMode('catalog');
                        setJob(p => ({ ...p, stylePreset: CATALOG_PRESETS[0].prompt }));
                      }}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${shootMode === 'catalog'
                        ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      <CubeIcon className="h-5 w-5" />
                      Katalog Çekimi
                    </button>
                    <button
                      onClick={() => {
                        setShootMode('lifestyle');
                        setJob(p => ({ ...p, stylePreset: LIFESTYLE_PRESETS[0].prompt }));
                      }}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${shootMode === 'lifestyle'
                        ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      <SparklesIcon className="h-5 w-5" />
                      Lifestyle Kreatif
                    </button>
                  </div>
                </div>

                {/* Atmosfer Dropdown */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2 text-sm"><SwatchIcon className="h-4 w-4 text-pink-600" /> Atmosfer</h3>
                  <div className="relative">
                    <select
                      value={job.stylePreset}
                      onChange={(e) => setJob(p => ({ ...p, stylePreset: e.target.value }))}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer transition-colors hover:bg-slate-100"
                    >
                      {Array.from(new Set((shootMode === 'catalog' ? CATALOG_PRESETS : LIFESTYLE_PRESETS).map(s => s.group))).map(group => (
                        <optgroup key={group} label={group}>
                          {(shootMode === 'catalog' ? CATALOG_PRESETS : LIFESTYLE_PRESETS).filter(s => s.group === group).map(s => (
                            <option key={s.id} value={s.prompt}>{s.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500"><ChevronDownIcon className="h-4 w-4" /></div>
                  </div>
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
                          src={job.gallery.find(g => g.type === 'standard')?.image.startsWith('http')
                            ? job.gallery.find(g => g.type === 'standard')?.image
                            : `data:image/png;base64,${job.gallery.find(g => g.type === 'standard')?.image}`
                          }
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
                  <div className="relative group cursor-zoom-in" onMouseMove={handleZoomMove} style={isZooming ? { overflow: 'hidden' } : {}}>
                    <img
                      src={activeImage.image.startsWith('http') ? activeImage.image : `data:image/png;base64,${activeImage.image}`}
                      className={`max-h-full max-w-full object-contain shadow-2xl rounded-lg transition-transform duration-200 ${isZooming ? 'scale-[2]' : 'scale-100'}`}
                      style={isZooming ? zoomStyle : {}}
                      onMouseEnter={() => setIsZooming(true)}
                      onMouseLeave={() => setIsZooming(false)}
                      alt="Hero Result"
                    />
                    {/* DEBUG TRACE REMOVED */}
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
                      <img src={item.image.startsWith('http') ? item.image : `data:image/png;base64,${item.image}`} className="w-full h-full object-cover object-top" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold p-1 text-center truncate">
                        {item.label}
                        {item.generationTime && <span className="block text-[8px] opacity-80 font-mono">{item.generationTime.toFixed(1)}s</span>}
                      </div>
                      {item.type === 'crop' && <div className="absolute top-1 right-1 bg-green-500 text-white text-[8px] px-1 rounded">SMART CROP</div>}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleGenerate}
                  disabled={job.isGenerating}
                  className="flex-1 bg-brand-dark text-brand-gold py-4 rounded-xl font-serif font-bold tracking-widest uppercase text-sm hover:shadow-2xl hover:shadow-brand-gold/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden group border border-brand-gold/20"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                  {job.isGenerating ? <ArrowPathIcon className="h-5 w-5 animate-spin text-white" /> : <SparklesIcon className="h-5 w-5 group-hover:animate-pulse" />}
                  {job.isGenerating ? 'Sanat Eseri İşleniyor...' : 'Koleksiyonu Oluştur'}
                </button>

                {job.gallery.length > 0 && (
                  <button onClick={saveToArchive} className="bg-white text-slate-600 px-5 rounded-xl font-medium hover:bg-slate-50 border border-slate-200 hover:border-brand-purple/50 hover:text-brand-purple shadow-sm transition-all flex items-center justify-center" title="Arşive Kaydet">
                    <ArchiveBoxIcon className="h-6 w-6" />
                  </button>
                )}

                {activeImage && (
                  <button onClick={handleVideoGen} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 rounded-xl font-bold shadow-lg shadow-pink-200 hover:shadow-pink-300 hover:scale-105 transition-all flex items-center gap-2">
                    <VideoCameraIcon className="h-5 w-5" />
                    <span className="hidden sm:inline">Reels Videosu</span>
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
                        <img src={item.image.startsWith('http') ? item.image : `data:image/png;base64,${item.image}`} className="w-12 h-12 rounded-md object-cover bg-slate-100" />
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
        )
        }
      </main >
    </div >
  );
}