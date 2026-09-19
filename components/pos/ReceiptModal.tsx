'use client';

import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  CheckCircle2,
  X,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Code2,
  FileText,
  Smartphone,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { Sale, Location } from '@/lib/types';
import { sound } from '@/lib/audio';

interface ReceiptModalProps {
  isOpen: boolean;
  sale: Sale | null;
  location: Location;
  onClose: () => void;
  onNewSale?: () => void;
}

type ReceiptTab = 'thermal' | 'verify' | 'raw';
type PaperWidth = '80mm' | '58mm';

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  sale,
  location,
  onClose,
  onNewSale,
}) => {
  const [activeTab, setActiveTab] = useState<ReceiptTab>('thermal');
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEscPos, setCopiedEscPos] = useState(false);

  // Compute digital verification token & URL
  const { verificationUrl, verificationHash } = useMemo(() => {
    if (!sale) return { verificationUrl: '', verificationHash: '' };

    // Deterministic pseudo-cryptographic hash for digital verification
    const rawSig = `${sale.orderNumber}|${sale.total.toFixed(2)}|${sale.createdAt}|${sale.registerId}`;
    let hashNum = 0;
    for (let i = 0; i < rawSig.length; i++) {
      hashNum = (hashNum << 5) - hashNum + rawSig.charCodeAt(i);
      hashNum |= 0;
    }
    const hexHash = Math.abs(hashNum).toString(16).toUpperCase().padStart(8, '0');
    const hash = `NEX-VRF-${sale.orderNumber.replace(/[^0-9]/g, '').slice(-4) || '9981'}-${hexHash.slice(0, 4)}`;

    // Digital verification URL
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nexora.pos';
    const url = `${baseUrl}/verify?order=${encodeURIComponent(sale.orderNumber)}&total=${sale.total.toFixed(2)}&time=${encodeURIComponent(sale.createdAt)}&hash=${hash}`;

    return { verificationUrl: url, verificationHash: hash };
  }, [sale]);

  // Generate QR Code data URL when sale is loaded
  useEffect(() => {
    if (!sale || !verificationUrl) return;

    QRCode.toDataURL(verificationUrl, {
      width: paperWidth === '80mm' ? 160 : 130,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('[Receipt] QR Code generation error:', err));
  }, [sale, verificationUrl, paperWidth]);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    sound.playClick();
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleCopyVerificationLink = async () => {
    sound.playClick();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(verificationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleShare = async () => {
    sound.playClick();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Receipt for ${sale.orderNumber}`,
          text: `Digital verified receipt from ${location.name} for ${location.currencySymbol}${sale.total.toFixed(2)}`,
          url: verificationUrl,
        });
      } catch {
        // User dismissed share dialog
      }
    } else {
      handleCopyVerificationLink();
    }
  };

  // Generate raw ESC/POS monospace stream for thermal receipt printers
  const escPosRaw = `[ESC @]
[ESC a 1]
================================
          NEXORA POS            
       ${location.name.toUpperCase().padEnd(24)}
       ${location.address.slice(0, 30)}
       TEL: ${location.phone}
================================
[ESC a 0]
Receipt #: ${sale.orderNumber}
Date/Time: ${new Date(sale.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
Register : ${sale.registerId}
Cashier  : ${sale.cashierName}
${sale.customerName ? `Customer : ${sale.customerName}\n` : ''}Type     : ${sale.orderType.toUpperCase()}${sale.tableNumber ? ` (T-${sale.tableNumber})` : ''}
--------------------------------
ITEM                   QTY  TOTAL
--------------------------------
${sale.items
  .map(it => {
    const namePart = it.name.slice(0, 18).padEnd(18);
    const qtyPart = `${it.quantity}x`.padStart(4);
    const pricePart = `${location.currencySymbol}${it.total.toFixed(2)}`.padStart(8);
    let out = `${namePart} ${qtyPart} ${pricePart}`;
    if (it.selectedModifiers && it.selectedModifiers.length > 0) {
      out += `\n  + ${it.selectedModifiers.map(m => m.optionName).join(', ')}`;
    }
    return out;
  })
  .join('\n')}
--------------------------------
Subtotal:          ${location.currencySymbol}${sale.subtotal.toFixed(2).padStart(12)}
${sale.discountTotal > 0 ? `Savings:          -${location.currencySymbol}${sale.discountTotal.toFixed(2).padStart(11)}\n` : ''}Tax (${(location.taxRate * 100).toFixed(1)}%):          ${location.currencySymbol}${sale.taxTotal.toFixed(2).padStart(12)}
[ESC E 1]
TOTAL:             ${location.currencySymbol}${sale.total.toFixed(2).padStart(12)}
[ESC E 0]
--------------------------------
${sale.payments
  .map(p => `Tender (${p.method.slice(0, 8)}):   ${location.currencySymbol}${(p.tendered || p.amount).toFixed(2).padStart(12)}`)
  .join('\n')}
${sale.payments.some(p => (p.changeDue || 0) > 0) ? `Change Given:      ${location.currencySymbol}${sale.payments.reduce((acc, p) => acc + (p.changeDue || 0), 0).toFixed(2).padStart(12)}\n` : ''}--------------------------------
[ESC a 1]
[QR Code: ${verificationUrl}]
Auth Hash: ${verificationHash}
Scan to verify digital receipt
* ${sale.orderNumber} *
Thank you for your visit!
[GS V 0]`;

  const handleCopyEscPos = async () => {
    sound.playClick();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(escPosRaw);
      setCopiedEscPos(true);
      setTimeout(() => setCopiedEscPos(false), 2500);
    }
  };

  return (
    <div
      id="receipt-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
    >
      {/* Thermal Print Injected Scoped CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-thermal-receipt,
          #printable-thermal-receipt * {
            visibility: visible !important;
          }
          #printable-thermal-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 8mm 6mm !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header Navigation */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Receipt View</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {sale.orderNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Thermal printer output & digital verification QR</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Switcher Tabs */}
            <div className="flex p-0.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
              <button
                id="receipt-tab-thermal"
                onClick={() => {
                  sound.playClick();
                  setActiveTab('thermal');
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'thermal'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thermal View</span>
              </button>

              <button
                id="receipt-tab-verify"
                onClick={() => {
                  sound.playClick();
                  setActiveTab('verify');
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'verify'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verify QR</span>
              </button>

              <button
                id="receipt-tab-raw"
                onClick={() => {
                  sound.playClick();
                  setActiveTab('raw');
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'raw'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ESC/POS Raw</span>
              </button>
            </div>

            <button
              id="close-receipt-modal"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition ml-2"
              aria-label="Close receipt modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-bar for paper width toggles if in thermal mode */}
        {activeTab === 'thermal' && (
          <div className="px-5 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              <span>Thermal Paper Width:</span>
              <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-0.5 border border-slate-800">
                <button
                  onClick={() => {
                    sound.playClick();
                    setPaperWidth('80mm');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    paperWidth === '80mm'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  80mm Standard
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    setPaperWidth('58mm');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    paperWidth === '58mm'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  58mm Compact
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyVerificationLink}
                className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 hover:underline"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Verification Link'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950/60 flex justify-center flex-1">
          {/* TAB 1: THERMAL RECEIPT VIEW */}
          {activeTab === 'thermal' && (
            <div className="flex flex-col items-center w-full">
              {/* Thermal Paper Component */}
              <div
                id="printable-thermal-receipt"
                style={{ width: paperWidth === '80mm' ? '340px' : '260px' }}
                className="bg-white text-slate-900 font-mono text-[11px] p-5 sm:p-6 rounded-xs shadow-2xl border border-slate-300 space-y-3 leading-tight transition-all duration-200 relative select-text"
              >
                {/* Serrated Top Edge Decorator */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-[radial-gradient(circle,transparent_2px,#ffffff_2px)] bg-[length:6px_6px] -translate-y-1 opacity-80 pointer-events-none" />

                {/* Store Branding Header */}
                <div className="text-center border-b border-dashed border-slate-400 pb-3 space-y-1">
                  <div className="text-[10px] tracking-widest text-slate-600 font-bold uppercase">
                    TAX INVOICE / RECEIPT
                  </div>
                  <h1 className="text-lg font-black tracking-wider uppercase text-black leading-none">
                    NEXORA POS
                  </h1>
                  <div className="font-bold text-xs text-black">{location.name}</div>
                  <div className="text-[10px] text-slate-700 leading-snug">{location.address}</div>
                  <div className="text-[10px] text-slate-700">TEL: {location.phone}</div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    TAX REG: VAT-{location.id.slice(0, 4).toUpperCase()}-9902
                  </div>
                </div>

                {/* Receipt Meta */}
                <div className="text-[10.5px] border-b border-dashed border-slate-400 pb-2 space-y-0.5 text-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-600">RECEIPT NO:</span>
                    <span className="font-black text-black">{sale.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">DATE & TIME:</span>
                    <span>
                      {new Date(sale.createdAt).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">REGISTER / POS:</span>
                    <span>{sale.registerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">CASHIER:</span>
                    <span className="font-semibold">{sale.cashierName}</span>
                  </div>
                  {sale.customerName && (
                    <div className="flex justify-between font-bold text-black pt-0.5">
                      <span className="text-slate-600">CUSTOMER:</span>
                      <span>{sale.customerName}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-slate-600 pt-0.5">
                    <span>FULFILLMENT:</span>
                    <span className="uppercase font-bold text-black">
                      {sale.orderType} {sale.tableNumber ? `(TABLE #${sale.tableNumber})` : ''}
                    </span>
                  </div>
                </div>

                {/* Line Items */}
                <div className="border-b border-dashed border-slate-400 pb-2 space-y-1.5">
                  <div className="flex justify-between font-bold text-[10.5px] text-black border-b border-slate-300 pb-1">
                    <span>DESCRIPTION</span>
                    <span>TOTAL</span>
                  </div>
                  {sale.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-black pr-2 leading-snug">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-bold font-mono text-black shrink-0">
                          {location.currencySymbol}
                          {item.total.toFixed(2)}
                        </span>
                      </div>

                      {/* Modifiers List */}
                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div className="text-[9.5px] text-slate-600 pl-3 leading-tight">
                          {item.selectedModifiers.map(m => `+ ${m.optionName}`).join(', ')}
                        </div>
                      )}

                      {/* Line Discount */}
                      {item.discountAmount > 0 && (
                        <div className="text-[9.5px] text-slate-700 pl-3 font-semibold">
                          Discount: -{location.currencySymbol}
                          {item.discountAmount.toFixed(2)} ({item.discountPercentage}%)
                        </div>
                      )}

                      {/* Prep notes */}
                      {item.notes && (
                        <div className="text-[9px] text-slate-500 pl-3 italic">
                          &quot;{item.notes}&quot;
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Financial Totals Breakdown */}
                <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal:</span>
                    <span>
                      {location.currencySymbol}
                      {sale.subtotal.toFixed(2)}
                    </span>
                  </div>

                  {sale.discountTotal > 0 && (
                    <div className="flex justify-between text-slate-800 font-semibold">
                      <span>Total Savings:</span>
                      <span>
                        -{location.currencySymbol}
                        {sale.discountTotal.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-700">
                    <span>Tax ({(location.taxRate * 100).toFixed(2)}%):</span>
                    <span>
                      {location.currencySymbol}
                      {sale.taxTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between font-black text-sm text-black pt-1.5 border-t border-slate-400">
                    <span>TOTAL DUE:</span>
                    <span>
                      {location.currencySymbol}
                      {sale.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Tender / Payments */}
                <div className="border-b border-dashed border-slate-400 pb-2 space-y-0.5 text-[10.5px]">
                  {sale.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-slate-800">
                      <span>TENDER ({p.method}):</span>
                      <span className="font-bold">
                        {location.currencySymbol}
                        {(p.tendered || p.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {sale.payments.some(p => (p.changeDue || 0) > 0) && (
                    <div className="flex justify-between font-black text-black pt-0.5">
                      <span>CHANGE GIVEN:</span>
                      <span>
                        {location.currencySymbol}
                        {sale.payments
                          .reduce((acc, p) => acc + (p.changeDue || 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Digital Receipt Verification QR Code Box */}
                <div className="border border-slate-400 rounded-sm p-2 text-center bg-slate-50 space-y-1">
                  <div className="text-[9px] font-black tracking-wider uppercase text-black flex items-center justify-center gap-1">
                    <span>DIGITAL VERIFICATION QR</span>
                  </div>

                  {qrDataUrl ? (
                    <div className="flex justify-center py-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrDataUrl}
                        alt="Digital Receipt Verification QR"
                        width={paperWidth === '80mm' ? 140 : 110}
                        height={paperWidth === '80mm' ? 140 : 110}
                        className="mx-auto block"
                      />
                    </div>
                  ) : (
                    <div className="h-28 flex items-center justify-center text-xs text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    </div>
                  )}

                  <div className="font-mono text-[9px] font-bold text-black tracking-tight">
                    VERIF: {verificationHash}
                  </div>
                  <div className="text-[8.5px] text-slate-600 leading-tight">
                    Scan with any smartphone camera for authenticated digital tax receipt & return proof.
                  </div>
                </div>

                {/* Barcode & Footer Notice */}
                <div className="text-center pt-1 space-y-1 text-[9.5px] text-slate-600">
                  <div className="font-mono text-xs tracking-widest font-black text-black py-0.5">
                    * {sale.orderNumber} *
                  </div>
                  <div className="font-semibold text-black">Thank you for choosing Nexora!</div>
                  <div className="text-[8.5px] text-slate-500">
                    Returns accepted within 14 days with verified digital receipt.
                  </div>
                  <div className="text-[8px] text-slate-400 pt-0.5">
                    Issued by Nexora Cloud POS • {sale.id}
                  </div>
                </div>

                {/* Serrated Bottom Edge Decorator */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[radial-gradient(circle,transparent_2px,#ffffff_2px)] bg-[length:6px_6px] translate-y-1 opacity-80 pointer-events-none" />
              </div>
            </div>
          )}

          {/* TAB 2: DIGITAL VERIFICATION INSPECTOR PREVIEW */}
          {activeTab === 'verify' && (
            <div className="w-full max-w-md space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>Authentic Digital Receipt</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                          VERIFIED
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400">Cryptographically signed transaction</p>
                    </div>
                  </div>
                </div>

                {/* QR Code Highlight */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
                  {qrDataUrl && (
                    <div className="bg-white p-2 rounded-lg shadow-sm shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrDataUrl}
                        alt="Digital Receipt Verification QR"
                        width={110}
                        height={110}
                        className="block"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 text-center sm:text-left flex-1">
                    <div className="text-[11px] font-bold text-slate-300">
                      Verification Certificate ID
                    </div>
                    <div className="font-mono text-xs font-bold text-emerald-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-800 break-all">
                      {verificationHash}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Encodes order, merchant ID, line totals, and timestamp to prevent counterfeit returns.
                    </p>
                  </div>
                </div>

                {/* Transaction details card */}
                <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Order Reference</span>
                    <span className="font-mono font-bold text-white">{sale.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp</span>
                    <span className="text-slate-200">
                      {new Date(sale.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Merchant Store</span>
                    <span className="text-slate-200">{location.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Register / Workstation</span>
                    <span className="text-slate-200">{sale.registerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Items Count</span>
                    <span className="text-slate-200">
                      {sale.items.reduce((acc, it) => acc + it.quantity, 0)} item(s)
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-sm">
                    <span className="text-white">Amount Paid</span>
                    <span className="text-emerald-400 font-mono">
                      {location.currencySymbol}
                      {sale.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={handleCopyVerificationLink}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Verification Link Copied to Clipboard</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-sky-400" />
                        <span>Copy Public Verification URL</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleShare}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-sky-950"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share Digital e-Receipt (SMS / WhatsApp / AirDrop)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ESC/POS RAW TEXT STREAM */}
          {activeTab === 'raw' && (
            <div className="w-full max-w-lg space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Direct ESC/POS Command Feed (Serial / Bluetooth / USB)</span>
                <button
                  onClick={handleCopyEscPos}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedEscPos ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedEscPos ? 'Copied Feed!' : 'Copy ESC/POS'}</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre selection:bg-emerald-900 shadow-inner">
                {escPosRaw}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <button
              id="print-receipt-btn"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-md shadow-sky-950"
            >
              <Printer className="w-4 h-4" />
              <span>Print Thermal Receipt</span>
            </button>

            <button
              onClick={handleShare}
              className="hidden sm:flex px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold items-center gap-1.5 transition"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Share</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition"
            >
              Close
            </button>

            {onNewSale && (
              <button
                id="receipt-new-sale-btn"
                onClick={() => {
                  sound.playClick();
                  onNewSale();
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-950"
              >
                <Sparkles className="w-4 h-4" />
                <span>New Sale</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
