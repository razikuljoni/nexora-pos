'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Coffee } from 'lucide-react';
import type { Product, ModifierGroup, SelectedModifier } from '@/lib/types';
import { sound } from '@/lib/audio';

interface ModifierModalProps {
  isOpen: boolean;
  product: Product | null;
  currencySymbol: string;
  onConfirm: (product: Product, selectedModifiers: SelectedModifier[], notes?: string) => void;
  onClose: () => void;
}

const getInitialModifiers = (product: Product | null): Record<string, SelectedModifier> => {
  const initial: Record<string, SelectedModifier> = {};
  if (product?.modifierGroups) {
    product.modifierGroups.forEach(group => {
      if (group.required && group.options.length > 0) {
        const firstOpt = group.options[0];
        initial[group.id] = {
          groupId: group.id,
          groupName: group.name,
          optionId: firstOpt.id,
          optionName: firstOpt.name,
          priceDelta: firstOpt.priceDelta,
        };
      }
    });
  }
  return initial;
};

const ModifierModalContent: React.FC<{
  product: Product;
  currencySymbol: string;
  onConfirm: (product: Product, selectedModifiers: SelectedModifier[], notes?: string) => void;
  onClose: () => void;
}> = ({ product, currencySymbol, onConfirm, onClose }) => {
  const [selectedMap, setSelectedMap] = useState<Record<string, SelectedModifier>>(() =>
    getInitialModifiers(product)
  );
  const [itemNotes, setItemNotes] = useState<string>('');

  const handleSelectOption = (group: ModifierGroup, optionId: string) => {
    sound.playClick();
    const opt = group.options.find(o => o.id === optionId);
    if (!opt) return;

    if (!group.required && selectedMap[group.id]?.optionId === optionId) {
      // Toggle off optional modifier
      const updated = { ...selectedMap };
      delete updated[group.id];
      setSelectedMap(updated);
      return;
    }

    setSelectedMap(prev => ({
      ...prev,
      [group.id]: {
        groupId: group.id,
        groupName: group.name,
        optionId: opt.id,
        optionName: opt.name,
        priceDelta: opt.priceDelta,
      },
    }));
  };

  const currentExtraCost = Object.values(selectedMap).reduce((acc, m) => acc + m.priceDelta, 0);
  const calculatedUnitPrice = product.sellingPrice + currentExtraCost;

  const handleConfirm = () => {
    sound.playClick();
    onConfirm(product, Object.values(selectedMap), itemNotes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{product.name}</h2>
              <p className="text-xs text-slate-400">Configure barista options & kitchen modifiers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modifiers List */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {product.modifierGroups?.map(group => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white uppercase tracking-wider">{group.name}</span>
                <span className="text-[11px] text-slate-400">
                  {group.required ? '(Required - Choose 1)' : '(Optional)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.options.map(opt => {
                  const isSelected = selectedMap[group.id]?.optionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(group, opt.id)}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-500 text-sky-200'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.name}</div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {opt.priceDelta > 0 ? `+${currencySymbol}${opt.priceDelta.toFixed(2)}` : 'Free'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Kitchen / Barista Prep Note */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Kitchen Preparation Notes
            </label>
            <input
              type="text"
              value={itemNotes}
              onChange={e => setItemNotes(e.target.value)}
              placeholder="e.g. Extra hot, lightly toasted, no ice..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 bg-slate-950/80">
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Configured Price</div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {currencySymbol}{calculatedUnitPrice.toFixed(2)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-sky-950"
            >
              <Check className="w-4 h-4" />
              Add to Cart ({currencySymbol}{calculatedUnitPrice.toFixed(2)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ModifierModal: React.FC<ModifierModalProps> = ({
  isOpen,
  product,
  currencySymbol,
  onConfirm,
  onClose,
}) => {
  if (!isOpen || !product) return null;
  return (
    <ModifierModalContent
      key={product.id}
      product={product}
      currencySymbol={currencySymbol}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};
