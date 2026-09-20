'use client';

import React, { useMemo, useState, useSyncExternalStore } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  Percent,
} from 'lucide-react';
import type { Sale } from '@/lib/types';

interface SalesChartWidgetProps {
  sales: Sale[];
  currencySymbol: string;
}

type MetricMode = 'both' | 'revenue' | 'orders';
type TimeRange = '7d' | '14d' | '30d';

const emptySubscribe = () => () => {};

export const SalesChartWidget: React.FC<SalesChartWidgetProps> = ({
  sales,
  currencySymbol,
}) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('both');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const daysCount = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;

  const { chartData, totalRevenue, totalOrders, avgDailySales, peakDay, avgBasket } = useMemo(() => {
    const today = new Date();
    const daysMap = new Map<
      string,
      {
        dateStr: string;
        dayLabel: string;
        fullDate: string;
        totalSales: number;
        ordersCount: number;
      }
    >();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel =
        i === 0
          ? 'Today'
          : i === 1
          ? 'Yesterday'
          : d.toLocaleDateString(undefined, {
              weekday: daysCount <= 7 ? 'short' : undefined,
              month: 'numeric',
              day: 'numeric',
            });

      daysMap.set(dateStr, {
        dateStr,
        dayLabel,
        fullDate: d.toLocaleDateString(undefined, { dateStyle: 'full' }),
        totalSales: 0,
        ordersCount: 0,
      });
    }

    sales.forEach(sale => {
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

    const rev = list.reduce((sum, d) => sum + d.totalSales, 0);
    const ord = list.reduce((sum, d) => sum + d.ordersCount, 0);
    const avgDaily = rev / daysCount;
    const basket = ord > 0 ? rev / ord : 0;

    let maxDay = list[0];
    list.forEach(d => {
      if (d.totalSales > (maxDay?.totalSales || 0)) {
        maxDay = d;
      }
    });

    return {
      chartData: list,
      totalRevenue: rev,
      totalOrders: ord,
      avgDailySales: avgDaily,
      peakDay: maxDay,
      avgBasket: basket,
    };
  }, [sales, daysCount]);

  if (!isMounted) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
        Loading sales chart metrics...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metric Mode & Time Range Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        {/* Metric Mode Filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => setMetricMode('both')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              metricMode === 'both'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Curves
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('revenue')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              metricMode === 'revenue'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Revenue ({currencySymbol})
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('orders')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              metricMode === 'orders'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Orders Count
          </button>
        </div>

        {/* Time Range Filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => setTimeRange('7d')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              timeRange === '7d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('14d')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              timeRange === '14d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            14 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('30d')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              timeRange === '30d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Period Gross</span>
            <DollarSign className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-lg font-black font-mono text-white mt-0.5">
            {currencySymbol}{totalRevenue.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total completed sales</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Transactions</span>
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
            {totalOrders} <span className="text-xs font-normal text-slate-400">tickets</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total settled tickets</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Avg Basket</span>
            <Percent className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black font-mono text-amber-300 mt-0.5">
            {currencySymbol}{avgBasket.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Spend per customer</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Peak Day</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-black font-mono text-purple-300 mt-0.5 truncate">
            {peakDay?.dayLabel || 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">
            {peakDay ? `${currencySymbol}${peakDay.totalSales.toFixed(2)}` : 'No data'}
          </div>
        </div>
      </div>

      {/* Responsive Recharts Area Chart */}
      <div className="h-60 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
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
                tickFormatter={(val: number) => `${val}`}
                allowDecimals={false}
              />
            )}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0]?.payload;
                if (!data) return null;

                return (
                  <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 shadow-2xl space-y-1.5 font-sans min-w-[180px]">
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
              <Area
                yAxisId="sales"
                type="monotone"
                dataKey="totalSales"
                name="Sales Volume"
                stroke="#38bdf8"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#salesGrad)"
              />
            )}

            {(metricMode === 'both' || metricMode === 'orders') && (
              <Area
                yAxisId={metricMode === 'both' ? 'orders' : 'sales'}
                type="monotone"
                dataKey="ordersCount"
                name="Order Count"
                stroke="#34d399"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#ordersGrad)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
