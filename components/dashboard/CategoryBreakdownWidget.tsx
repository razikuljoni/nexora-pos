'use client';

import React, { useMemo } from 'react';
import { PieChart, DollarSign, Package, Award, Sparkles } from 'lucide-react';
import type { Sale, Category, Product } from '@/lib/types';

interface CategoryBreakdownWidgetProps {
  sales: Sale[];
  categories: Category[];
  products: Product[];
  currencySymbol: string;
}

export const CategoryBreakdownWidget: React.FC<CategoryBreakdownWidgetProps> = ({
  sales,
  categories,
  products,
  currencySymbol,
}) => {
  const { categoryMetrics, topProducts, totalRevenue } = useMemo(() => {
    const catMap = new Map<string, { id: string; name: string; revenue: number; itemsSold: number }>();
    const prodMap = new Map<string, { id: string; name: string; sku: string; categoryName: string; revenue: number; quantity: number }>();

    categories.forEach(cat => {
      catMap.set(cat.id, { id: cat.id, name: cat.name, revenue: 0, itemsSold: 0 });
    });
    catMap.set('uncategorized', { id: 'uncategorized', name: 'General', revenue: 0, itemsSold: 0 });

    let gross = 0;

    sales.forEach(sale => {
      if (sale.status === 'REFUNDED') return;
      sale.items.forEach(item => {
        const lineTotal = item.total;
        gross += lineTotal;

        const prod = products.find(p => p.id === item.productId);
        const catId = prod?.categoryId || 'uncategorized';
        const catEntry = catMap.get(catId) || catMap.get('uncategorized');

        if (catEntry) {
          catEntry.revenue += lineTotal;
          catEntry.itemsSold += item.quantity;
        }

        const currentProd = prodMap.get(item.productId) || {
          id: item.productId,
          name: item.name || prod?.name || 'Product',
          sku: prod?.sku || item.sku || 'SKU',
          categoryName: catEntry?.name || 'General',
          revenue: 0,
          quantity: 0,
        };
        currentProd.revenue += lineTotal;
        currentProd.quantity += item.quantity;
        prodMap.set(item.productId, currentProd);
      });
    });

    const sortedCategories = Array.from(catMap.values())
      .filter(c => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const sortedProducts = Array.from(prodMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      categoryMetrics: sortedCategories,
      topProducts: sortedProducts,
      totalRevenue: gross > 0 ? gross : 1,
    };
  }, [sales, categories, products]);

  const categoryColors = ['bg-sky-500', 'bg-indigo-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-purple-500'];

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <PieChart className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">
              Department Performance & Top Movers
            </div>
            <div className="text-[11px] text-slate-400">
              Sales contribution by product department
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Contribution Bars */}
        <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Category Revenue Share</span>
            <span className="text-[11px] font-mono text-slate-400">
              {currencySymbol}{totalRevenue.toFixed(2)}
            </span>
          </div>

          <div className="space-y-2.5">
            {categoryMetrics.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">
                No categorical sales logged yet.
              </div>
            ) : (
              categoryMetrics.map((cat, idx) => {
                const percent = Math.round((cat.revenue / totalRevenue) * 100);
                const color = categoryColors[idx % categoryColors.length];

                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${color} inline-block`} />
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white font-bold">
                          {currencySymbol}{cat.revenue.toFixed(2)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
                          {percent}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{ width: `${Math.max(percent, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top 5 Velocity Products */}
        <div className="space-y-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Top 5 Highest Grossing SKUs</span>
          </div>

          <div className="space-y-2">
            {topProducts.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">
                No items sold yet.
              </div>
            ) : (
              topProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="text-white font-semibold truncate">{prod.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {prod.sku} • {prod.quantity} sold
                      </div>
                    </div>
                  </div>

                  <div className="font-mono text-sky-400 font-bold shrink-0 ml-2">
                    {currencySymbol}{prod.revenue.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
