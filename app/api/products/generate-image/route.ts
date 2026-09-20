import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { matchCuratedPreset, generateVectorPlaceholder } from '@/lib/catalogImages';

// Lazy initialization of GoogleGenAI client (server-side only)
let aiClient: GoogleGenAI | null = null;

function getAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productName,
      categoryName = 'Retail Item',
      sku = 'SKU',
      brand,
      style = 'Studio Product Photography',
      customPrompt,
    } = body;

    if (!productName || typeof productName !== 'string') {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    // Build focused, commercial catalog prompt
    const brandPrefix = brand ? `by ${brand}` : '';
    const styleDescriptions: Record<string, string> = {
      'Studio Product Photography': 'High-end commercial product photography on seamless light studio backdrop, soft balanced studio lighting, sharp focus, 1:1 square crop, elegant retail catalog presentation.',
      'Minimalist Clean': 'Minimalist Japanese aesthetic, clean negative space, smooth neutral tones, sharp micro-detail, soft ambient daylight, no clutter.',
      'Artisan Cafe': 'Artisan third-wave cafe atmosphere, warm morning sunlight, natural wood counter texture, barista aesthetic, cozy depth of field.',
      'Vector Flat Art': 'Clean modern vector flat graphic, bold geometric silhouettes, vibrant balanced palette, minimalist icon design.',
      '3D Stylized': 'High fidelity 3D clay-render, glossy studio finish, smooth bevels, isometric perspective, premium toy-like tactile finish.',
    };

    const styleDesc = styleDescriptions[style] || styleDescriptions['Studio Product Photography'];

    const promptText = customPrompt && customPrompt.trim().length > 5
      ? customPrompt.trim()
      : `Commercial catalog product photograph of ${productName} ${brandPrefix} (Category: ${categoryName}). ${styleDesc} Isolated subject, pristine clarity, no watermarks, no distorted text, professional retail look.`;

    const ai = getAi();

    if (ai) {
      try {
        // Attempt generation with gemini-3.1-flash-image
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image',
          contents: {
            parts: [{ text: promptText }],
          },
          config: {
            imageConfig: {
              aspectRatio: '1:1',
              imageSize: '512px',
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;

            return NextResponse.json({
              success: true,
              imageUrl: dataUrl,
              source: 'gemini-3.1-flash-image',
              prompt: promptText,
            });
          }
        }
      } catch (geminiError: any) {
        console.warn('Gemini image generation attempt failed, falling back to catalog preset:', geminiError?.message);
        // Secondary attempt with gemini-3.1-flash-lite-image if flash-image model was restricted
        try {
          const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents: {
              parts: [{ text: promptText }],
            },
          });

          const parts = fallbackResponse.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || 'image/png';
              const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;

              return NextResponse.json({
                success: true,
                imageUrl: dataUrl,
                source: 'gemini-3.1-flash-lite-image',
                prompt: promptText,
              });
            }
          }
        } catch {
          // Continue to high-clarity curated / vector fallback below
        }
      }
    }

    // High-Clarity Fallback when Gemini is unavailable or rate-limited
    const curated = matchCuratedPreset(productName);
    if (curated) {
      return NextResponse.json({
        success: true,
        imageUrl: curated.url,
        source: 'curated-photography-engine',
        prompt: promptText,
      });
    }

    const vectorUri = generateVectorPlaceholder({
      name: productName,
      sku,
      categoryName,
    });

    return NextResponse.json({
      success: true,
      imageUrl: vectorUri,
      source: 'vector-schematic-engine',
      prompt: promptText,
    });
  } catch (error: any) {
    console.error('API /api/products/generate-image error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process image generation request' },
      { status: 500 }
    );
  }
}
