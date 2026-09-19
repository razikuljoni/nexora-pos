'use client';

import React, { useMemo, useState, useSyncExternalStore } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Calendar,
  Sparkles,
  BarChart2,
} from 'lucide-react';
import type { Sale } from '@/lib/types';

interface SalesVolumeChartProps {
  sales: Sale[];
  currencySymbol: string;
}

type ChartMetric = 'revenue' | 'orders' | 'both';

const emptySubscribe = () => () => {};

export const SalesVolumeChart: React.FC<SalesVolumeChartProps> = ({
  sales,
  currencySymbol,
}) => {
  const [metricMode, setMetricMode] = useState<ChartMetric>('both');
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Compute 7-day chronological time series
  const { chartData, totalRevenue7d, totalOrders7d, avgDailySales, peakDay } = useMemo(() => {
    const today = new Date();
    const daysMap = new Map<string, {
      dateStr: string;
      dayLabel: string;
      fullDate: string;
      totalSales: number;
      ordersCount: number;
    }>();

    // Construct last 7 consecutive calendar days (6 days ago through today)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel =
        i === 0
          ? 'Today'
          : i === 1
          ? 'Yesterday'
          : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

      daysMap.set(dateStr, {
        dateStr,
        dayLabel,
        fullDate: d.toLocaleDateString(undefined, { dateStyle: 'full' }),
        totalSales: 0,
        ordersCount: 0,
      });
    }

    // Populate sales data
    sales.forEach(sale => {
      // Exclude voided/fully refunded if applicable, or count completed sales
      if (sale.status === 'REFUNDED') return;
      try {
        const saleDateStr = new Date(sale.createdAt).toISOString().split('T')[0];
        const dayEntry = daysMap.get(saleDateStr);
        if (dayEntry) {
          dayEntry.totalSales += sale.total;
          dayEntry.ordersCount += 1;
        }
      } catch {
        // Ignore invalid dates
      }
    });

    const list = Array.from(daysMap.values()).map(d => ({
      ...d,
      totalSales: parseFloat(d.totalSales.toFixed(2)),
      avgTicket: d.ordersCount > 0 ? parseFloat((d.totalSales / d.ordersCount).toFixed(2)) : 0,
    }));

    const rev7d = list.reduce((sum, d) => sum + d.totalSales, 0);
    const ord7d = list.reduce((sum, d) => sum + d.ordersCount, 0);
    const avgDaily = rev7d / 7;

    let maxDay = list[0];
    list.forEach(d => {
      if (d.totalSales > (maxDay?.totalSales || 0)) {
        maxDay = d;
      }
    });

    return {
      chartData: list,
      totalRevenue7d: rev7d,
      totalOrders7d: ord7d,
      avgDailySales: avgDaily,
      peakDay: maxDay,
    };
  }, [sales]);

  if (!isMounted) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl min-h-[260px] flex items-center justify-center text-slate-500 text-xs">
        Loading 7-day sales overview...
      </div>
    );
  }

  return (
    <div
      id="orders-7day-sales-chart-card"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
    >
      {/* Chart Top Header & Quick Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>7-Day Sales Volume & Transaction Velocity</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Performance Overview
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Managerial performance trends across consecutive days with average ticket sizing.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 self-start lg:self-auto">
          <button
            onClick={() => setMetricMode('both')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              metricMode === 'both'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Metrics
          </button>
          <button
            onClick={() => setMetricMode('revenue')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              metricMode === 'revenue'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Revenue (${currencySymbol})
          </button>
          <button
            onClick={() => setMetricMode('orders')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              metricMode === 'orders'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Orders Count
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 7-Day Revenue */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>7-Day Gross Volume</span>
            <DollarSign className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-lg font-black font-mono text-white mt-0.5">
            {currencySymbol}{totalRevenue7d.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Net completed sales</div>
        </div>

        {/* 7-Day Orders */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>7-Day Orders</span>
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
            {totalOrders7d} <span className="text-xs font-normal text-slate-400">orders</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total transactions</div>
        </div>

        {/* Daily Average */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Daily Average</span>
            <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black font-mono text-amber-300 mt-0.5">
            {currencySymbol}{avgDailySales.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Average revenue / day</div>
        </div>

        {/* Peak Day */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Peak Performance</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-black font-mono text-purple-300 mt-0.5 truncate">
            {peakDay?.dayLabel || 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {peakDay ? `${currencySymbol}${peakDay.totalSales.toFixed(2)} (${peakDay.ordersCount} orders)` : 'No activity'}
          </div>
        </div>
      </div>

      {/* Recharts Line Chart */}
      <div className="h-56 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
          >
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dayLabel"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              yAxisId="sales"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(val: number) => `${currencySymbol}${val}`}
            />
            {metricMode === 'both' && (
              <YAxis
                yAxisId="orders"
                orientation="right"
                stroke="#64748b"
                tick={{ fill: '#10b981', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(val: number) => `${val} ord`}
                allowDecimals={false}
              />
            )}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0]?.payload;
                if (!data) return null;

                return (
                  <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 shadow-2xl space-y-1.5 font-sans min-w-[170px]">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-1">
                      <Calendar className="w-3.5 h-3.5 text-sky-400" />
                      <span>{data.fullDate}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                          Sales Volume:
                        </span>
                        <span className="font-mono font-bold text-sky-400">
                          {currencySymbol}{data.totalSales.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                          Transactions:
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {data.ordersCount} orders
                        </span>
                      </div>
                      {data.ordersCount > 0 && (
                        <div className="flex justify-between items-center text-[11px] text-slate-400 pt-0.5 border-t border-slate-800/80">
                          <span>Avg Ticket:</span>
                          <span className="font-mono font-medium text-slate-200">
                            {currencySymbol}{data.avgTicket.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {(metricMode === 'both' || metricMode === 'revenue') && (
              <Line
                yAxisId="sales"
                type="monotone"
                dataKey="totalSales"
                name="Sales Volume"
                stroke="#38bdf8"
                strokeWidth={3}
                dot={{ fill: '#0284c7', r: 4, strokeWidth: 2, stroke: '#38bdf8' }}
                activeDot={{ r: 6, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {(metricMode === 'both' || metricMode === 'orders') && (
              <Line
                yAxisId={metricMode === 'both' ? 'orders' : 'sales'}
                type="monotone"
                dataKey="ordersCount"
                name="Order Count"
                stroke="#34d399"
                strokeWidth={2.5}
                strokeDasharray={metricMode === 'both' ? '4 4' : undefined}
                dot={{ fill: '#059669', r: 3.5, strokeWidth: 2, stroke: '#34d399' }}
                activeDot={{ r: 5, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
