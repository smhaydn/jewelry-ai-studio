import { GoogleGenAI, Type } from "@google/genai";

const createAI = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export interface AnalysisResult {
  scenePrompt: string;
}

// 1. AURA DEFINITIONS
const AURA_STYLES = {
  standard: "PURE COMMERCIAL STUDIO PHOTOGRAPHY. \n    BACKGROUND: Solid Neutral Colors (White, Light Grey, Beige) ONLY. NO PLANTS, NO FURNITURE, NO SCENERY. \n    LIGHTING: Softbox Studio Lighting. Even, shadowless, strictly technical. \n    FOCUS: Macro shot of the product. If it's a ring, show HAND ONLY. If it's a necklace, show NECK ONLY. \n    VIBE: E-Commerce Product Listing. Clean, sterile, professional.",
  playful: "LIFESTYLE INFLUENCER AESTHETIC. MEDIUM SHOT (Waist up). Candid, authentic. Golden hour sunlight or cozy cafe lighting. Slightly grainy film look. The model looks relaxed and happy. The jewelry is just a detail in her outfit, NOT the main focus.",
  artistic: "FINE ART BEAUTY EDITORIAL. 'SCULPTURAL & ORGANIC'. \n    STYLING: MINIMALIST. Bare skin (shoulders/neck), soft silk draping. NO BLAZERS. \n    LIGHTING: CHIAROSCURO. Dramatic shadow. \n    COMPOSITION: MEDIUM PORTRAIT (Chest up). Allow breathing room around the model. The jewelry is DELICATE and SMALL in the frame. \n    MOOD: Intimate, Breathless, Expensive.",
};

export const analyzeJewelry = async (productImagesBase64: string[], category: string): Promise<AnalysisResult> => {
  const ai = createAI();
  const model = 'gemini-2.5-flash';

  const prompt = `
    Look at these images of a ${category}.
    Determine the best luxury environment/background for this specific item.
    Do NOT describe the item itself. Only describe the BACKGROUND and LIGHTING.
    Return JSON: { "scenePrompt": "..." }
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
          scenePrompt: { type: Type.STRING }
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

  // NEGATIVE CONSTRAINTS
  let negativeConstraints = "";
  if (cat.includes('kolye') || cat.includes('necklace')) {
    negativeConstraints = "NEGATIVE CONSTRAINT: DO NOT GENERATE RINGS ON FINGERS. DO NOT GENERATE BRACELETS. The product is ONLY the necklace on the neck.";
  } else if (cat.includes('yüzük') || cat.includes('ring')) {
    negativeConstraints = "NEGATIVE CONSTRAINT: Focus only on the hands. Do not confuse with other jewelry.";
  }

  // If Standard mode
  if (variationMode === 'standard') {
    return `${negativeConstraints} Standard commercial framing. Focus on the product placement. Clean composition.`;
  }

  // RING
  if (cat.includes('yüzük') || cat.includes('ring')) {
    return `
      ${negativeConstraints}
      COMPOSITION: "HAND-TO-FACE" PORTRAIT.
      - The model is touching her face, cheek, or lips with the hand wearing the ring.
      - KEY: We must see the Ring AND the Model's Face clearly.
    `;
  }

  // BRACELET
  if (cat.includes('bileklik') || cat.includes('bracelet')) {
    return `
      ${negativeConstraints}
      COMPOSITION: ELEGANT ARM PLACEMENT.
      - Model resting her chin on the back of her hand.
      - The bracelet must be prominent in the foreground.
    `;
  }

  // EARRING
  if (cat.includes('küpe') || cat.includes('earring')) {
    return `
      ${negativeConstraints}
      COMPOSITION: SIDE PROFILE PORTRAIT.
      - Model turned slightly to side.
      - Hand gently tucking hair behind ear to reveal the earring.
      - Focus on ear/jawline.
    `;
  }

  // NECKLACE (Critical fix: Open neck, no hands blocking)
  if (cat.includes('kolye') || cat.includes('necklace')) {
    return `
      ${negativeConstraints}
      COMPOSITION: OPEN DECOLLETAGE PORTRAIT.
      - The model has an open neckline (V-neck or off-shoulder).
      - HANDS: Hands should NOT block the necklace. Hands can be on top of head or resting on chin (away from chest).
      - The necklace must be the STAR of the image on the neck.
    `;
  }

  // BROOCH
  if (cat.includes('broş') || cat.includes('brooch')) {
    return `
      ${negativeConstraints}
      COMPOSITION: UPPER BODY PORTRAIT.
      - Model wearing a blazer/coat.
      - Brooch pinned clearly on lapel.
    `;
  }

  return `${negativeConstraints} High fashion portrait posing.`;
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
  variationMode: 'standard' | 'playful' | 'artistic' = 'standard'
) => {
  const ai = createAI();
  const model = 'gemini-3-pro-image-preview'; // Keeping Preview model for speed/quality balance

  const auraPrompt = AURA_STYLES[variationMode];
  const poseInstruction = getPoseInstruction(category, variationMode);

  // STRICT FIDELITY INSTRUCTIONS
  let fidelityInstruction = "";
  if (variationMode === 'standard') {
    fidelityInstruction = `
    *** CRITICAL: SOURCE OF TRUTH IS THE INPUT IMAGE ***
    - The images provided are the REFERENCE PRODUCT.
    - You must COMPOSITE this exact jewelry onto the model.
    - DO NOT redesign the jewelry. DO NOT add extra stones.
    `;
  } else {
    fidelityInstruction = `
    - Feature the jewelry shown in the input images.
    - Ensure the metal color and stone type match the reference.
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
