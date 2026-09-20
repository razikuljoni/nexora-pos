'use client';

import React, { useState, useMemo, useSyncExternalStore } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Plus,
  Search,
  DollarSign,
  Package,
  Clock,
  ShieldCheck,
  Check,
  CheckCircle2,
  Copy,
  X,
  Truck,
  Zap,
} from 'lucide-react';
import type {
  Product,
  Category,
  Location,
  User,
  Sale,
  Supplier,
} from '@/lib/types';
import { db } from '@/lib/db';
import { adjustStock, createPurchaseOrder } from '@/lib/services/inventoryService';
import { sound } from '@/lib/audio';

const emptySubscribe = () => () => {};

export type SeasonalityModel =
  | 'DYNAMIC_WEEKLY' // Computes empirical Day-of-Week index from history
  | 'PEAK_WEEKEND' // +25% surge on Fri/Sat/Sun
  | 'MOMENTUM' // Short-term 7d velocity vs 14d velocity growth factor
  | 'LINEAR_FLAT'; // Simple flat moving average

export interface ForecastItem {
  product: Product;
  category?: Category;
  currentStock: number;
  minStock: number;
  historicalSoldUnits: number;
  dailyVelocity: number; // Base units / day
  adjustedDailyVelocity: number; // Seasonality / momentum adjusted
  runwayDays: number; // Stock / adjustedVelocity
  predictedStockoutDate: Date | null;
  stockoutDateFormatted: string;
  safetyStock: number;
  reorderPoint: number;
  suggestedReorderQty: number;
  estimatedPoCost: number;
  estimatedRetailValue: number;
  atRiskRevenue: number;
  urgency: 'OUT_OF_STOCK' | 'CRITICAL' | 'REORDER_DUE' | 'HEALTHY';
  momentumPct: number;
  isCustomQty?: boolean;
}

interface PredictiveForecastingWidgetProps {
  sales: Sale[];
  products: Product[];
  categories: Category[];
  currentLocation: Location;
  currentUser: User;
  onRefreshData: () => Promise<void>;
  onNavigateToInventory?: () => void;
}

export const PredictiveForecastingWidget: React.FC<PredictiveForecastingWidgetProps> = ({
  sales,
  products,
  categories,
  currentLocation,
  currentUser,
  onRefreshData,
  onNavigateToInventory,
}) => {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Simulation & Algorithm Parameters
  const [horizonDays, setHorizonDays] = useState<number>(14);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(5);
  const [coverageDays, setCoverageDays] = useState<number>(14);
  const [safetyBufferPct] = useState<number>(25);
  const [seasonalityModel, setSeasonalityModel] = useState<SeasonalityModel>('DYNAMIC_WEEKLY');

  // Filter and Search States
  const [selectedUrgency, setSelectedUrgency] = useState<'ALL' | 'ACTIONABLE' | 'OUT_OF_STOCK' | 'CRITICAL'>('ACTIONABLE');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Custom Reorder Overrides Map (productId -> number)
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // Active Modals & Selection States
  const [activeSimulationItem, setActiveSimulationItem] = useState<ForecastItem | null>(null);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedPoSupplierId, setSelectedPoSupplierId] = useState<string>('');
  const [poNotes, setPoNotes] = useState('');
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);

  // Action status toasts
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Fetch available suppliers on mount / modal open
  React.useEffect(() => {
    db.suppliers.toArray().then(sups => {
      setAvailableSuppliers(sups);
      if (sups.length > 0 && !selectedPoSupplierId) {
        setSelectedPoSupplierId(sups[0].id);
      }
    }).catch(err => console.error('[PredictiveForecasting] Error loading suppliers:', err));
  }, [selectedPoSupplierId]);

  // 1. Compute Day-of-Week Seasonality Factors from Historical Sales
  const dayOfWeekFactors = useMemo(() => {
    const validSales = sales.filter(s => s.status !== 'REFUNDED' && s.status !== 'VOIDED');
    const dowCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun (0) to Sat (6)
    let totalItemsSold = 0;

    validSales.forEach(sale => {
      const day = new Date(sale.createdAt).getDay();
      const qty = sale.items.reduce((acc, it) => acc + it.quantity, 0);
      dowCounts[day] += qty;
      totalItemsSold += qty;
    });

    if (totalItemsSold === 0) {
      return [1, 1, 1, 1, 1, 1, 1]; // neutral
    }

    const baselineExpectedPerDay = totalItemsSold / 7;
    return dowCounts.map(count => {
      if (baselineExpectedPerDay === 0) return 1;
      const factor = count / baselineExpectedPerDay;
      return Math.max(0.5, Math.min(2.0, factor));
    });
  }, [sales]);

  // 2. Compute Product-Level Historical Velocity, Seasonality, & Reorder Suggestions
  const forecastItems: ForecastItem[] = useMemo(() => {
    const now = new Date();
    const horizonCutoff = new Date(now.getTime() - horizonDays * 86400000);
    const momentumCutoff = new Date(now.getTime() - 7 * 86400000);
    const previousMomentumCutoff = new Date(now.getTime() - 14 * 86400000);

    const validSales = sales.filter(s => s.status !== 'REFUNDED' && s.status !== 'VOIDED');

    // Aggregate sales by product
    const productSalesMap = new Map<
      string,
      {
        totalHorizonQty: number;
        recent7dQty: number;
        previous7dQty: number;
      }
    >();

    validSales.forEach(sale => {
      const saleDate = new Date(sale.createdAt);
      const isWithinHorizon = saleDate >= horizonCutoff;
      const isWithinRecent7d = saleDate >= momentumCutoff;
      const isWithinPrevious7d = saleDate >= previousMomentumCutoff && saleDate < momentumCutoff;

      sale.items.forEach(item => {
        let entry = productSalesMap.get(item.productId);
        if (!entry) {
          entry = { totalHorizonQty: 0, recent7dQty: 0, previous7dQty: 0 };
          productSalesMap.set(item.productId, entry);
        }
        if (isWithinHorizon) {
          entry.totalHorizonQty += item.quantity;
        }
        if (isWithinRecent7d) {
          entry.recent7dQty += item.quantity;
        }
        if (isWithinPrevious7d) {
          entry.previous7dQty += item.quantity;
        }
      });
    });

    return products.map(product => {
      const stock = product.stockQuantity ?? 0;
      const minStock = product.minStockLevel || 5;
      const category = categories.find(c => c.id === product.categoryId);

      const salesStats = productSalesMap.get(product.id) || {
        totalHorizonQty: 0,
        recent7dQty: 0,
        previous7dQty: 0,
      };

      // Base Daily Run-Rate (units / day)
      let baseVelocity = salesStats.totalHorizonQty / Math.max(1, horizonDays);

      if (baseVelocity === 0 && stock <= minStock) {
        baseVelocity = Math.max(0.2, (minStock / 14));
      }

      // Calculate Momentum Factor (Recent 7d velocity vs Prior 7d velocity)
      const recentVelocity = salesStats.recent7dQty / 7;
      const prevVelocity = salesStats.previous7dQty / 7;
      let momentumFactor = 1.0;
      let momentumPct = 0;

      if (prevVelocity > 0) {
        momentumPct = Math.round(((recentVelocity - prevVelocity) / prevVelocity) * 100);
        momentumFactor = Math.max(0.7, Math.min(1.5, 1 + momentumPct / 100));
      }

      // Compute Forward-Looking Daily Velocity based on selected Seasonality Model
      let forwardMultiplier = 1.0;
      if (seasonalityModel === 'DYNAMIC_WEEKLY') {
        let sumFactor = 0;
        const totalSimDays = Math.max(1, leadTimeDays + coverageDays);
        for (let d = 0; d < totalSimDays; d++) {
          const futureDay = (now.getDay() + d) % 7;
          sumFactor += dayOfWeekFactors[futureDay] || 1.0;
        }
        forwardMultiplier = sumFactor / totalSimDays;
      } else if (seasonalityModel === 'PEAK_WEEKEND') {
        forwardMultiplier = 1.25;
      } else if (seasonalityModel === 'MOMENTUM') {
        forwardMultiplier = momentumFactor;
      } else {
        forwardMultiplier = 1.0;
      }

      const adjustedDailyVelocity = Math.max(0.1, baseVelocity * forwardMultiplier);

      // Inventory Runway in Days
      let runwayDays = 0;
      if (stock <= 0) {
        runwayDays = 0;
      } else {
        runwayDays = Math.round((stock / adjustedDailyVelocity) * 10) / 10;
      }

      // Projected Stockout Date simulation
      let simulatedStock = stock;
      let predictedStockoutDate: Date | null = null;
      let stockoutDateFormatted = 'Stocked Out';

      if (stock <= 0) {
        predictedStockoutDate = now;
        stockoutDateFormatted = 'Immediate (0 Stock)';
      } else {
        for (let d = 1; d <= 90; d++) {
          const simDate = new Date(now.getTime() + d * 86400000);
          const dow = simDate.getDay();
          const dayRate = baseVelocity * (seasonalityModel === 'DYNAMIC_WEEKLY' ? (dayOfWeekFactors[dow] || 1.0) : forwardMultiplier);
          simulatedStock -= dayRate;
          if (simulatedStock <= 0) {
            predictedStockoutDate = simDate;
            stockoutDateFormatted = simDate.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              weekday: 'short',
            });
            break;
          }
        }
        if (!predictedStockoutDate) {
          stockoutDateFormatted = '> 90 days runway';
        }
      }

      // Safety Stock & Reorder Point Formulas:
      const safetyStock = Math.ceil(
        adjustedDailyVelocity * Math.sqrt(Math.max(1, leadTimeDays)) * (1 + safetyBufferPct / 100)
      );

      const reorderPoint = Math.ceil(leadTimeDays * adjustedDailyVelocity + safetyStock);
      const targetStockLevel = Math.ceil(coverageDays * adjustedDailyVelocity + safetyStock);

      const rawSuggested = Math.max(0, targetStockLevel - stock);
      const isCustom = customQuantities[product.id] !== undefined;
      const suggestedReorderQty = isCustom ? customQuantities[product.id] : rawSuggested;

      const estimatedPoCost = suggestedReorderQty * (product.purchaseCost || 0);
      const estimatedRetailValue = suggestedReorderQty * (product.sellingPrice || 0);
      const atRiskRevenue = Math.min(stock <= 0 ? suggestedReorderQty : targetStockLevel, adjustedDailyVelocity * 14) * (product.sellingPrice || 0);

      let urgency: 'OUT_OF_STOCK' | 'CRITICAL' | 'REORDER_DUE' | 'HEALTHY' = 'HEALTHY';
      if (stock <= 0) {
        urgency = 'OUT_OF_STOCK';
      } else if (runwayDays < Math.max(2, leadTimeDays)) {
        urgency = 'CRITICAL';
      } else if (stock <= reorderPoint || runwayDays <= leadTimeDays + 4) {
        urgency = 'REORDER_DUE';
      } else {
        urgency = 'HEALTHY';
      }

      return {
        product,
        category,
        currentStock: stock,
        minStock,
        historicalSoldUnits: salesStats.totalHorizonQty,
        dailyVelocity: Math.round(baseVelocity * 100) / 100,
        adjustedDailyVelocity: Math.round(adjustedDailyVelocity * 100) / 100,
        runwayDays,
        predictedStockoutDate,
        stockoutDateFormatted,
        safetyStock,
        reorderPoint,
        suggestedReorderQty,
        estimatedPoCost,
        estimatedRetailValue,
        atRiskRevenue,
        urgency,
        momentumPct,
        isCustomQty: isCustom,
      };
    });
  }, [
    sales,
    products,
    categories,
    horizonDays,
    leadTimeDays,
    coverageDays,
    safetyBufferPct,
    seasonalityModel,
    dayOfWeekFactors,
    customQuantities,
  ]);

  // 3. Filtered Forecast Items
  const filteredForecastItems = useMemo(() => {
    return forecastItems
      .filter(item => {
        if (selectedUrgency === 'ACTIONABLE' && item.urgency === 'HEALTHY' && item.suggestedReorderQty === 0) {
          return false;
        }
        if (selectedUrgency === 'OUT_OF_STOCK' && item.urgency !== 'OUT_OF_STOCK') {
          return false;
        }
        if (selectedUrgency === 'CRITICAL' && item.urgency !== 'CRITICAL' && item.urgency !== 'OUT_OF_STOCK') {
          return false;
        }

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
      })
      .sort((a, b) => {
        const urgencyScore = { OUT_OF_STOCK: 4, CRITICAL: 3, REORDER_DUE: 2, HEALTHY: 1 };
        const scoreDiff = urgencyScore[b.urgency] - urgencyScore[a.urgency];
        if (scoreDiff !== 0) return scoreDiff;
        return a.runwayDays - b.runwayDays;
      });
  }, [forecastItems, selectedUrgency, selectedCategory, searchQuery]);

  // 4. Executive Summary KPI Totals
  const summaryKPIs = useMemo(() => {
    const actionable = forecastItems.filter(i => i.suggestedReorderQty > 0);
    const outOfStockCount = forecastItems.filter(i => i.urgency === 'OUT_OF_STOCK').length;
    const criticalCount = forecastItems.filter(i => i.urgency === 'CRITICAL').length;
    const reorderDueCount = forecastItems.filter(i => i.urgency === 'REORDER_DUE').length;

    const totalRecommendedUnits = actionable.reduce((acc, i) => acc + i.suggestedReorderQty, 0);
    const totalPoCapital = actionable.reduce((acc, i) => acc + i.estimatedPoCost, 0);
    const totalAtRiskRevenue = actionable.reduce((acc, i) => acc + i.atRiskRevenue, 0);

    return {
      actionableCount: actionable.length,
      outOfStockCount,
      criticalCount,
      reorderDueCount,
      totalRecommendedUnits,
      totalPoCapital,
      totalAtRiskRevenue,
    };
  }, [forecastItems]);

  // 5. Handlers: Quick Restock Single Item
  const handleQuickRestockItem = async (item: ForecastItem) => {
    try {
      setIsSubmittingAction(true);
      sound.playClick();
      const qty = item.suggestedReorderQty > 0 ? item.suggestedReorderQty : 10;

      await adjustStock(
        item.product.id,
        qty,
        'PURCHASE_RECEIPT',
        `Predictive Forecast Restock (+${qty})`,
        currentUser.id,
        currentUser.name,
        currentLocation.id,
        'org_nexora'
      );

      sound.playSuccess();
      setActionFeedback(`Restocked +${qty} units of "${item.product.name}"`);
      setTimeout(() => setActionFeedback(null), 3000);

      setCustomQuantities(prev => {
        const next = { ...prev };
        delete next[item.product.id];
        return next;
      });

      await onRefreshData();
    } catch (err) {
      console.error('[PredictiveForecasting] Error quick restocking:', err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 6. Handlers: Batch Restock All Critical & Out-of-Stock Items
  const handleBatchRestockCritical = async () => {
    const targets = forecastItems.filter(
      i => (i.urgency === 'OUT_OF_STOCK' || i.urgency === 'CRITICAL') && i.suggestedReorderQty > 0
    );

    if (targets.length === 0) {
      setActionFeedback('No critical items currently require restock.');
      setTimeout(() => setActionFeedback(null), 2500);
      return;
    }

    try {
      setIsSubmittingAction(true);
      sound.playClick();

      for (const item of targets) {
        await adjustStock(
          item.product.id,
          item.suggestedReorderQty,
          'PURCHASE_RECEIPT',
          `Automated Batch Forecast Replenishment (+${item.suggestedReorderQty})`,
          currentUser.id,
          currentUser.name,
          currentLocation.id,
          'org_nexora'
        );
      }

      sound.playSuccess();
      setActionFeedback(`Batch replenished ${targets.length} critical items (+${targets.reduce((a, b) => a + b.suggestedReorderQty, 0)} units)`);
      setTimeout(() => setActionFeedback(null), 3500);

      setCustomQuantities(prev => {
        const next = { ...prev };
        targets.forEach(t => delete next[t.product.id]);
        return next;
      });

      await onRefreshData();
    } catch (err) {
      console.error('[PredictiveForecasting] Error batch restocking:', err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 7. Handlers: Generate Official Purchase Order
  const handleCreatePurchaseOrder = async () => {
    const actionableItems = forecastItems.filter(i => i.suggestedReorderQty > 0);
    if (actionableItems.length === 0) {
      setActionFeedback('No items have suggested reorder quantities to create a PO.');
      setTimeout(() => setActionFeedback(null), 2500);
      return;
    }

    try {
      setIsSubmittingAction(true);
      sound.playClick();

      const supplier = availableSuppliers.find(s => s.id === selectedPoSupplierId) || {
        id: 'sup_general',
        name: 'Primary Wholesale Supplier',
      };

      const poItems = actionableItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.suggestedReorderQty,
        unitCost: item.product.purchaseCost || 0,
      }));

      await createPurchaseOrder(
        supplier.id,
        supplier.name,
        currentLocation.id,
        poItems,
        currentUser.name,
        currentUser.id,
        poNotes || `AI Predictive Forecasting Replenishment (${seasonalityModel} Profile, ${coverageDays}d Coverage Buffer)`
      );

      sound.playSuccess();
      setIsPoModalOpen(false);
      setPoNotes('');
      setActionFeedback(`Successfully generated Purchase Order with ${poItems.length} lines ($${summaryKPIs.totalPoCapital.toFixed(2)})`);
      setTimeout(() => setActionFeedback(null), 3500);

      await onRefreshData();
    } catch (err) {
      console.error('[PredictiveForecasting] Error creating PO:', err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 8. Copy PO Summary to Clipboard
  const handleCopyPoSummary = () => {
    sound.playClick();
    const actionableItems = forecastItems.filter(i => i.suggestedReorderQty > 0);
    const lines = [
      `=== NEXORA POS - PURCHASE REQUISITION ===`,
      `Generated: ${new Date().toLocaleString()}`,
      `Location: ${currentLocation.name}`,
      `Forecast Profile: ${seasonalityModel} | Lead Time: ${leadTimeDays}d | Coverage: ${coverageDays}d`,
      `----------------------------------------------------`,
      `SKU | Product Name | Stock | Reorder Qty | Unit Cost | Total`,
    ];

    actionableItems.forEach(i => {
      lines.push(
        `${i.product.sku} | ${i.product.name} | ${i.currentStock} | ${i.suggestedReorderQty} | ${currentLocation.currencySymbol}${i.product.purchaseCost.toFixed(2)} | ${currentLocation.currencySymbol}${i.estimatedPoCost.toFixed(2)}`
      );
    });

    lines.push(`----------------------------------------------------`);
    lines.push(`Total Reorder Units: ${summaryKPIs.totalRecommendedUnits}`);
    lines.push(`Estimated Total PO Cost: ${currentLocation.currencySymbol}${summaryKPIs.totalPoCapital.toFixed(2)}`);

    navigator.clipboard.writeText(lines.join('\n'));
    setActionFeedback('Copied Purchase Order manifest to clipboard!');
    setTimeout(() => setActionFeedback(null), 2500);
  };

  // 9. Depletion Chart Simulation Data for selected item
  const simulationChartData = useMemo(() => {
    if (!activeSimulationItem) return [];

    const data = [];
    const item = activeSimulationItem;
    let projectedStock = item.currentStock;
    let projectedWithRestock = item.currentStock;
    const today = new Date();

    for (let d = 0; d <= 21; d++) {
      const simDate = new Date(today.getTime() + d * 86400000);
      const dayLabel = d === 0 ? 'Today' : simDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const dow = simDate.getDay();

      const dailyRate = item.dailyVelocity * (seasonalityModel === 'DYNAMIC_WEEKLY' ? (dayOfWeekFactors[dow] || 1.0) : 1.0);

      projectedStock = Math.max(0, projectedStock - dailyRate);

      if (d === leadTimeDays) {
        projectedWithRestock += item.suggestedReorderQty;
      }
      projectedWithRestock = Math.max(0, projectedWithRestock - dailyRate);

      data.push({
        day: dayLabel,
        dayOffset: d,
        currentTrajectory: Math.round(projectedStock * 10) / 10,
        withReplenishment: Math.round(projectedWithRestock * 10) / 10,
        safetyThreshold: item.safetyStock,
        reorderPoint: item.reorderPoint,
      });
    }

    return data;
  }, [activeSimulationItem, leadTimeDays, seasonalityModel, dayOfWeekFactors]);

  return (
    <div className="space-y-5 text-slate-100">
      {/* Toast Feedback */}
      {actionFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-lg shadow-emerald-950/40 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-emerald-400 hover:text-white text-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Section: Predictive Engine Header & Scenario Controls */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                Demand & Replenishment Simulator
              </h4>
              <p className="text-[11px] text-slate-400">
                Calculates empirical burn-rate, weekly seasonality spikes, and recommended PO buffers.
              </p>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-copy-po-summary"
              type="button"
              onClick={handleCopyPoSummary}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
              title="Copy PO Summary to Clipboard"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy PO Requisition</span>
            </button>

            <button
              id="btn-batch-restock-critical"
              type="button"
              disabled={isSubmittingAction || summaryKPIs.criticalCount + summaryKPIs.outOfStockCount === 0}
              onClick={handleBatchRestockCritical}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-rose-950 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Restock All Critical ({summaryKPIs.outOfStockCount + summaryKPIs.criticalCount})</span>
            </button>

            <button
              id="btn-create-po-modal"
              type="button"
              disabled={summaryKPIs.totalRecommendedUnits === 0}
              onClick={() => {
                sound.playClick();
                setIsPoModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-950 cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Generate PO ({summaryKPIs.totalRecommendedUnits} Units)</span>
            </button>
          </div>
        </div>

        {/* Interactive Parameter Controls Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Sales History Horizon */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Sales Analysis Horizon</span>
              <Clock className="w-3 h-3 text-sky-400" />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[7, 14, 30].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setHorizonDays(days);
                  }}
                  className={`py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    horizonDays === days
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {/* Seasonality Weighting Model */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Seasonality Model</span>
              <TrendingUp className="w-3 h-3 text-amber-400" />
            </div>
            <select
              value={seasonalityModel}
              onChange={e => {
                sound.playClick();
                setSeasonalityModel(e.target.value as SeasonalityModel);
              }}
              aria-label="Seasonality Model"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-sky-500"
            >
              <option value="DYNAMIC_WEEKLY">Weekly Rhythm (Day-of-Week Weights)</option>
              <option value="PEAK_WEEKEND">Weekend / Peak Surge (+25% Boost)</option>
              <option value="MOMENTUM">Growth Momentum (Recent Velocity)</option>
              <option value="LINEAR_FLAT">Linear Baseline (Moving Avg)</option>
            </select>
          </div>

          {/* Supplier Lead Time */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Supplier Lead Time</span>
              <Truck className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[2, 3, 5, 7].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setLeadTimeDays(d);
                  }}
                  className={`py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    leadTimeDays === d
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Target Buffer Coverage Days */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Target Coverage Buffer</span>
              <ShieldCheck className="w-3 h-3 text-purple-400" />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setCoverageDays(d);
                  }}
                  className={`py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    coverageDays === d
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Recommended Restock Units</span>
            <Package className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-black font-mono text-sky-400 mt-1">
            {summaryKPIs.totalRecommendedUnits} <span className="text-xs font-normal text-slate-400">units</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across {summaryKPIs.actionableCount} SKU items</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Estimated PO Capital Required</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-400 mt-1">
            {currentLocation.currencySymbol}{summaryKPIs.totalPoCapital.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total wholesale procurement value</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Revenue at Stockout Risk</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black font-mono text-amber-300 mt-1">
            {currentLocation.currencySymbol}{summaryKPIs.totalAtRiskRevenue.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Protected retail gross turnover</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Urgent / Out-of-Stock SKUs</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black font-mono text-rose-400 mt-1">
            {summaryKPIs.outOfStockCount + summaryKPIs.criticalCount} <span className="text-xs font-normal text-slate-400">critical</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {summaryKPIs.outOfStockCount} zero stock, {summaryKPIs.criticalCount} &lt; {leadTimeDays}d runway
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setSelectedUrgency('ACTIONABLE');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedUrgency === 'ACTIONABLE'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Actionable Reorders ({summaryKPIs.actionableCount})
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setSelectedUrgency('OUT_OF_STOCK');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedUrgency === 'OUT_OF_STOCK'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Out of Stock ({summaryKPIs.outOfStockCount})
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setSelectedUrgency('CRITICAL');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedUrgency === 'CRITICAL'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Critical Runway ({summaryKPIs.criticalCount})
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setSelectedUrgency('ALL');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedUrgency === 'ALL'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Products ({forecastItems.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={e => {
              sound.playClick();
              setSelectedCategory(e.target.value);
            }}
            aria-label="Filter by Category"
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 font-medium focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search SKU / name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Predictions Table (Mobile Cards + Desktop Table) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Mobile Cards (< lg) */}
        <div className="lg:hidden divide-y divide-slate-800/80">
          {filteredForecastItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No items match your filter criteria.
            </div>
          ) : (
            filteredForecastItems.map(item => (
              <div key={item.product.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs truncate">{item.product.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.product.sku} • {item.category?.name || 'Uncategorized'}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                      item.urgency === 'OUT_OF_STOCK'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : item.urgency === 'CRITICAL'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : item.urgency === 'REORDER_DUE'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {item.urgency.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2.5 rounded-xl text-[10px]">
                  <div>
                    <div className="text-slate-400">Current / Min</div>
                    <div className="font-mono font-bold text-white text-xs mt-0.5">
                      <span className={item.currentStock <= item.minStock ? 'text-rose-400' : 'text-slate-200'}>
                        {item.currentStock}
                      </span>
                      <span className="text-slate-500 font-normal"> / {item.minStock}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400">Burn Rate</div>
                    <div className="font-mono font-bold text-amber-300 text-xs mt-0.5">
                      {item.adjustedDailyVelocity}/d
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400">Runway</div>
                    <div className={`font-mono font-bold text-xs mt-0.5 ${item.runwayDays <= 3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {item.currentStock <= 0 ? '0 days' : `${item.runwayDays} days`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="text-xs">
                    <span className="text-slate-400 text-[10px] block">Suggested Reorder</span>
                    <span className="font-mono font-bold text-sky-400 text-sm">
                      +{item.suggestedReorderQty} units
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1.5">
                      ({currentLocation.currencySymbol}{item.estimatedPoCost.toFixed(2)})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setActiveSimulationItem(item);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Simulate</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingAction}
                      onClick={() => handleQuickRestockItem(item)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Restock</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (>= lg) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-3 text-center">Stock / Min</th>
                <th className="py-3 px-3 text-center">Daily Burn Rate</th>
                <th className="py-3 px-3 text-center">Stockout Date</th>
                <th className="py-3 px-3 text-center">Runway</th>
                <th className="py-3 px-3 text-center">Urgency</th>
                <th className="py-3 px-3 text-right">Suggested Order</th>
                <th className="py-3 px-3 text-right">Est. Cost</th>
                <th className="py-3 px-4 text-center">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredForecastItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No items matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredForecastItems.map(item => (
                  <tr key={item.product.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white truncate max-w-[220px]">
                        {item.product.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.product.sku} • {item.category?.name || 'Standard'}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      <span className={`font-bold ${item.currentStock <= item.minStock ? 'text-rose-400' : 'text-slate-200'}`}>
                        {item.currentStock}
                      </span>
                      <span className="text-slate-500"> / {item.minStock}</span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      <div className="font-bold text-amber-300">{item.adjustedDailyVelocity} /day</div>
                      {item.momentumPct !== 0 && (
                        <div className={`text-[9.5px] ${item.momentumPct > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {item.momentumPct > 0 ? `+${item.momentumPct}% trend` : `${item.momentumPct}% trend`}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-300">
                      {item.stockoutDateFormatted}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className={`font-mono font-bold text-xs ${
                        item.currentStock <= 0
                          ? 'text-rose-400'
                          : item.runwayDays <= 3
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}>
                        {item.currentStock <= 0 ? '0d' : `${item.runwayDays}d`}
                      </div>
                      <div className="w-16 h-1 bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                        <div
                          className={`h-full ${
                            item.currentStock <= 0
                              ? 'w-full bg-rose-500'
                              : item.runwayDays <= 3
                              ? 'w-1/3 bg-amber-500'
                              : 'w-4/5 bg-emerald-500'
                          }`}
                        />
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.urgency === 'OUT_OF_STOCK'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : item.urgency === 'CRITICAL'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : item.urgency === 'REORDER_DUE'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {item.urgency.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.suggestedReorderQty}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setCustomQuantities(prev => ({ ...prev, [item.product.id]: val }));
                          }}
                          className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-0.5 text-right font-mono text-xs text-sky-400 font-bold focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-[10px] text-slate-500">units</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold">
                      {currentLocation.currencySymbol}{item.estimatedPoCost.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setActiveSimulationItem(item);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white transition cursor-pointer"
                          title="View Depletion Forecast Curve"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={isSubmittingAction}
                          onClick={() => handleQuickRestockItem(item)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                          title={`Apply restock of +${item.suggestedReorderQty} units`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Restock</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Depletion Curve Simulation Modal */}
      {activeSimulationItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{activeSimulationItem.product.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    SKU: {activeSimulationItem.product.sku} • Stock: {activeSimulationItem.currentStock} units
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSimulationItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Simulation Stat Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Daily Demand</div>
                  <div className="font-mono font-bold text-amber-300 text-sm mt-0.5">
                    {activeSimulationItem.adjustedDailyVelocity} units/day
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Predicted Stockout</div>
                  <div className="font-mono font-bold text-rose-400 text-sm mt-0.5">
                    {activeSimulationItem.stockoutDateFormatted}
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Lead Time Arrival</div>
                  <div className="font-mono font-bold text-sky-400 text-sm mt-0.5">
                    +{leadTimeDays} days
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Suggested PO</div>
                  <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                    +{activeSimulationItem.suggestedReorderQty} units
                  </div>
                </div>
              </div>

              {/* Depletion Curve Chart */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-white">21-Day Projected Inventory Depletion & Replenishment</span>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1 text-rose-400">
                      <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> Unreplenished Stock
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> With Replenishment (+{activeSimulationItem.suggestedReorderQty})
                    </span>
                  </div>
                </div>

                <div className="h-56 w-full">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={simulationChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '0.75rem',
                            fontSize: '11px',
                          }}
                        />
                        <ReferenceLine
                          x={simulationChartData[leadTimeDays]?.day}
                          stroke="#38bdf8"
                          strokeDasharray="4 4"
                          label={{ value: `PO Delivery (Day ${leadTimeDays})`, fill: '#38bdf8', fontSize: 10 }}
                        />
                        <ReferenceLine
                          y={activeSimulationItem.safetyStock}
                          stroke="#f59e0b"
                          strokeDasharray="3 3"
                          label={{ value: 'Safety Stock', fill: '#f59e0b', fontSize: 9 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="currentTrajectory"
                          name="Current Stock Trajectory"
                          stroke="#f43f5e"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="withReplenishment"
                          name="With Reorder Replenishment"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/70">
              <button
                type="button"
                onClick={() => setActiveSimulationItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={async () => {
                  await handleQuickRestockItem(activeSimulationItem);
                  setActiveSimulationItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-950 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Apply Restock (+{activeSimulationItem.suggestedReorderQty} Units)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Purchase Order Creation Modal */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Generate Purchase Order</h3>
                  <p className="text-xs text-slate-400">
                    Creates an official PO with recommended replenish quantities.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Vendor Selection */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1.5">Supplier / Vendor</label>
                <select
                  value={selectedPoSupplierId}
                  onChange={e => setSelectedPoSupplierId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-sky-500"
                >
                  {availableSuppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson})
                    </option>
                  ))}
                  {availableSuppliers.length === 0 && (
                    <option value="sup_general">Apex Wholesale Importers (Default)</option>
                  )}
                </select>
              </div>

              {/* Order Lines Summary */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between font-bold text-white border-b border-slate-800 pb-2">
                  <span>Requisition Summary</span>
                  <span className="text-emerald-400 font-mono">
                    {summaryKPIs.totalRecommendedUnits} Units • {currentLocation.currencySymbol}{summaryKPIs.totalPoCapital.toFixed(2)}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 pr-1">
                  {forecastItems.filter(i => i.suggestedReorderQty > 0).map(item => (
                    <div key={item.product.id} className="py-1.5 flex items-center justify-between text-[11px]">
                      <div className="truncate max-w-[240px]">
                        <span className="text-white font-medium">{item.product.name}</span>
                        <span className="text-slate-500 ml-1 font-mono">({item.product.sku})</span>
                      </div>
                      <div className="font-mono text-right">
                        <span className="text-sky-400 font-bold">+{item.suggestedReorderQty}</span>
                        <span className="text-slate-400 ml-2">
                          {currentLocation.currencySymbol}{item.estimatedPoCost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1.5">Purchase Order Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={e => setPoNotes(e.target.value)}
                  placeholder="e.g. Expedited delivery requested for low-stock coffee beans and teas..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/70">
              <button
                type="button"
                onClick={() => setIsPoModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={handleCreatePurchaseOrder}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-950 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Submit Official PO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
