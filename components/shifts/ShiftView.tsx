'use client';

import React, { useState } from 'react';
import {
  Clock,
  Banknote,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Lock,
  Unlock,
  Printer,
} from 'lucide-react';
import type { Shift, CashMovement, Location, User as StaffUser } from '@/lib/types';
import { openShift, recordCashMovement, closeShift } from '@/lib/services/shiftService';
import { sound } from '@/lib/audio';
import { printService } from '@/lib/services/printService';

interface ShiftViewProps {
  activeShift?: Shift;
  pastShifts: Shift[];
  cashMovements: CashMovement[];
  currentLocation: Location;
  currentUser: StaffUser;
  onRefreshData: () => Promise<void>;
}

export const ShiftView: React.FC<ShiftViewProps> = ({
  activeShift,
  pastShifts,
  cashMovements,
  currentLocation,
  currentUser,
  onRefreshData,
}) => {
  // Modal states
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [openingFloatInput, setOpeningFloatInput] = useState('200.00');
  const [openingNotes, setOpeningNotes] = useState('');

  const [isCashMovementModal, setIsCashMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT' | 'SAFE_DROP'>('CASH_IN');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const [isCloseShiftModal, setIsCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [selectedZReportShift, setSelectedZReportShift] = useState<Shift | null>(null);

  // Handle Open Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const floatVal = parseFloat(openingFloatInput) || 0;
    try {
      sound.playClick();
      await openShift(
        'org_nexora',
        currentLocation.id,
        'reg_01',
        currentUser.id,
        currentUser.name,
        floatVal,
        openingNotes
      );
      setIsOpenShiftModal(false);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Cash Movement (In/Out/Drop)
  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    const amount = parseFloat(movementAmount) || 0;
    if (amount <= 0 || !movementReason.trim()) return;

    try {
      sound.playClick();
      await recordCashMovement(
        activeShift.id,
        movementType,
        amount,
        movementReason.trim(),
        currentUser.id,
        currentUser.name,
        currentLocation.id
      );
      setIsCashMovementModal(false);
      setMovementAmount('');
      setMovementReason('');
      await onRefreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Close Shift (Smart Close)
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    const counted = parseFloat(countedCashInput) || 0;
    const variance = Number((counted - activeShift.expectedCash).toFixed(2));

    if (variance !== 0 && !varianceReason.trim()) {
      alert('A valid reason explanation is required for non-zero cash drawer variance.');
      return;
    }

    try {
      sound.playSaleSuccess();
      const closed = await closeShift(
        activeShift.id,
        counted,
        varianceReason.trim() || null,
        closingNotes.trim() || undefined,
        currentUser.id,
        currentUser.name,
        currentLocation.id
      );
      setIsCloseShiftModal(false);
      setSelectedZReportShift(closed);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const countedVal = parseFloat(countedCashInput) || 0;
  const currentVariance = activeShift
    ? Number((countedVal - activeShift.expectedCash).toFixed(2))
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6 bg-slate-950 text-slate-100">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-white">Cash & Shift Management</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                activeShift
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {activeShift ? (
                <>
                  <Unlock className="w-3.5 h-3.5" /> Shift Open
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" /> Shift Closed
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Reconcile drawer floats, log cash movements, and perform Smart Close shift audits.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeShift ? (
            <>
              <button
                onClick={() => {
                  sound.playClick();
                  setIsCashMovementModal(true);
                }}
                className="px-3.5 sm:px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition flex items-center gap-2"
              >
                <Banknote className="w-4 h-4 text-amber-400" />
                <span>Cash In / Out</span>
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  setCountedCashInput(activeShift.expectedCash.toFixed(2));
                  setIsCloseShiftModal(true);
                }}
                className="px-4 sm:px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition flex items-center gap-2 shadow-md shadow-rose-950"
              >
                <Lock className="w-4 h-4" />
                <span>Close Shift</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                sound.playClick();
                setIsOpenShiftModal(true);
              }}
              className="px-5 sm:px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition flex items-center gap-2 shadow-md shadow-emerald-950"
            >
              <Unlock className="w-4 h-4" />
              <span>Open New Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Dashboard */}
      {activeShift ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400">Opening Float</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {currentLocation.currencySymbol}{activeShift.openingFloat.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Initial Cash</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400">Cash Sales</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                +{currentLocation.currencySymbol}{activeShift.cashSales.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Tendered cash</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400">Card & Mobile</div>
              <div className="text-xl font-bold font-mono text-sky-400 mt-1">
                {currentLocation.currencySymbol}{(activeShift.cardSales + activeShift.mobileSales).toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Electronic payments</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400">Cash Movements</div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                {currentLocation.currencySymbol}{(activeShift.cashIn - activeShift.cashOut - activeShift.safeDrops).toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">In - Out - Drops</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400">Cash Refunds</div>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                -{currentLocation.currencySymbol}{activeShift.cashRefunds.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Returned to customer</div>
            </div>

            <div className="bg-slate-900 border-2 border-emerald-500/40 p-4 rounded-xl bg-emerald-950/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Expected in Drawer</div>
              <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
                {currentLocation.currencySymbol}{activeShift.expectedCash.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Calculated ledger balance</div>
            </div>
          </div>

          {/* Active Shift Details & Cash Movements Ledger */}
          <div className="grid lg:grid-cols-3 gap-5">
            {/* Shift Summary Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Shift Metadata
              </h3>
              <div className="space-y-2 text-xs divide-y divide-slate-800/80">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Cashier:</span>
                  <span className="font-semibold text-white">{activeShift.cashierName}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Shift Started:</span>
                  <span className="font-mono text-slate-300">
                    {new Date(activeShift.openedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Register:</span>
                  <span className="font-mono text-slate-300">{activeShift.registerId}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Location:</span>
                  <span className="text-slate-300">{currentLocation.name}</span>
                </div>
                {activeShift.notes && (
                  <div className="pt-2 text-slate-400 italic">
                    &quot;{activeShift.notes}&quot;
                  </div>
                )}
              </div>
            </div>

            {/* Cash Movements Ledger */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Shift Cash Movement Ledger ({cashMovements.length})
                </h3>
                <span className="text-xs text-slate-500">Immutable drawer events</span>
              </div>

              {cashMovements.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No cash movements recorded yet for this active shift.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cashMovements.map(mov => (
                    <div
                      key={mov.id}
                      className="p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            mov.amount >= 0
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {mov.amount >= 0 ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-white uppercase text-[11px]">{mov.type}</div>
                          <div className="text-slate-400 text-[11px]">{mov.reason}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`font-mono font-bold ${mov.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {mov.amount >= 0 ? '+' : ''}{currentLocation.currencySymbol}{mov.amount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(mov.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Register Shift is Currently Closed</h2>
            <p className="text-xs text-slate-400 mt-1">
              Before accepting payments or opening the cash drawer, please open a shift with an initial cash float.
            </p>
          </div>
          <button
            onClick={() => setIsOpenShiftModal(true)}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow-md shadow-emerald-950"
          >
            Open Register Shift Now
          </button>
        </div>
      )}

      {/* Past Shifts History Display (Mobile Cards + Desktop Table) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Historical Shift Records & Z-Reports
        </h3>

        {/* Mobile Shift Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-800/70">
          {pastShifts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No historical shifts recorded yet.
            </div>
          ) : (
            pastShifts.map(s => (
              <div key={s.id} className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-white">#{s.id.slice(-8)}</span>
                    <span className="text-xs text-slate-400 ml-2">• {s.cashierName}</span>
                  </div>
                  <button
                    onClick={() => {
                      sound.playClick();
                      setSelectedZReportShift(s);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-medium"
                  >
                    Z-Report
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex justify-between">
                  <span>Opened: {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{s.closedAt ? `Closed: ${new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Active'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2 rounded-xl text-center text-[10px]">
                  <div>
                    <div className="text-slate-400">Expected</div>
                    <div className="font-mono font-bold text-slate-200">{currentLocation.currencySymbol}{s.expectedCash.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Counted</div>
                    <div className="font-mono font-bold text-white">{s.countedCash !== null ? `${currentLocation.currencySymbol}${s.countedCash.toFixed(2)}` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Variance</div>
                    <div className={`font-mono font-bold ${s.variance === 0 ? 'text-emerald-400' : s.variance && s.variance < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                      {s.variance !== null ? `${s.variance > 0 ? '+' : ''}${currentLocation.currencySymbol}${s.variance.toFixed(2)}` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Past Shifts Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Shift ID</th>
                <th className="p-3">Cashier</th>
                <th className="p-3">Opened</th>
                <th className="p-3">Closed</th>
                <th className="p-3">Cash Sales</th>
                <th className="p-3">Expected</th>
                <th className="p-3">Counted</th>
                <th className="p-3">Variance</th>
                <th className="p-3 text-right">Z-Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pastShifts.map(s => (
                <tr key={s.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-mono font-semibold text-slate-200">{s.id.slice(-8)}</td>
                  <td className="p-3 font-medium text-white">{s.cashierName}</td>
                  <td className="p-3 text-slate-400 font-mono">
                    {new Date(s.openedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="p-3 text-slate-400 font-mono">
                    {s.closedAt ? new Date(s.closedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'In Progress'}
                  </td>
                  <td className="p-3 font-mono text-emerald-400">{currentLocation.currencySymbol}{s.cashSales.toFixed(2)}</td>
                  <td className="p-3 font-mono text-slate-300">{currentLocation.currencySymbol}{s.expectedCash.toFixed(2)}</td>
                  <td className="p-3 font-mono text-white">{s.countedCash !== null ? `${currentLocation.currencySymbol}${s.countedCash.toFixed(2)}` : '—'}</td>
                  <td className="p-3 font-mono font-bold">
                    {s.variance !== null ? (
                      <span className={s.variance === 0 ? 'text-emerald-400' : s.variance < 0 ? 'text-rose-400' : 'text-amber-400'}>
                        {s.variance > 0 ? '+' : ''}{currentLocation.currencySymbol}{s.variance.toFixed(2)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelectedZReportShift(s)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-medium"
                    >
                      View Z-Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Shift Modal */}
      {isOpenShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form onSubmit={handleOpenShift} className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 bg-slate-950/70">
              <h3 className="text-base font-bold text-white">Open Cash Register Shift</h3>
              <p className="text-xs text-slate-400">Count physical bills and declare opening cash float</p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Opening Float ({currentLocation.currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={openingFloatInput}
                  onChange={e => setOpeningFloatInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-lg font-bold font-mono text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Shift Notes (Optional)
                </label>
                <input
                  type="text"
                  value={openingNotes}
                  onChange={e => setOpeningNotes(e.target.value)}
                  placeholder="e.g. Afternoon shift handover..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpenShiftModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Confirm & Open Shift
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cash Movement Modal */}
      {isCashMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form onSubmit={handleRecordMovement} className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 bg-slate-950/70">
              <h3 className="text-base font-bold text-white">Record Cash Drawer Movement</h3>
              <p className="text-xs text-slate-400">Log cash in, petty cash out, or safe drops</p>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                {(['CASH_IN', 'CASH_OUT', 'SAFE_DROP'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMovementType(type)}
                    className={`py-2 px-2 rounded-xl border transition ${
                      movementType === type
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Amount ({currentLocation.currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={movementAmount}
                  onChange={e => setMovementAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-base font-bold font-mono text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Reason Description *
                </label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={e => setMovementReason(e.target.value)}
                  placeholder="e.g. Bought fresh whole milk from market, safe drop..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCashMovementModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
              >
                Record Movement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Smart Close Modal */}
      {isCloseShiftModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form onSubmit={handleCloseShift} className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-400" />
                  Smart Close Shift Reconciliation
                </h3>
                <p className="text-xs text-slate-400">Compare calculated expected cash against physical count</p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Smart Close Comparison Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>EXPECTED CASH:</span>
                  <span className="font-bold text-white text-sm">
                    {currentLocation.currencySymbol}{activeShift.expectedCash.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>PHYSICAL COUNT:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">{currentLocation.currencySymbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      autoFocus
                      value={countedCashInput}
                      onChange={e => setCountedCashInput(e.target.value)}
                      className="w-32 bg-slate-900 border-2 border-slate-700 focus:border-sky-500 rounded-lg px-2.5 py-1 font-bold text-white text-sm text-right focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between font-black text-sm">
                  <span>VARIANCE:</span>
                  <span
                    className={
                      currentVariance === 0
                        ? 'text-emerald-400'
                        : currentVariance < 0
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }
                  >
                    {currentVariance > 0 ? '+' : ''}{currentLocation.currencySymbol}{currentVariance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Breakdown summary */}
              <div className="grid grid-cols-3 gap-2 text-center text-slate-400 bg-slate-950/40 p-3 rounded-xl">
                <div>
                  <div className="text-[10px] uppercase">Cash Sales</div>
                  <div className="font-mono text-white font-bold">{currentLocation.currencySymbol}{activeShift.cashSales.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase">Card Sales</div>
                  <div className="font-mono text-white font-bold">{currentLocation.currencySymbol}{activeShift.cardSales.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase">Mobile Sales</div>
                  <div className="font-mono text-white font-bold">{currentLocation.currencySymbol}{activeShift.mobileSales.toFixed(2)}</div>
                </div>
              </div>

              {/* Variance reason required if non-zero */}
              {currentVariance !== 0 && (
                <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <label className="block font-bold text-amber-300 text-xs">
                    Variance Explanation *
                  </label>
                  <input
                    type="text"
                    required
                    value={varianceReason}
                    onChange={e => setVarianceReason(e.target.value)}
                    placeholder="e.g. Dispensed extra 50c coin change during morning rush..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-xs mb-1">Final Handover Notes</label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  placeholder="Any equipment or inventory notes for the next shift..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCloseShiftModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Commit & Finalize Close
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Z-Report Modal */}
      {selectedZReportShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Shift End Z-Report
              </h3>
              <button
                onClick={() => setSelectedZReportShift(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-950/60 flex justify-center">
              <div className="w-full bg-white text-black font-mono text-xs p-5 rounded-lg border border-slate-300 space-y-2.5 leading-tight">
                <div className="text-center border-b border-dashed border-slate-300 pb-2">
                  <div className="font-black text-sm uppercase">NEXORA POS — Z-REPORT</div>
                  <div className="text-[10px] text-slate-600">{currentLocation.name}</div>
                  <div className="text-[10px] text-slate-600">Shift #{selectedZReportShift.id.slice(-8)}</div>
                </div>

                <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span className="font-bold">{selectedZReportShift.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opened:</span>
                    <span>{new Date(selectedZReportShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Closed:</span>
                    <span>
                      {selectedZReportShift.closedAt
                        ? new Date(selectedZReportShift.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Active'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                  <div className="flex justify-between">
                    <span>Opening Float:</span>
                    <span>{currentLocation.currencySymbol}{selectedZReportShift.openingFloat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Sales:</span>
                    <span>+{currentLocation.currencySymbol}{selectedZReportShift.cashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Card Sales:</span>
                    <span>{currentLocation.currencySymbol}{selectedZReportShift.cardSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mobile Sales:</span>
                    <span>{currentLocation.currencySymbol}{selectedZReportShift.mobileSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash In/Out:</span>
                    <span>{currentLocation.currencySymbol}{(selectedZReportShift.cashIn - selectedZReportShift.cashOut).toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] font-bold border-b border-dashed border-slate-300 pb-2">
                  <div className="flex justify-between">
                    <span>Expected Cash:</span>
                    <span>{currentLocation.currencySymbol}{selectedZReportShift.expectedCash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Counted Cash:</span>
                    <span>
                      {selectedZReportShift.countedCash !== null
                        ? `${currentLocation.currencySymbol}${selectedZReportShift.countedCash.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-300">
                    <span>Cash Variance:</span>
                    <span>
                      {selectedZReportShift.variance !== null
                        ? `${currentLocation.currencySymbol}${selectedZReportShift.variance.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>
                </div>

                {selectedZReportShift.varianceReason && (
                  <div className="text-[10px] text-slate-700 italic">
                    Variance Note: {selectedZReportShift.varianceReason}
                  </div>
                )}
                <div className="text-center pt-2 text-[9px] text-slate-500">
                  Audit Verified • End of Shift Ledger
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-between">
              <button
                onClick={() => {
                  sound.playClick();
                  sound.playPrintFeed();
                  if (typeof window !== 'undefined') {
                    window.print();
                  }
                  const totalSales =
                    selectedZReportShift.cashSales +
                    selectedZReportShift.cardSales +
                    selectedZReportShift.mobileSales;
                  const rawZReport = `********************************
      OFFICIAL Z-REPORT
    END OF SHIFT RECONCILIATION
********************************
Store    : ${currentLocation.name}
Register : ${selectedZReportShift.registerId}
Cashier  : ${selectedZReportShift.cashierName}
Opened   : ${new Date(selectedZReportShift.openedAt).toLocaleString()}
Closed   : ${selectedZReportShift.closedAt ? new Date(selectedZReportShift.closedAt).toLocaleString() : 'N/A'}
--------------------------------
TOTAL SALES:        ${currentLocation.currencySymbol}${totalSales.toFixed(2)}
  CASH:             ${currentLocation.currencySymbol}${selectedZReportShift.cashSales.toFixed(2)}
  CARD:             ${currentLocation.currencySymbol}${selectedZReportShift.cardSales.toFixed(2)}
  MOBILE:           ${currentLocation.currencySymbol}${selectedZReportShift.mobileSales.toFixed(2)}
CASH REFUNDS:       ${currentLocation.currencySymbol}${selectedZReportShift.cashRefunds.toFixed(2)}
--------------------------------
DRAWER RECONCILIATION:
  Opening Float:    ${currentLocation.currencySymbol}${selectedZReportShift.openingFloat.toFixed(2)}
  Cash In/Out:      ${currentLocation.currencySymbol}${(selectedZReportShift.cashIn - selectedZReportShift.cashOut).toFixed(2)}
  Safe Drops:       ${currentLocation.currencySymbol}${selectedZReportShift.safeDrops.toFixed(2)}
  Expected Cash:    ${currentLocation.currencySymbol}${selectedZReportShift.expectedCash.toFixed(2)}
  Counted Cash:     ${currentLocation.currencySymbol}${(selectedZReportShift.countedCash || 0).toFixed(2)}
  Variance:         ${currentLocation.currencySymbol}${(selectedZReportShift.variance || 0).toFixed(2)}
--------------------------------
Audit Verified • End of Shift Ledger
********************************`;

                  printService
                    .enqueuePrintJob({
                      type: 'Z_REPORT',
                      title: `Shift Z-Report #${selectedZReportShift.id.slice(0, 8)}`,
                      status: 'COMPLETED',
                      completedAt: new Date().toISOString(),
                      printerName: 'Epson TM-T88VI (Network 80mm)',
                      paperWidth: '80mm',
                      copies: 1,
                      targetId: selectedZReportShift.id,
                      payloadRaw: rawZReport,
                      payloadMetadata: {
                        shiftId: selectedZReportShift.id,
                        totalAmount: totalSales,
                        cashierName: selectedZReportShift.cashierName,
                        locationName: currentLocation.name,
                      },
                    })
                    .catch(err => console.warn('Could not register shift print job:', err));
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-2"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                Print Z-Report
              </button>
              <button
                onClick={() => setSelectedZReportShift(null)}
                className="px-4 py-2 rounded-xl bg-slate-700 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
