'use client';

import React, { useState } from 'react';
import {
  Settings,
  Building,
  Store,
  Coffee,
  ShoppingBag,
  Users,
  Database,
  RefreshCw,
  Sliders,
  Check,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Location, Register, User as StaffUser, BusinessMode } from '@/lib/types';
import { seedDatabase } from '@/lib/mockData';
import { sound } from '@/lib/audio';

interface SettingsViewProps {
  locations: Location[];
  currentLocation: Location;
  registers: Register[];
  currentRegister: Register;
  users: StaffUser[];
  currentUser: StaffUser;
  businessMode: BusinessMode;
  onSetBusinessMode: (mode: BusinessMode) => void;
  onSwitchLocation: (location: Location) => void;
  onSwitchRegister: (register: Register) => void;
  onSwitchUser: (user: StaffUser) => void;
  onRefreshData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  locations,
  currentLocation,
  registers,
  currentRegister,
  users,
  currentUser,
  businessMode,
  onSetBusinessMode,
  onSwitchLocation,
  onSwitchRegister,
  onSwitchUser,
  onRefreshData,
}) => {
  const [isResetting, setIsResetting] = useState(false);

  const handleResetData = async () => {
    if (confirm('Are you sure you want to reset offline IndexedDB storage with fresh demo data?')) {
      setIsResetting(true);
      try {
        await seedDatabase();
        await onRefreshData();
        sound.playSaleSuccess();
        alert('Database reset successfully with fresh demo catalog, shifts, and outbox records.');
      } catch (err: any) {
        alert(err.message);
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-sky-400" />
          Terminal & Business Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure operating profile, multi-location register assignments, staff roles, and offline storage.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-5xl">
        {/* Operating Profile Mode */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Business Operating Profile</h2>
              <p className="text-xs text-slate-400">Tailors checkout workflows & catalog layouts</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => {
                sound.playClick();
                onSetBusinessMode('RETAIL');
              }}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition ${
                businessMode === 'RETAIL'
                  ? 'bg-sky-500/15 border-sky-500 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <ShoppingBag className="w-5 h-5 text-sky-400" />
                {businessMode === 'RETAIL' && <Check className="w-4 h-4 text-sky-400" />}
              </div>
              <div className="font-bold text-xs text-white">Retail Mode</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Optimized for high-density barcode scanning, SKU lookups, merchandise, and retail inventory.
              </p>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onSetBusinessMode('CAFE');
              }}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition ${
                businessMode === 'CAFE'
                  ? 'bg-purple-500/15 border-purple-500 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Coffee className="w-5 h-5 text-purple-400" />
                {businessMode === 'CAFE' && <Check className="w-4 h-4 text-purple-400" />}
              </div>
              <div className="font-bold text-xs text-white">Café / QSR Mode</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Touch-first barista modifiers (milk, syrups, temperature), table assignment, and kitchen prep notes.
              </p>
            </button>
          </div>
        </div>

        {/* Multi-Location Switcher */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Location & Store Assignment</h2>
              <p className="text-xs text-slate-400">Current store terminal: {currentLocation.name}</p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {locations.map(loc => {
              const isSelected = loc.id === currentLocation.id;
              return (
                <button
                  key={loc.id}
                  onClick={() => {
                    sound.playClick();
                    onSwitchLocation(loc);
                  }}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-white">{loc.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{loc.address}</div>
                  </div>
                  <div className="text-right text-[11px] font-mono">
                    <span className="text-slate-500">Tax: {(loc.taxRate * 100).toFixed(1)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Staff Switcher & PIN Security */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Staff Cashier & Roles</h2>
              <p className="text-xs text-slate-400">Active Cashier: {currentUser.name} ({currentUser.role})</p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {users.map(u => {
              const isSelected = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    sound.playClick();
                    onSwitchUser(u);
                  }}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-sky-400">
                      {u.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">{u.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">PIN: {u.pin}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                    {u.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Local IndexedDB Diagnostics & Reset */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Offline Storage & Demo Seed</h2>
              <p className="text-xs text-slate-400">IndexedDB persistence layer diagnostics</p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Database Engine:</span>
              <span className="font-mono text-emerald-400 font-semibold">Dexie.js v4 (IndexedDB)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Audio Haptic Engine:</span>
              <span className="font-mono text-sky-400 font-semibold">Web Audio API Synthesizer</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Service Worker:</span>
              <span className="font-mono text-white">/sw.js (Active Cache)</span>
            </div>
          </div>

          <button
            onClick={handleResetData}
            disabled={isResetting}
            className="w-full py-2.5 rounded-xl border border-rose-500/40 hover:bg-rose-500/10 text-rose-300 text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            Reset Local Demo Database
          </button>
        </div>
      </div>
    </div>
  );
};
