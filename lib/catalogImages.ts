// NEXORA POS - Product Catalog Imagery & Visual Clarity Service
import type { Product, Category } from './types';

export interface ImagePreset {
  id: string;
  name: string;
  category: string;
  url: string;
  aspectRatio: string;
}

export const CURATED_IMAGE_PRESETS: ImagePreset[] = [
  {
    id: 'preset_flat_white',
    name: 'Artisan Flat White / Latte',
    category: 'Coffee & Espresso',
    url: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_cold_brew',
    name: 'Nitro Cold Brew Glass',
    category: 'Coffee & Espresso',
    url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_espresso',
    name: 'Double Espresso Cup',
    category: 'Coffee & Espresso',
    url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_cortado',
    name: 'Cortado in Gibraltar Glass',
    category: 'Coffee & Espresso',
    url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_matcha',
    name: 'Ceremonial Matcha Latte',
    category: 'Artisan Teas',
    url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_chai',
    name: 'Spiced Vanilla Chai Latte',
    category: 'Artisan Teas',
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_croissant',
    name: 'Golden Butter Croissant',
    category: 'Bakery & Pastry',
    url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_pain_chocolat',
    name: 'Pain au Chocolat',
    category: 'Bakery & Pastry',
    url: 'https://images.unsplash.com/photo-1623334044303-241021148842?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_sourdough',
    name: 'Artisan Sourdough Loaf',
    category: 'Bakery & Pastry',
    url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_avocado_toast',
    name: 'Avocado Toast with Seeds',
    category: 'Warm Brunch & Bowls',
    url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_kombucha',
    name: 'Ginger Kombucha Bottle',
    category: 'Bottled Drinks',
    url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_sparkling',
    name: 'Sparkling Citrus Water',
    category: 'Bottled Drinks',
    url: 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_coffee_beans',
    name: 'Whole Bean Roasted Coffee Bag',
    category: 'Packaged Beans',
    url: 'https://images.unsplash.com/photo-1587734195503-904fca47e0e9?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_tumbler',
    name: 'Ceramic Travel Tumbler (12oz)',
    category: 'Merchandise & Cups',
    url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_tote',
    name: 'Heavyweight Cotton Tote Bag',
    category: 'Merchandise & Cups',
    url: 'https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
  {
    id: 'preset_granola',
    name: 'Gourmet Roasted Granola Jar',
    category: 'Gourmet Snacks',
    url: 'https://images.unsplash.com/photo-1517093709121-6a166a5c267a?w=600&auto=format&fit=crop&q=80',
    aspectRatio: '1:1',
  },
];

/**
 * Automatically detects a curated photograph based on product keywords.
 */
export function matchCuratedPreset(productName: string, categoryId?: string): ImagePreset | null {
  const q = productName.toLowerCase();

  if (q.includes('flat white') || q.includes('latte') || q.includes('cappuccino')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_flat_white') || null;
  }
  if (q.includes('cold brew') || q.includes('nitro')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_cold_brew') || null;
  }
  if (q.includes('cortado') || q.includes('macchiato')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_cortado') || null;
  }
  if (q.includes('espresso') || q.includes('ristretto') || q.includes('americano')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_espresso') || null;
  }
  if (q.includes('matcha')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_matcha') || null;
  }
  if (q.includes('chai') || q.includes('tea') || q.includes('earl grey')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_chai') || null;
  }
  if (q.includes('croissant') || q.includes('almond croissant')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_croissant') || null;
  }
  if (q.includes('chocolat') || q.includes('chocolate') || q.includes('danish') || q.includes('cookie')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_pain_chocolat') || null;
  }
  if (q.includes('sourdough') || q.includes('bread') || q.includes('loaf') || q.includes('bagel')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_sourdough') || null;
  }
  if (q.includes('avocado') || q.includes('toast') || q.includes('bowl') || q.includes('brunch')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_avocado_toast') || null;
  }
  if (q.includes('kombucha') || q.includes('bottled') || q.includes('cider') || q.includes('juice')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_kombucha') || null;
  }
  if (q.includes('sparkling') || q.includes('water') || q.includes('soda')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_sparkling') || null;
  }
  if (q.includes('bean') || q.includes('roast') || q.includes('ethiopian') || q.includes('colombian') || categoryId === 'cat_retail_beans') {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_coffee_beans') || null;
  }
  if (q.includes('tumbler') || q.includes('cup') || q.includes('mug') || q.includes('bottle')) {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_tumbler') || null;
  }
  if (q.includes('tote') || q.includes('bag') || q.includes('merch') || categoryId === 'cat_merch') {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_tote') || null;
  }
  if (q.includes('granola') || q.includes('snack') || q.includes('nut') || categoryId === 'cat_snacks') {
    return CURATED_IMAGE_PRESETS.find(p => p.id === 'preset_granola') || null;
  }

  return null;
}

/**
 * Generates an SVG Data URI placeholder for a product when offline or no URL is provided.
 * Features high-contrast dark aesthetic, subtle category-coded accent gradients, and typography.
 */
export function generateVectorPlaceholder(product: {
  name: string;
  sku?: string;
  categoryId?: string;
  categoryName?: string;
  themeColor?: string;
}): string {
  const color = product.themeColor || '#0284c7';
  const sku = product.sku || 'SKU';
  const name = product.name || 'Catalog Product';
  const cat = product.categoryName || 'Item';

  // Extract up to 2 initials
  const words = name.trim().split(/\s+/);
  const initials = words.length > 1
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  // Pick an SVG icon silhouette path based on keywords
  const q = name.toLowerCase();
  let iconPath = '';
  if (q.includes('coffee') || q.includes('latte') || q.includes('brew') || q.includes('espresso')) {
    // Hot cup silhouette
    iconPath = `<path d="M140 180h100a10 10 0 0 1 10 10v40a60 60 0 0 1-60 60h-20a60 60 0 0 1-60-60v-40a10 10 0 0 1 10-10zm110 20h20a20 20 0 0 1 20 20v10a20 20 0 0 1-20 20h-20v-50zM120 300h160v15H120zM170 140c0-10 10-20 10-30m30 30c0-10 10-20 10-30m30 30c0-10 10-20 10-30" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`;
  } else if (q.includes('croissant') || q.includes('bread') || q.includes('pastry') || q.includes('loaf')) {
    // Bakery loaf silhouette
    iconPath = `<path d="M120 230c0-50 40-80 80-80s80 30 80 80v20a10 10 0 0 1-10 10H130a10 10 0 0 1-10-10v-20zm35-25l25 25m25-35l25 25m25-35l25 25" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`;
  } else if (q.includes('bean') || q.includes('roast') || product.categoryId === 'cat_retail_beans') {
    // Coffee bean bag silhouette
    iconPath = `<path d="M150 150h100l20 140H130l20-140zm-15-20h130v20H135zm65 70c-20 0-35 15-35 35s15 35 35 35 35-15 35-35-15-35-35-35zm0 15c-5 10-5 25 0 40" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
  } else {
    // Modern retail package box
    iconPath = `<path d="M130 180l70-35 70 35v80l-70 35-70-35v-80zm70-35v115m70-80l-70 35-70-35" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="60%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.30" />
      <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
    </radialGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#334155" stop-opacity="0.2" />
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="400" height="400" rx="36" fill="url(#bgGrad)" />
  <rect width="400" height="400" rx="36" fill="url(#glow)" />
  <rect x="2" y="2" width="396" height="396" rx="34" fill="none" stroke="url(#borderGrad)" stroke-width="2.5" />

  <!-- Subtle grid lines -->
  <line x1="40" y1="40" x2="360" y2="40" stroke="#1e293b" stroke-width="1" opacity="0.4" />
  <line x1="40" y1="360" x2="360" y2="360" stroke="#1e293b" stroke-width="1" opacity="0.4" />

  <!-- Category Pill Badge -->
  <rect x="40" y="32" width="${Math.min(220, cat.length * 8 + 32)}" height="26" rx="13" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-opacity="0.5" stroke-width="1" />
  <text x="56" y="49" fill="${color}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5">${escapeXml(cat.toUpperCase())}</text>

  <!-- SKU Badge -->
  <text x="360" y="49" text-anchor="end" fill="#94a3b8" font-family="ui-monospace, monospace" font-size="11" font-weight="600">${escapeXml(sku)}</text>

  <!-- Icon Silhouette Artwork -->
  <g transform="translate(0, -10)">
    ${iconPath}
  </g>

  <!-- Product Initials Seal -->
  <circle cx="200" cy="205" r="28" fill="#020617" fill-opacity="0.8" stroke="${color}" stroke-opacity="0.7" stroke-width="2" />
  <text x="200" y="213" text-anchor="middle" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="900" letter-spacing="1">${escapeXml(initials)}</text>

  <!-- Product Title & Studio Badge -->
  <rect x="30" y="310" width="340" height="60" rx="16" fill="#020617" fill-opacity="0.85" stroke="#1e293b" stroke-width="1.5" />
  <text x="200" y="336" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">
    ${escapeXml(truncateText(name, 28))}
  </text>
  <text x="200" y="354" text-anchor="middle" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="500">
    NEXORA CATALOG • AI STUDIO SPEC
  </text>
</svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

/**
 * Client-side invoker to generate AI product imagery via our server-side Gemini API route.
 */
export async function requestAiProductImage(params: {
  productName: string;
  categoryName?: string;
  sku?: string;
  brand?: string;
  style?: string;
  customPrompt?: string;
}): Promise<{ imageUrl: string; source: string; prompt: string }> {
  try {
    const res = await fetch('/api/products/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return {
      imageUrl: data.imageUrl,
      source: data.source || 'ai',
      prompt: data.prompt || '',
    };
  } catch (err: any) {
    // Graceful offline/local fallback
    console.warn('AI Image Generation API warning, utilizing high-clarity catalog fallback:', err);
    const matched = matchCuratedPreset(params.productName);
    if (matched) {
      return {
        imageUrl: matched.url,
        source: 'curated-fallback',
        prompt: `Curated retail studio photograph for ${params.productName}`,
      };
    }

    const svgData = generateVectorPlaceholder({
      name: params.productName,
      sku: params.sku,
      categoryName: params.categoryName,
    });

    return {
      imageUrl: svgData,
      source: 'vector-fallback',
      prompt: `Vector studio schematic placeholder for ${params.productName}`,
    };
  }
}
