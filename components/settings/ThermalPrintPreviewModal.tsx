// NEXORA POS - Thermal Receipt & Report Print Preview Modal
'use client';

import React, { useState } from 'react';
import {
  X,
  Printer,
  RotateCw,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  Clock,
  Trash2,
  Receipt,
  Cpu,
} from 'lucide-react';
import type { PrintJob } from '@/lib/types';
import { printService } from '@/lib/services/printService';
import { sound } from '@/lib/audio';

interface ThermalPrintPreviewModalProps {
  job: PrintJob | null;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated?: (updatedJob: PrintJob) => void;
  onJobDeleted?: (jobId: string) => void;
}

export const ThermalPrintPreviewModal: React.FC<ThermalPrintPreviewModalProps> = ({
  job,
  isOpen,
  onClose,
  onJobUpdated,
  onJobDeleted,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !job) return null;

  const handleRetry = async () => {
    sound.playClick();
    setIsRetrying(true);
    setRetryMessage(null);
    try {
      const result = await printService.retryPrintJob(job.id, { forceSuccess: true });
      setRetryMessage(result.message);
      if (onJobUpdated) {
        onJobUpdated(result.job);
      }
      setTimeout(() => setRetryMessage(null), 3500);
    } catch (err: any) {
      setRetryMessage(`Retry failed: ${err.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const handlePrintBrowser = () => {
    printService.printJobToBrowser(job);
  };

  const handleCopyRaw = async () => {
    sound.playClick();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(job.payloadRaw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Remove "${job.title}" from the print spooler queue?`)) {
      sound.playClick();
      await printService.cancelPrintJob(job.id);
      if (onJobDeleted) {
        onJobDeleted(job.id);
      }
      onClose();
    }
  };

  const getStatusBadge = () => {
    switch (job.status) {
      case 'FAILED':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            FAILED (Attempt {job.retryCount})
          </span>
        );
      case 'QUEUED':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            QUEUED
          </span>
        );
      case 'PRINTING':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            PRINTING...
          </span>
        );
      case 'COMPLETED':
      default:
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            COMPLETED
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{job.title}</h3>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Device: {job.printerName} • Paper: {job.paperWidth} Thermal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message if any */}
        {retryMessage && (
          <div className="px-4 py-2.5 bg-sky-500/15 border-b border-sky-500/30 text-sky-300 text-xs flex items-center justify-between">
            <span className="font-medium">{retryMessage}</span>
          </div>
        )}

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Failure Alert Banner */}
          {job.status === 'FAILED' && job.error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-400">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                Spooler Failure Reason:
              </div>
              <p className="pl-5 font-mono text-[11px] text-rose-200">{job.error}</p>
              <div className="pl-5 pt-1 text-[10.5px] text-slate-400">
                Total attempts: {job.retryCount} of {job.maxRetries || 5} • Last attempted:{' '}
                {job.lastAttemptAt ? new Date(job.lastAttemptAt).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          )}

          {/* Job Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Job ID</div>
              <div className="font-mono text-slate-300 truncate mt-0.5">{job.id}</div>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Created Time</div>
              <div className="font-mono text-slate-300 mt-0.5">
                {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Job Type</div>
              <div className="font-mono text-sky-400 mt-0.5">{job.type}</div>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Copies</div>
              <div className="font-mono text-slate-300 mt-0.5">{job.copies || 1} copy</div>
            </div>
          </div>

          {/* Thermal Paper Monospaced Slip Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-sky-400" />
                Thermal Paper Rendering ({job.paperWidth})
              </span>
              <button
                type="button"
                onClick={handleCopyRaw}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-mono transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Raw Monospace
                  </>
                )}
              </button>
            </div>

            {/* Realistic Thermal Receipt Slip */}
            <div className="flex justify-center p-3 bg-slate-950/70 rounded-2xl border border-slate-800/90 overflow-x-auto">
              <div
                className={`bg-[#fdfefe] text-slate-900 font-mono text-[11px] leading-[1.3] p-4 shadow-xl border border-slate-300 rounded-sm select-text ${
                  job.paperWidth === '58mm' ? 'w-[280px]' : 'w-[340px]'
                }`}
              >
                {/* Top Perforation Simulation */}
                <div className="border-b border-dashed border-slate-400/80 pb-2 mb-2 text-center text-[9px] text-slate-500">
                  --- THERMAL RECEIPT TEAR LINE ---
                </div>

                {/* Preformatted Monospace Output */}
                <pre className="whitespace-pre-wrap font-mono break-all font-medium text-slate-900">
                  {job.payloadRaw}
                </pre>

                {/* Bottom Barcode / Verification Placeholder */}
                <div className="border-t border-dashed border-slate-400/80 pt-2 mt-3 text-center space-y-1">
                  <div className="text-[9px] text-slate-500 font-mono">
                    TERMINAL ID: REG-01 • QUEUE REF: {job.id}
                  </div>
                  <div className="flex justify-center py-1">
                    {/* Simulated 1D Barcode bars */}
                    <div className="flex gap-[2px] h-6 items-center">
                      {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 3, 1, 4, 2, 1].map((w, idx) => (
                        <div
                          key={idx}
                          className="bg-black h-full"
                          style={{ width: `${w}px` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-[8px] text-slate-400 font-mono">* {job.id} *</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Remove from Spooler
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintBrowser}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              Browser / Hardware Print
            </button>

            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-sky-950"
            >
              <RotateCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying Dispatch...' : 'Retry Print Job'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
