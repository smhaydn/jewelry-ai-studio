/// <reference types="vite/client" />
import { GoogleGenAI, Type } from "@google/genai";

const createAI = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export interface AnalysisResult {
  scenePrompt: string;
  material: string;
  gemColor: string;
}

// --- SHARED TYPES ---
export interface ModelPersona {
  id: string;
  name: string;
  image: string;
  category: string;
  description: string;
}

export interface JewelryProduct {
  id: string;
  name: string;
  image: string;
}

export type JobStatusKey = 'idle' | 'queued' | 'processing' | 'analyzing' | 'generating' | 'complete' | 'failed';

export const JOB_STATUS_MESSAGES: Record<JobStatusKey, string> = {
  idle: "Hazır",
  queued: "Sıraya alındı...",
  processing: "Yapay zeka çalışıyor...",
  analyzing: "Ürün analiz ediliyor...",
  generating: "Görseller üretiliyor...",
  complete: "Tamamlandı!",
  failed: "Hata oluştu."
};

// 1. AURA DEFINITIONS (Lighting Removed - Now Dynamic)
const AURA_STYLES = {
  standard: "PURE PRODUCT HERO CATALOG PHOTOGRAPHY. \\n    FOCUS: The product is the absolute center of page. Show the full item clearly and sharply. \\n    CAMERA: Shot on Sony A7R IV, 90mm Macro or 85mm Prime. f/11 Aperture for edge-to-edge sharpness. \\n    BACKGROUND: Solid Studio Light Grey or Warm White ONLY. No scenery. No windows. \\n    VIBE: High-end E-commerce Catalog (like Net-A-Porter). Sterile, clinical, perfectly balanced. \\n    STRICT CONSTRAINT: NO EMOTION. NO STORY. NO LIFESTYLE CONTEXT. THE PRODUCT IS THE ABSOLUTE HERO.",
  playful: "LIFESTYLE INFLUENCER AESTHETIC. MEDIUM SHOT (Waist up). \\n    CAMERA: Shot on Sony A7R IV, 85mm G-Master Lens, f/1.8 Aperture. Bokeh background. \\n    SKIN DEEP PROTOCOL: Visible vellus hair (peach fuzz), distinct pores, slight imperfections, freckles. REAL HUMAN SKIN. \\n    VIBE: Candid, authentic. Golden hour sunlight or cozy cafe lighting. Slightly grainy film look.",
  artistic: "HIGH-END COMMERCIAL CAMPAIGN AESTHETIC. 'ASPIRATIONAL & POWERFUL'. \n    CHARACTER SOUL: Quiet confidence, regal posture, sharp intelligent gaze. Not a model, but a person of influence. \n    STYLING: MINIMALIST LUXURY. Bare skin (shoulders/neck), soft silk draping, or high-end natural linen. NO BLAZERS. \n    LIGHTING: CARTIER-STYLE CAMPAIGN LIGHTING. High-contrast Rim light. Global Illumination. Ray-traced shadows with golden highlights. \n    COMPOSITION: THE DECISIVE MOMENT. A candid, powerful capture. Allow breathing room (Medium Portrait). \n    SKIN & TEXTURE: Ultra-High Definition. Imperfect skin is premium. Visible pores. \n    REAR-END FINISH: Analog film grain (Kodak Portra 400 feel), subtle lens flare, high-fashion editorial color grading. The jewelry is the HERO, small but striking.",
};

export const analyzeJewelry = async (productImagesBase64: string[], category: string): Promise<AnalysisResult> => {
  const ai = createAI();
  const model = 'gemini-1.5-flash';

  const prompt = `
    Look at these images of a ${category}.
    1. ANALYZE MATERIAL: Is it Yellow Gold, White Gold/Silver, or Rose Gold?
    2. ANALYZE GEMSTONES: What is the main color of the stones? (e.g. Red, Blue, Diamond/Clear, Emerald Green). If none, say "None".
    3. SCENE: Determine the best luxury environment/background.

    Return JSON: 
    { 
      "scenePrompt": "...", 
      "material": "...",
      "gemColor": "..."
    }
  `;

  const parts: any[] = [{ text: prompt }];
  productImagesBase64.forEach(img => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } });
  });

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      generationConfig: {
        // @ts-ignore
        responseMimeType: 'application/json',
      }
    });

    const text = result.response.text();
    if (!text) throw new Error("No analysis generated");
    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.warn("Analysis failed, using fallback:", error);
    // FALLBACK: Return a safe default instead of crashing user flow
    return {
      scenePrompt: "Clean luxury studio background, high-end photography",
      material: "Gold",
      gemColor: "None"
    };
  }
};

export const ANALYSIS_FALLBACK: AnalysisResult = {
  scenePrompt: "Clean luxury studio background, high-end photography",
  material: "Gold",
  gemColor: "None"
};

// 2. DYNAMIC POSING & NEGATIVE CONSTRAINTS
const getPoseInstruction = (category: string, variationMode: string, stylePreset: string): string => {
  const cat = category.toLowerCase();
  const preset = stylePreset.toLowerCase();

  // GLOBAL NEGATIVE CONSTRAINTS (Baseline)
  const baseNegative = "NEGATIVE CONSTRAINT: NO GIANT JEWELRY. NO OVERSIZED STONES. NO CHUNKY BANDS. NO COSTUME JEWELRY LOOK. NO THICK METAL. NO 3D RENDER LOOK. NO SMOOTH PLASTIC SKIN.";

  // If Standard mode - Category Specific Technical Poses
  if (variationMode === 'standard') {
    let techPose = "Standard commercial framing. Focus on product placement.";
    if (cat.includes('yüzük') || cat.includes('ring')) techPose = "HAND ONLY. Flat on surface or elegantly resting. Center the ring.";
    if (cat.includes('kolye') || cat.includes('necklace')) techPose = "NECK AND CHEST ONLY. Symmetrical placement. Head looking forward or slightly away.";
    if (cat.includes('küpe') || cat.includes('earring')) techPose = "EAR AND JAWLINE ONLY. Profile shot. Product is perfectly vertical.";

    return `${baseNegative} ${techPose} No backgrounds. Direct studio lighting.`;
  }

  // --- SCENE CONTEXT LOGIC (NEW: Phase 17) ---
  let sceneContextPose = "";

  // 1. Bedroom / Boudoir / Silk
  if (preset.includes('bed') || preset.includes('morning') || preset.includes('silk') || preset.includes('yatak') || preset.includes('sheets')) {
    sceneContextPose = "CONTEXT POSE: RECLINING / RELAXED. Model is lying back on pillows or silk sheets. Soft, lazy morning energy. Arms stretched overhead or hand running through hair.";
  }
  // 2. Cafe / Restaurant
  else if (preset.includes('cafe') || preset.includes('coffee') || preset.includes('kafe')) {
    sceneContextPose = "CONTEXT POSE: SITTING AT TABLE. Leaning forward slightly, elbows on table. Engaging in conversation. Holding a cup or resting chin on hand.";
  }
  // 3. Pool / Beach / Yacht
  else if (preset.includes('pool') || preset.includes('swim') || preset.includes('havuz') || preset.includes('yacht') || preset.includes('tekne')) {
    sceneContextPose = "CONTEXT POSE: SUNBATHING / LOUNGING. Head tilted back towards the sun. Eyes closed or looking at horizon. Wet hair look. Relaxed luxury.";
  }
  // 4. Street / Urban / City
  else if (preset.includes('street') || preset.includes('city') || preset.includes('sokak') || preset.includes('urban')) {
    sceneContextPose = "CONTEXT POSE: WALKING / IN MOTION. Captured mid-stride or turning back to look at camera. Hair blowing in wind. Dynamic energy.";
  }
  // 5. Nature / Field / Forest
  else if (preset.includes('nature') || preset.includes('forest') || preset.includes('field') || preset.includes('orman') || preset.includes('tarlası')) {
    sceneContextPose = "CONTEXT POSE: ETHEREAL WANDERER. Standing amongst tall grass or flowers. Touching nature. Dreamy, absent-minded expression.";
  }
  // 6. High-End Event / Box / Night
  else if (preset.includes('night') || preset.includes('disco') || preset.includes('gece') || preset.includes('dark')) {
    sceneContextPose = "CONTEXT POSE: SULTRY EVENING. Very confident. Direct eye contact. Shoulders back. 'Bond Girl' energy.";
  }
  else {
    sceneContextPose = "CONTEXT POSE: CLASSIC EDITORIAL. Strong independent posture. Minimal movement. Focus on elegance.";
  }

  // --- RING LOGIC ---
  if (cat.includes('yüzük') || cat.includes('ring')) {
    return `
      ${baseNegative} NO BRACELETS. NO WATCHES.
      ${sceneContextPose}
      COMPOSITION: "HAND-TO-FACE" PORTRAIT (Integrated with Scene).
      - The model is touching her face, cheek, or lips with the hand wearing the ring.
      - KEY: We must see the Ring AND the Model's Face clearly.
      - Fingers must look elegant and relaxed, not tense.
      *** PARTS MODEL ANATOMY (HANDS): World-class Hand Model. Slender, elongated fingers. Soft knuckles. No bulging veins. Smooth, hydrated skin. ***
      *** SCALE ANCHOR & RATIO LOCK: 
      - The ring PROPORTION must be identical to the reference image. 
      - The ring band is DELICATE (1.2mm - 1.5mm thickness). 
      - The stone size is REALSITIC (6mm - 12mm range). 
      - THE RING MUST NOT OVERWHELM THE FINGER. If the product is thin, it must remain thin. 
      - NEGATIVE: NO bulky metal, no thick oversized bands. 
      ***
    `;
  }

  // --- BRACELET LOGIC ---
  if (cat.includes('bileklik') || cat.includes('bracelet')) {
    return `
      ${baseNegative} NO RINGS. NO WATCHES.
      ${sceneContextPose}
      COMPOSITION: ELEGANT ARM PLACEMENT.
      - Model resting her chin on the back of her hand, or fixing hair.
      - The bracelet must be prominent in the foreground.
      - Sleeves must be rolled up or sleeveless to show the wrist/forearm.
    `;
  }

  // --- EARRING LOGIC (Sub-Categories) ---
  if (cat.includes('küpe') || cat.includes('earring')) {
    const isHoop = cat.includes('halka') || cat.includes('hoop');
    const isStud = cat.includes('çivili') || cat.includes('stud') || cat.includes('tektaş') || cat.includes('küçük');
    const isDangle = cat.includes('sallantı') || cat.includes('dangle') || cat.includes('uzun');

    let pose = "SIDE PROFILE PORTRAIT. Hand gently tucking hair behind ear.";

    if (isStud) {
      pose = "EXTREME CLOSE-UP SIDE PROFILE. Hair MUST be tied back in a bun or ponytail. Ear must be fully visible. No loose hair covering the stud.";
    } else if (isHoop) {
      pose = "3/4 ANGLE PORTRAIT. Model looking over shoulder. Hoop earring clearly visible against the neck gap.";
    } else if (isDangle) {
      pose = "FRONT FACING PORTRAIT but head tilted slightly. The earring rests on the neck/shoulder line.";
    }

    return `
      ${baseNegative} NO NECKLACES. NO HATS.
      ${sceneContextPose}
      COMPOSITION: ${pose} (Adapted to Scene)
      - Focus on ear/jawline.
      - Skin texture must be distinct around the ear (visible pores).
      - Ensure the earring is NOT hidden by hair.
      *** SCALE ANCHOR: Compare the jewelry to the Human Ear Lobe. Studs must be 50% SMALLER than the ear lobe. Hoops must be proportionate, staying between the lobe and the shoulder line. DO NOT make them oversized. Accuracy is key. ***
    `;
  }

  // --- NECKLACE LOGIC (Sub-Categories) ---
  if (cat.includes('kolye') || cat.includes('necklace')) {
    const isChoker = cat.includes('tasma') || cat.includes('choker') || cat.includes('kısa');
    const isLong = cat.includes('uzun') || cat.includes('long') || cat.includes('zincir');

    let pose = "OPEN DECOLLETAGE PORTRAIT. V-neck or off-shoulder top.";

    if (isChoker) {
      pose = "HEAD TILTED UP (Chin up). High-neck focus. The choker sits tight on the neck. Shoulders bare.";
    } else if (isLong) {
      pose = "WIDER SHOT. Model leaning back slightly. The long necklace hangs freely over the top/dress. DO NOT CUT OFF the visually bottom part of the necklace.";
    }

    return `
      ${baseNegative} NO RINGS. NO EARRINGS. BARE HANDS.
      ${sceneContextPose}
      COMPOSITION: ${pose} (Adapted to Scene)
      - HANDS: Hands should NOT block the necklace. Ideally hands are out of frame or resting on head/surface.
      - The necklace must be the STAR.
      - NO HIGH COLLARS apart from Choker style.
      *** PARTS MODEL ANATOMY (NECK): "The Swan Neck". Long, elegant, graceful neck. Prominent and feminine clavicles (collarbones). Perfect posture. Smooth skin without neck lines. ***
      *** SCALE ANCHOR & RATIO LOCK: 
      - The chain is almost invisible (0.8mm - 1.0mm thickness). 
      - The pendant size is strictly 1-to-1 with its proportion to the human collarbone in real life. 
      - DO NOT BLOW UP the size for visibility. 
      - Accuracy over impact. 
      ***
    `;
  }

  // --- BROOCH ---
  if (cat.includes('broş') || cat.includes('brooch')) {
    return `
      ${baseNegative}
      ${sceneContextPose}
      COMPOSITION: UPPER BODY PORTRAIT.
      - Model wearing a blazer, coat, or thick knit sweater.
      - Brooch pinned clearly on the lapel or chest area.
    `;
  }

  if (variationMode === 'artistic') {
    return `
      ${baseNegative}
      ${sceneContextPose}
      COMPOSITION: THE ICONIC CAMPAIGN POSE. 
      - The character is NOT posing for the camera. 
      - They are in the middle of a high-status action: adjusting a cufflink, looking away thoughtfully before an entrance, or a subtle head tilt that catches the light.
      - Aspirational energy. Powerful but effortless.
    `;
  }

  return `${baseNegative} High fashion portrait posing. ${sceneContextPose}`;
};

// 3. DYNAMIC LIGHTING ENGINE
const getLightingInstruction = (variationMode: string, stylePreset: string): string => {
  const preset = stylePreset.toLowerCase();

  // STANDARD: Always technical
  if (variationMode === 'standard') {
    return "LIGHTING: SOFTBOX STUDIO. Even, shadowless, strictly technical 5000K Lighting. No artistic shadows.";
  }

  // PLAYFUL: Warm and Natural
  if (variationMode === 'playful') {
    if (preset.includes('night') || preset.includes('akşam') || preset.includes('bar')) {
      return "LIGHTING: CITY NIGHT BOKEH. Warm ambient store lights, neon reflections, cozy atmosphere.";
    }
    return "LIGHTING: GOLDEN HOUR. Warm sunlight hitting the model's face. Natural window light. Soft, flattering, optimistic.";
  }

  // ARTISTIC: Adaptive to Scene
  if (variationMode === 'artistic') {
    // If scene commands lightness
    if (preset.includes('white') || preset.includes('light') || preset.includes('beyaz') || preset.includes('linen') || preset.includes('beach')) {
      return "LIGHTING: HIGH-KEY ETHEREAL. Soft, diffused white light. Dreamy, glowing skin. Low contrast. Angelic vibe.";
    }
    // Default to Dramatic
    return "LIGHTING: CHIAROSCURO & RIM LIGHT. Dramatic interplay of light and shadow. Deep blacks, high contrast. The jewelry catches a dedicated spotlight (Gobo light).";
  }

  return "LIGHTING: Balanced professional lighting.";
};

// 4. DYNAMIC FASHION & STYLING ENGINE
const getStylingInstruction = (gemColor?: string): string => {
  if (!gemColor || gemColor === 'None') return "STYLING: Classic French Manicure. Nude natural makeup. Timeless elegance.";

  const color = gemColor.toLowerCase();

  // RUBY / RED
  if (color.includes('red') || color.includes('ruby') || color.includes('garnet')) {
    return "STYLING: NAILS: Deep Bordeaux or Warm Nude polish. MAKEUP: Warm undertones, subtle berry lip tint. Cohesive warm styling.";
  }
  // EMERALD / GREEN
  if (color.includes('green') || color.includes('emerald')) {
    return "STYLING: NAILS: Soft Beige or Pearl White polish. MAKEUP: Earthy tones, bronzed glow. Sophisticated and grounded.";
  }
  // SAPPHIRE / BLUE
  if (color.includes('blue') || color.includes('sapphire') || color.includes('tanzanite')) {
    return "STYLING: NAILS: Sheer Pink or Soft Cool Grey polish. MAKEUP: Cool undertones, highlighter on cheekbones. Icy elegance.";
  }
  // DIAMOND / WHITE
  if (color.includes('white') || color.includes('diamond') || color.includes('clear')) {
    return "STYLING: NAILS: Clean French Manicure or 'Milky White' trend. MAKEUP: 'No-makeup' makeup look, focus on dewy skin.";
  }
  // GOLD
  if (color.includes('gold') || color.includes('yellow')) {
    return "STYLING: NAILS: Nude/Skin-tone or Soft Gold shimmer. MAKEUP: Golden hour glow, warm blush.";
  }

  return "STYLING: Elegant, high-fashion grooming. Manicured nails (Nude/Neutral).";
};

export const generateLifestyleImage = async (
  productImagesBase64: string[],
  baseScenePrompt: string,
  category: string,
  stylePreset: string,
  technicalSettings: {
    aspectRatio: string;
    cameraAngle: string;
    shotScale: string;
    lens: string;
  },
  modelReferenceBase64?: string | null,
  variationMode: 'standard' | 'playful' | 'artistic' = 'artistic',
  detectedMaterial?: { material: string, gemColor: string }
): Promise<{ image: string | null; error: string | null }> => {
  const ai = createAI();
  const model = 'gemini-3-pro-image-preview'; // Keeping Preview model for speed/quality balance

  const auraPrompt = AURA_STYLES[variationMode];
  const poseInstruction = getPoseInstruction(category, variationMode, stylePreset);
  const lightingInstruction = getLightingInstruction(variationMode, stylePreset);
  const stylingInstruction = getStylingInstruction(detectedMaterial?.gemColor); // NEW: Dynamic Styling

  // STRICT FIDELITY INSTRUCTIONS
  let fidelityInstruction = "";

  // MATERIAL ENFORCEMENT
  let materialConstraint = "";
  if (detectedMaterial) {
    materialConstraint = `
    *** COLOR & MATERIAL ENFORCEMENT ***
    - The jewelry metal is: ${detectedMaterial.material.toUpperCase()}.
    - The gem color is: ${detectedMaterial.gemColor.toUpperCase()}.
    - DO NOT CHANGE THESE COLORS. If it is Silver, DO NOT make it Gold.
    `;
  }

  if (variationMode === 'standard') {
    fidelityInstruction = `
    *** PIXEL-PERFECT PRODUCT FIDELITY: SACRED GEOMETRY LOCK ***
    - The SOURCE images are the ONLY truth. 
    - You MUST use the exact design, stone layout, and metal structure provided.
    - DO NOT add extra stones. DO NOT change the metal thickness.
    - DO NOT redesign the prong settings or the band.
    - Think of this as a composite/placement task, not a generative one.
    ${materialConstraint}
    `;
  } else {
    fidelityInstruction = `
    - *** STRICT GEOMETRY & SCALE LOCK ***: You are FORBIDDEN from enlarging the jewelry. 
    - MAINTAIN THE RATIO: Look at the size of the jewelry relative to the background/original props in the source image. REPLICATE THAT EXACT RATIO on the human model.
    - If the jewelry looks small in the source, it MUST look small on the model.
    ${materialConstraint}
    - Aesthetic mood is secondary to MILLIMETRIC SCALE ACCURACY. The product is FINE JEWELRY, not costume jewelry.
    `;
  }

  // Explicit Subject Line (Lower weight to model in standard mode)
  const subjectLine = variationMode === 'standard'
    ? `SUBJECT: High-end technical catalog shot of a ${category}.`
    : `SUBJECT: Professional model wearing a ${category}.`;

  // MODEL INJECTION (Restored Legacy Logic)
  let modelIdentityPrompt = "";
  if (modelReferenceBase64) {
    modelIdentityPrompt = `
    *** CRITICAL: FACE/MODEL IDENTITY ENFORCEMENT ***
    - The LAST image provided is the REFERENCE MODEL (Target Face).
    - You MUST perform a "Face Swap" operation effectively.
    - The generated person MUST look exactly like the reference model identity.
    - Match: Skin tone, Hair color, Facial structure, Gender, Age.
    - If the reference is Male, generate a Male. If Female, generate Female.
    *** END MODEL IDENTITY ***
    `;
  }

  let fullPrompt = `
    ${modelIdentityPrompt}
    ${subjectLine}

  AESTHETIC & ATMOSPHERE(THE AURA):
    ${auraPrompt}

  LIGHTING & MOOD:
    ${lightingInstruction}

  POSING & COMPOSITION(THE ANATOMY):
    ${poseInstruction}

  FASHION & STYLING(THE LOOK):
    ${stylingInstruction}

  ENVIRONMENT: ${stylePreset}
    
    ${fidelityInstruction}

    REALISTIC SIZE & SCALE(MANDATORY & CRITICAL):
    - *** RATIO LOCK PROTOCOL: REPLICATE THE PRODUCT - TO - BODY RATIO FROM SOURCE. ***
    - PREVENT "AI BLOAT": AI models tend to enlarge jewelry for visibility.YOU MUST RESIST THIS.
    - ** IF IN DOUBT, MAKE THE JEWELRY SMALLER. **
    - FINE JEWELRY STANDARDS: Metal is thin, elegant, and precise. 
    - RING: Band width approx 1.2mm.Stone length max 10mm.DO NOT MAKE IT LOOK LIKE COSTUME JEWELRY.
    - NECKLACE: Chain width approx 0.8mm(Invisible Thread).Pendants are OFTEN SMALL(1cm - 2cm). 
    - EARRING: Earring height approx 5mm - 15mm(studs / small drops).
    - Camera must be far enough back to show the jewelry in its true, delicate context.

    HYPER - REALISM & ANATOMY(THE "HUMAN PERFECTION" STANDARD):
    - ** ANATOMY PRIORITY: WORLD - CLASS PARTS MODEL STANDARD. **
    - HANDS: Slender, elegant, soft knuckles.NO distorted fingers.NO veins.
    - EARS: Small, tucked, perfect helix structure.
    - NECK: Swan - like, long, smooth.
    - CHEST / DECOLLETAGE: Smooth skin, perfect bone structure(clavicles).
    
    - SKIN TEXTURE(NOT PLASTIC):
  - The goal is "High-End Magazine Retouch", NOT "Computer Generated".
    - Visible pores ? YES.
    - Real skin texture ? YES.
    - Plastic smoothness ? NO.
    - ** REFERENCE FIDELITY: The reference model is already perfect.DO NOT "FIX" HER.Just copy her exact skin reality. **

    *** SENSITIVE IDENTITY CHECK(SANDWICH LOCK) ***
    - FINAL VERIFICATION: DOES THE FACE LOOK LIKE THE SISTER OF THE REFERENCE ?
      - IT MUST BE THE * SAME PERSON *.
    - If the reference has freckles, the output MUST have freckles.
    - If the reference has a specific nose shape, the output MUST match.
    - IGNORE "BEAUTY FILTERS".WE WANT THE REAL FACE.
    - KEEP THE IDENTITY 100 % LOCKED.
    *** END IDENTITY LOCK ***
    `;

  const parts: any[] = [{ text: fullPrompt }];

  // INPUT IMAGES
  productImagesBase64.forEach(img => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } });
  });

  // MODEL REFERENCE (Still appended as image, but prompt is now top priority)
  if (modelReferenceBase64) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelReferenceBase64 } });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    generationConfig: {
      // @ts-ignore
      imageConfig: {
        aspectRatio: technicalSettings.aspectRatio,
        imageSize: '2K'
      }
    }
  });

  const responseParts = response.candidates?.[0]?.content?.parts;
  if (!responseParts) return { image: null, error: "Görsel oluşturulamadı (API Yanıtı Boş)" };

  for (const part of responseParts) {
    if (part.inlineData) {
      return { image: part.inlineData.data ?? null, error: null };
    }
  }

  return { image: null, error: "Görsel verisi bulunamadı" };
};

export const generateJewelryVideo = async (inputImageBase64: string, category: string, stylePreset: string): Promise<string> => {
  try {
    const ai = createAI();
    const model = 'veo-3.1-fast-generate-preview';

    const videoPrompt = "Cinematic luxury jewelry shot. The product is the hero. Atmosphere: " + stylePreset + ". Subtle motion: Light reflections moving on the metal (caustics), model breathing very slightly. High fidelity. 4K.";

    let operation = await ai.models.generateVideos({
      model: model,
      prompt: videoPrompt,
      image: {
        imageBytes: inputImageBase64,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16'
      }
    });

    // Polling with safety timeout (max 60s)
    let attempts = 0;
    while (!operation.done && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
      attempts++;
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video timeline timeout");

    // Clean fetch construction
    const fetchUrl = videoUri + "&key=" + import.meta.env.VITE_GEMINI_API_KEY;
    const response = await fetch(fetchUrl);
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error: any) {
    console.error("Video Gen Error:", error);
    if (error.message?.includes("429") || error.message?.includes("Quota")) {
      throw new Error("Video kotası dolu.");
    }
    throw new Error("Video servisi hatası: " + (error.message || "Bilinmeyen"));
  }
};
