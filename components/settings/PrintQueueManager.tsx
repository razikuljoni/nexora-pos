// NEXORA POS - Thermal Print Queue Manager Component
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Trash2,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Receipt,
  Cpu,
  Check,
  ChevronDown,
} from 'lucide-react';
import type { PrintJob, PrintJobStatus, PrintJobType } from '@/lib/types';
import { printService, type PrintQueueSummary } from '@/lib/services/printService';
import { sound } from '@/lib/audio';
import { ThermalPrintPreviewModal } from './ThermalPrintPreviewModal';

export const PrintQueueManager: React.FC = () => {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [summary, setSummary] = useState<PrintQueueSummary>({
    total: 0,
    queued: 0,
    printing: 0,
    completed: 0,
    failed: 0,
    lastJobTime: null,
    printers: [],
  });
  const [statusFilter, setStatusFilter] = useState<PrintJobStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<PrintJobType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [retryingJobIds, setRetryingJobIds] = useState<Set<string>>(new Set());
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [selectedPreviewJob, setSelectedPreviewJob] = useState<PrintJob | null>(null);
  const [isNewJobMenuOpen, setIsNewJobMenuOpen] = useState(false);

  // Load jobs and summary
  const refreshQueue = React.useCallback(async () => {
    try {
      const [fetchedJobs, fetchedSummary] = await Promise.all([
        printService.getPrintJobs(),
        printService.getPrintQueueSummary(),
      ]);
      setJobs(fetchedJobs);
      setSummary(fetchedSummary);
    } catch (err) {
      console.error('[PrintQueueManager] Failed to load print queue:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadInitial = async () => {
      try {
        const [fetchedJobs, fetchedSummary] = await Promise.all([
          printService.getPrintJobs(),
          printService.getPrintQueueSummary(),
        ]);
        if (isMounted) {
          setJobs(fetchedJobs);
          setSummary(fetchedSummary);
        }
      } catch (err) {
        console.error('[PrintQueueManager] Failed to load print queue:', err);
      }
    };

    loadInitial();

    const unsubscribe = printService.subscribe(() => {
      if (isMounted) {
        loadInitial();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (statusFilter !== 'ALL' && job.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && job.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = job.title.toLowerCase().includes(q);
        const matchesPrinter = job.printerName.toLowerCase().includes(q);
        const matchesError = job.error ? job.error.toLowerCase().includes(q) : false;
        const matchesOrder = job.payloadMetadata?.orderNumber
          ? job.payloadMetadata.orderNumber.toLowerCase().includes(q)
          : false;
        const matchesCustomer = job.payloadMetadata?.customerName
          ? job.payloadMetadata.customerName.toLowerCase().includes(q)
          : false;
        if (!matchesTitle && !matchesPrinter && !matchesError && !matchesOrder && !matchesCustomer) {
          return false;
        }
      }
      return true;
    });
  }, [jobs, statusFilter, typeFilter, searchQuery]);

  // Retry single job
  const handleRetrySingle = async (job: PrintJob) => {
    sound.playClick();
    setRetryingJobIds(prev => new Set(prev).add(job.id));
    setFeedbackMessage(null);
    try {
      const result = await printService.retryPrintJob(job.id, { forceSuccess: true });
      if (result.success) {
        setFeedbackMessage(`Success: "${job.title}" printed on ${job.printerName}`);
      } else {
        setFeedbackMessage(`Retry failure: ${result.message}`);
      }
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: any) {
      sound.playError();
      setFeedbackMessage(`Retry error: ${err.message}`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } finally {
      setRetryingJobIds(prev => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
      refreshQueue();
    }
  };

  // Retry all failed jobs
  const handleRetryAllFailed = async () => {
    sound.playClick();
    setIsRetryingAll(true);
    setFeedbackMessage(null);
    try {
      const outcome = await printService.retryAllFailedJobs();
      if (outcome.succeeded > 0) {
        setFeedbackMessage(
          `Successfully processed and reprinted ${outcome.succeeded} failed print job(s)!`
        );
      } else if (outcome.processed === 0) {
        setFeedbackMessage('No failed print jobs in the queue to retry.');
      } else {
        setFeedbackMessage(`Reprint completed: ${outcome.succeeded} ok, ${outcome.failed} failed.`);
      }
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      sound.playError();
      setFeedbackMessage(`Batch retry error: ${err.message}`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } finally {
      setIsRetryingAll(false);
      refreshQueue();
    }
  };

  // Clear completed jobs
  const handleClearCompleted = async () => {
    sound.playClick();
    const count = await printService.clearCompletedJobs();
    setFeedbackMessage(`Cleared ${count} completed print job(s) from spooler.`);
    setTimeout(() => setFeedbackMessage(null), 3000);
    refreshQueue();
  };

  // Delete single job
  const handleDeleteJob = async (id: string, title: string) => {
    if (confirm(`Remove "${title}" from the print queue?`)) {
      sound.playClick();
      await printService.cancelPrintJob(id);
      refreshQueue();
    }
  };

  // Demo simulation options
  const handleSimulateFailedJob = async () => {
    sound.playClick();
    setIsNewJobMenuOpen(false);
    const randomOrderNum = Math.floor(10050 + Math.random() * 900);
    await printService.enqueuePrintJob({
      type: 'RECEIPT',
      title: `Receipt #ORD-${randomOrderNum}`,
      status: 'FAILED',
      error: 'Thermal paper out: Sensor 0x0C tripped (Replace 80mm roll)',
      retryCount: 1,
      maxRetries: 5,
      printerName: 'Epson TM-T88VI (Network 80mm)',
      paperWidth: '80mm',
      copies: 1,
      payloadMetadata: {
        orderNumber: `ORD-${randomOrderNum}`,
        totalAmount: 32.50,
        cashierName: 'Active Cashier',
      },
      payloadRaw: `================================
          NEXORA POS            
       FLAGSHIP DOWNTOWN        
================================
Receipt #: ORD-${randomOrderNum}
Date/Time: ${new Date().toLocaleTimeString()}
Register : REG-01
--------------------------------
ITEM                   QTY  TOTAL
--------------------------------
Matcha Latte             2  $13.00
Blueberry Muffin         2   $9.50
Iced Americano           2  $10.00
--------------------------------
TOTAL:                    $32.50
================================`,
    });
    setFeedbackMessage(`Enqueued simulated failed receipt #ORD-${randomOrderNum}`);
    setTimeout(() => setFeedbackMessage(null), 3000);
    refreshQueue();
  };

  const handleQueueSampleZReport = async () => {
    sound.playClick();
    setIsNewJobMenuOpen(false);
    const shiftNum = Math.floor(100 + Math.random() * 50);
    await printService.enqueuePrintJob({
      type: 'Z_REPORT',
      title: `End-of-Shift Z-Report (Shift #SH-${shiftNum})`,
      status: 'QUEUED',
      retryCount: 0,
      printerName: 'Epson TM-T88VI (Network 80mm)',
      paperWidth: '80mm',
      copies: 2,
      payloadMetadata: {
        shiftId: `SH-${shiftNum}`,
        totalAmount: 1420.00,
        cashierName: 'Active Cashier',
      },
      payloadRaw: `********************************
      OFFICIAL Z-REPORT #${shiftNum}    
         END OF SHIFT LEDGER    
********************************
Time     : ${new Date().toLocaleTimeString()}
Register : REG-01
--------------------------------
GROSS SALES:           $1,420.00
TAX COLLECTED:           $117.15
NET REVENUE:           $1,302.85
--------------------------------
CASH IN DRAWER:          $420.00
CARD TRANSACTIONS:     $1,000.00
AUDIT STATUS:           BALANCED
********************************`,
    });
    setFeedbackMessage(`Queued Z-Report for Shift #SH-${shiftNum}`);
    setTimeout(() => setFeedbackMessage(null), 3000);
    refreshQueue();
  };

  const handleResetDemoJobs = async () => {
    sound.playClick();
    setIsNewJobMenuOpen(false);
    await printService.clearCompletedJobs();
    await printService.seedDefaultPrintJobsIfEmpty();
    setFeedbackMessage('Reset default thermal print queue demonstration data.');
    setTimeout(() => setFeedbackMessage(null), 3000);
    refreshQueue();
  };

  return (
    <div id="settings-card-print-queue" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
      {/* Header with Title & Hardware Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Thermal Print Queue Manager</h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                ESC/POS Spooler
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Monitor, audit, and retry thermal receipt & report print jobs
            </p>
          </div>
        </div>

        {/* Printer Hardware Indicators */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px] truncate max-w-[150px]">
              Epson TM-T88VI (80mm)
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setStatusFilter('ALL');
          }}
          className={`p-3 rounded-xl border text-left transition ${
            statusFilter === 'ALL'
              ? 'bg-slate-800 border-slate-700 text-white shadow-sm'
              : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:bg-slate-850'
          }`}
        >
          <div className="text-[10.5px] uppercase font-semibold text-slate-400">Total Jobs</div>
          <div className="text-lg font-bold font-mono text-white mt-0.5">{summary.total}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setStatusFilter('FAILED');
          }}
          className={`p-3 rounded-xl border text-left transition ${
            statusFilter === 'FAILED'
              ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-sm'
              : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:bg-slate-850'
          }`}
        >
          <div className="text-[10.5px] uppercase font-semibold text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            Failed Jobs
          </div>
          <div className="text-lg font-bold font-mono text-rose-300 mt-0.5 flex items-center justify-between">
            <span>{summary.failed}</span>
            {summary.failed > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Action Req.
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setStatusFilter('QUEUED');
          }}
          className={`p-3 rounded-xl border text-left transition ${
            statusFilter === 'QUEUED'
              ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-sm'
              : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:bg-slate-850'
          }`}
        >
          <div className="text-[10.5px] uppercase font-semibold text-sky-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-400" />
            Queued
          </div>
          <div className="text-lg font-bold font-mono text-sky-300 mt-0.5">{summary.queued}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setStatusFilter('COMPLETED');
          }}
          className={`p-3 rounded-xl border text-left transition ${
            statusFilter === 'COMPLETED'
              ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-sm'
              : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:bg-slate-850'
          }`}
        >
          <div className="text-[10.5px] uppercase font-semibold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Completed
          </div>
          <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">{summary.completed}</div>
        </button>
      </div>

      {/* Action Bar: Search, Filters, Batch Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
        {/* Search & Type filter */}
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search receipt #, order, cashier, or error..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition"
            />
          </div>

          <select
            aria-label="Filter print jobs by document type"
            value={typeFilter}
            onChange={e => {
              sound.playClick();
              setTypeFilter(e.target.value as PrintJobType | 'ALL');
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-hidden focus:border-sky-500"
          >
            <option value="ALL">All Types</option>
            <option value="RECEIPT">Receipts</option>
            <option value="Z_REPORT">Z-Reports</option>
            <option value="X_REPORT">X-Reports</option>
            <option value="KITCHEN_TICKET">Kitchen Tickets</option>
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {summary.failed > 0 && (
            <button
              id="btn-retry-all-failed-prints"
              type="button"
              onClick={handleRetryAllFailed}
              disabled={isRetryingAll}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-950"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRetryingAll ? 'animate-spin' : ''}`} />
              <span>{isRetryingAll ? 'Retrying...' : `Retry All Failed (${summary.failed})`}</span>
            </button>
          )}

          {summary.completed > 0 && (
            <button
              type="button"
              onClick={handleClearCompleted}
              className="px-2.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium transition"
              title="Clear completed print jobs"
            >
              Clear Completed
            </button>
          )}

          {/* Test & Simulation Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNewJobMenuOpen(!isNewJobMenuOpen)}
              className="px-2.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>Test Print</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isNewJobMenuOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-slate-950 border border-slate-800 rounded-xl shadow-xl z-20 py-1 text-xs">
                <button
                  type="button"
                  onClick={handleSimulateFailedJob}
                  className="w-full px-3 py-2 text-left hover:bg-slate-800 text-rose-300 flex items-center gap-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Simulate Paper Jam / Out</span>
                </button>
                <button
                  type="button"
                  onClick={handleQueueSampleZReport}
                  className="w-full px-3 py-2 text-left hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>Queue Shift Z-Report</span>
                </button>
                <div className="border-t border-slate-800/80 my-1" />
                <button
                  type="button"
                  onClick={handleResetDemoJobs}
                  className="w-full px-3 py-2 text-left hover:bg-slate-800 text-slate-400 flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reset Demo Queue</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Feedback Toast */}
      {feedbackMessage && (
        <div className="p-3 rounded-xl bg-slate-950 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Queue Job List */}
      <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
        {filteredJobs.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <Printer className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-xs font-semibold text-slate-300">No print jobs found</div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'Try adjusting your search or active filter tabs.'
                : 'The print spooler queue is currently empty. Jobs sent from checkout receipts or shift Z-reports will appear here.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSimulateFailedJob}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold transition"
              >
                Enqueue Demo Print Job
              </button>
            </div>
          </div>
        ) : (
          filteredJobs.map(job => {
            const isRetryingThis = retryingJobIds.has(job.id);
            return (
              <div
                key={job.id}
                id={`print-job-${job.id}`}
                className={`p-3.5 rounded-xl border transition flex flex-col gap-2.5 ${
                  job.status === 'FAILED'
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                    : job.status === 'QUEUED'
                    ? 'bg-slate-950/80 border-sky-500/30 hover:border-sky-500/50'
                    : job.status === 'PRINTING'
                    ? 'bg-blue-950/20 border-blue-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Job Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Status Icon */}
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        job.status === 'FAILED'
                          ? 'bg-rose-500/20 text-rose-400'
                          : job.status === 'QUEUED'
                          ? 'bg-sky-500/20 text-sky-400'
                          : job.status === 'PRINTING'
                          ? 'bg-blue-500/20 text-blue-400 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {job.status === 'FAILED' && <AlertTriangle className="w-4 h-4" />}
                      {job.status === 'QUEUED' && <Clock className="w-4 h-4" />}
                      {job.status === 'PRINTING' && <RotateCw className="w-4 h-4 animate-spin" />}
                      {job.status === 'COMPLETED' && <Check className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-white">{job.title}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300">
                          {job.type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {job.paperWidth}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{job.printerName}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">
                          {new Date(job.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        {job.copies > 1 && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">{job.copies} copies</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions on row */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {/* View Slip */}
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setSelectedPreviewJob(job);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1"
                      title="View formatted thermal receipt slip"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      <span>Slip</span>
                    </button>

                    {/* Direct Print to browser */}
                    <button
                      type="button"
                      onClick={() => printService.printJobToBrowser(job)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition flex items-center gap-1"
                      title="Print via hardware or browser dialog"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {/* Retry Button (For FAILED or QUEUED jobs) */}
                    {(job.status === 'FAILED' || job.status === 'QUEUED') && (
                      <button
                        type="button"
                        onClick={() => handleRetrySingle(job)}
                        disabled={isRetryingThis}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-950"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isRetryingThis ? 'animate-spin' : ''}`} />
                        <span>{isRetryingThis ? 'Retrying...' : 'Retry'}</span>
                      </button>
                    )}

                    {/* Remove from queue */}
                    <button
                      type="button"
                      onClick={() => handleDeleteJob(job.id, job.title)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition"
                      title="Delete from spooler"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Error Callout Banner if FAILED */}
                {job.status === 'FAILED' && job.error && (
                  <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="font-mono text-[11px] truncate">{job.error}</span>
                    </div>
                    <span className="text-[10px] font-mono shrink-0 text-rose-400">
                      Retry #{job.retryCount}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal for viewing raw thermal slip */}
      <ThermalPrintPreviewModal
        job={selectedPreviewJob}
        isOpen={Boolean(selectedPreviewJob)}
        onClose={() => setSelectedPreviewJob(null)}
        onJobUpdated={updated => {
          setSelectedPreviewJob(updated);
          refreshQueue();
        }}
        onJobDeleted={() => {
          setSelectedPreviewJob(null);
          refreshQueue();
        }}
      />
    </div>
  );
};
