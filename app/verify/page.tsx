'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, CheckCircle2, Store, Calendar, CreditCard, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function VerifyContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order') || 'ORD-20260919-001';
  const total = searchParams.get('total') || '0.00';
  const time = searchParams.get('time') || new Date().toISOString();
  const hash = searchParams.get('hash') || 'NEX-VRF-9981-A42F';

  return (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      {/* Verified Banner */}
      <div className="bg-emerald-600/20 border-b border-emerald-500/30 p-5 text-center space-y-2">
        <div className="w-12 h-12 bg-emerald-500 text-slate-950 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-950">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-black tracking-tight text-white">
          Verified Authentic Transaction
        </h1>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Valid Tax Invoice & Digital Proof</span>
        </div>
      </div>

      {/* Certificate Details */}
      <div className="p-6 space-y-5">
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Order Reference</span>
            <span className="font-mono font-bold text-white text-sm">{orderNumber}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Verification Hash</span>
            <span className="font-mono text-emerald-400 font-semibold text-xs">{hash}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Issued Timestamp</span>
            <span className="text-slate-200">
              {new Date(time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-2 font-bold">
            <span className="text-slate-300">Authorized Total</span>
            <span className="text-emerald-400 font-mono text-base">${total}</span>
          </div>
        </div>

        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Issued by Nexora POS Certified Cloud Node</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Eligible for refunds or exchanges within 14 days of purchase.</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Authorized via encrypted electronic settlement ledger.</span>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Nexora POS Terminal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="text-slate-400 text-sm flex items-center gap-2">
            <span>Verifying transaction certificate...</span>
          </div>
        }
      >
        <VerifyContent />
      </Suspense>
    </main>
  );
}
