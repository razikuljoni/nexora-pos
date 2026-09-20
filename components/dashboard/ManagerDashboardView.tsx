'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  GripVertical,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  TrendingUp,
  Flame,
  AlertTriangle,
  PieChart,
  Banknote,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react';
import type {
  Sale,
  Product,
  Category,
  Location,
  Register,
  User,
  Shift,
  CashMovement,
} from '@/lib/types';
import { sound } from '@/lib/audio';

import { SalesChartWidget } from './SalesChartWidget';
import { SalesHeatmapWidget } from './SalesHeatmapWidget';
import { LowStockAlertsWidget } from './LowStockAlertsWidget';
import { CategoryBreakdownWidget } from './CategoryBreakdownWidget';
import { RegisterPulseWidget } from './RegisterPulseWidget';

const LOCAL_STORAGE_KEY = 'nexora_manager_dashboard_layout_v2';

export interface WidgetConfig {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  colSpan: 1 | 2; // 1 = half width (on 2-col layout), 2 = full width
  isVisible: boolean;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: 'sales_chart',
    title: 'Sales Volume & Velocity Chart',
    subtitle: 'Revenue, order frequency, and ticket sizes across consecutive days',
    iconName: 'TrendingUp',
    colSpan: 2,
    isVisible: true,
  },
  {
    id: 'sales_heatmap',
    title: 'Peak Traffic & Velocity Thermal Heatmap',
    subtitle: 'Hourly vs. day-of-week transaction density matrix',
    iconName: 'Flame',
    colSpan: 2,
    isVisible: true,
  },
  {
    id: 'low_stock_alerts',
    title: 'Real-Time Low-Stock & Depletion Alerts',
    subtitle: 'SKU thresholds, critical stock breaches, and 1-click restock actions',
    iconName: 'AlertTriangle',
    colSpan: 2,
    isVisible: true,
  },
  {
    id: 'category_breakdown',
    title: 'Department Performance & Top Movers',
    subtitle: 'Category revenue share and top 5 highest grossing items',
    iconName: 'PieChart',
    colSpan: 1,
    isVisible: true,
  },
  {
    id: 'register_pulse',
    title: 'Terminal Pulse & Cash Drawer Health',
    subtitle: 'Live register status, in-till cash float, and audit synchronization',
    iconName: 'Banknote',
    colSpan: 1,
    isVisible: true,
  },
];

interface ManagerDashboardViewProps {
  sales: Sale[];
  products: Product[];
  categories: Category[];
  currentLocation: Location;
  currentRegister: Register;
  currentUser: User;
  activeShift?: Shift;
  cashMovements: CashMovement[];
  isOffline: boolean;
  onRefreshData: () => Promise<void>;
  onNavigateToTab?: (tab: string) => void;
}

function getInitialWidgets(): WidgetConfig[] {
  if (typeof window === 'undefined') return DEFAULT_WIDGETS;
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed: WidgetConfig[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with DEFAULT_WIDGETS to ensure all standard widgets exist
        const merged: WidgetConfig[] = [];
        parsed.forEach(p => {
          const def = DEFAULT_WIDGETS.find(d => d.id === p.id);
          if (def) {
            merged.push({ ...def, ...p });
          }
        });
        DEFAULT_WIDGETS.forEach(def => {
          if (!merged.some(m => m.id === def.id)) {
            merged.push(def);
          }
        });
        return merged;
      }
    }
  } catch (err) {
    console.error('[ManagerDashboard] Failed to read layout from localStorage', err);
  }
  return DEFAULT_WIDGETS;
}

export const ManagerDashboardView: React.FC<ManagerDashboardViewProps> = ({
  sales,
  products,
  categories,
  currentLocation,
  currentRegister,
  currentUser,
  activeShift,
  cashMovements,
  isOffline,
  onRefreshData,
  onNavigateToTab,
}) => {
  // Widget ordering and layout state with localStorage lazy initialization
  const [widgets, setWidgets] = useState<WidgetConfig[]>(getInitialWidgets);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

  // Save layout to localStorage helper
  const persistWidgets = useCallback((newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newWidgets));
      setSaveStatus('Saved to Local Storage');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error('[ManagerDashboard] Failed to save layout to localStorage', err);
    }
  }, []);

  // Reset to default layout
  const handleResetLayout = () => {
    sound.playClick();
    persistWidgets(DEFAULT_WIDGETS);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedWidgetId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverWidgetId !== id) {
      setDragOverWidgetId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverWidgetId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedWidgetId || e.dataTransfer.getData('text/plain');
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);

    if (!sourceId || sourceId === targetId) return;

    sound.playClick();
    const sourceIndex = widgets.findIndex(w => w.id === sourceId);
    const targetIndex = widgets.findIndex(w => w.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const updated = [...widgets];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);

    persistWidgets(updated);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  // Reorder buttons (Move Up / Down for touch or fast keyboard usage)
  const handleMoveWidget = (id: string, direction: 'UP' | 'DOWN') => {
    sound.playClick();
    const idx = widgets.findIndex(w => w.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= widgets.length) return;

    const updated = [...widgets];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    persistWidgets(updated);
  };

  // Toggle Column Span (1 col = Half, 2 cols = Full)
  const handleToggleColSpan = (id: string) => {
    sound.playClick();
    const updated = widgets.map(w =>
      w.id === id ? { ...w, colSpan: (w.colSpan === 1 ? 2 : 1) as 1 | 2 } : w
    );
    persistWidgets(updated);
  };

  // Toggle Widget Visibility
  const handleToggleVisibility = (id: string) => {
    sound.playClick();
    const updated = widgets.map(w =>
      w.id === id ? { ...w, isVisible: !w.isVisible } : w
    );
    persistWidgets(updated);
  };

  // Top KPI Totals
  const executiveKPIs = useMemo(() => {
    let gross = 0;
    let validSales = 0;
    sales.forEach(s => {
      if (s.status !== 'REFUNDED') {
        gross += s.total;
        validSales += 1;
      }
    });

    const lowStockCount = products.filter(
      p => (p.stockQuantity ?? 0) <= (p.minStockLevel || 5)
    ).length;

    return {
      grossSales: gross,
      transactionCount: validSales,
      avgTicket: validSales > 0 ? gross / validSales : 0,
      lowStockCount,
    };
  }, [sales, products]);

  const renderWidgetContent = (id: string) => {
    switch (id) {
      case 'sales_chart':
        return (
          <SalesChartWidget
            sales={sales}
            currencySymbol={currentLocation.currencySymbol}
          />
        );
      case 'sales_heatmap':
        return (
          <SalesHeatmapWidget
            sales={sales}
            currencySymbol={currentLocation.currencySymbol}
          />
        );
      case 'low_stock_alerts':
        return (
          <LowStockAlertsWidget
            products={products}
            categories={categories}
            currentLocation={currentLocation}
            currentUser={currentUser}
            onRefreshData={onRefreshData}
            onNavigateToInventory={() => onNavigateToTab?.('inventory')}
          />
        );
      case 'category_breakdown':
        return (
          <CategoryBreakdownWidget
            sales={sales}
            categories={categories}
            products={products}
            currencySymbol={currentLocation.currencySymbol}
          />
        );
      case 'register_pulse':
        return (
          <RegisterPulseWidget
            activeShift={activeShift}
            cashMovements={cashMovements}
            currentLocation={currentLocation}
            currentRegister={currentRegister}
            currentUser={currentUser}
            currencySymbol={currentLocation.currencySymbol}
            isOffline={isOffline}
          />
        );
      default:
        return null;
    }
  };

  const getWidgetIcon = (iconName: string) => {
    switch (iconName) {
      case 'TrendingUp':
        return <TrendingUp className="w-4 h-4 text-sky-400" />;
      case 'Flame':
        return <Flame className="w-4 h-4 text-amber-400" />;
      case 'AlertTriangle':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'PieChart':
        return <PieChart className="w-4 h-4 text-indigo-400" />;
      case 'Banknote':
        return <Banknote className="w-4 h-4 text-emerald-400" />;
      default:
        return <LayoutDashboard className="w-4 h-4 text-sky-400" />;
    }
  };

  const visibleWidgets = widgets.filter(w => w.isVisible);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-y-auto scrollbar-thin">
      {/* Top Manager Executive Sub-Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span>Manager Analytics & Widget Control</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Customizable Dashboard
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Drag and drop cards to rearrange widgets • Layout persists in local storage
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Layout Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {saveStatus && (
            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{saveStatus}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setIsCustomizeModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            <span>Customize ({visibleWidgets.length}/{widgets.length})</span>
          </button>

          <button
            type="button"
            onClick={handleResetLayout}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="Reset layout order and sizes to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Layout</span>
          </button>
        </div>
      </div>

      {/* Main Container Area */}
      <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full">
        {/* Executive Quick Stats Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Gross Sales Volume</span>
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-xl font-black font-mono text-white mt-1">
              {currentLocation.currencySymbol}
              {executiveKPIs.grossSales.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">All registered orders</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Settled Transactions</span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black font-mono text-emerald-400 mt-1">
              {executiveKPIs.transactionCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Tickets processed</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Avg Basket Size</span>
              <Layers className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black font-mono text-amber-300 mt-1">
              {currentLocation.currencySymbol}
              {executiveKPIs.avgTicket.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Revenue per checkout</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Low-Stock Alerts</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-black font-mono text-rose-400 mt-1">
              {executiveKPIs.lowStockCount} SKUs
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">At or below reorder threshold</div>
          </div>
        </div>

        {/* Drag-and-Drop Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {visibleWidgets.map((widget, index) => {
            const isFirst = index === 0;
            const isLast = index === visibleWidgets.length - 1;
            const isDragging = draggedWidgetId === widget.id;
            const isDragOver = dragOverWidgetId === widget.id;

            return (
              <div
                key={widget.id}
                id={`widget-card-${widget.id}`}
                draggable
                onDragStart={e => handleDragStart(e, widget.id)}
                onDragOver={e => handleDragOver(e, widget.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, widget.id)}
                onDragEnd={handleDragEnd}
                className={`transition-all duration-200 rounded-2xl bg-slate-900 border shadow-xl flex flex-col ${
                  widget.colSpan === 2 ? 'lg:col-span-2' : 'lg:col-span-1'
                } ${
                  isDragging
                    ? 'opacity-40 border-dashed border-sky-400 scale-[0.99]'
                    : isDragOver
                    ? 'border-sky-500 ring-2 ring-sky-500/50 shadow-sky-950/50 scale-[1.01]'
                    : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Widget Card Header & Drag Handle Toolbar */}
                <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-950/40 rounded-t-2xl">
                  {/* Title and Grab Handle */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="p-1 text-slate-500 hover:text-slate-200 cursor-grab active:cursor-grabbing rounded-md hover:bg-slate-800 transition"
                      title="Click and drag to reorder this widget"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="p-1.5 rounded-lg bg-slate-800/70 border border-slate-700/50 shrink-0">
                      {getWidgetIcon(widget.iconName)}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                        <span>{widget.title}</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 truncate hidden sm:block">
                        {widget.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Widget Controls Toolbar */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveWidget(widget.id, 'UP')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Move widget up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveWidget(widget.id, 'DOWN')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Move widget down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Expand / Collapse Column Span */}
                    <button
                      type="button"
                      onClick={() => handleToggleColSpan(widget.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition cursor-pointer hidden lg:flex"
                      title={widget.colSpan === 2 ? 'Collapse to half width' : 'Expand to full width'}
                    >
                      {widget.colSpan === 2 ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Hide Widget */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(widget.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                      title="Hide widget from dashboard"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Widget Body Content */}
                <div className="p-5 flex-1">{renderWidgetContent(widget.id)}</div>
              </div>
            );
          })}
        </div>

        {visibleWidgets.length === 0 && (
          <div className="py-16 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
            <Info className="w-8 h-8 text-sky-400" />
            <div className="font-bold text-white text-sm">All dashboard widgets are currently hidden</div>
            <p className="text-xs text-slate-400 max-w-sm">
              Click &quot;Customize&quot; or reset your layout to restore your sales charts, heatmaps, and stock alerts.
            </p>
            <button
              type="button"
              onClick={handleResetLayout}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-sky-950"
            >
              Reset to Default Layout
            </button>
          </div>
        )}
      </div>

      {/* Customize Widgets Modal */}
      {isCustomizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-sm text-white">Customize Dashboard Widgets</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomizeModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
              >
                Done
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Toggle visibility of executive widgets or adjust column spans. Changes are saved directly to your local storage.
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {widgets.map((widget, idx) => (
                <div
                  key={widget.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1 text-slate-500">{getWidgetIcon(widget.iconName)}</div>
                    <div className="truncate">
                      <div className="text-white font-semibold truncate">{widget.title}</div>
                      <div className="text-[10px] text-slate-400">
                        {widget.colSpan === 2 ? 'Full Width (2 cols)' : 'Half Width (1 col)'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Move Controls */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveWidget(widget.id, 'UP')}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === widgets.length - 1}
                      onClick={() => handleMoveWidget(widget.id, 'DOWN')}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Visibility Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(widget.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                        widget.isVisible
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {widget.isVisible ? (
                        <>
                          <Eye className="w-3 h-3 text-sky-400" />
                          <span>Visible</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetLayout}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to default</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCustomizeModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
