'use client';

import React, { useState } from 'react';
import {
  FileText,
  Search,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Smartphone,
} from 'lucide-react';
import type { Sale, Location, User as StaffUser } from '@/lib/types';
import { processRefund } from '@/lib/services/posService';
import { sound } from '@/lib/audio';
import { ReceiptModal } from '../pos/ReceiptModal';

interface OrdersViewProps {
  sales: Sale[];
  currentLocation: Location;
  currentUser: StaffUser;
  onRefreshData: () => Promise<void>;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  sales,
  currentLocation,
  currentUser,
  onRefreshData,
}) => {
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  // Refund Modal State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundItemQuantities, setRefundItemQuantities] = useState<Record<string, number>>({});
  const [refundReason, setRefundReason] = useState('Customer changed mind');
  const [restockInventory, setRestockInventory] = useState(true);
  const [refundTender, setRefundTender] = useState<'CASH' | 'CARD' | 'STORE_CREDIT'>('CASH');

  const filteredSales = sales.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.orderNumber.toLowerCase().includes(q) ||
      (s.customerName && s.customerName.toLowerCase().includes(q)) ||
      s.cashierName.toLowerCase().includes(q)
    );
  });

  const handleOpenRefundModal = (sale: Sale) => {
    sound.playClick();
    setSelectedSale(sale);
    const initialQty: Record<string, number> = {};
    sale.items.forEach(it => {
      initialQty[it.cartItemId] = 0; // default 0 to select return quantities
    });
    setRefundItemQuantities(initialQty);
    setIsRefundModalOpen(true);
  };

  const handleExecuteRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    const itemsToRefund = selectedSale.items
      .map(it => ({
        cartItemId: it.cartItemId,
        productId: it.productId,
        quantity: refundItemQuantities[it.cartItemId] || 0,
        unitPrice: it.unitPrice,
        name: it.name,
      }))
      .filter(it => it.quantity > 0);

    if (itemsToRefund.length === 0) {
      alert('Please select at least one item quantity to refund.');
      return;
    }

    try {
      sound.playSaleSuccess();
      await processRefund(
        selectedSale,
        calculatedRefundTotal,
        refundReason,
        currentUser.id,
        currentUser.name,
        restockInventory
      );

      setIsRefundModalOpen(false);
      setSelectedSale(null);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const calculatedRefundTotal = selectedSale
    ? selectedSale.items.reduce((acc, it) => {
        const q = refundItemQuantities[it.cartItemId] || 0;
        return acc + it.unitPrice * q;
      }, 0)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-sky-400" />
            Transactions & Order History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Search completed orders, issue item refunds, and re-print 80mm thermal receipts.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search orders by receipt number (e.g. ORD-), customer, or cashier..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Receipt #</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Customer / Cashier</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5">Items</th>
                <th className="p-3.5">Total Paid</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSales.map(sale => {
                const totalItemQty = sale.items.reduce((acc, it) => acc + it.quantity, 0);
                const paymentMethods = sale.payments.map(p => p.method).join(', ');

                return (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-mono font-bold text-sky-400">{sale.orderNumber}</td>
                    <td className="p-3.5 text-slate-400 font-mono">
                      {new Date(sale.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-white">
                        {sale.customerName || 'Walk-in Customer'}
                      </div>
                      <div className="text-[10px] text-slate-500">By {sale.cashierName}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                        {sale.orderType}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
                        {paymentMethods.includes('CASH') && <Banknote className="w-3.5 h-3.5 text-amber-400" />}
                        {paymentMethods.includes('CARD') && <CreditCard className="w-3.5 h-3.5 text-sky-400" />}
                        {paymentMethods}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">{totalItemQty} items</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      {currentLocation.currencySymbol}{sale.total.toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          sale.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : sale.status === 'REFUNDED'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => {
                          sound.playClick();
                          setReceiptSale(sale);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-semibold transition inline-flex items-center gap-1"
                        title="Print Thermal Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Receipt
                      </button>
                      {sale.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleOpenRefundModal(sale)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[11px] font-semibold transition inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Processing Modal */}
      {isRefundModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form onSubmit={handleExecuteRefund} className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-400" />
                  Process Return / Refund: {selectedSale.orderNumber}
                </h3>
                <p className="text-xs text-slate-400">Select items to return and adjust inventory</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Line Items Selection */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                  Select Items & Return Quantities
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedSale.items.map(item => (
                    <div
                      key={item.cartItemId}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-white text-xs">{item.name}</div>
                        <div className="text-[10px] text-slate-400">
                          Purchased: {item.quantity} units @ {currentLocation.currencySymbol}{item.unitPrice.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">Return Qty:</span>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={refundItemQuantities[item.cartItemId] || 0}
                          onChange={e => {
                            const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                            setRefundItemQuantities(prev => ({
                              ...prev,
                              [item.cartItemId]: val,
                            }));
                          }}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-white text-xs focus:outline-hidden focus:border-rose-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Restock Inventory Checkbox */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs">Return items to inventory stock</div>
                  <div className="text-[10px] text-slate-400">
                    If checked, item quantities will be restocked back into the catalog ledger.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={restockInventory}
                  onChange={e => setRestockInventory(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-slate-900 border-slate-700"
                />
              </div>

              {/* Refund Method Selection */}
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[11px] mb-1.5">
                  Refund Tender Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CASH', 'CARD', 'STORE_CREDIT'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setRefundTender(method)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                        refundTender === method
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {method.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason Code */}
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[11px] mb-1.5">
                  Reason for Refund *
                </label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  placeholder="e.g. Customer returned sealed mug, wrong size..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-rose-500"
                />
              </div>

              {/* Total Refund Due */}
              <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl flex items-center justify-between">
                <span className="font-bold text-rose-300">Total Refund Payable:</span>
                <span className="text-lg font-black font-mono text-rose-400">
                  {currentLocation.currencySymbol}{calculatedRefundTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={calculatedRefundTotal <= 0}
                className="px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-950"
              >
                <RotateCcw className="w-4 h-4" /> Issue Refund ({currentLocation.currencySymbol}{calculatedRefundTotal.toFixed(2)})
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={!!receiptSale}
        sale={receiptSale}
        location={currentLocation}
        onClose={() => setReceiptSale(null)}
        onNewSale={() => setReceiptSale(null)}
      />
    </div>
  );
};
