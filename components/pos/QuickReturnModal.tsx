'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  X,
  Check,
  Receipt,
  Calendar,
  DollarSign,
  Package,
  AlertCircle,
  ArrowRight,
  User,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { Sale, Location, User as StaffUser } from '@/lib/types';
import { db } from '@/lib/db';
import { processRefund } from '@/lib/services/posService';
import { sound } from '@/lib/audio';

interface QuickReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: Location;
  currentUser: StaffUser;
  onSuccess: (refundedSale: Sale) => Promise<void>;
  onViewReceipt?: (sale: Sale) => void;
}

export const QuickReturnModal: React.FC<QuickReturnModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  currentUser,
  onSuccess,
  onViewReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [restockInventory, setRestockInventory] = useState(true);
  const [refundReason, setRefundReason] = useState<string>('Customer changed mind');
  const [customReason, setCustomReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedRefundSale, setCompletedRefundSale] = useState<Sale | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Load recent sales from local Dexie database
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    async function loadSales() {
      try {
        const sales = await db.sales.orderBy('createdAt').reverse().limit(40).toArray();
        if (isSubscribed) {
          setRecentSales(sales);
          setErrorNotice(null);
        }
      } catch (err) {
        console.error('[QuickReturnModal] Failed to load sales:', err);
      }
    }

    loadSales();
    return () => {
      isSubscribed = false;
    };
  }, [isOpen]);

  // Reset states when closing
  const handleClose = () => {
    sound.playClick();
    setSelectedSale(null);
    setReturnQuantities({});
    setSearchQuery('');
    setCompletedRefundSale(null);
    setErrorNotice(null);
    onClose();
  };

  // Filter sales matching search query
  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return recentSales;
    const q = searchQuery.toLowerCase().trim();
    return recentSales.filter(
      s =>
        s.orderNumber.toLowerCase().includes(q) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        s.cashierName.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [recentSales, searchQuery]);

  // Handle selecting a sale for return
  const handleSelectSale = (sale: Sale) => {
    sound.playClick();
    setSelectedSale(sale);
    setCompletedRefundSale(null);
    setErrorNotice(null);

    // Initialize quantities to 0 for each line item
    const initialQty: Record<string, number> = {};
    sale.items.forEach(it => {
      initialQty[it.cartItemId] = 0;
    });
    setReturnQuantities(initialQty);
  };

  // Set quantity to return for a specific line item
  const handleSetReturnQuantity = (cartItemId: string, maxQty: number, nextQty: number) => {
    sound.playClick();
    const clamped = Math.max(0, Math.min(maxQty, nextQty));
    setReturnQuantities(prev => ({
      ...prev,
      [cartItemId]: clamped,
    }));
  };

  // Quick action: Select all items for full refund
  const handleSelectAllItems = () => {
    if (!selectedSale) return;
    sound.playClick();
    const allQty: Record<string, number> = {};
    selectedSale.items.forEach(it => {
      allQty[it.cartItemId] = it.quantity;
    });
    setReturnQuantities(allQty);
  };

  // Calculate live refund amount
  const calculatedRefundTotal = useMemo(() => {
    if (!selectedSale) return 0;
    const total = selectedSale.items.reduce((acc, it) => {
      const q = returnQuantities[it.cartItemId] || 0;
      return acc + it.unitPrice * q;
    }, 0);
    return Number(total.toFixed(2));
  }, [selectedSale, returnQuantities]);

  const totalReturnUnits = useMemo(() => {
    return Object.values(returnQuantities).reduce((acc, q) => acc + q, 0);
  }, [returnQuantities]);

  // Execute the refund transaction
  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale || calculatedRefundTotal <= 0) {
      setErrorNotice('Please select at least 1 item quantity to return.');
      sound.playError();
      return;
    }

    setIsProcessing(true);
    setErrorNotice(null);

    try {
      const finalReason =
        refundReason === 'Other' && customReason.trim()
          ? customReason.trim()
          : refundReason;

      await processRefund(
        selectedSale,
        calculatedRefundTotal,
        finalReason,
        currentUser.id,
        currentUser.name,
        restockInventory
      );

      sound.playSaleSuccess();

      // Fetch the updated sale record from DB
      const updated = await db.sales.get(selectedSale.id);
      const refundedRecord = updated || { ...selectedSale, status: 'REFUNDED' as const };

      setCompletedRefundSale(refundedRecord);
      await onSuccess(refundedRecord);
    } catch (err: any) {
      console.error('[QuickReturnModal] Refund execution failed:', err);
      setErrorNotice(err.message || 'Refund processing encountered an unexpected error.');
      sound.playError();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="quick-return-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Start New Return & Refund</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-rose-300 border border-rose-500/30">
                  Quick Action
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Look up completed transactions, select items to return, and update stock ledger.
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Error Notice if any */}
          {errorNotice && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* Refund Success Confirmation View */}
          {completedRefundSale ? (
            <div className="py-8 px-4 text-center space-y-4 animate-in zoom-in-95 duration-150">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Refund Successfully Processed</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Order <span className="text-white font-mono font-bold">#{completedRefundSale.orderNumber}</span> has been refunded {currentLocation.currencySymbol}{calculatedRefundTotal.toFixed(2)}.
                  {restockInventory && ' Returned items were safely restocked into inventory.'}
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl max-w-md mx-auto text-xs space-y-2 text-left">
                <div className="flex justify-between text-slate-400">
                  <span>Order Number:</span>
                  <span className="text-white font-mono">{completedRefundSale.orderNumber}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Units Returned:</span>
                  <span className="text-white font-mono">{totalReturnUnits} items</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Amount Refunded:</span>
                  <span className="text-emerald-400 font-mono font-bold text-sm">
                    {currentLocation.currencySymbol}{calculatedRefundTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Reason Code:</span>
                  <span className="text-slate-200">{refundReason}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                {onViewReceipt && (
                  <button
                    onClick={() => {
                      onViewReceipt(completedRefundSale);
                      handleClose();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-sky-400 hover:text-sky-300 transition flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Refund Receipt</span>
                  </button>
                )}

                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-950"
                >
                  <Check className="w-4 h-4" />
                  <span>Done & Return to Checkout</span>
                </button>
              </div>
            </div>
          ) : !selectedSale ? (
            /* STEP 1: Search & Pick Order */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by Order # (e.g. ORD-1001), Customer, or Cashier..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500 transition"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between pt-1">
                <span>Recent Completed Orders ({filteredSales.length})</span>
                <span>Select an order to refund</span>
              </div>

              {filteredSales.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40 text-slate-500 text-xs space-y-1">
                  <Package className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="font-semibold text-slate-400">No matching orders found</div>
                  <div>Try searching for a different order number or customer name</div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {filteredSales.map(sale => {
                    const isAlreadyRefunded = sale.status === 'REFUNDED';
                    const isPartial = sale.status === 'PARTIALLY_REFUNDED';

                    return (
                      <div
                        key={sale.id}
                        onClick={() => !isAlreadyRefunded && handleSelectSale(sale)}
                        className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                          isAlreadyRefunded
                            ? 'bg-slate-950/40 border-slate-800/60 opacity-60 cursor-not-allowed'
                            : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 cursor-pointer'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-white">
                              #{sale.orderNumber}
                            </span>
                            {isAlreadyRefunded ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Refunded
                              </span>
                            ) : isPartial ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Partial Refund
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Completed
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500">
                              {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(sale.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="text-xs text-slate-400 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-500" />
                              {sale.customerName || 'Walk-in Guest'}
                            </span>
                            <span>•</span>
                            <span>{sale.items.length} item{sale.items.length > 1 ? 's' : ''}</span>
                            <span>•</span>
                            <span className="text-slate-500">By {sale.cashierName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-mono font-black text-white">
                              {currentLocation.currencySymbol}{sale.total.toFixed(2)}
                            </div>
                            <div className="text-[10px] uppercase font-mono text-slate-500">
                              {sale.payments[0]?.method || 'CASH'}
                            </div>
                          </div>

                          {!isAlreadyRefunded && (
                            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 group-hover:text-white">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Configure Return Items & Reason */
            <form onSubmit={handleProcessRefund} className="space-y-4">
              {/* Selected Order Summary Banner */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                    <span>Order #{selectedSale.orderNumber}</span>
                    <span className="text-slate-500 font-sans">•</span>
                    <span className="text-slate-300 font-sans">{selectedSale.customerName || 'Walk-in Guest'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Total: {currentLocation.currencySymbol}{selectedSale.total.toFixed(2)} • {new Date(selectedSale.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllItems}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold transition"
                  >
                    Select All Items
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSale(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs transition"
                  >
                    Change Order
                  </button>
                </div>
              </div>

              {/* Items Table for Returning */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Select Items to Return</span>
                  <span>Units to Refund</span>
                </div>

                <div className="border border-slate-800 rounded-xl divide-y divide-slate-800/80 overflow-hidden bg-slate-950/60">
                  {selectedSale.items.map(it => {
                    const returnQty = returnQuantities[it.cartItemId] || 0;
                    const isSelected = returnQty > 0;

                    return (
                      <div
                        key={it.cartItemId}
                        className={`p-3 flex items-center justify-between gap-3 transition ${
                          isSelected ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-xs font-bold text-white truncate">
                            {it.name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>Purchased: <strong className="text-slate-200">{it.quantity}</strong></span>
                            <span>•</span>
                            <span>Unit: {currentLocation.currencySymbol}{it.unitPrice.toFixed(2)}</span>
                            {it.discountAmount > 0 && (
                              <span className="text-emerald-400">(-{currentLocation.currencySymbol}{it.discountAmount.toFixed(2)} disc)</span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleSetReturnQuantity(it.cartItemId, it.quantity, returnQty - 1)}
                              disabled={returnQty <= 0}
                              className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 disabled:opacity-30 transition font-bold"
                            >
                              -
                            </button>
                            <span className="px-3 py-1.5 font-mono text-xs font-bold text-white min-w-[32px] text-center">
                              {returnQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSetReturnQuantity(it.cartItemId, it.quantity, returnQty + 1)}
                              disabled={returnQty >= it.quantity}
                              className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 disabled:opacity-30 transition font-bold"
                            >
                              +
                            </button>
                          </div>

                          <div className="w-20 text-right font-mono font-bold text-xs text-rose-300">
                            {currentLocation.currencySymbol}{(it.unitPrice * returnQty).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Options: Reason and Restock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Reason Dropdown */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Reason for Return
                  </label>
                  <select
                    value={refundReason}
                    onChange={e => setRefundReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                  >
                    <option value="Customer changed mind">Customer changed mind</option>
                    <option value="Defective or damaged item">Defective / damaged item</option>
                    <option value="Incorrect item prepared or rung up">Incorrect item prepared</option>
                    <option value="Wrong size or variant">Wrong size / variant</option>
                    <option value="Expired or quality complaint">Expired or quality complaint</option>
                    <option value="Other">Other (Custom note)</option>
                  </select>

                  {refundReason === 'Other' && (
                    <input
                      type="text"
                      value={customReason}
                      onChange={e => setCustomReason(e.target.value)}
                      placeholder="Specify custom refund reason..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden mt-1.5"
                    />
                  )}
                </div>

                {/* Restock Option */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Inventory Ledger Treatment
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900 transition">
                    <input
                      type="checkbox"
                      checked={restockInventory}
                      onChange={e => setRestockInventory(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-white">Restock items to on-hand inventory</span>
                      <p className="text-[10px] text-slate-500">
                        Automatically logs a SALE_RETURN stock movement in the ledger.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Total Refund Banner & Submit */}
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-rose-300 font-medium">Calculated Refund Total</div>
                  <div className="text-2xl font-black font-mono text-rose-400">
                    {currentLocation.currencySymbol}{calculatedRefundTotal.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {totalReturnUnits} item{totalReturnUnits !== 1 ? 's' : ''} selected for return
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSale(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isProcessing || calculatedRefundTotal <= 0}
                    className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-rose-950"
                  >
                    {isProcessing ? (
                      <span>Processing Refund...</span>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Process Refund ({currentLocation.currencySymbol}{calculatedRefundTotal.toFixed(2)})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
