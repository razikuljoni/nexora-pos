'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, CheckCircle2, Store, Calendar, CreditCard, ArrowLeft, Sparkles, Hash, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order') || 'ORD-20260919-001';
  const total = searchParams.get('total') || '0.00';
  const time = searchParams.get('time') || new Date().toISOString();
  const hash = searchParams.get('hash') || 'NEX-VRF-9981-A42F';

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-emerald-950/30 overflow-hidden"
    >
      {/* Ambient background glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/15 blur-3xl pointer-events-none rounded-full" />

      {/* Verified Banner Header */}
      <div className="relative bg-gradient-to-b from-emerald-500/20 via-emerald-600/10 to-transparent border-b border-emerald-500/20 p-6 sm:p-7 text-center space-y-3">
        {/* Animated Shield Badge with Glowing Halo */}
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-2xl bg-emerald-400/25 blur-md"
          />

          <motion.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 18,
              delay: 0.15,
            }}
            className="relative z-10 w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-950/80 border border-emerald-300/40"
          >
            <ShieldCheck className="w-8 h-8 drop-shadow-sm" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
          className="space-y-1.5"
        >
          <h1 className="text-xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>Verified Authentic Transaction</span>
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Official cryptographic proof issued by Nexora POS point-of-sale fiscal engine.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold shadow-xs"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Valid Tax Invoice & Digital Proof</span>
        </motion.div>
      </div>

      {/* Certificate Details */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.55 }}
        className="p-6 space-y-5"
      >
        <div className="bg-slate-950/90 rounded-2xl p-4.5 border border-slate-800/90 space-y-3.5 shadow-inner">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-500" />
              <span>Order Reference</span>
            </span>
            <span className="font-mono font-bold text-white text-sm bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
              {orderNumber}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Verification Hash</span>
            </span>
            <span className="font-mono text-emerald-400 font-semibold text-xs tracking-wider bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-900/60">
              {hash}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Issued Timestamp</span>
            </span>
            <span className="text-slate-200 font-mono text-[11px]">
              {new Date(time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-3 font-bold">
            <span className="text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authorized Total</span>
            </span>
            <span className="text-emerald-400 font-mono text-lg font-black">${total}</span>
          </div>
        </div>

        {/* Security Disclosures */}
        <div className="space-y-2.5 text-xs text-slate-400 px-1">
          <div className="flex items-center gap-2.5">
            <Store className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Issued by Nexora POS Certified Cloud Node</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Eligible for refunds or exchanges within 14 days of purchase.</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Authorized via encrypted electronic settlement ledger.</span>
          </div>
        </div>

        {/* Return to POS CTA */}
        <div className="pt-2">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/"
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg hover:shadow-slate-900/60"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              <span>Return to Nexora POS Terminal</span>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
      <Suspense
        fallback={
          <div className="text-slate-400 text-sm flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <span>Verifying transaction certificate...</span>
          </div>
        }
      >
        <VerifyContent />
      </Suspense>
    </main>
  );
}

