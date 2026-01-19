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
  physicalDescription?: string; // New field for forensic identity
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
    const config: any = {
      model,
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
      }
    };
    const result = await ai.models.generateContent(config);

    const text = (result as any).text ? (result as any).text() : (result as any).response?.text();
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
  modelPhysicalDescription?: string,
  wornReferenceBase64s?: string[], // UPDATED: Changed to array for multi-upload
  shootMode?: 'catalog' | 'lifestyle',
  variationMode: 'standard' | 'playful' | 'artistic' = 'artistic',
  detectedMaterial?: { material: string, gemColor: string }
): Promise<{ image: string | null; error: string | null }> => {
  const ai = createAI();
  const model = 'gemini-3-pro-image-preview';

  console.log("📸 Shoot Mode:", shootMode || 'lifestyle (default)');

  // ========================================
  // IDENTITY LOCK (PRESERVED IN BOTH MODES)
  // ========================================
  let modelIdentityPrompt = "";
  if (modelReferenceBase64) {
    modelIdentityPrompt = `
    *** CRITICAL: FORENSIC BIOMETRIC FACE CLONING ***
    - TASK: Biyometric Yüz Kopyalama (Forensic Facial Reconstruction).
    - INPUT: The LAST image is the TARGET IDENTITY.
    - STRICT COMMAND: YOU MUST CLONE THE EXACT FACE FROM THE INPUT IMAGE.
    - BIOMETRIC ANCHORS (DO NOT CHANGE):
      1. CRANIAL STRUCTURE: Copy the exact head shape and jawline width.
      2. NASAL BRIDGE: Maintain the exact nose shape, width, and hump (if any).
      3. EYE DISTANCE: Maintain the exact Inter-pupillary distance.
      4. SKIN IMPERFECTIONS: If the reference has moles, scars, or texture, KEEP THEM.
    - NEGATIVE CONSTRAINTS:
      - DO NOT "Beautify". DO NOT "Instagram Filter". DO NOT "Westernize" or "Standardize" features.
      - DO NOT CHANGE EYEBROW SHAPE.
      - DO NOT CHANGE HAIRLINE.
    - LIGHTING OVERRIDE:
      - Even if the scene is "Dim/Dark", the FACE MUST BE LIT ENOUGH TO SHOW IDENTITY.
      - PRIORITY: IDENTITY > AESTHETICS.
    *** END FORENSIC LOCK ***
    `;
  }

  // PHYSICAL DESCRIPTION INJECTION
  if (modelPhysicalDescription) {
    modelIdentityPrompt += `
    *** MANDATORY PHYSICAL TRAITS (TEXTUAL ANCHOR) ***
    - The target person has the following undeniable traits. YOU MUST ADHERE TO THEM:
    - "${modelPhysicalDescription}"
    - If the image differs from this text, PRIORITIZE THIS TEXT for hair color/style and eye color.
    *** END TEXT ANCHOR ***
    `;
  }

  // ========================================
  // SCALE REFERENCE (WORN PHOTO)
  // ========================================
  let scaleReferencePrompt = "";
  if (wornReferenceBase64s && wornReferenceBase64s.length > 0) {
    scaleReferencePrompt = `
    *** SCALE REFERENCE (CRITICAL - HIGHEST PRIORITY) ***
    
    IMPORTANT: ${wornReferenceBase64s.length} of the reference images show the product WORN on real people.
    These are your ABSOLUTE SCALE ANCHORS.
    
    MANDATORY RULES:
    1. Identify which images show the product worn (on hand/neck/ear/wrist).
    2. Measure the product-to-body ratio in those worn reference images.
    3. Use ALL worn reference images to understand the correct product size from multiple angles.
    4. In your generated image, the product MUST be the EXACT SAME SIZE relative to the model's body.
    5. DO NOT make the product larger or smaller than shown in the worn references.
    6. Copy the size ratio 1:1 from the worn references.
    
    VERIFICATION:
    - Compare: "Is the product the same size relative to the body part as in the worn references?"
    - If the product looks bigger or smaller, ADJUST IT to match the worn references exactly.
    
    PRIORITY: This scale reference overrides all other size instructions.
    
    *** END SCALE REFERENCE ***
    `;
  }

  let fullPrompt = "";

  // ========================================
  // MODE 1: CATALOG (STERILE E-COMMERCE)
  // ========================================
  if (shootMode === 'catalog') {
    // ========================================
    // COMPOSITIONAL ENGINEERING: FRAMING RULES
    // ========================================
    let framingInstruction = "";
    let poseAnchor = "";
    let visualShrinkingKeywords = "";
    const categoryLower = category.toLowerCase();

    if (categoryLower.includes('ring') || categoryLower.includes('yüzük')) {
      framingInstruction = `
      *** FRAMING CONSTRAINT: MEDIUM SHOT (WAIST-UP) ***
      - MANDATORY: SHOW THE WHOLE HAND AND WRIST.
      - MANDATORY: SHOW THE TORSO (waist to shoulders).
      - FORBIDDEN: Do NOT use Macro lens. Do NOT do an extreme close-up of the finger.
      - FORBIDDEN: Do NOT crop at the wrist. The entire hand must be visible.
      - CAMERA DISTANCE: At least 1.5 meters away from the subject.
      `;
      poseAnchor = `
      - POSE ANCHOR: Model's hand is resting near her face, on her shoulder, or touching her collarbone.
      - This provides a FACE-TO-HAND size comparison, forcing correct scale.
      `;
      visualShrinkingKeywords = "dainty, fitted, realistic size, snug fit";
    } else if (categoryLower.includes('earring') || categoryLower.includes('küpe')) {
      framingInstruction = `
      *** FRAMING CONSTRAINT: PORTRAIT SHOT (HEAD AND SHOULDERS) ***
      - MANDATORY: SHOW NECK AND SHOULDER.
      - MANDATORY: SHOW THE ENTIRE HEAD (not just ear).
      - FORBIDDEN: Do NOT do an extreme close-up of the ear only.
      - CAMERA DISTANCE: At least 1 meter away from the subject.
      `;
      poseAnchor = `
      - POSE ANCHOR: Model is slightly turning her head, showing the earring in profile.
      - The face provides scale reference for the ear and earring.
      `;
      visualShrinkingKeywords = "delicate, subtle, small";
    } else if (categoryLower.includes('necklace') || categoryLower.includes('kolye')) {
      framingInstruction = `
      *** FRAMING CONSTRAINT: BUST SHOT (CHEST UP) ***
      - MANDATORY: SHOW SHOULDERS AND UPPER CHEST.
      - MANDATORY: SHOW THE FACE (at least from nose up).
      - FORBIDDEN: Do NOT crop at the neck.
      - CAMERA DISTANCE: At least 1 meter away from the subject.
      `;
      poseAnchor = `
      - POSE ANCHOR: Model is facing forward or slightly turned, showing the necklace resting on the collarbone.
      - The face and shoulders provide scale reference.
      `;
      visualShrinkingKeywords = "delicate, fine, elegant";
    } else if (categoryLower.includes('bracelet') || categoryLower.includes('bileklik')) {
      framingInstruction = `
      *** FRAMING CONSTRAINT: MEDIUM SHOT (WAIST-UP) ***
      - MANDATORY: SHOW THE ENTIRE ARM (from shoulder to hand).
      - FORBIDDEN: Do NOT crop at the elbow or wrist.
      - CAMERA DISTANCE: At least 1.5 meters away from the subject.
      `;
      poseAnchor = `
      - POSE ANCHOR: Model's arm is extended or resting naturally, showing the bracelet in context.
      `;
      visualShrinkingKeywords = "slim, fitted, delicate";
    } else {
      // Default framing for other categories
      framingInstruction = `
      *** FRAMING CONSTRAINT: MEDIUM SHOT ***
      - SHOW THE PRODUCT IN CONTEXT WITH THE BODY.
      - DO NOT use extreme close-ups.
      `;
      poseAnchor = "";
      visualShrinkingKeywords = "realistic size, proportional";
    }

    // Category-specific scale instructions
    let categoryScalePrompt = "";

    if (categoryLower.includes('ring') || categoryLower.includes('yüzük')) {
      categoryScalePrompt = `
      *** RING WEARING PHYSICS & ORIENTATION (CRITICAL) ***
      
      STEP 1: IDENTIFY THE FINGER ENTRY POINT
      - Look at the product reference image carefully.
      - Find the OPENING/GAP/HOLE where the finger enters the ring.
      - This is usually the WIDEST part of the ring band.
      - This opening is typically at the BOTTOM when the ring is standing upright in the photo.
      - This opening is OPPOSITE to the gemstone/decorative element.
      
      STEP 2: UNDERSTAND THE FINGER PATH
      - The finger enters from the OPENING (bottom of the product photo).
      - The finger moves UPWARD through the ring.
      - The finger passes UNDERNEATH the gemstone/decorative part.
      - Result: The gemstone ends up ON TOP of the finger (visible from above).
      
      STEP 3: CORRECT WORN ORIENTATION
      - GEMSTONE/DECORATIVE PART: Must be on TOP of the finger (knuckle side, visible).
      - OPENING/SPLIT SHANK: Must be on BOTTOM of the finger (palm side, hidden from top view).
      - The ring wraps around the finger with the opening hugging from below.
      
      VERIFICATION CHECKLIST:
      - ✓ Can you see the gemstone from the top/front view? (Should be YES)
      - ✓ Is the opening/split visible from the top view? (Should be NO - it's on the palm side)
      - ✓ Does the gemstone appear on the knuckle side? (Should be YES)
      - If any answer is wrong, the ring is UPSIDE DOWN or INCORRECTLY ORIENTED.
      
      STRICTLY FORBIDDEN:
      - DO NOT flip the ring 180° from its reference orientation.
      - DO NOT show the opening/split on top of the finger.
      - DO NOT place the gemstone on the palm side.
      - The finger does NOT enter from the gemstone side.
      
      *** RING-SPECIFIC SCALE RULES ***
      - THE RING BAND RULE: The inner diameter of the ring MUST match the width of the model's finger exactly.
      - FLESH INTERACTION: Focus on the connection point between the finger and the ring. The skin should slightly press against the metal (realistic contact).
      - NO FLOATING: The ring must sit TIGHTLY on the skin, hugging the finger bone.
      - KNUCKLE TEST: The ring should NOT be wider than the knuckle. If it's a chunky/statement ring, preserve its volume but ensure it fits the finger bone.
      - RATIO: The ring should occupy roughly 15-20% of the hand's total vertical length, NOT 50%.
      `;
    } else if (categoryLower.includes('necklace') || categoryLower.includes('kolye')) {
      categoryScalePrompt = `
      *** NECKLACE-SPECIFIC SCALE RULES ***
      - Chain width should be delicate (approx 0.8mm - invisible thread aesthetic).
      - Pendant size: typically 1cm - 2cm, NOT oversized.
      - The necklace should rest naturally on the collarbone/chest, not float.
      `;
    } else if (categoryLower.includes('earring') || categoryLower.includes('küpe')) {
      categoryScalePrompt = `
      *** EARRING-SPECIFIC SCALE RULES ***
      - Earring height: approx 5mm - 15mm for studs/small drops.
      - The earring should sit flush against the earlobe, not dangle unnaturally.
      - Ear size reference: Human earlobes are typically 1.5cm - 2cm in length.
      `;
    } else if (categoryLower.includes('bracelet') || categoryLower.includes('bileklik')) {
      categoryScalePrompt = `
      *** BRACELET-SPECIFIC SCALE RULES ***
      - The bracelet should wrap around the wrist naturally, with slight gap for movement.
      - Width: typically 2mm - 8mm for delicate pieces.
      - Should NOT look like a bangle unless specified.
      `;
    }

    fullPrompt = `
    ${scaleReferencePrompt}
    
    ${modelIdentityPrompt}

    *** CATALOG MODE: STERILE E-COMMERCE PHOTOGRAPHY ***
    
    ${framingInstruction}
    
    SUBJECT: A photo of a professional model. She is wearing a ${visualShrinkingKeywords} ${category}.
    ${poseAnchor}
    
    CAMERA SETTINGS:
    - Shot on Sony A7R IV, 85mm Lens (NOT 100mm Macro)
    - Aperture: f/11 to f/16 (Everything in sharp focus, no bokeh)
    - ISO: 100 (Clean, noise-free)
    - Shutter: 1/125s (Studio sync)
    - FRAMING: Medium Close-Up (Chest up or Waist up). DO NOT frame only the hand/jewelry.
    - CRITICAL: Showing more of the body helps establish correct scale. The hand must look proportional to the torso.
    
    LIGHTING:
    - Studio Softbox Lighting (3-point setup)
    - Evenly lit, no harsh shadows
    - Color temperature: 5500K (Neutral daylight)
    - Fill light to eliminate all shadows
    
    BACKGROUND:
    - ${baseScenePrompt}
    - STRICT: If "Pure White", background must be #FFFFFF with no texture
    - STRICT: If "Studio Grey", background must be neutral grey #C0C0C0
    - STRICT: If "Luxury Black", background must be pure black #000000
    - NO props, NO distracting elements
    
    MODEL DIRECTION:
    - Professional hand/body model posing
    - Perfect, controlled positioning
    - NO emotional expression
    - Hair perfectly styled and controlled
    - Makeup: Minimal, natural, professional
    - Nails: Clean, manicured, neutral polish
    
    COMPOSITION:
    - Product is the ABSOLUTE hero
    - Model is a display mannequin (hands/neck only)
    - Centered, symmetrical framing
    - Clean, uncluttered
    
    VIBE:
    - Sterile, Clinical, High-End E-Commerce
    - Net-A-Porter / Farfetch catalog style
    - Perfectionist, controlled, technical
    
    *** FOCUS PRIORITY (CRITICAL - UNIVERSAL FOR ALL PRODUCTS) ***
    
    - PRIMARY FOCUS POINT: THE ${category.toUpperCase()}
    - The ${category} MUST be in RAZOR-SHARP focus
    - Product sharpness > Model sharpness > Background sharpness
    
    WHAT IS THE PRODUCT:
    - The ${category} is the subject of this photograph
    - Every detail of the ${category} must be visible and sharp
    - Texture, facets, patterns, logos, designs on the ${category} must be crystal clear
    
    CRITICAL RULE:
    - This is ${category.toUpperCase()} PHOTOGRAPHY, not PORTRAIT photography
    - The ${category} is the HERO, not the model
    - If you must choose between sharp product or sharp model face, ALWAYS choose sharp product
    - The model is a display tool for the ${category}, nothing more
    
    FOCUS TECHNIQUE:
    - Lock focus on the ${category}
    - Use focus peaking on the product
    - The ${category} should be the sharpest element in the entire image
    - Model can be slightly softer (acceptable and preferred if it emphasizes product)
    
    *** END FOCUS PRIORITY ***
    
    *** CRITICAL: PHYSICS & SCALE ENFORCEMENT (THE GOLDEN RULE) ***
    
    - OBJECTIVE: The jewelry must look WEARABLE and REALISTIC in size.
    - SIZE CALIBRATION:
      - If the input image shows a "Chunky/Statement Ring" (like an Amber ring), preserve its volume but ensure it fits the finger bone.
      - DO NOT make the jewelry wider than anatomically possible (e.g., ring wider than knuckle).
      - DO NOT scale the jewelry up to show detail. It is better to have a smaller, realistic piece than a giant, fake-looking one.
      - RATIO: Jewelry should occupy a realistic proportion of the body part (15-20% for rings, NOT 50%).
    - NO AI BLOAT: AI models tend to enlarge jewelry for visibility. YOU MUST RESIST THIS URGE.
    - IF IN DOUBT, MAKE THE JEWELRY SMALLER.
    - FINE JEWELRY STANDARDS: Metal is thin, elegant, and precise. This is NOT costume jewelry.
    
    ${categoryScalePrompt}
    
    *** END SCALE ENFORCEMENT ***
    
    NEGATIVE PROMPT (STRICTLY FORBIDDEN):
    - NO blurry background
    - NO messy hair
    - NO emotional expression
    - NO props or lifestyle elements
    - NO candid moments
    - NO natural imperfections
    - NO bokeh or shallow depth of field
    - NO oversized jewelry (giant props)
    - NO floating jewelry (must touch skin)
    
    PRODUCT FIDELITY:
    - The product images are SACRED. Do not alter the design.
    - Maintain exact proportions and scale
    - ${category} should look delicate and fine, not oversized
    - Metal thickness and stone size must match reference exactly
    
    *** END CATALOG MODE ***
    `;
  }
  // ========================================
  // MODE 2: LIFESTYLE (CANDID INFLUENCER)
  // ========================================
  else {
    // Lifestyle scenario mapping
    let scenarioPrompt = "";
    const presetLower = stylePreset.toLowerCase();

    if (presetLower.includes('lazy') || presetLower.includes('sunday') || presetLower.includes('bed')) {
      scenarioPrompt = "Lying in bed with messy sheets, hair in a loose bun, holding a coffee mug, scrolling on phone. Casual, just-woke-up energy.";
    } else if (presetLower.includes('kitchen') || presetLower.includes('mess')) {
      scenarioPrompt = "In a messy kitchen, flour on counter, eating a croissant, laughing. Authentic home moment.";
    } else if (presetLower.includes('car') || presetLower.includes('interior')) {
      scenarioPrompt = "Selfie angle inside a luxury car, sunlight streaming through window, hand on steering wheel. Travel vibe.";
    } else if (presetLower.includes('mirror') || presetLower.includes('selfie') || presetLower.includes('getting ready')) {
      scenarioPrompt = "Taking a photo in a mirror, phone visible in hand, flash firing. Getting-ready aesthetic.";
    } else if (presetLower.includes('street') || presetLower.includes('urban')) {
      scenarioPrompt = "Walking on city street, caught mid-stride, looking back at camera. Street style energy.";
    } else if (presetLower.includes('cafe') || presetLower.includes('coffee')) {
      scenarioPrompt = "Sitting at cafe table, holding coffee cup, blurred street background. Casual luxury.";
    } else if (presetLower.includes('pool') || presetLower.includes('vacation')) {
      scenarioPrompt = "Lounging by pool, wet hair, sunglasses, summer vacation vibe.";
    } else {
      scenarioPrompt = "Candid lifestyle moment, natural and authentic.";
    }

    fullPrompt = `
    ${scaleReferencePrompt}
    
    ${modelIdentityPrompt}

    *** LIFESTYLE MODE: CANDID INFLUENCER AESTHETIC ***
    
    SUBJECT: Authentic lifestyle moment featuring a ${category}.
    
    CAMERA SETTINGS:
    - Shot on iPhone 15 Pro Max (Portrait Mode, Flash ON) OR 35mm Film Camera (Kodak Portra 400)
    - Aperture: f/1.8 or f/2.0 (Shallow depth of field, blurry background)
    - Natural grain and slight imperfections welcome
    - Paparazzi-style direct flash acceptable
    
    LIGHTING:
    - Natural window light, Golden Hour, OR Direct Camera Flash
    - Uncontrolled, authentic lighting
    - Shadows and highlights are natural and imperfect
    - Warm, flattering tones
    
    SCENARIO:
    ${scenarioPrompt}
    
    ENVIRONMENT:
    - ${baseScenePrompt}
    - Messy, lived-in, authentic
    - Props and context elements encouraged
    - Blurred background (bokeh)
    
    MODEL DIRECTION (CRITICAL):
    - The model is NOT posing perfectly
    - She is caught in a candid moment
    - Hair should be slightly messy/natural (NOT perfectly styled)
    - Expression: Natural, authentic, maybe laughing or looking away
    - Body language: Relaxed, not stiff
    - This is NOT a professional photoshoot - it's a real moment
    
    SKIN & TEXTURE:
    - Visible skin texture (pores, slight imperfections)
    - NO plastic smoothness
    - NO heavy retouching
    - Real human skin with natural texture
    - Freckles, moles, texture marks MUST be visible if present
    
    STYLING:
    - Casual, effortless
    - "Old Money" or "Influencer" aesthetic
    - Minimal makeup or natural makeup
    - Nails: Can be natural or trendy (not necessarily perfect)
    - Clothing: Casual luxury (silk robe, oversized sweater, etc.)
    
    VIBE:
    - Candid, Authentic, Imperfect
    - "Caught in the moment"
    - Influencer aesthetic (Sofia Richie, Hailey Bieber style)
    - Messy but chic
    - NOT staged, NOT perfect
    
    COMPOSITION:
    - Product is visible but NOT the only focus
    - Context and lifestyle matter
    - Asymmetrical, natural framing
    - Bokeh background
    
    NEGATIVE PROMPT (STRICTLY FORBIDDEN):
    - NO perfect studio lighting
    - NO stiff, professional posing
    - NO perfectly styled hair
    - NO sterile backgrounds
    - NO catalog-style perfection
    
    PRODUCT FIDELITY:
    - The product images are SACRED. Do not alter the design.
    - Maintain exact proportions and scale
    - ${category} should look delicate and fine, not oversized
    - Metal thickness and stone size must match reference exactly
    
    *** END LIFESTYLE MODE ***
    `;
  }

  const parts: any[] = [{ text: fullPrompt }];

  // INPUT IMAGES
  productImagesBase64.forEach(img => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } });
  });

  // MODEL REFERENCE (Still appended as image, but prompt is now top priority)
  if (modelReferenceBase64) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelReferenceBase64 } });
  }

  // WORN REFERENCE (Scale anchor)
  if (wornReferenceBase64s && wornReferenceBase64s.length > 0) {
    wornReferenceBase64s.forEach(img => {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } });
    });
  }

  const request: any = {
    model,
    contents: [{ role: 'user', parts }],
    generationConfig: {
      imageConfig: {
        aspectRatio: technicalSettings.aspectRatio,
        imageSize: '2K'
      }
    }
  };

  const response = await ai.models.generateContent(request);

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
