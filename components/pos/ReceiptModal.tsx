'use client';

import React from 'react';
import {
  Printer,
  CheckCircle2,
  X,
  Share2,
  Download,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import type { Sale, Location } from '@/lib/types';
import { sound } from '@/lib/audio';

interface ReceiptModalProps {
  isOpen: boolean;
  sale: Sale | null;
  location: Location;
  onClose: () => void;
  onNewSale: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  sale,
  location,
  onClose,
  onNewSale,
}) => {
  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    sound.playClick();
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Transaction Completed</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Paper Container (80mm styling) */}
        <div className="p-6 overflow-y-auto bg-slate-950/50 flex justify-center">
          <div
            id="thermal-receipt"
            className="w-full max-w-[340px] bg-white text-slate-900 font-mono text-xs p-5 rounded-lg shadow-xl border border-slate-200 space-y-3 leading-tight"
          >
            {/* Store Branding Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
              <h1 className="text-base font-black tracking-wider uppercase text-black">NEXORA POS</h1>
              <div className="font-bold text-xs">{location.name}</div>
              <div className="text-[10px] text-slate-600">{location.address}</div>
              <div className="text-[10px] text-slate-600">Tel: {location.phone}</div>
            </div>

            {/* Receipt Meta */}
            <div className="text-[11px] border-b border-dashed border-slate-300 pb-2 space-y-0.5">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold text-black">{sale.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date/Time:</span>
                <span>{new Date(sale.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <div className="flex justify-between">
                <span>Register:</span>
                <span>{sale.registerId}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{sale.cashierName}</span>
              </div>
              {sale.customerName && (
                <div className="flex justify-between font-medium">
                  <span>Customer:</span>
                  <span>{sale.customerName}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Order Type:</span>
                <span className="uppercase">{sale.orderType} {sale.tableNumber ? `(T-${sale.tableNumber})` : ''}</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="border-b border-dashed border-slate-300 pb-2 space-y-1.5">
              <div className="flex justify-between font-bold text-[11px] text-black">
                <span>ITEM</span>
                <span>TOTAL</span>
              </div>
              {sale.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="font-medium text-black">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-bold text-black">{location.currencySymbol}{item.total.toFixed(2)}</span>
                  </div>
                  {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                    <div className="text-[9px] text-slate-600 pl-3">
                      {item.selectedModifiers.map(m => `+ ${m.optionName}`).join(', ')}
                    </div>
                  )}
                  {item.discountAmount > 0 && (
                    <div className="text-[9px] text-emerald-700 pl-3">
                      Discount: -{location.currencySymbol}{item.discountAmount.toFixed(2)} ({item.discountPercentage}%)
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-[9px] text-slate-500 pl-3 italic">
                      &quot;{item.notes}&quot;
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals Breakdown */}
            <div className="border-b border-dashed border-slate-300 pb-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{location.currencySymbol}{sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Total Savings:</span>
                  <span>-{location.currencySymbol}{sale.discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax ({(location.taxRate * 100).toFixed(2)}%):</span>
                <span>{location.currencySymbol}{sale.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-black pt-1 border-t border-slate-300">
                <span>TOTAL:</span>
                <span>{location.currencySymbol}{sale.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Tender / Payments */}
            <div className="border-b border-dashed border-slate-300 pb-2 space-y-0.5 text-[11px]">
              {sale.payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>Tender ({p.method}):</span>
                  <span className="font-bold">{location.currencySymbol}{(p.tendered || p.amount).toFixed(2)}</span>
                </div>
              ))}
              {sale.payments.some(p => (p.changeDue || 0) > 0) && (
                <div className="flex justify-between font-bold text-black">
                  <span>Change Given:</span>
                  <span>
                    {location.currencySymbol}
                    {sale.payments.reduce((acc, p) => acc + (p.changeDue || 0), 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Barcode & Footer */}
            <div className="text-center pt-2 space-y-1 text-[9px] text-slate-500">
              <div className="font-mono text-xs tracking-widest font-black text-black">
                * {sale.orderNumber} *
              </div>
              <div>Thank you for choosing Nexora!</div>
              <div>Returns accepted within 14 days with receipt.</div>
              <div className="text-[8px] text-slate-400">nexora.io/receipt/{sale.orderNumber}</div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold flex items-center gap-2 transition"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            Print 80mm Receipt
          </button>

          <button
            onClick={onNewSale}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950"
          >
            Start Next Sale
          </button>
        </div>
      </div>
    </div>
  );
};
