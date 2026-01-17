import { GoogleGenAI, Type } from "@google/genai";

const createAI = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export interface AnalysisResult {
  scenePrompt: string;
  material: string;
  gemColor: string;
}

// 1. AURA DEFINITIONS (Lighting Removed - Now Dynamic)
const AURA_STYLES = {
  standard: "PURE COMMERCIAL STUDIO PHOTOGRAPHY. \n    BACKGROUND: Solid Neutral Colors (White, Light Grey, Beige) ONLY. NO PLANTS, NO FURNITURE, NO SCENERY. \n    FOCUS: Macro shot of the product. If it's a ring, show HAND ONLY. If it's a necklace, show NECK ONLY. \n    VIBE: E-Commerce Product Listing. Clean, sterile, professional.",
  playful: "LIFESTYLE INFLUENCER AESTHETIC. MEDIUM SHOT (Waist up). Candid, authentic. The model looks relaxed and happy. The jewelry is just a detail in her outfit, NOT the main focus.",
  artistic: "FINE ART BEAUTY EDITORIAL. 'SCULPTURAL & ORGANIC'. \n    STYLING: MINIMALIST. Bare skin (shoulders/neck), soft silk draping. NO BLAZERS. \n    COMPOSITION: MEDIUM PORTRAIT (Chest up). Allow breathing room around the model. The jewelry is DELICATE and SMALL in the frame. \n    MOOD: Intimate, Breathless, Expensive.",
};

export const analyzeJewelry = async (productImagesBase64: string[], category: string): Promise<AnalysisResult> => {
  const ai = createAI();
  const model = 'gemini-2.5-flash';

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

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scenePrompt: { type: Type.STRING },
          material: { type: Type.STRING },
          gemColor: { type: Type.STRING }
        }
      }
    }
  });

  if (!response.text) throw new Error("No analysis generated");
  return JSON.parse(response.text) as AnalysisResult;
};

// 2. DYNAMIC POSING & NEGATIVE CONSTRAINTS
const getPoseInstruction = (category: string, variationMode: string): string => {
  const cat = category.toLowerCase();

  // GLOBAL NEGATIVE CONSTRAINTS (Baseline)
  const baseNegative = "NEGATIVE CONSTRAINT: NO multiple jewelry pieces. NO conflicting accessories. NO busy patterns on clothing.";

  // If Standard mode
  if (variationMode === 'standard') {
    return `${baseNegative} Standard commercial framing. Focus on the product placement. Clean composition.`;
  }

  // --- RING LOGIC ---
  if (cat.includes('yüzük') || cat.includes('ring')) {
    return `
      ${baseNegative} NO BRACELETS. NO WATCHES.
      COMPOSITION: "HAND-TO-FACE" PORTRAIT.
      - The model is touching her face, cheek, or lips with the hand wearing the ring.
      - KEY: We must see the Ring AND the Model's Face clearly.
      - Fingers must look elegant and relaxed, not tense.
      - Do NOT crop the fingers.
    `;
  }

  // --- BRACELET LOGIC ---
  if (cat.includes('bileklik') || cat.includes('bracelet')) {
    return `
      ${baseNegative} NO RINGS. NO WATCHES.
      COMPOSITION: ELEGANT ARM PLACEMENT.
      - Model resting her chin on the back of her hand.
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
      COMPOSITION: ${pose}
      - Focus on ear/jawline.
      - Skin texture must be distinct around the ear.
      - Ensure the earring is NOT hidden by hair.
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
      COMPOSITION: ${pose}
      - HANDS: Hands should NOT block the necklace. Ideally hands are out of frame or resting on head.
      - The necklace must be the STAR.
      - NO HIGH COLLARS apart from Choker style.
    `;
  }

  // --- BROOCH ---
  if (cat.includes('broş') || cat.includes('brooch')) {
    return `
      ${baseNegative}
      COMPOSITION: UPPER BODY PORTRAIT.
      - Model wearing a blazer, coat, or thick knit sweater.
      - Brooch pinned clearly on the lapel or chest area.
    `;
  }

  return `${baseNegative} High fashion portrait posing.`;
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
  variationMode: 'standard' | 'playful' | 'artistic' = 'standard',
  detectedMaterial?: { material: string, gemColor: string }
) => {
  const ai = createAI();
  const model = 'gemini-3-pro-image-preview'; // Keeping Preview model for speed/quality balance

  const auraPrompt = AURA_STYLES[variationMode];
  const poseInstruction = getPoseInstruction(category, variationMode);
  const lightingInstruction = getLightingInstruction(variationMode, stylePreset);

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
    *** CRITICAL: SOURCE OF TRUTH IS THE INPUT IMAGE ***
    - The images provided are the REFERENCE PRODUCT.
    - You must COMPOSITE this exact jewelry onto the model.
    - DO NOT redesign the jewelry. DO NOT add extra stones.
    ${materialConstraint}
    `;
  } else {
    fidelityInstruction = `
    - Feature the jewelry shown in the input images.
    ${materialConstraint}
    - The aesthetic mood is the priority here, but the product must remain recognizable.
    `;
  }

  // Explicit Subject Line
  const subjectLine = `SUBJECT: Professional model wearing a ${category}.`;

  // MODEL INJECTION (MOVED TO TOP PRIORITY)
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
    
    AESTHETIC & ATMOSPHERE (THE AURA):
    ${auraPrompt}
    
    LIGHTING & MOOD:
    ${lightingInstruction}
    
    POSING & COMPOSITION (THE ANATOMY):
    ${poseInstruction}
    
    ENVIRONMENT: ${stylePreset}
    
    ${fidelityInstruction}

    REALISTIC SIZE & SCALE (MANDATORY):
    - *** NEGATIVE CONSTRAINT: DO NOT GENERATE GIANT JEWELRY. ***
    - The jewelry size must be MICROSCOPICALLY ACCURATE to real life.
    - NECKLACE: Must fit delicately on the neck. It is small. It is NOT a breastplate.
    - RING: Must be small and fit on a single finger.
    - EARRING: Must be ear-sized, not shoulder-sized.
    - Camera must be far enough back to show the jewelry in context (Medium Shot), NOT a Macro Zoom.

    REALISM:
    - Skin texture must be 8k resolution, raw photo quality, visible pores, freckles (if applicable), fine hair.
    - No plastic AI skin.
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
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: technicalSettings.aspectRatio,
        imageSize: '2K'
      }
    }
  });

  const responseParts = response.candidates?.[0]?.content?.parts;
  if (!responseParts) throw new Error("No image generated");

  for (const part of responseParts) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }

  throw new Error("No image data found");
};

export const generateJewelryVideo = async (inputImageBase64: string, category: string, stylePreset: string): Promise<string> => {
  const ai = createAI();
  const model = 'veo-3.1-fast-generate-preview';

  const videoPrompt = `
    Cinematic luxury jewelry shot.
    The product is the hero.
    Atmosphere: ${stylePreset}.
    Subtle motion: Light reflections moving on the metal (caustics), model breathing very slightly.
    High fidelity. 4K.
  `;

  let operation = await ai.models.generateVideos({
    model,
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

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed");

  const response = await fetch(`${videoUri}&key=${import.meta.env.VITE_GEMINI_API_KEY}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
