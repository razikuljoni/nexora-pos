'use client';

import React, { useState } from 'react';
import { Camera, Barcode, X, Check, Search } from 'lucide-react';
import { sound } from '@/lib/audio';

interface ScannerModalProps {
  isOpen: boolean;
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onScan, onClose }) => {
  const [manualCode, setManualCode] = useState('');

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      sound.playScanBeep();
      onScan(manualCode.trim());
      setManualCode('');
      onClose();
    }
  };

  const handleQuickSimulate = (code: string) => {
    sound.playScanBeep();
    onScan(code);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Barcode & Optical Scanner</h2>
              <p className="text-xs text-slate-400">Hardware wedge, camera, or quick code simulator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Camera Scanning Reticle Box */}
          <div className="relative h-44 bg-slate-950 rounded-xl border-2 border-dashed border-sky-500/40 flex flex-col items-center justify-center text-center p-4 overflow-hidden">
            {/* Laser scanning line animation */}
            <div className="absolute inset-x-0 h-0.5 bg-rose-500 shadow-md shadow-rose-500 animate-bounce duration-1000 top-1/2 -translate-y-1/2 opacity-75" />

            <Camera className="w-8 h-8 text-sky-400 mb-2 stroke-1" />
            <div className="text-xs font-semibold text-white">Optical Target Active</div>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              Point package barcode at camera, or swipe with a physical USB/Bluetooth handheld barcode reader.
            </p>
          </div>

          {/* Direct Keyboard Entry */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Manual Barcode / SKU Entry
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="Scan or enter barcode (e.g. 890100101)..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Add
              </button>
            </div>
          </form>

          {/* Quick Barcode Demo Simulator Pills */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Quick Test Barcodes (Click to simulate scan):
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => handleQuickSimulate('890100101')}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left text-sky-300 truncate"
              >
                Flat White [890100101]
              </button>
              <button
                type="button"
                onClick={() => handleQuickSimulate('890100201')}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left text-amber-300 truncate"
              >
                Croissant [890100201]
              </button>
              <button
                type="button"
                onClick={() => handleQuickSimulate('890100401')}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left text-emerald-300 truncate"
              >
                Guji Coffee [890100401]
              </button>
              <button
                type="button"
                onClick={() => handleQuickSimulate('890100701')}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-left text-purple-300 truncate"
              >
                Tumbler Mug [890100701]
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
