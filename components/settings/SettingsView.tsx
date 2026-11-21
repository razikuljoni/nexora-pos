'use client';

import React, { useState, useEffect } from 'react';
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
  ShieldCheck,
  Download,
  Lock,
  FileCheck,
  Archive,
  Radio,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import type { Location, Register, User as StaffUser, BusinessMode } from '@/lib/types';
import { seedDatabase } from '@/lib/mockData';
import { sound } from '@/lib/audio';
import { syncEngine, type SyncEngineStatus } from '@/lib/services/syncService';
import { ExportArchiveModal } from './ExportArchiveModal';
import { PrintQueueManager } from './PrintQueueManager';

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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nexora_last_backup_at');
    }
    return null;
  });

  // Background Sync Setting & Status State
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(() => {
    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSimulatedOffline: false,
      lastSyncTime: null,
      pendingCount: 0,
      isSyncing: false,
      dbHealthy: true,
      isAutoSyncEnabled:
        typeof window !== 'undefined'
          ? localStorage.getItem('nexora_auto_background_sync_enabled') !== 'false'
          : true,
      autoSyncIntervalSec: 30,
    };
  });
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncFeedbackMessage, setSyncFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const unsub = syncEngine.subscribe(status => {
      if (isMounted) {
        setSyncStatus(status);
      }
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const handleToggleAutoSync = () => {
    sound.playClick();
    const nextVal = !syncStatus.isAutoSyncEnabled;
    syncEngine.setAutoSyncEnabled(nextVal);
  };

  const handleTriggerManualSync = async () => {
    sound.playClick();
    setIsManualSyncing(true);
    setSyncFeedbackMessage(null);
    try {
      const result = await syncEngine.syncOutbox();
      await onRefreshData();
      sound.playSuccess();
      if (result.processed > 0) {
        setSyncFeedbackMessage(`Synced ${result.processed} pending operation(s)`);
      } else {
        setSyncFeedbackMessage('All local data is up to date');
      }
      setTimeout(() => setSyncFeedbackMessage(null), 3000);
    } catch (err: any) {
      sound.playError();
      setSyncFeedbackMessage(`Sync failed: ${err.message}`);
      setTimeout(() => setSyncFeedbackMessage(null), 4000);
    } finally {
      setIsManualSyncing(false);
    }
  };

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
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6 bg-slate-950 text-slate-100">
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

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-5xl">
        {/* Operating Profile Mode */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Business Operating Profile</h2>
              <p className="text-xs text-slate-400">Tailors checkout workflows & catalog layouts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                      <div className="text-[10px] text-slate-400 font-mono">PIN: ****</div>
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

        {/* Automatic Background Sync & Cloud Outbox */}
        <div id="settings-card-background-sync" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl border ${
                  syncStatus.isAutoSyncEnabled
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Radio
                  className={`w-5 h-5 ${
                    syncStatus.isAutoSyncEnabled && syncStatus.isOnline
                      ? 'animate-pulse text-sky-400'
                      : 'text-slate-400'
                  }`}
                />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Automatic Background Sync
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      syncStatus.isAutoSyncEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {syncStatus.isAutoSyncEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Auto-synchronize pending outbox records to central server
                </p>
              </div>
            </div>
          </div>

          {/* Toggle Switch Row */}
          <div className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-1 pr-2">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                Periodic Online Background Sync
                {syncStatus.isAutoSyncEnabled && (
                  <span className="text-[10.5px] font-mono font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Every {syncStatus.autoSyncIntervalSec}s
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                When connected to the network, periodically flushes pending sales transactions, inventory movements, and cash movements automatically.
              </p>
            </div>

            {/* Toggle Switch Component */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button
                id="toggle-auto-background-sync"
                type="button"
                role="switch"
                aria-checked={syncStatus.isAutoSyncEnabled}
                aria-label="Toggle periodic automatic background syncing when online"
                onClick={handleToggleAutoSync}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  syncStatus.isAutoSyncEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    syncStatus.isAutoSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-[10px] font-mono font-medium ${
                  syncStatus.isAutoSyncEnabled ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                {syncStatus.isAutoSyncEnabled ? 'Auto-sync ON' : 'Auto-sync OFF'}
              </span>
            </div>
          </div>

          {/* Sync Diagnostics & Status */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Connection Engine:</span>
              <span className="font-mono font-semibold flex items-center gap-1.5">
                {syncStatus.isOnline ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    Online {syncStatus.isSimulatedOffline ? '(Simulated Offline)' : '(Active)'}
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    Offline (Suspended)
                  </span>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Pending Outbox Queue:</span>
              <span className="font-mono">
                {syncStatus.pendingCount > 0 ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    {syncStatus.pendingCount} pending
                  </span>
                ) : (
                  <span className="text-slate-400">0 items (Up to date)</span>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Last Outbox Synchronization:</span>
              <span className="font-mono text-slate-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {syncStatus.lastSyncTime
                  ? new Date(syncStatus.lastSyncTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Never'}
              </span>
            </div>
          </div>

          {/* Feedback Message */}
          {syncFeedbackMessage && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{syncFeedbackMessage}</span>
            </div>
          )}

          {/* Manual Force Sync Button */}
          <div className="pt-1">
            <button
              id="btn-manual-sync-now"
              type="button"
              onClick={handleTriggerManualSync}
              disabled={isManualSyncing || syncStatus.isSyncing || !syncStatus.isOnline}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center justify-center gap-2 border border-slate-700"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isManualSyncing || syncStatus.isSyncing ? 'animate-spin text-sky-400' : 'text-slate-400'
                }`}
              />
              <span>
                {isManualSyncing || syncStatus.isSyncing
                  ? 'Synchronizing Outbox...'
                  : 'Sync Outbox Now'}
              </span>
            </button>
          </div>
        </div>

        {/* Thermal Print Queue & Spooler Manager */}
        <PrintQueueManager />

        {/* Secure Data Archive & Off-Site Storage */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Export Data Archive
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  AES-256-GCM
                </span>
              </h2>
              <p className="text-xs text-slate-400">Secure encrypted JSON backup for off-site disaster recovery</p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Cipher Protocol:</span>
              <span className="font-mono text-sky-400 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> AES-256-GCM + PBKDF2
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Payload Format:</span>
              <span className="font-mono text-emerald-400 font-semibold">Immutable JSON Archive</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Last Off-Site Archive:</span>
              <span className="font-mono text-slate-300">
                {lastBackupDate
                  ? new Date(lastBackupDate).toLocaleDateString() +
                    ' ' +
                    new Date(lastBackupDate).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'No archives created yet'}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              id="btn-open-export-archive-modal"
              onClick={() => {
                sound.playClick();
                setIsExportModalOpen(true);
              }}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-sky-950"
            >
              <Download className="w-4 h-4" />
              Export Encrypted Database Backup
            </button>
            <button
              id="btn-verify-archive-modal"
              onClick={() => {
                sound.playClick();
                setIsExportModalOpen(true);
              }}
              className="w-full py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              <FileCheck className="w-3.5 h-3.5 text-slate-400" />
              Verify / Decrypt Existing Backup
            </button>
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

      {/* Export Data Archive Modal */}
      <ExportArchiveModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentUser={currentUser}
        allUsers={users}
        onBackupExported={() => setLastBackupDate(new Date().toISOString())}
      />
    </div>
  );
};
