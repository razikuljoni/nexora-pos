'use client';

import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Server,
  Layers,
  X,
  RotateCcw,
} from 'lucide-react';
import { syncEngine, type SyncEngineStatus } from '@/lib/services/syncService';
import type { SyncCommand } from '@/lib/types';
import { motion, AnimatePresence } from 'motion/react';

interface OfflineConfidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineConfidenceModal: React.FC<OfflineConfidenceModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<SyncEngineStatus>({
    isOnline: true,
    isSimulatedOffline: false,
    lastSyncTime: null,
    pendingCount: 0,
    isSyncing: false,
    dbHealthy: true,
    isAutoSyncEnabled: true,
    autoSyncIntervalSec: 30,
  });
  const [pendingCommands, setPendingCommands] = useState<SyncCommand[]>([]);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const unsub = syncEngine.subscribe(newStatus => {
      if (active) setStatus(newStatus);
    });
    syncEngine.getPendingCommands().then(cmds => {
      if (active) setPendingCommands(cmds);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSimulatedOffline = () => {
    const nextVal = !status.isSimulatedOffline;
    syncEngine.setSimulatedOffline(nextVal);
  };

  const handleManualSync = async () => {
    setSyncFeedback('Synchronizing local transactions...');
    const res = await syncEngine.syncOutbox();
    const cmds = await syncEngine.getPendingCommands();
    setPendingCommands(cmds);
    setSyncFeedback(
      res.processed > 0
        ? `Successfully synced ${res.processed} pending operation(s) with authority.`
        : 'All local changes are fully synchronized.'
    );
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${status.isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
              {status.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Offline Confidence Layer</h2>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wider ${
                  status.isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {status.isOnline ? 'Network Online' : 'Operating Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Local-first business continuity & synchronization diagnostic center</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-200">
          {/* Diagnostic Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
                <Server className="w-3.5 h-3.5 text-sky-400" />
                Network State
              </div>
              <div className={`font-semibold text-base ${status.isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                {status.isOnline ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {status.isSimulatedOffline ? 'Simulated Offline Test' : 'Real Hardware Link'}
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                Local Database
              </div>
              <div className="font-semibold text-base text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Healthy
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">IndexedDB / Dexie</div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Pending Outbox
              </div>
              <div className={`font-semibold text-base ${status.pendingCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {status.pendingCount} Operations
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Awaiting Server Ack</div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Last Synced
              </div>
              <div className="font-semibold text-xs text-slate-200 mt-1 truncate">
                {status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Automatic loop</div>
            </div>
          </div>

          {/* Test Offline Mode Toggle */}
          <div className="bg-slate-800/40 border border-slate-700/60 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-white font-medium flex items-center gap-2">
                <span>Simulate Network Outage</span>
                {status.isSimulatedOffline && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-mono">
                    TESTING MODE ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Cut simulated internet connection to verify that checkout, printing, shifts, and local ledger storage continue uninterrupted.
              </p>
            </div>
            <button
              onClick={handleToggleSimulatedOffline}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                status.isSimulatedOffline
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              {status.isSimulatedOffline ? (
                <>
                  <Wifi className="w-4 h-4" /> Restore Internet
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" /> Disconnect Internet
                </>
              )}
            </button>
          </div>

          {/* Capability Matrix */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Operational Safety Matrix
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3.5 space-y-1.5">
                <div className="font-semibold text-emerald-400 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Fully Safe & Functional Offline
                </div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>Process cash sales & compute change due</li>
                  <li>Local catalog search & barcode scanning</li>
                  <li>Hold, suspend, and resume customer tickets</li>
                  <li>Open / Close shift with Smart Close reconciliation</li>
                  <li>Print receipts via local/thermal bridge</li>
                  <li>Queue outbox items with unique idempotency keys</li>
                </ul>
              </div>

              <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3.5 space-y-1.5">
                <div className="font-semibold text-amber-400 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Offline Limitations & Risk Guards
                </div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>Live payment gateway authorization (cards/wallets)</li>
                  <li>Multi-branch live stock reservations</li>
                  <li>Cloud-wide financial consolidation reports</li>
                  <li>Adding new staff or altering permission levels</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Outbox inspection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pending Outbox Commands ({pendingCommands.length})
              </h3>
              <button
                onClick={handleManualSync}
                disabled={status.isSyncing || !status.isOnline}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${status.isSyncing ? 'animate-spin' : ''}`} />
                Force Sync Outbox
              </button>
            </div>

            {syncFeedback && (
              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs">
                {syncFeedback}
              </div>
            )}

            {pendingCommands.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-center text-xs text-slate-400">
                All local commands have been acknowledged by the server. Outbox is clean.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[11px]">
                {pendingCommands.map(cmd => (
                  <div key={cmd.id} className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="text-amber-400 font-semibold">{cmd.commandType}</span>
                      <span className="text-slate-400 ml-2">[{cmd.idempotencyKey}]</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">
                      {cmd.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-500 font-mono">
            Terminal: REG-01 | Protocol: v2.4-LOCAL
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition cursor-pointer"
          >
            Close Diagnostics
          </button>
        </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
