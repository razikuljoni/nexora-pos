'use client';

import React, { useState, useEffect, useId } from 'react';
import {
  X,
  Sparkles,
  Link as LinkIcon,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Wand2,
  Palette,
  Camera,
  Layers,
} from 'lucide-react';
import type { Product, Category } from '@/lib/types';
import { db } from '@/lib/db';
import { sound } from '@/lib/audio';
import {
  CURATED_IMAGE_PRESETS,
  matchCuratedPreset,
  generateVectorPlaceholder,
  requestAiProductImage,
} from '@/lib/catalogImages';

interface ProductImageModalProps {
  product: Product | null;
  category?: Category;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedProduct: Product) => void;
}

export const ProductImageModal: React.FC<ProductImageModalProps> = ({
  product,
  category,
  isOpen,
  onClose,
  onSave,
}) => {
  const brandStr = product?.brand ? `by ${product.brand}` : '';
  const catStr = category?.name || 'Retail Product';
  const defaultPrompt = product
    ? `Commercial catalog product photograph of ${product.name} ${brandStr} (${catStr}). Clean white studio background, soft lighting, 4k sharp focus, isolated subject.`
    : '';

  const [activeTab, setActiveTab] = useState<'URL' | 'AI' | 'PRESETS'>('URL');
  const [urlInput, setUrlInput] = useState(product?.image || '');
  const [previewUrl, setPreviewUrl] = useState(product?.image || '');
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputId = useId();

  // AI Generation State
  const [aiStyle, setAiStyle] = useState('Studio Product Photography');
  const [customPrompt, setCustomPrompt] = useState(defaultPrompt);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize state when product changes during modal lifetime
  const [prevProductId, setPrevProductId] = useState(product?.id);
  if (product && product.id !== prevProductId) {
    setPrevProductId(product.id);
    const initial = product.image || '';
    setUrlInput(initial);
    setPreviewUrl(initial);
    setPreviewError(false);
    setCustomPrompt(defaultPrompt);
  }

  if (!isOpen || !product) return null;

  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    setPreviewError(false);
    setPreviewUrl(value.trim());
  };

  const handleSelectPreset = (presetUrl: string) => {
    sound.playClick();
    setUrlInput(presetUrl);
    setPreviewUrl(presetUrl);
    setPreviewError(false);
  };

  const handleClearImage = () => {
    sound.playClick();
    setUrlInput('');
    setPreviewUrl('');
    setPreviewError(false);
  };

  const handleGenerateAi = async () => {
    sound.playClick();
    setIsGeneratingAi(true);
    setAiStatusMessage('Synthesizing image with Gemini AI engine...');

    try {
      const result = await requestAiProductImage({
        productName: product.name,
        categoryName: category?.name,
        sku: product.sku,
        brand: product.brand,
        style: aiStyle,
        customPrompt,
      });

      setUrlInput(result.imageUrl);
      setPreviewUrl(result.imageUrl);
      setPreviewError(false);
      sound.playSuccess();
      setAiStatusMessage(`Generated successfully (${result.source})`);
    } catch (err: any) {
      console.error('Failed to generate image:', err);
      setAiStatusMessage('Generation encountered an issue. Applied high-clarity backup.');
      const fallback = generateVectorPlaceholder({
        name: product.name,
        sku: product.sku,
        categoryName: category?.name,
        themeColor: category?.color,
      });
      setUrlInput(fallback);
      setPreviewUrl(fallback);
      setPreviewError(false);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleGenerateVectorOnly = () => {
    sound.playClick();
    const svgData = generateVectorPlaceholder({
      name: product.name,
      sku: product.sku,
      categoryName: category?.name,
      themeColor: category?.color,
    });
    setUrlInput(svgData);
    setPreviewUrl(svgData);
    setPreviewError(false);
    sound.playSuccess();
  };

  const handleAutoSuggestPreset = () => {
    sound.playClick();
    const matched = matchCuratedPreset(product.name, product.categoryId);
    if (matched) {
      setUrlInput(matched.url);
      setPreviewUrl(matched.url);
      setPreviewError(false);
    } else {
      handleGenerateVectorOnly();
    }
  };

  const handleSave = async () => {
    if (!product) return;
    setIsSaving(true);
    sound.playClick();

    try {
      const finalImage = previewUrl.trim() || undefined;
      await db.products.update(product.id, { image: finalImage });

      const updatedProduct: Product = {
        ...product,
        image: finalImage,
      };

      sound.playSuccess();
      onSave(updatedProduct);
      onClose();
    } catch (err: any) {
      console.error('Failed to save product image:', err);
      alert(`Could not save image: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const styleOptions = [
    { id: 'Studio Product Photography', label: 'Studio Photo', icon: Camera },
    { id: 'Minimalist Clean', label: 'Minimalist', icon: Sparkles },
    { id: 'Artisan Cafe', label: 'Artisan Cafe', icon: Palette },
    { id: 'Vector Flat Art', label: 'Vector Graphic', icon: Layers },
  ];

  return (
    <div
      id="product-image-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div
        id="product-image-modal-card"
        className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white leading-tight">{product.name}</h3>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold">
                  {product.sku}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Link image URL or generate AI catalog artwork for visual clarity
              </p>
            </div>
          </div>
          <button
            id="close-image-modal-btn"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {/* Main Visual Comparison & Live Preview */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            {/* Image Preview Box */}
            <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-900 flex items-center justify-center shrink-0 shadow-inner group">
              {previewUrl && !previewError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                  onError={() => setPreviewError(true)}
                  onLoad={() => setPreviewLoading(false)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 p-3 text-center">
                  {previewError ? (
                    <>
                      <AlertCircle className="w-8 h-8 text-rose-400 mb-1" />
                      <span className="text-[11px] text-rose-300 font-semibold leading-tight">
                        Image Failed to Load
                      </span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-slate-600 mb-1" />
                      <span className="text-[11px] text-slate-400 font-medium">No Image Set</span>
                    </>
                  )}
                </div>
              )}

              {/* Status Pill Badge */}
              <div className="absolute top-2 left-2 pointer-events-none">
                {previewUrl && !previewError ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/90 text-slate-950 shadow-sm flex items-center gap-1">
                    <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800/90 text-slate-400 border border-slate-700">
                    Empty
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions & Meta Info */}
            <div className="flex-1 space-y-2 text-left w-full">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Target Category:</span>
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-semibold border"
                  style={{
                    backgroundColor: `${category?.color || '#0284c7'}20`,
                    borderColor: `${category?.color || '#0284c7'}50`,
                    color: '#f8fafc',
                  }}
                >
                  {category?.name || 'Retail Standard'}
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-400">Price: ${product.sellingPrice.toFixed(2)}</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Images are displayed across the inventory table, low-stock alerts, and the point of sale register.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAutoSuggestPreset}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Auto-Detect Preset
                </button>

                <button
                  type="button"
                  onClick={handleGenerateVectorOnly}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  title="Generate dynamic SVG vector card"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Generate Vector Card
                </button>

                {previewUrl && (
                  <button
                    type="button"
                    onClick={handleClearImage}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex border-b border-slate-800 gap-2">
            <button
              id="tab-link-url"
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveTab('URL');
              }}
              className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
                activeTab === 'URL'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Link via Image URL
            </button>

            <button
              id="tab-generate-ai"
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveTab('AI');
              }}
              className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
                activeTab === 'AI'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              AI Image Generator
            </button>

            <button
              id="tab-curated-presets"
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveTab('PRESETS');
              }}
              className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
                activeTab === 'PRESETS'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              Curated Presets ({CURATED_IMAGE_PRESETS.length})
            </button>
          </div>

          {/* TAB 1: Link via URL */}
          {activeTab === 'URL' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div>
                <label htmlFor={inputId} className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Direct Image URL (HTTPS, Unsplash, CDN, or Data URI)
                </label>
                <div className="relative">
                  <input
                    id={inputId}
                    type="url"
                    value={urlInput}
                    onChange={e => handleUrlChange(e.target.value)}
                    placeholder="https://images.unsplash.com/... or https://cdn.vendor.com/product.jpg"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-sky-500 font-mono pr-20"
                  />
                  {urlInput && (
                    <button
                      type="button"
                      onClick={() => handleUrlChange('')}
                      className="absolute right-2 top-2 px-2 py-1 text-[10px] text-slate-400 hover:text-white bg-slate-800 rounded"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Quick helper notes */}
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Supports PNG, JPG, WebP, SVG, and base64 Data URIs.</span>
                {previewUrl && !previewError && (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Valid Image URL
                  </span>
                )}
              </div>

              {/* Quick sample chips */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Quick Sample URLs for Testing:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CURATED_IMAGE_PRESETS.slice(0, 6).map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.url)}
                      className="px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[10.5px] text-slate-300 transition hover:text-white"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI Image Generator */}
          {activeTab === 'AI' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Style selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Artistic Visual Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {styleOptions.map(opt => {
                    const Icon = opt.icon;
                    const isSelected = aiStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setAiStyle(opt.id);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                          isSelected
                            ? 'bg-purple-500/20 border-purple-500 text-purple-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-semibold">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Prompt Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    AI Generation Prompt (Customizable)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const brandStr = product.brand ? `by ${product.brand}` : '';
                      const catStr = category?.name || 'Retail Product';
                      setCustomPrompt(
                        `Commercial catalog product photograph of ${product.name} ${brandStr} (${catStr}). Clean white studio background, soft lighting, 4k sharp focus, isolated subject.`
                      );
                    }}
                    className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Prompt
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-purple-500 font-sans resize-none"
                  placeholder="Describe the product photography..."
                />
              </div>

              {/* AI Trigger Action */}
              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-left w-full sm:w-auto">
                  <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Powered by Gemini AI Engine
                  </div>
                  <div className="text-[11px] text-purple-300/70 mt-0.5">
                    {aiStatusMessage || 'Generates square 1:1 commercial catalog imagery.'}
                  </div>
                </div>

                <button
                  id="generate-ai-image-submit-btn"
                  type="button"
                  disabled={isGeneratingAi}
                  onClick={handleGenerateAi}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-purple-950 disabled:opacity-50"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Generate AI Product Image
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Curated Presets */}
          {activeTab === 'PRESETS' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <p className="text-xs text-slate-400">
                Select from professionally shot studio images tailored for cafe and retail catalogs:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto p-1">
                {CURATED_IMAGE_PRESETS.map(preset => {
                  const isSelected = previewUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.url)}
                      className={`group relative rounded-xl overflow-hidden border text-left p-1.5 transition flex flex-col items-center ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/50'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-900 mb-1.5 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preset.url}
                          alt={preset.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                            <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-white line-clamp-1 w-full text-center">
                        {preset.name}
                      </span>
                      <span className="text-[9.5px] text-slate-400 line-clamp-1 w-full text-center">
                        {preset.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {previewUrl ? 'Changes will be saved to IndexedDB catalog' : 'No image assigned'}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="cancel-image-modal-btn"
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
            >
              Cancel
            </button>

            <button
              id="save-image-modal-btn"
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-950 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  Apply & Save Image
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
