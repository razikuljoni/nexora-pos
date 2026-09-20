'use client';

import React from 'react';
import {
  Banknote,
  Clock,
  ShieldCheck,
  AlertCircle,
  Wifi,
  Lock,
  Unlock,
  Store,
  Layers,
} from 'lucide-react';
import type { Shift, CashMovement, Location, Register, User } from '@/lib/types';

interface RegisterPulseWidgetProps {
  activeShift?: Shift;
  cashMovements: CashMovement[];
  currentLocation: Location;
  currentRegister: Register;
  currentUser: User;
  currencySymbol: string;
  isOffline: boolean;
}

export const RegisterPulseWidget: React.FC<RegisterPulseWidgetProps> = ({
  activeShift,
  cashMovements,
  currentLocation,
  currentRegister,
  currentUser,
  currencySymbol,
  isOffline,
}) => {
  // Estimate expected cash in drawer
  const expectedCash = activeShift ? activeShift.expectedCash : 0;
  const openingFloat = activeShift ? activeShift.openingFloat : 0;
  const cashSales = activeShift ? activeShift.cashSales : 0;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Banknote className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">
              Terminal Pulse & Cash Drawer Health
            </div>
            <div className="text-[11px] text-slate-400">
              Active drawer audit at {currentRegister.name} ({currentLocation.name})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {activeShift ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Unlock className="w-3 h-3 text-emerald-400" />
              <span>DRAWER OPEN</span>
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>DRAWER CLOSED</span>
            </span>
          )}
        </div>
      </div>

      {/* Grid of 4 Terminal Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Expected Cash</span>
            <Banknote className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
            {currencySymbol}{expectedCash.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Current in-till float + cash</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Opening Float</span>
            <Layers className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-lg font-black font-mono text-sky-300 mt-0.5">
            {currencySymbol}{openingFloat.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Start of shift base</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Shift Cash Sales</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black font-mono text-amber-300 mt-0.5">
            {currencySymbol}{cashSales.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Settled in hard cash</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Sync Latency</span>
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-lg font-black font-mono text-white mt-0.5">
            {isOffline ? 'OFFLINE' : 'LOCAL 0ms'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">IndexedDB state ledger</div>
        </div>
      </div>
    </div>
  );
};
