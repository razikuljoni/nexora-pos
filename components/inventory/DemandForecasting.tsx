'use client';

import React, { useState, useMemo, useSyncExternalStore } from 'react';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Package,
  Calendar,
  DollarSign,
  ShoppingCart,
  Download,
  CheckCircle2,
  Filter,
  Search,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  RefreshCw,
  SlidersHorizontal,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type {
  Product,
  Category,
  Sale,
  InventoryMovement,
  Location,
  Supplier,
  User as StaffUser,
} from '@/lib/types';
import { createPurchaseOrder, adjustStock } from '@/lib/services/inventoryService';
import { sound } from '@/lib/audio';

const emptySubscribe = () => () => {};

export interface DemandForecastingProps {
  products: Product[];
  categories: Category[];
  sales?: Sale[];
  movements?: InventoryMovement[];
  locations?: Location[];
  suppliers?: Supplier[];
  currencySymbol?: string;
  currentLocation: Location;
  currentUser: StaffUser;
  onRefreshData: () => Promise<void>;
  onQuickRestockClick?: (product: Product, recommendedQty: number) => void;
}

export type RiskLevel = 'ALL' | 'CRITICAL' | 'REORDER_NEEDED' | 'OUT_OF_STOCK' | 'HEALTHY' | 'OVERSTOCKED';
export type TimeHorizon = '7d' | '14d' | '30d' | 'all';
export type ViewTab = 'table' | 'chart' | 'procurement';

interface ForecastItem {
  product: Product;
  categoryName: string;
  categoryColor: string;
  currentStock: number;
  minStock: number;
  totalSoldInWindow: number;
  dailyVelocity: number;
  isBaselineEstimate: boolean;
  daysRemaining: number;
  depletionDate: Date;
  formattedDepletionDate: string;
  safetyStock: number;
  reorderPoint: number;
  isBelowROP: boolean;
  riskStatus: 'OUT_OF_STOCK' | 'CRITICAL' | 'REORDER_NEEDED' | 'HEALTHY' | 'OVERSTOCKED';
  recommendedReorderQty: number;
  estimatedOrderCost: number;
  matchedSupplierId: string;
  matchedSupplierName: string;
}

export const DemandForecasting: React.FC<DemandForecastingProps> = ({
  products,
  categories,
  sales = [],
  movements = [],
  locations = [],
  suppliers = [],
  currencySymbol = '$',
  currentLocation,
  currentUser,
  onRefreshData,
  onQuickRestockClick,
}) => {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Configuration States
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('30d');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<RiskLevel>('ALL');
  const [leadTimeDays, setLeadTimeDays] = useState<number>(5);
  const [targetBufferDays, setTargetBufferDays] = useState<number>(30);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ViewTab>('table');
  const [customSelectedChartSkus, setCustomSelectedChartSkus] = useState<string[]>([]);
  const [isSubmittingPO, setIsSubmittingPO] = useState<boolean>(false);
  const [poSuccessMessage, setPoSuccessMessage] = useState<string | null>(null);
  const [quickRestockProduct, setQuickRestockProduct] = useState<ForecastItem | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(10);
  const [isProcessingRestock, setIsProcessingRestock] = useState<boolean>(false);

  // Category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  // Supplier default mapping
  const getSupplierForProduct = useMemo(() => {
    return (p: Product): { id: string; name: string } => {
      const cat = categoryMap.get(p.categoryId);
      const catCode = cat?.code?.toUpperCase() || '';
      
      if (suppliers.length > 0) {
        if (catCode === 'COFFEE' || catCode === 'BEANS') {
          const s = suppliers.find(s => s.name.toLowerCase().includes('bean') || s.name.toLowerCase().includes('roast'));
          if (s) return { id: s.id, name: s.name };
        }
        if (catCode === 'PASTRY' || catCode === 'FOOD') {
          const s = suppliers.find(s => s.name.toLowerCase().includes('bakery') || s.name.toLowerCase().includes('boulange'));
          if (s) return { id: s.id, name: s.name };
        }
        if (catCode === 'MERCH' || catCode === 'BEV' || catCode === 'SNACK') {
          const s = suppliers.find(s => s.name.toLowerCase().includes('pack') || s.name.toLowerCase().includes('goods'));
          if (s) return { id: s.id, name: s.name };
        }
        return { id: suppliers[0].id, name: suppliers[0].name };
      }

      // Fallback
      if (catCode === 'COFFEE' || catCode === 'BEANS') return { id: 'sup_roasters', name: 'Apex Green Bean Importers' };
      if (catCode === 'PASTRY' || catCode === 'FOOD') return { id: 'sup_bakery', name: 'La Boulange Artisan Bakery' };
      return { id: 'sup_packaging', name: 'EcoPack Sustainable Goods' };
    };
  }, [suppliers, categoryMap]);

  // 1. Calculate Core Forecast Metrics for each product
  const forecastItems: ForecastItem[] = useMemo(() => {
    const now = new Date();
    let daysThreshold = 30;
    if (timeHorizon === '7d') daysThreshold = 7;
    if (timeHorizon === '14d') daysThreshold = 14;
    if (timeHorizon === 'all') daysThreshold = 90;

    const cutoffDate = new Date(now.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

    // Filter sales by timeframe and location
    const relevantSales = sales.filter(s => {
      if (s.status === 'REFUNDED' || s.status === 'VOIDED') return false;
      if (selectedLocationId !== 'ALL' && s.locationId !== selectedLocationId) return false;
      const saleDate = new Date(s.createdAt);
      return saleDate >= cutoffDate;
    });

    // Aggregate units sold per productId
    const salesMap = new Map<string, number>();
    relevantSales.forEach(sale => {
      sale.items.forEach(item => {
        salesMap.set(item.productId, (salesMap.get(item.productId) || 0) + item.quantity);
      });
    });

    // Also factor movements (e.g. SALE movements if recorded directly)
    movements.forEach(m => {
      if (m.movementType === 'SALE' && m.quantity < 0) {
        if (selectedLocationId !== 'ALL' && m.locationId !== selectedLocationId) return;
        const mDate = new Date(m.createdAt);
        if (mDate >= cutoffDate) {
          // If not already covered by sales table
          if (relevantSales.length === 0) {
            salesMap.set(m.productId, (salesMap.get(m.productId) || 0) + Math.abs(m.quantity));
          }
        }
      }
    });

    return products.map(product => {
      const cat = categoryMap.get(product.categoryId);
      const stock = product.stockQuantity || 0;
      const minStock = product.minStockLevel || 5;
      const totalSold = salesMap.get(product.id) || 0;

      let dailyVelocity = 0;
      let isBaselineEstimate = false;

      if (totalSold > 0) {
        dailyVelocity = Math.round((totalSold / daysThreshold) * 100) / 100;
      } else {
        // Realistic fallback turnover baseline for newly stocked products (e.g. 3-6% of stock per week)
        isBaselineEstimate = true;
        const baselineBurn = product.type === 'RECIPE' ? 2.5 : Math.max(0.25, Math.round((stock * 0.04) * 100) / 100);
        dailyVelocity = baselineBurn;
      }

      // Avoid zero division
      const effectiveVelocity = Math.max(0.1, dailyVelocity);

      let daysRemaining = 999;
      if (stock <= 0) {
        daysRemaining = 0;
      } else {
        daysRemaining = Math.floor(stock / effectiveVelocity);
      }

      const depletionDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
      const formattedDepletionDate =
        daysRemaining === 0
          ? 'Stocked Out'
          : daysRemaining >= 999
          ? 'Extended (>1 yr)'
          : depletionDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

      // Safety Stock & Reorder Point Calculation
      // Safety Stock = minStockLevel or 3 days of velocity
      const safetyStock = Math.max(minStock, Math.ceil(effectiveVelocity * 3));
      // Reorder Point (ROP) = (Daily Velocity * Supplier Lead Time) + Safety Stock
      const reorderPoint = Math.ceil(effectiveVelocity * leadTimeDays + safetyStock);
      const isBelowROP = stock <= reorderPoint;

      // Determine Risk Level
      let riskStatus: ForecastItem['riskStatus'] = 'HEALTHY';
      if (stock <= 0) {
        riskStatus = 'OUT_OF_STOCK';
      } else if (daysRemaining <= leadTimeDays) {
        // Will stock out before new supplier shipment can arrive!
        riskStatus = 'CRITICAL';
      } else if (isBelowROP || daysRemaining <= 14) {
        riskStatus = 'REORDER_NEEDED';
      } else if (daysRemaining > targetBufferDays + 30) {
        riskStatus = 'OVERSTOCKED';
      } else {
        riskStatus = 'HEALTHY';
      }

      // Recommended Reorder Quantity to achieve targetBufferDays of stock coverage
      const targetStockLevel = Math.ceil(effectiveVelocity * targetBufferDays + safetyStock);
      const recommendedReorderQty = Math.max(0, targetStockLevel - stock);
      const estimatedOrderCost = Math.round(recommendedReorderQty * product.purchaseCost * 100) / 100;

      const supplierInfo = getSupplierForProduct(product);

      return {
        product,
        categoryName: cat?.name || 'Uncategorized',
        categoryColor: cat?.color || '#64748b',
        currentStock: stock,
        minStock,
        totalSoldInWindow: totalSold,
        dailyVelocity,
        isBaselineEstimate,
        daysRemaining,
        depletionDate,
        formattedDepletionDate,
        safetyStock,
        reorderPoint,
        isBelowROP,
        riskStatus,
        recommendedReorderQty,
        estimatedOrderCost,
        matchedSupplierId: supplierInfo.id,
        matchedSupplierName: supplierInfo.name,
      };
    });
  }, [
    products,
    sales,
    movements,
    timeHorizon,
    selectedLocationId,
    leadTimeDays,
    targetBufferDays,
    categoryMap,
    getSupplierForProduct,
  ]);

  // 2. Executive KPI Aggregates
  const summaryKpis = useMemo(() => {
    let criticalCount = 0;
    let reorderCount = 0;
    let outOfStockCount = 0;
    let healthyCount = 0;
    let overstockedCount = 0;
    let totalProcurementCost = 0;
    let totalDailyVelocity = 0;

    forecastItems.forEach(item => {
      totalDailyVelocity += item.dailyVelocity;
      if (item.riskStatus === 'CRITICAL') criticalCount++;
      if (item.riskStatus === 'REORDER_NEEDED') reorderCount++;
      if (item.riskStatus === 'OUT_OF_STOCK') outOfStockCount++;
      if (item.riskStatus === 'HEALTHY') healthyCount++;
      if (item.riskStatus === 'OVERSTOCKED') overstockedCount++;

      if (item.isBelowROP || item.riskStatus === 'CRITICAL' || item.riskStatus === 'OUT_OF_STOCK') {
        totalProcurementCost += item.estimatedOrderCost;
      }
    });

    return {
      criticalCount,
      reorderCount,
      outOfStockCount,
      healthyCount,
      overstockedCount,
      urgentActionTotal: criticalCount + outOfStockCount + reorderCount,
      totalProcurementCost,
      avgDailyVelocity: Math.round(totalDailyVelocity * 10) / 10,
    };
  }, [forecastItems]);

  // Top critical SKUs for trajectory chart when items change
  const defaultChartSkus = useMemo(() => {
    const sorted = [...forecastItems]
      .filter(item => item.currentStock > 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
    return sorted.slice(0, 4).map(i => i.product.sku);
  }, [forecastItems]);

  const activeChartSkus = customSelectedChartSkus.length > 0 ? customSelectedChartSkus : defaultChartSkus;

  // 3. Filtered Items for Display
  const filteredItems = useMemo(() => {
    return forecastItems
      .filter(item => {
        // Risk Filter
        if (riskFilter !== 'ALL') {
          if (riskFilter === 'CRITICAL' && item.riskStatus !== 'CRITICAL') return false;
          if (riskFilter === 'REORDER_NEEDED' && item.riskStatus !== 'REORDER_NEEDED') return false;
          if (riskFilter === 'OUT_OF_STOCK' && item.riskStatus !== 'OUT_OF_STOCK') return false;
          if (riskFilter === 'HEALTHY' && item.riskStatus !== 'HEALTHY') return false;
          if (riskFilter === 'OVERSTOCKED' && item.riskStatus !== 'OVERSTOCKED') return false;
        }

        // Category Filter
        if (selectedCategoryId !== 'ALL' && item.product.categoryId !== selectedCategoryId) {
          return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = item.product.name.toLowerCase().includes(q);
          const matchSku = item.product.sku.toLowerCase().includes(q);
          const matchCategory = item.categoryName.toLowerCase().includes(q);
          if (!matchName && !matchSku && !matchCategory) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort urgent depletion first
        return a.daysRemaining - b.daysRemaining;
      });
  }, [forecastItems, riskFilter, selectedCategoryId, searchQuery]);

  // 4. Generate 30-Day Forward Trajectory Data for Recharts
  const trajectoryChartData = useMemo(() => {
    const activeChartItems = forecastItems.filter(item => activeChartSkus.includes(item.product.sku));

    const days = [0, 3, 7, 10, 14, 18, 21, 25, 30];
    const now = new Date();

    return days.map(day => {
      const futureDate = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
      const label = day === 0 ? 'Today' : `+${day}d (${futureDate.getMonth() + 1}/${futureDate.getDate()})`;

      const row: Record<string, number | string> = {
        day,
        label,
      };

      activeChartItems.forEach(item => {
        // Project stock remaining at day N: Math.max(0, currentStock - (dailyVelocity * day))
        const remaining = Math.max(0, Math.round(item.currentStock - item.dailyVelocity * day));
        row[item.product.sku] = remaining;
      });

      return row;
    });
  }, [forecastItems, activeChartSkus]);

  // 5. Consolidated Procurement Plan grouped by Supplier
  const procurementPlan = useMemo(() => {
    const itemsNeedingReorder = forecastItems.filter(
      item => item.isBelowROP || item.riskStatus === 'CRITICAL' || item.riskStatus === 'OUT_OF_STOCK'
    );

    const supplierGroups = new Map<
      string,
      {
        supplierId: string;
        supplierName: string;
        items: ForecastItem[];
        totalUnits: number;
        totalCost: number;
      }
    >();

    itemsNeedingReorder.forEach(item => {
      const supId = item.matchedSupplierId;
      const existing = supplierGroups.get(supId) || {
        supplierId: supId,
        supplierName: item.matchedSupplierName,
        items: [],
        totalUnits: 0,
        totalCost: 0,
      };

      existing.items.push(item);
      existing.totalUnits += item.recommendedReorderQty;
      existing.totalCost += item.estimatedOrderCost;
      supplierGroups.set(supId, existing);
    });

    return Array.from(supplierGroups.values());
  }, [forecastItems]);

  // Handler: Batch Create Purchase Order in System
  const handleGenerateSystemPO = async (group: (typeof procurementPlan)[0]) => {
    try {
      sound.playClick();
      setIsSubmittingPO(true);

      const itemsForPO = group.items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        sku: i.product.sku,
        quantity: i.recommendedReorderQty,
        unitCost: i.product.purchaseCost,
      }));

      const newPo = await createPurchaseOrder(
        group.supplierId,
        group.supplierName,
        currentLocation.id,
        itemsForPO,
        currentUser.name,
        currentUser.id,
        `Automated replenishment draft generated from 30-Day Demand Forecasting (${leadTimeDays}d lead time, ${targetBufferDays}d buffer)`
      );

      sound.playSuccess();
      setPoSuccessMessage(`Successfully created Purchase Order ${newPo.poNumber} for ${group.supplierName}!`);
      await onRefreshData();

      setTimeout(() => {
        setPoSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Failed to create purchase order:', err);
    } finally {
      setIsSubmittingPO(false);
    }
  };

  // Handler: Export Procurement Plan as CSV
  const handleExportCSV = () => {
    sound.playClick();
    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Stock On Hand',
      'Min Stock Level',
      'Daily Velocity (units/day)',
      'Days Until Depletion',
      'Depletion Date',
      'Reorder Point (ROP)',
      'Risk Status',
      'Recommended Reorder Qty',
      'Unit Purchase Cost',
      'Estimated PO Cost',
      'Assigned Supplier',
    ];

    const rows = forecastItems.map(item => [
      `"${item.product.sku}"`,
      `"${item.product.name.replace(/"/g, '""')}"`,
      `"${item.categoryName}"`,
      item.currentStock,
      item.minStock,
      item.dailyVelocity,
      item.daysRemaining,
      `"${item.formattedDepletionDate}"`,
      item.reorderPoint,
      item.riskStatus,
      item.recommendedReorderQty,
      item.product.purchaseCost.toFixed(2),
      item.estimatedOrderCost.toFixed(2),
      `"${item.matchedSupplierName}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Nexora_Demand_Forecast_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler: Execute Quick Restock for single row
  const handleExecuteQuickRestock = async () => {
    if (!quickRestockProduct) return;
    try {
      setIsProcessingRestock(true);
      sound.playClick();

      await adjustStock(
        quickRestockProduct.product.id,
        restockAmount,
        'PURCHASE_RECEIPT',
        `Demand Forecast Quick Replenishment (${restockAmount} units)`,
        currentUser.id,
        currentUser.name,
        currentLocation.id,
        'org_nexora'
      );

      sound.playSuccess();
      await onRefreshData();
      setQuickRestockProduct(null);
    } catch (err) {
      console.error('Failed to restock item:', err);
    } finally {
      setIsProcessingRestock(false);
    }
  };

  const chartColors = ['#f43f5e', '#f59e0b', '#06b6d4', '#10b981', '#8b5cf6', '#ec4899'];

  return (
    <div id="demand-forecasting-section" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8 shadow-xl">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Demand Forecasting & Depletion Projections</h2>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Predictive Run Rate
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Analyzes historical sales velocity to project stockout dates, calculate safety stock breaches, and automate procurement orders.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs & Quick CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 flex items-center gap-1 text-xs">
            <button
              id="forecast-tab-table"
              onClick={() => {
                sound.playClick();
                setActiveTab('table');
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'table' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Projections Table</span>
            </button>
            <button
              id="forecast-tab-chart"
              onClick={() => {
                sound.playClick();
                setActiveTab('chart');
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'chart' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Depletion Trajectory (30d)</span>
            </button>
            <button
              id="forecast-tab-procurement"
              onClick={() => {
                sound.playClick();
                setActiveTab('procurement');
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'procurement' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Procurement Plan ({procurementPlan.length})</span>
            </button>
          </div>

          <button
            id="forecast-export-csv-btn"
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            title="Download full forecast and reorder recommendations as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {poSuccessMessage && (
        <div className="mt-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{poSuccessMessage}</span>
          </div>
          <button
            onClick={() => setPoSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Executive KPI Banner Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 my-5">
        <div className="bg-slate-800/50 border border-rose-500/20 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">Critical Stockout</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{summaryKpis.criticalCount}</span>
            <span className="text-xs text-rose-400 font-medium">&lt; {leadTimeDays}d lead time</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Will deplete before new shipment arrives</p>
        </div>

        <div className="bg-slate-800/50 border border-amber-500/20 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Reorders Required</span>
            <ShoppingCart className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{summaryKpis.reorderCount}</span>
            <span className="text-xs text-amber-400 font-medium">Below ROP trigger</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Stock on hand is under reorder threshold</p>
        </div>

        <div className="bg-slate-800/50 border border-sky-500/20 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">Daily Network Run Rate</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{summaryKpis.avgDailyVelocity}</span>
            <span className="text-xs text-slate-400 font-medium">units/day</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Based on {timeHorizon === 'all' ? 'All-Time' : timeHorizon} historical POS velocity</p>
        </div>

        <div className="bg-slate-800/50 border border-emerald-500/20 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Est. Restock Capital</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              {currencySymbol}
              {summaryKpis.totalProcurementCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-emerald-400 font-medium">to {targetBufferDays}d target</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Investment needed for urgent restock SKUs</p>
        </div>
      </div>

      {/* Interactive Forecasting Parameter Controls */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Historical Time Horizon */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> Velocity Window:
            </span>
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/60">
              {(['7d', '14d', '30d', 'all'] as TimeHorizon[]).map(th => (
                <button
                  key={th}
                  id={`forecast-horizon-${th}`}
                  onClick={() => {
                    sound.playClick();
                    setTimeHorizon(th);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase transition ${
                    timeHorizon === th ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {th === 'all' ? 'All Time' : th}
                </button>
              ))}
            </div>
          </div>

          {/* Supplier Lead Time Tuner */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" /> Lead Time:
            </span>
            <select
              id="forecast-lead-time-select"
              value={leadTimeDays}
              onChange={e => {
                sound.playClick();
                setLeadTimeDays(Number(e.target.value));
              }}
              className="bg-slate-800 border border-slate-700/80 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-hidden focus:border-sky-500"
            >
              <option value={3}>3 Days (Express)</option>
              <option value={5}>5 Days (Standard)</option>
              <option value={7}>7 Days (Weekly)</option>
              <option value={10}>10 Days (Regional)</option>
              <option value={14}>14 Days (Bi-weekly)</option>
            </select>
          </div>

          {/* Target Buffer Coverage Tuner */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Target Buffer:
            </span>
            <select
              id="forecast-target-buffer-select"
              value={targetBufferDays}
              onChange={e => {
                sound.playClick();
                setTargetBufferDays(Number(e.target.value));
              }}
              className="bg-slate-800 border border-slate-700/80 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-hidden focus:border-sky-500"
            >
              <option value={14}>14 Days (Lean)</option>
              <option value={21}>21 Days (3 Weeks)</option>
              <option value={30}>30 Days (Standard 1 Month)</option>
              <option value={45}>45 Days (Safety Buffer)</option>
              <option value={60}>60 Days (High Reserve)</option>
            </select>
          </div>

          {/* Location Filter */}
          {locations.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" /> Location:
              </span>
              <select
                id="forecast-location-select"
                value={selectedLocationId}
                onChange={e => {
                  sound.playClick();
                  setSelectedLocationId(e.target.value);
                }}
                className="bg-slate-800 border border-slate-700/80 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-hidden focus:border-sky-500"
              >
                <option value="ALL">All Network Locations</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search SKU input */}
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            id="forecast-search-input"
            type="text"
            placeholder="Search SKU, item..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
          />
        </div>
      </div>

      {/* Risk Filter Category Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4 text-xs">
        <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-slate-500" /> Filter Risk:
        </span>
        <button
          id="risk-filter-all"
          onClick={() => {
            sound.playClick();
            setRiskFilter('ALL');
          }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
            riskFilter === 'ALL'
              ? 'bg-sky-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
          }`}
        >
          All Items ({forecastItems.length})
        </button>
        <button
          id="risk-filter-critical"
          onClick={() => {
            sound.playClick();
            setRiskFilter('CRITICAL');
          }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            riskFilter === 'CRITICAL'
              ? 'bg-rose-600 text-white'
              : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
          <span>Critical Stockout ({summaryKpis.criticalCount})</span>
        </button>
        <button
          id="risk-filter-reorder"
          onClick={() => {
            sound.playClick();
            setRiskFilter('REORDER_NEEDED');
          }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            riskFilter === 'REORDER_NEEDED'
              ? 'bg-amber-600 text-white'
              : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Reorder Required ({summaryKpis.reorderCount})</span>
        </button>
        <button
          id="risk-filter-healthy"
          onClick={() => {
            sound.playClick();
            setRiskFilter('HEALTHY');
          }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            riskFilter === 'HEALTHY'
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Healthy Buffer ({summaryKpis.healthyCount})</span>
        </button>
        <button
          id="risk-filter-overstocked"
          onClick={() => {
            sound.playClick();
            setRiskFilter('OVERSTOCKED');
          }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            riskFilter === 'OVERSTOCKED'
              ? 'bg-indigo-600 text-white'
              : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30'
          }`}
        >
          <span>Overstocked / Slow ({summaryKpis.overstockedCount})</span>
        </button>
      </div>

      {/* TAB 1: PROJECTIONS & PROCUREMENT TABLE */}
      {activeTab === 'table' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/90 text-slate-300 font-semibold border-b border-slate-700">
                <th className="py-3 px-3.5">Product & SKU</th>
                <th className="py-3 px-3 text-center">Stock On Hand</th>
                <th className="py-3 px-3 text-center">Daily Run Rate</th>
                <th className="py-3 px-3 text-center">Projected Depletion</th>
                <th className="py-3 px-3 text-center">Reorder Point (ROP)</th>
                <th className="py-3 px-3 text-center">Target Reorder Qty</th>
                <th className="py-3 px-3 text-center">Est. Restock Cost</th>
                <th className="py-3 px-3 text-center">Risk Status</th>
                <th className="py-3 px-3.5 text-right">Procurement Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold">No products match current forecast filter</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Try adjusting the risk filter or search keywords</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isCritical = item.riskStatus === 'CRITICAL';
                  const isReorder = item.riskStatus === 'REORDER_NEEDED';
                  const isOutOfStock = item.riskStatus === 'OUT_OF_STOCK';

                  return (
                    <tr
                      key={item.product.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isCritical
                          ? 'bg-rose-500/5'
                          : isReorder
                          ? 'bg-amber-500/5'
                          : isOutOfStock
                          ? 'bg-red-500/10'
                          : ''
                      }`}
                    >
                      {/* Product details */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-white leading-tight">{item.product.name}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-mono text-[10px] text-slate-400 font-semibold">{item.product.sku}</span>
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase"
                            style={{
                              backgroundColor: `${item.categoryColor}25`,
                              color: item.categoryColor,
                              border: `1px solid ${item.categoryColor}40`,
                            }}
                          >
                            {item.categoryName}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            • {item.matchedSupplierName}
                          </span>
                        </div>
                      </td>

                      {/* Stock On Hand */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`font-mono font-bold text-sm ${
                              item.currentStock <= 0
                                ? 'text-red-400 font-black'
                                : item.currentStock <= item.minStock
                                ? 'text-rose-400'
                                : 'text-slate-200'
                            }`}
                          >
                            {item.currentStock}
                          </span>
                          <span className="text-[10px] text-slate-400">Min: {item.minStock}</span>
                        </div>
                      </td>

                      {/* Daily Run Rate */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-sky-400">{item.dailyVelocity}</span>
                            <span className="text-[10px] text-slate-400">/day</span>
                          </div>
                          {item.isBaselineEstimate ? (
                            <span
                              className="text-[9px] text-slate-400 underline decoration-dotted cursor-help"
                              title="Catalog turnover baseline estimation until more POS sales are recorded"
                            >
                              (baseline)
                            </span>
                          ) : (
                            <span className="text-[9px] text-emerald-400 font-medium">
                              ({item.totalSoldInWindow} in {timeHorizon})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Projected Depletion Date & Countdown */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`font-semibold text-xs ${
                              item.daysRemaining <= leadTimeDays
                                ? 'text-rose-400 font-bold'
                                : item.daysRemaining <= 14
                                ? 'text-amber-300 font-bold'
                                : 'text-slate-200'
                            }`}
                          >
                            {item.formattedDepletionDate}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold mt-0.5 ${
                              item.daysRemaining === 0
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                : item.daysRemaining <= leadTimeDays
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                : item.daysRemaining <= 14
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'text-slate-400 bg-slate-800'
                            }`}
                          >
                            {item.daysRemaining === 0
                              ? 'Stocked Out'
                              : item.daysRemaining === 1
                              ? 'Tomorrow'
                              : `in ${item.daysRemaining} days`}
                          </span>
                        </div>
                      </td>

                      {/* Reorder Point ROP */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-mono font-bold text-slate-300">{item.reorderPoint} units</span>
                          <span className="text-[9px] text-slate-400">
                            {leadTimeDays}d lead + {item.safetyStock} buffer
                          </span>
                        </div>
                      </td>

                      {/* Target Reorder Quantity */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`font-mono font-bold text-sm ${
                              item.recommendedReorderQty > 0 ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            +{item.recommendedReorderQty}
                          </span>
                          <span className="text-[9px] text-slate-400">{targetBufferDays}d target</span>
                        </div>
                      </td>

                      {/* Est Restock Cost */}
                      <td className="py-3 px-3 text-center font-mono">
                        {item.recommendedReorderQty > 0 ? (
                          <div>
                            <span className="font-semibold text-slate-200">
                              {currencySymbol}
                              {item.estimatedOrderCost.toFixed(2)}
                            </span>
                            <div className="text-[9px] text-slate-400">
                              @{currencySymbol}
                              {item.product.purchaseCost.toFixed(2)}/ea
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Risk Badge */}
                      <td className="py-3 px-3 text-center">
                        {item.riskStatus === 'OUT_OF_STOCK' && (
                          <span className="px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-[10px] tracking-wide inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-400" /> Stocked Out
                          </span>
                        )}
                        {item.riskStatus === 'CRITICAL' && (
                          <span className="px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[10px] tracking-wide inline-flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3 text-rose-400" /> Imminent Stockout
                          </span>
                        )}
                        {item.riskStatus === 'REORDER_NEEDED' && (
                          <span className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px] tracking-wide inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" /> Reorder Triggered
                          </span>
                        )}
                        {item.riskStatus === 'HEALTHY' && (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-[10px] tracking-wide inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Adequate Buffer
                          </span>
                        )}
                        {item.riskStatus === 'OVERSTOCKED' && (
                          <span className="px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-medium text-[10px] tracking-wide">
                            Slow Moving
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`quick-restock-btn-${item.product.id}`}
                            onClick={() => {
                              sound.playClick();
                              setQuickRestockProduct(item);
                              setRestockAmount(item.recommendedReorderQty > 0 ? item.recommendedReorderQty : 10);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 text-xs font-semibold transition flex items-center gap-1"
                            title="Quick manual restock for this item"
                          >
                            <Package className="w-3 h-3" />
                            <span>Restock</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: DEPLETION TRAJECTORY CHART (RECHARTS) */}
      {activeTab === 'chart' && (
        <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-sky-400" />
                <span>30-Day Forward Stock Depletion Trajectory</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulates projected daily inventory burndown based on calculated POS sales velocity.
              </p>
            </div>

            {/* SKU selection chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium text-[11px]">Compare SKUs:</span>
              {forecastItems.slice(0, 8).map((item, idx) => {
                const isSelected = activeChartSkus.includes(item.product.sku);
                const color = chartColors[idx % chartColors.length];

                return (
                  <button
                    key={item.product.sku}
                    id={`chart-sku-toggle-${item.product.sku}`}
                    onClick={() => {
                      sound.playClick();
                      if (isSelected) {
                        if (activeChartSkus.length > 1) {
                          setCustomSelectedChartSkus(activeChartSkus.filter(s => s !== item.product.sku));
                        }
                      } else {
                        if (activeChartSkus.length < 6) {
                          setCustomSelectedChartSkus([...activeChartSkus, item.product.sku]);
                        }
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition border ${
                      isSelected
                        ? 'text-white shadow-xs'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-white'
                    }`}
                    style={{
                      backgroundColor: isSelected ? `${color}30` : undefined,
                      borderColor: isSelected ? color : undefined,
                    }}
                  >
                    {item.product.sku}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recharts Canvas */}
          <div className="h-72 w-full pt-2">
            {!isMounted ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Rendering projection models...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trajectoryChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <ReferenceLine
                    y={5}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ value: 'Safety Threshold', fill: '#f59e0b', fontSize: 10, position: 'right' }}
                  />

                  {activeChartSkus.map((sku, idx) => {
                    const color = chartColors[idx % chartColors.length];
                    const matched = forecastItems.find(i => i.product.sku === sku);
                    const name = matched ? `${sku} (${matched.product.name.slice(0, 18)}...)` : sku;

                    return (
                      <Line
                        key={sku}
                        type="monotone"
                        dataKey={sku}
                        name={name}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: color }}
                        activeDot={{ r: 5 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PROCUREMENT PLAN & AUTOMATED PURCHASE ORDER DRAFTS */}
      {activeTab === 'procurement' && (
        <div className="space-y-4">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <span>Automated Supplier Procurement Order Plan</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidates all SKUs flagged for replenishment into supplier purchase orders sized to replenish inventory to the {targetBufferDays}-day target.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Total Recommended Investment:</div>
              <div className="text-lg font-black text-emerald-400">
                {currencySymbol}
                {summaryKpis.totalProcurementCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          {procurementPlan.length === 0 ? (
            <div className="bg-slate-800/20 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-bold text-white">All Products Currently Have Adequate Stock Coverage</p>
              <p className="text-xs text-slate-500 mt-1">
                No items are below the Reorder Point or within the {leadTimeDays}-day delivery lead time window.
              </p>
            </div>
          ) : (
            procurementPlan.map(group => (
              <div
                key={group.supplierId}
                className="bg-slate-800/40 border border-slate-700/80 rounded-xl p-4 transition shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-700 rounded-lg text-slate-200">
                      <Building2 className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{group.supplierName}</h4>
                      <p className="text-xs text-slate-400">
                        {group.items.length} SKUs flagged • {group.totalUnits} total units recommended
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Order Subtotal</div>
                      <div className="text-base font-black text-white">
                        {currencySymbol}
                        {group.totalCost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>

                    <button
                      id={`create-po-btn-${group.supplierId}`}
                      disabled={isSubmittingPO}
                      onClick={() => handleGenerateSystemPO(group)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
                    >
                      {isSubmittingPO ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Create PO in System</span>
                    </button>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead>
                      <tr className="text-slate-400 font-semibold border-b border-slate-700/40">
                        <th className="py-2 px-2">SKU & Item</th>
                        <th className="py-2 px-2 text-center">On Hand</th>
                        <th className="py-2 px-2 text-center">Depletion Date</th>
                        <th className="py-2 px-2 text-center">Run Rate</th>
                        <th className="py-2 px-2 text-center">Reorder Qty</th>
                        <th className="py-2 px-2 text-right">Unit Cost</th>
                        <th className="py-2 px-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {group.items.map(item => (
                        <tr key={item.product.id} className="hover:bg-slate-800/30">
                          <td className="py-2 px-2">
                            <span className="font-semibold text-white">{item.product.name}</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-400">[{item.product.sku}]</span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono">{item.currentStock}</td>
                          <td className="py-2 px-2 text-center text-rose-300 font-medium">{item.formattedDepletionDate}</td>
                          <td className="py-2 px-2 text-center font-mono text-sky-400">{item.dailyVelocity}/day</td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-emerald-400">
                            +{item.recommendedReorderQty}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-400">
                            {currencySymbol}
                            {item.product.purchaseCost.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-200">
                            {currencySymbol}
                            {item.estimatedOrderCost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* QUICK RESTOCK MODAL */}
      {quickRestockProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sky-400">
                <Package className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">Quick Restock</h3>
              </div>
              <button
                onClick={() => setQuickRestockProduct(null)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Product:</span>
                <p className="font-bold text-white text-sm mt-0.5">{quickRestockProduct.product.name}</p>
                <p className="font-mono text-slate-400">{quickRestockProduct.product.sku}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <div>
                  <span className="text-slate-400">Current Stock:</span>
                  <p className="font-mono font-bold text-white text-sm">{quickRestockProduct.currentStock}</p>
                </div>
                <div>
                  <span className="text-slate-400">Daily Burn Rate:</span>
                  <p className="font-mono font-bold text-sky-400 text-sm">{quickRestockProduct.dailyVelocity}/day</p>
                </div>
                <div>
                  <span className="text-slate-400">Depletion Date:</span>
                  <p className="font-bold text-rose-300 text-sm">{quickRestockProduct.formattedDepletionDate}</p>
                </div>
                <div>
                  <span className="text-slate-400">Target Coverage:</span>
                  <p className="font-bold text-emerald-400 text-sm">+{quickRestockProduct.recommendedReorderQty} units</p>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Units to Add to Current Stock:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={restockAmount}
                    onChange={e => setRestockAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-hidden focus:border-sky-500"
                  />
                  <button
                    onClick={() => setRestockAmount(quickRestockProduct.recommendedReorderQty || 20)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold whitespace-nowrap"
                  >
                    Recommended ({quickRestockProduct.recommendedReorderQty})
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setQuickRestockProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={isProcessingRestock}
                onClick={handleExecuteQuickRestock}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5"
              >
                {isProcessingRestock ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Confirm Restock (+{restockAmount})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
