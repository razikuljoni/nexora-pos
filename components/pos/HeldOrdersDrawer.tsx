'use client';

import React from 'react';
import { Clock, Play, Trash2, X, ShoppingBag } from 'lucide-react';
import type { HeldOrder } from '@/lib/types';
import { sound } from '@/lib/audio';

interface HeldOrdersDrawerProps {
  isOpen: boolean;
  heldOrders: HeldOrder[];
  currencySymbol: string;
  onResume: (order: HeldOrder) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const HeldOrdersDrawer: React.FC<HeldOrdersDrawerProps> = ({
  isOpen,
  heldOrders,
  currencySymbol,
  onResume,
  onDelete,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 border-l border-slate-700 w-full max-w-md h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Held Orders & Suspended Tabs</h2>
              <p className="text-xs text-slate-400">{heldOrders.length} ticket(s) currently paused</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tickets List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {heldOrders.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <ShoppingBag className="w-10 h-10 stroke-1 text-slate-600" />
              <div className="text-sm font-medium text-slate-400">No held orders on this terminal</div>
              <p className="text-xs max-w-xs">
                During busy rushes, press &apos;Hold (F6)&apos; on an active cart to suspend it and serve the next customer.
              </p>
            </div>
          ) : (
            heldOrders.map(order => (
              <div
                key={order.id}
                className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-2.5 hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{order.title}</h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {order.customerName ? `Customer: ${order.customerName}` : 'Counter Walk-in'} • {order.orderType}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {currencySymbol}{order.subtotal.toFixed(2)}
                  </span>
                </div>

                {/* Items summary */}
                <div className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg space-y-1">
                  {order.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="truncate pr-2">{it.quantity}x {it.name}</span>
                      <span className="font-mono text-slate-400">{currencySymbol}{it.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Held {new Date(order.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        sound.playClick();
                        onDelete(order.id);
                      }}
                      className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
                      title="Discard ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        sound.playClick();
                        onResume(order);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Resume Cart
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
