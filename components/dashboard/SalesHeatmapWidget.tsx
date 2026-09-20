'use client';

import React, { useMemo, useState } from 'react';
import {
  Clock,
  Flame,
  ShoppingBag,
  TrendingUp,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import type { Sale } from '@/lib/types';

interface SalesHeatmapWidgetProps {
  sales: Sale[];
  currencySymbol: string;
}

type HeatmapMetric = 'revenue' | 'orders';

const DAYS_OF_WEEK = [
  { key: 0, label: 'Sun', full: 'Sunday' },
  { key: 1, label: 'Mon', full: 'Monday' },
  { key: 2, label: 'Tue', full: 'Tuesday' },
  { key: 3, label: 'Wed', full: 'Wednesday' },
  { key: 4, label: 'Thu', full: 'Thursday' },
  { key: 5, label: 'Fri', full: 'Friday' },
  { key: 6, label: 'Sat', full: 'Saturday' },
];

const DISPLAY_HOURS = [
  7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
];

export const SalesHeatmapWidget: React.FC<SalesHeatmapWidgetProps> = ({
  sales,
  currencySymbol,
}) => {
  const [metric, setMetric] = useState<HeatmapMetric>('revenue');
  const [hoveredCell, setHoveredCell] = useState<{
    dayName: string;
    hour: number;
    revenue: number;
    orders: number;
  } | null>(null);

  // Compute 7x24 Matrix
  const { matrix, maxRevenue, maxOrders, peakHourInfo, totalTrackedSales } = useMemo(() => {
    // initialize matrix: dayIndex (0-6) -> hour (0-23) -> { revenue, orders }
    const m: Record<number, Record<number, { revenue: number; orders: number }>> = {};
    for (let d = 0; d < 7; d++) {
      m[d] = {};
      for (let h = 0; h < 24; h++) {
        m[d][h] = { revenue: 0, orders: 0 };
      }
    }

    let maxRev = 0;
    let maxOrd = 0;
    let totalRev = 0;
    let peakDay = 0;
    let peakHour = 12;
    let peakRev = 0;
    let peakOrd = 0;

    sales.forEach(sale => {
      if (sale.status === 'REFUNDED') return;
      try {
        const date = new Date(sale.createdAt);
        const day = date.getDay(); // 0-6
        const hour = date.getHours(); // 0-23

        if (m[day] && m[day][hour]) {
          m[day][hour].revenue += sale.total;
          m[day][hour].orders += 1;
          totalRev += sale.total;

          if (m[day][hour].revenue > maxRev) {
            maxRev = m[day][hour].revenue;
          }
          if (m[day][hour].orders > maxOrd) {
            maxOrd = m[day][hour].orders;
          }

          if (m[day][hour].revenue > peakRev) {
            peakRev = m[day][hour].revenue;
            peakOrd = m[day][hour].orders;
            peakDay = day;
            peakHour = hour;
          }
        }
      } catch {
        // Ignore invalid dates
      }
    });

    const dayName = DAYS_OF_WEEK.find(d => d.key === peakDay)?.full || 'Friday';
    const hourLabel = formatHour(peakHour);

    return {
      matrix: m,
      maxRevenue: maxRev > 0 ? maxRev : 1,
      maxOrders: maxOrd > 0 ? maxOrd : 1,
      totalTrackedSales: totalRev,
      peakHourInfo: {
        dayName,
        hourLabel,
        revenue: peakRev,
        orders: peakOrd,
      },
    };
  }, [sales]);

  function formatHour(h: number) {
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }

  // Determine background color based on heat intensity ratio 0.0 - 1.0
  const getCellColor = (rev: number, ord: number) => {
    const val = metric === 'revenue' ? rev : ord;
    const maxVal = metric === 'revenue' ? maxRevenue : maxOrders;
    if (val <= 0) return 'bg-slate-950/70 border-slate-900 text-transparent';

    const ratio = Math.min(val / maxVal, 1);

    if (metric === 'revenue') {
      if (ratio < 0.2) return 'bg-sky-950/60 border-sky-900/40 text-sky-400';
      if (ratio < 0.4) return 'bg-sky-800/80 border-sky-600/50 text-white';
      if (ratio < 0.7) return 'bg-indigo-600 border-indigo-400 text-white';
      if (ratio < 0.9) return 'bg-amber-600 border-amber-400 text-white font-bold';
      return 'bg-amber-500 border-yellow-300 text-slate-950 font-black shadow-md shadow-amber-500/20';
    } else {
      if (ratio < 0.2) return 'bg-emerald-950/60 border-emerald-900/40 text-emerald-400';
      if (ratio < 0.4) return 'bg-emerald-800/80 border-emerald-600/50 text-white';
      if (ratio < 0.7) return 'bg-teal-600 border-teal-400 text-white';
      if (ratio < 0.9) return 'bg-lime-600 border-lime-400 text-slate-950 font-bold';
      return 'bg-lime-400 border-emerald-300 text-slate-950 font-black shadow-md shadow-emerald-500/20';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header with Metric Selection & Busiest Time Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">
              Peak Traffic & Velocity Thermal Matrix
            </div>
            <div className="text-[11px] text-slate-400">
              Aggregated across all registered transactions
            </div>
          </div>
        </div>

        {/* Metric Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => setMetric('revenue')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              metric === 'revenue'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Revenue Density ({currencySymbol})
          </button>
          <button
            type="button"
            onClick={() => setMetric('orders')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              metric === 'orders'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Order Traffic (#)
          </button>
        </div>
      </div>

      {/* Peak Window Summary Banner */}
      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-400 text-[11px] font-medium">Historical Peak Rush Window</div>
            <div className="text-white font-bold text-xs flex items-center gap-1.5">
              <span>{peakHourInfo.dayName} at {peakHourInfo.hourLabel}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {currencySymbol}{peakHourInfo.revenue.toFixed(2)} ({peakHourInfo.orders} txs)
              </span>
            </div>
          </div>
        </div>

        {/* Hovered Cell Quick Diagnostic Display */}
        {hoveredCell ? (
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] flex items-center gap-3">
            <span className="text-sky-300 font-semibold">{hoveredCell.dayName} @ {formatHour(hoveredCell.hour)}</span>
            <span className="font-mono text-white font-bold">{currencySymbol}{hoveredCell.revenue.toFixed(2)}</span>
            <span className="text-emerald-400 font-medium font-mono">{hoveredCell.orders} orders</span>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-600" />
            <span>Hover on any cell to view detailed hourly breakdown</span>
          </div>
        )}
      </div>

      {/* Heatmap Grid Matrix */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[640px] space-y-1.5">
          {/* Hour Column Header */}
          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono pl-11">
            {DISPLAY_HOURS.map(hour => (
              <div key={hour} className="flex-1 text-center truncate">
                {hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`}
              </div>
            ))}
          </div>

          {/* Day Rows */}
          {DAYS_OF_WEEK.map(day => (
            <div key={day.key} className="flex items-center gap-1">
              <div className="w-10 text-[11px] font-bold text-slate-400 text-right pr-1 shrink-0">
                {day.label}
              </div>

              {DISPLAY_HOURS.map(hour => {
                const cell = matrix[day.key]?.[hour] || { revenue: 0, orders: 0 };
                const colorClass = getCellColor(cell.revenue, cell.orders);

                return (
                  <div
                    key={hour}
                    onMouseEnter={() =>
                      setHoveredCell({
                        dayName: day.full,
                        hour,
                        revenue: cell.revenue,
                        orders: cell.orders,
                      })
                    }
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`flex-1 h-7 rounded-md border flex items-center justify-center text-[10px] transition-all cursor-pointer hover:scale-110 hover:z-10 hover:shadow-lg ${colorClass}`}
                    title={`${day.full} @ ${formatHour(hour)}: ${currencySymbol}${cell.revenue.toFixed(2)} (${cell.orders} orders)`}
                  >
                    {cell.orders > 0 && (
                      <span className="truncate px-0.5">
                        {metric === 'revenue'
                          ? cell.revenue >= 100
                            ? Math.round(cell.revenue)
                            : cell.revenue.toFixed(0)
                          : cell.orders}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Intensity Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span>Low Activity</span>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded-xs bg-slate-950 border border-slate-800" />
            <span className="w-3.5 h-3.5 rounded-xs bg-sky-950 border border-sky-800" />
            <span className="w-3.5 h-3.5 rounded-xs bg-indigo-600" />
            <span className="w-3.5 h-3.5 rounded-xs bg-amber-600" />
            <span className="w-3.5 h-3.5 rounded-xs bg-amber-500" />
          </div>
          <span>Peak Surge</span>
        </div>

        <div className="text-[10px] text-slate-400 font-mono">
          Operating Window: 7:00 AM – 10:00 PM
        </div>
      </div>
    </div>
  );
};
