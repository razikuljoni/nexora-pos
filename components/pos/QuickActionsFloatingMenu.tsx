'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Clock,
  Printer,
  RotateCcw,
  Barcode,
  Trash2,
  X,
  Coins,
  ChevronRight,
  Sparkles,
  Layers,
  PauseCircle,
  PlayCircle,
  HelpCircle,
} from 'lucide-react';
import { sound } from '@/lib/audio';

interface QuickActionsFloatingMenuProps {
  onHoldOrder: () => void;
  canHoldOrder: boolean;
  heldOrdersCount: number;
  onOpenHeldOrders: () => void;
  onPrintLastReceipt: () => void;
  lastCompletedSaleNumber?: string;
  onStartReturn: () => void;
  onOpenScanner: () => void;
  onClearCart: () => void;
  canClearCart: boolean;
  onOpenDrawerNoSale?: () => void;
  cartItemsCount: number;
  currencySymbol: string;
  grandTotal: number;
  registerName?: string;
}

export const QuickActionsFloatingMenu: React.FC<QuickActionsFloatingMenuProps> = ({
  onHoldOrder,
  canHoldOrder,
  heldOrdersCount,
  onOpenHeldOrders,
  onPrintLastReceipt,
  lastCompletedSaleNumber,
  onStartReturn,
  onOpenScanner,
  onClearCart,
  canClearCart,
  onOpenDrawerNoSale,
  cartItemsCount,
  currencySymbol,
  grandTotal,
  registerName = 'Register #01',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Global Keyboard shortcuts: Alt+Q (Toggle Menu), Alt+P (Print Last Receipt), Alt+R (Start Return)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Quick Actions floating menu with Alt+Q or F9
      if ((e.altKey && (e.key === 'q' || e.key === 'Q')) || e.key === 'F9') {
        e.preventDefault();
        sound.playClick();
        setIsOpen(prev => !prev);
      }

      // Alt+P: Print Last Receipt directly
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        onPrintLastReceipt();
      }

      // Alt+R: Start New Return directly
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        onStartReturn();
      }

      // F3: Barcode Scanner
      if (e.key === 'F3') {
        e.preventDefault();
        onOpenScanner();
      }

      // Escape: Close menu if open
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onPrintLastReceipt, onStartReturn, onOpenScanner]);

  const toggleMenu = () => {
    sound.playClick();
    setIsOpen(prev => !prev);
  };

  return (
    <div
      id="pos-quick-actions-floating-container"
      className="fixed bottom-5 right-5 lg:bottom-6 lg:right-6 z-40 flex flex-col items-end"
    >
      {/* Floating Menu Popover Panel */}
      {isOpen && (
        <div
          ref={menuRef}
          className="mb-3 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Menu Top Bar */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Quick Actions</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                    Alt+Q
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  {registerName} • Instant Checkout Utilities
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Close Quick Actions"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Items List */}
          <div className="p-2 space-y-1.5 max-h-[70vh] overflow-y-auto">
            {/* 1. Hold Current Order */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  if (canHoldOrder) {
                    onHoldOrder();
                    setIsOpen(false);
                  }
                }}
                disabled={!canHoldOrder}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                  canHoldOrder
                    ? 'bg-slate-950/70 hover:bg-amber-500/10 border-slate-800 hover:border-amber-500/30 text-white cursor-pointer group'
                    : 'bg-slate-950/30 border-slate-800/40 text-slate-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl border ${
                      canHoldOrder
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-slate-800/40 text-slate-600 border-slate-800'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Hold Active Order</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                        F6
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {canHoldOrder
                        ? `${cartItemsCount} item${cartItemsCount > 1 ? 's' : ''} • ${currencySymbol}${grandTotal.toFixed(2)} suspended`
                        : 'Cart is empty (add items to hold)'}
                    </div>
                  </div>
                </div>

                <div className="text-slate-500 group-hover:text-amber-400 transition">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              {/* Sub-action: View Held Orders Drawer if any are parked */}
              {heldOrdersCount > 0 && (
                <button
                  onClick={() => {
                    onOpenHeldOrders();
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-[11px] font-medium flex items-center justify-between transition"
                >
                  <span className="flex items-center gap-1.5">
                    <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>{heldOrdersCount} Parked Order{heldOrdersCount > 1 ? 's' : ''} in Drawer</span>
                  </span>
                  <span className="font-bold underline text-[10px]">Resume Order →</span>
                </button>
              )}
            </div>

            {/* 2. Print Last Receipt */}
            <button
              onClick={() => {
                onPrintLastReceipt();
                setIsOpen(false);
              }}
              className="w-full p-2.5 rounded-xl bg-slate-950/70 hover:bg-sky-500/10 border border-slate-800 hover:border-sky-500/30 text-left flex items-center justify-between text-white transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Print Last Receipt</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                      Alt+P
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {lastCompletedSaleNumber
                      ? `Order #${lastCompletedSaleNumber} • Thermal & QR View`
                      : 'Fetch latest completed sale receipt'}
                  </div>
                </div>
              </div>

              <div className="text-slate-500 group-hover:text-sky-400 transition">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* 3. Start New Return / Refund */}
            <button
              onClick={() => {
                onStartReturn();
                setIsOpen(false);
              }}
              className="w-full p-2.5 rounded-xl bg-slate-950/70 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-left flex items-center justify-between text-white transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Start New Return</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                      Alt+R
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Lookup order, select items & process refund
                  </div>
                </div>
              </div>

              <div className="text-slate-500 group-hover:text-rose-400 transition">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* Secondary Utilities */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/80">
              {/* Barcode Scanner */}
              <button
                onClick={() => {
                  onOpenScanner();
                  setIsOpen(false);
                }}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition flex items-center gap-2 text-slate-300 hover:text-white"
              >
                <Barcode className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate">Scanner</div>
                  <div className="text-[9px] text-slate-500 font-mono">F3</div>
                </div>
              </button>

              {/* No-Sale Drawer Kick */}
              <button
                onClick={() => {
                  if (onOpenDrawerNoSale) {
                    onOpenDrawerNoSale();
                  }
                  setIsOpen(false);
                }}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition flex items-center gap-2 text-slate-300 hover:text-white"
              >
                <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate">No-Sale Kick</div>
                  <div className="text-[9px] text-slate-500">Open Drawer</div>
                </div>
              </button>
            </div>

            {/* Clear Cart button if active items exist */}
            {canClearCart && (
              <button
                onClick={() => {
                  onClearCart();
                  setIsOpen(false);
                }}
                className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Active Cart ({cartItemsCount} items)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        ref={buttonRef}
        id="pos-quick-actions-floating-trigger"
        onClick={toggleMenu}
        className={`group relative flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl transition-all duration-200 active:scale-95 ${
          isOpen
            ? 'bg-amber-600 text-white shadow-amber-950 border border-amber-400'
            : 'bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/80 hover:border-amber-500/50 shadow-2xl backdrop-blur-md'
        }`}
        title="Quick Actions Menu (Alt+Q or F9)"
      >
        <div
          className={`p-1.5 rounded-xl transition ${
            isOpen ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-400 group-hover:scale-110'
          }`}
        >
          <Zap className="w-4 h-4" />
        </div>

        <div className="text-left">
          <div className="text-xs font-black tracking-wide flex items-center gap-1.5">
            <span>Quick Actions</span>
            {heldOrdersCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <div className="text-[10px] font-mono text-slate-400 group-hover:text-amber-300">
            Alt+Q
          </div>
        </div>

        {/* Indicator pills */}
        {heldOrdersCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
            {heldOrdersCount}
          </span>
        )}
      </button>
    </div>
  );
};
