'use client';

import React, { useState, useEffect } from 'react';
import {
  Banknote,
  CreditCard,
  Smartphone,
  Check,
  X,
  Plus,
  Trash2,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import type { PaymentMethod, PaymentRecord } from '@/lib/types';
import { sound } from '@/lib/audio';

interface PaymentModalProps {
  isOpen: boolean;
  total: number;
  currencySymbol: string;
  onComplete: (payments: PaymentRecord[]) => void;
  onClose: () => void;
}

const PaymentModalContent: React.FC<Omit<PaymentModalProps, 'isOpen'>> = ({
  total,
  currencySymbol,
  onComplete,
  onClose,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH');
  const [tenderedInput, setTenderedInput] = useState<string>(total.toFixed(2));
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [splitMode, setSplitMode] = useState<boolean>(false);

  useEffect(() => {
    sound.playDrawer();
  }, []);

  const totalPaidSoFar = payments.reduce((acc, p) => acc + p.amount, 0);
  const remainingDue = Math.max(0, Number((total - totalPaidSoFar).toFixed(2)));
  const tenderedNumeric = parseFloat(tenderedInput) || 0;
  const changeDue = Math.max(0, Number((tenderedNumeric - (splitMode ? remainingDue : total)).toFixed(2)));

  const handleQuickCash = (amount: number) => {
    sound.playClick();
    setTenderedInput(amount.toFixed(2));
  };

  const handleAddQuickDelta = (delta: number) => {
    sound.playClick();
    const current = parseFloat(tenderedInput) || 0;
    setTenderedInput((current + delta).toFixed(2));
  };

  const handleAddSplitPayment = () => {
    sound.playClick();
    const amountToApply = Math.min(remainingDue, tenderedNumeric || remainingDue);
    if (amountToApply <= 0) return;

    const newPayment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      method: selectedMethod,
      amount: amountToApply,
      tendered: selectedMethod === 'CASH' ? tenderedNumeric : amountToApply,
      changeDue: selectedMethod === 'CASH' ? Math.max(0, tenderedNumeric - amountToApply) : 0,
      status: 'CAPTURED',
      processedAt: new Date().toISOString(),
    };

    const nextPayments = [...payments, newPayment];
    setPayments(nextPayments);

    const newRemaining = Math.max(0, Number((total - nextPayments.reduce((acc, p) => acc + p.amount, 0)).toFixed(2)));
    setTenderedInput(newRemaining.toFixed(2));

    if (newRemaining <= 0) {
      sound.playSaleSuccess();
      onComplete(nextPayments);
    }
  };

  const handleSinglePaymentSubmit = () => {
    if (selectedMethod === 'CASH' && tenderedNumeric < total) {
      sound.playError();
      return;
    }

    sound.playSaleSuccess();
    const paymentRecord: PaymentRecord = {
      id: `pay_${Date.now()}`,
      method: selectedMethod,
      amount: total,
      tendered: selectedMethod === 'CASH' ? tenderedNumeric : total,
      changeDue: selectedMethod === 'CASH' ? changeDue : 0,
      status: 'CAPTURED',
      processedAt: new Date().toISOString(),
    };

    onComplete([paymentRecord]);
  };

  const handleRemovePayment = (id: string) => {
    sound.playClick();
    const filtered = payments.filter(p => p.id !== id);
    setPayments(filtered);
    const newRemaining = Math.max(0, Number((total - filtered.reduce((acc, p) => acc + p.amount, 0)).toFixed(2)));
    setTenderedInput(newRemaining.toFixed(2));
  };

  // Quick denomination suggestions
  const roundedUp5 = Math.ceil(total / 5) * 5;
  const roundedUp10 = Math.ceil(total / 10) * 10;
  const roundedUp20 = Math.ceil(total / 20) * 20;
  const roundedUp50 = Math.ceil(total / 50) * 50;
  const roundedUp100 = Math.ceil(total / 100) * 100;
  const quickOptions = Array.from(
    new Set([
      total,
      roundedUp5 > total ? roundedUp5 : total + 5,
      roundedUp10 > total ? roundedUp10 : total + 10,
      roundedUp20 > total ? roundedUp20 : total + 20,
      roundedUp50 > total ? roundedUp50 : total + 50,
      roundedUp100 > total ? roundedUp100 : total + 100,
    ])
  ).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Payment & Tender</h2>
              <p className="text-xs text-slate-400">Total payable: <strong className="text-emerald-400 font-mono text-sm">{currencySymbol}{total.toFixed(2)}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Method Selector Tabs */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => {
                sound.playClick();
                setSelectedMethod('CASH');
              }}
              className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition ${
                selectedMethod === 'CASH'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Banknote className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Cash Tender</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setSelectedMethod('CARD');
              }}
              className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition ${
                selectedMethod === 'CARD'
                  ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md shadow-sky-950'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Credit / Debit</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setSelectedMethod('MOBILE_WALLET');
              }}
              className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition ${
                selectedMethod === 'MOBILE_WALLET'
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md shadow-purple-950'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Mobile / QR</span>
            </button>
          </div>

          {/* Mode Switch: Single vs Split */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400">Payment Breakdown:</span>
            <button
              onClick={() => {
                sound.playClick();
                setSplitMode(!splitMode);
              }}
              className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-4"
            >
              {splitMode ? 'Switch to Single Tender' : 'Enable Split Payment Tender'}
            </button>
          </div>

          {/* Split Mode Progress */}
          {splitMode && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Paid: <strong className="text-white">{currencySymbol}{totalPaidSoFar.toFixed(2)}</strong></span>
                <span className="text-slate-400">Remaining Due: <strong className="text-amber-400 font-mono">{currencySymbol}{remainingDue.toFixed(2)}</strong></span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (totalPaidSoFar / total) * 100)}%` }}
                />
              </div>

              {payments.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-900/70 px-3 py-1.5 rounded-lg text-xs">
                      <span className="text-slate-300 font-medium">{p.method}: {currencySymbol}{p.amount.toFixed(2)}</span>
                      <button onClick={() => handleRemovePayment(p.id)} className="text-rose-400 hover:text-rose-300">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cash Input & Quick Bills */}
          {selectedMethod === 'CASH' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Tendered Amount ({currencySymbol})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-lg font-bold">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={tenderedInput}
                    onChange={e => setTenderedInput(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-2xl font-bold font-mono text-white focus:outline-hidden transition"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2">
                {quickOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => handleQuickCash(opt)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-semibold text-emerald-300 transition"
                  >
                    {opt === total ? 'Exact' : `${currencySymbol}${opt.toFixed(2)}`}
                  </button>
                ))}
                <button
                  onClick={() => handleAddQuickDelta(10)}
                  className="px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300"
                >
                  +{currencySymbol}10
                </button>
                <button
                  onClick={() => handleAddQuickDelta(20)}
                  className="px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300"
                >
                  +{currencySymbol}20
                </button>
              </div>

              {/* Change Due Highlight Box */}
              <div className="bg-slate-950 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Change Due</div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {currencySymbol}{changeDue.toFixed(2)}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400 space-y-0.5">
                  <div>Tendered: <strong className="text-white font-mono">{currencySymbol}{tenderedNumeric.toFixed(2)}</strong></div>
                  <div>Payable: <strong className="text-white font-mono">{currencySymbol}{(splitMode ? remainingDue : total).toFixed(2)}</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* Card / Mobile Info */}
          {selectedMethod !== 'CASH' && (
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-xl text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center">
                {selectedMethod === 'CARD' ? <CreditCard className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
              </div>
              <div className="text-sm font-semibold text-white">
                {selectedMethod === 'CARD' ? 'Present Card to Terminal' : 'Scan Dynamic QR / Mobile Transfer'}
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {selectedMethod === 'CARD'
                  ? 'Swipe, tap or insert customer card on the connected PIN pad. Terminal is ready.'
                  : 'Customer may scan checkout QR on screen or enter reference number.'}
              </p>
              <div className="text-xs font-mono text-sky-300 font-bold pt-2">
                Amount to Capture: {currencySymbol}{(splitMode ? remainingDue : total).toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
          >
            Cancel Tender
          </button>

          {splitMode ? (
            <button
              onClick={handleAddSplitPayment}
              disabled={tenderedNumeric <= 0}
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              Apply {selectedMethod} Tender ({currencySymbol}{Math.min(remainingDue, tenderedNumeric || remainingDue).toFixed(2)})
            </button>
          ) : (
            <button
              onClick={handleSinglePaymentSubmit}
              disabled={selectedMethod === 'CASH' && tenderedNumeric < total}
              className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-950 transition"
            >
              <Check className="w-5 h-5" />
              Complete Sale & Print Receipt ({currencySymbol}{total.toFixed(2)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const PaymentModal: React.FC<PaymentModalProps> = props => {
  if (!props.isOpen) return null;
  return <PaymentModalContent {...props} />;
};

