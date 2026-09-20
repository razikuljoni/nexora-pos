'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Package,
  Plus,
  ArrowRight,
  CheckCircle2,
  Filter,
  ShieldAlert,
  Search,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { Product, Category, Location, User } from '@/lib/types';
import { adjustStock } from '@/lib/services/inventoryService';
import { sound } from '@/lib/audio';

interface LowStockAlertsWidgetProps {
  products: Product[];
  categories: Category[];
  currentLocation: Location;
  currentUser: User;
  onRefreshData: () => Promise<void>;
  onNavigateToInventory?: () => void;
}

export const LowStockAlertsWidget: React.FC<LowStockAlertsWidgetProps> = ({
  products,
  categories,
  currentLocation,
  currentUser,
  onRefreshData,
  onNavigateToInventory,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL_LOW' | 'CRITICAL' | 'OUT_OF_STOCK'>('ALL_LOW');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [restockingSku, setRestockingSku] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Compute products with stock status
  const lowStockProducts = useMemo(() => {
    return products
      .map(product => {
        const stock = product.stockQuantity ?? 0;
        const minStock = product.minStockLevel || 5;
        const isOutOfStock = stock <= 0;
        const isCritical = stock > 0 && stock <= Math.max(2, Math.floor(minStock / 2));
        const isLow = stock > 0 && stock <= minStock;

        return {
          product,
          stock,
          minStock,
          isOutOfStock,
          isCritical,
          isLow,
          severity: isOutOfStock ? 3 : isCritical ? 2 : isLow ? 1 : 0,
        };
      })
      .filter(item => item.severity > 0)
      .sort((a, b) => b.severity - a.severity || a.stock - b.stock);
  }, [products]);

  const filteredItems = useMemo(() => {
    return lowStockProducts.filter(item => {
      if (filterMode === 'OUT_OF_STOCK' && !item.isOutOfStock) return false;
      if (filterMode === 'CRITICAL' && !item.isCritical && !item.isOutOfStock) return false;

      if (selectedCategory !== 'ALL' && item.product.categoryId !== selectedCategory) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.product.name.toLowerCase().includes(q) ||
          item.product.sku.toLowerCase().includes(q) ||
          (item.product.barcode && item.product.barcode.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [lowStockProducts, filterMode, selectedCategory, searchQuery]);

  const stats = useMemo(() => {
    const outOfStockCount = lowStockProducts.filter(p => p.isOutOfStock).length;
    const criticalCount = lowStockProducts.filter(p => p.isCritical).length;
    const lowCount = lowStockProducts.filter(p => p.isLow && !p.isCritical).length;
    return { outOfStockCount, criticalCount, lowCount, totalAlerts: lowStockProducts.length };
  }, [lowStockProducts]);

  // Quick Restock Action
  const handleQuickRestock = async (product: Product, quantityToAdd: number) => {
    try {
      setRestockingSku(product.sku);
      sound.playClick();

      await adjustStock(
        product.id,
        quantityToAdd,
        'PURCHASE_RECEIPT',
        `Manager Quick Restock (+${quantityToAdd})`,
        currentUser.id,
        currentUser.name,
        currentLocation.id,
        'org_nexora'
      );

      sound.playSuccess();
      setSuccessToast(`Restocked +${quantityToAdd} units of "${product.name}"`);
      setTimeout(() => setSuccessToast(null), 3000);

      await onRefreshData();
    } catch (err) {
      console.error('[LowStockAlerts] Restock error:', err);
    } finally {
      setRestockingSku(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Alert Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">
              Inventory Depletion & Stock Risk Monitor
            </div>
            <div className="text-[11px] text-slate-400">
              Real-time threshold breaches at {currentLocation.name}
            </div>
          </div>
        </div>

        {/* Quick Nav Button */}
        {onNavigateToInventory && (
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onNavigateToInventory();
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-400 hover:text-sky-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>Open Inventory Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 3 Alert Metric Badges */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setFilterMode('OUT_OF_STOCK')}
          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
            filterMode === 'OUT_OF_STOCK'
              ? 'bg-rose-950/50 border-rose-500 text-rose-200 ring-1 ring-rose-500/40'
              : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] text-rose-400 flex items-center justify-between font-semibold">
            <span>Out of Stock</span>
            <ShieldAlert className="w-3 h-3 text-rose-400" />
          </div>
          <div className="text-lg font-black font-mono text-rose-400 mt-0.5">
            {stats.outOfStockCount}
          </div>
          <div className="text-[10px] text-slate-500">0 units remaining</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode('CRITICAL')}
          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
            filterMode === 'CRITICAL'
              ? 'bg-amber-950/50 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
              : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] text-amber-400 flex items-center justify-between font-semibold">
            <span>Critical Low</span>
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-lg font-black font-mono text-amber-300 mt-0.5">
            {stats.criticalCount}
          </div>
          <div className="text-[10px] text-slate-500">≤ 50% min threshold</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode('ALL_LOW')}
          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
            filterMode === 'ALL_LOW'
              ? 'bg-sky-950/50 border-sky-500 text-sky-200 ring-1 ring-sky-500/40'
              : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] text-sky-400 flex items-center justify-between font-semibold">
            <span>Total SKUs At Risk</span>
            <Layers className="w-3 h-3 text-sky-400" />
          </div>
          <div className="text-lg font-black font-mono text-sky-300 mt-0.5">
            {stats.totalAlerts}
          </div>
          <div className="text-[10px] text-slate-500">Action recommended</div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search low stock SKU or name..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          aria-label="Filter low stock items by category"
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-sky-500"
        >
          <option value="ALL">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Product List Table / Cards */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <span className="font-semibold text-slate-300">All inventory levels are healthy!</span>
            <span className="text-[11px] text-slate-500">
              No products currently breach minimum replenishment thresholds.
            </span>
          </div>
        ) : (
          filteredItems.map(({ product, stock, minStock, isOutOfStock, isCritical }) => {
            const ratio = Math.max(0, Math.min(stock / minStock, 1));
            const categoryName = categories.find(c => c.id === product.categoryId)?.name || 'General';

            return (
              <div
                key={product.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  isOutOfStock
                    ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60'
                    : isCritical
                    ? 'bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Product Info & Bar */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-white truncate max-w-[200px]">
                      {product.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded-sm border border-slate-800">
                      {product.sku}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {categoryName}
                    </span>

                    {isOutOfStock ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        OUT OF STOCK
                      </span>
                    ) : isCritical ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        CRITICAL LOW
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        REPLENISH
                      </span>
                    )}
                  </div>

                  {/* Stock Health Progress Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-xs h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          isOutOfStock
                            ? 'bg-rose-500'
                            : isCritical
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                        }`}
                        style={{ width: `${Math.max(ratio * 100, isOutOfStock ? 0 : 6)}%` }}
                      />
                    </div>
                    <div className="text-[11px] font-mono text-slate-300">
                      <span className={`font-bold ${isOutOfStock ? 'text-rose-400' : isCritical ? 'text-amber-400' : 'text-sky-400'}`}>
                        {stock}
                      </span>
                      <span className="text-slate-500"> / {minStock} min</span>
                    </div>
                  </div>
                </div>

                {/* 1-Click Restock Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    disabled={restockingSku === product.sku}
                    onClick={() => handleQuickRestock(product, 10)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                    title="Quick Restock +10 units"
                  >
                    <Plus className="w-3 h-3 text-sky-400" />
                    <span>+10</span>
                  </button>

                  <button
                    type="button"
                    disabled={restockingSku === product.sku}
                    onClick={() => handleQuickRestock(product, 50)}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white shadow-xs flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                    title="Quick Restock +50 units"
                  >
                    <Plus className="w-3 h-3 text-white" />
                    <span>+50</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
