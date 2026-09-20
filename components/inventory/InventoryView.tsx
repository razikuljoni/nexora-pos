'use client';

import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  ArrowUpDown,
  History,
  AlertTriangle,
  AlertOctagon,
  FileSpreadsheet,
  X,
  Check,
  CheckCircle2,
  Filter,
  ShieldAlert,
  TrendingDown,
  Layers,
  ArrowUpRight,
  Flame,
  TrendingUp,
  Image as ImageIcon,
  Sparkles,
  Wand2,
  Camera,
  Loader2,
} from 'lucide-react';
import type { Product, Category, InventoryMovement, Location, Sale, User as StaffUser } from '@/lib/types';
import { db } from '@/lib/db';
import { adjustStock } from '@/lib/services/inventoryService';
import { sound } from '@/lib/audio';
import { BulkImportModal } from './BulkImportModal';
import { LocationHeatmap } from './LocationHeatmap';
import { DemandForecasting } from './DemandForecasting';
import { ProductImageModal } from './ProductImageModal';
import { matchCuratedPreset, generateVectorPlaceholder } from '@/lib/catalogImages';

interface InventoryViewProps {
  products: Product[];
  categories: Category[];
  movements: InventoryMovement[];
  locations?: Location[];
  sales?: Sale[];
  currentLocation: Location;
  currentUser: StaffUser;
  onRefreshData: () => Promise<void>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  categories,
  movements,
  locations = [],
  sales = [],
  currentLocation,
  currentUser,
  onRefreshData,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [stockFilter, setStockFilter] = useState<'ALL' | 'BELOW_THRESHOLD' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'HEALTHY'>('ALL');
  const [isAlertBannerDismissed, setIsAlertBannerDismissed] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [showLocationHeatmap, setShowLocationHeatmap] = useState(true);
  const [showDemandForecasting, setShowDemandForecasting] = useState(true);

  // Automated Low Stock Statistics Calculation
  const lowStockStats = useMemo(() => {
    let outOfStock = 0;
    let lowStock = 0;
    let healthy = 0;
    let totalDeficit = 0;

    products.forEach(p => {
      if (p.stockQuantity <= 0) {
        outOfStock++;
        totalDeficit += Math.max(1, p.minStockLevel);
      } else if (p.stockQuantity <= p.minStockLevel) {
        lowStock++;
        totalDeficit += p.minStockLevel - p.stockQuantity;
      } else {
        healthy++;
      }
    });

    return {
      outOfStock,
      lowStock,
      healthy,
      totalBelowThreshold: outOfStock + lowStock,
      totalDeficit,
    };
  }, [products]);

  // Modals & Drawers
  const [ledgerProduct, setLedgerProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Cycle count recount');
  const [isNewProductModal, setIsNewProductModal] = useState(false);

  // Image Management & Visual Clarity State
  const [selectedImageProduct, setSelectedImageProduct] = useState<Product | null>(null);
  const [isBatchEnriching, setIsBatchEnriching] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  // New Product Form State
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0]?.id || 'cat_coffee');
  const [newCost, setNewCost] = useState('1.50');
  const [newPrice, setNewPrice] = useState('4.50');
  const [newInitialStock, setNewInitialStock] = useState('20');
  const [newMinStock, setNewMinStock] = useState('5');
  const [newUnit, setNewUnit] = useState('piece');
  const [newImage, setNewImage] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (stockFilter === 'BELOW_THRESHOLD' && p.stockQuantity > p.minStockLevel) return false;
      if (stockFilter === 'OUT_OF_STOCK' && p.stockQuantity > 0) return false;
      if (stockFilter === 'LOW_STOCK' && (p.stockQuantity <= 0 || p.stockQuantity > p.minStockLevel)) return false;
      if (stockFilter === 'HEALTHY' && p.stockQuantity <= p.minStockLevel) return false;
      if (onlyLowStock && p.stockQuantity > p.minStockLevel) return false;
      if (selectedCategory !== 'ALL' && p.categoryId !== selectedCategory) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
      );
    });
  }, [products, stockFilter, onlyLowStock, selectedCategory, search]);

  const handleOpenQuickRestock = (prod: Product) => {
    sound.playClick();
    setAdjustingProduct(prod);
    const deficit = Math.max(1, prod.minStockLevel - prod.stockQuantity);
    setAdjustQuantity(deficit);
    setAdjustReason('Safety threshold replenishment');
  };

  // Handle stock adjustment
  const handleConfirmAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || adjustQuantity === 0) return;

    try {
      sound.playClick();
      await adjustStock(
        adjustingProduct.id,
        adjustQuantity,
        adjustQuantity < 0 ? 'DAMAGE' : 'ADJUSTMENT',
        adjustReason,
        currentUser.id,
        currentUser.name,
        currentLocation.id,
        'org_nexora'
      );
      setAdjustingProduct(null);
      setAdjustQuantity(0);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 1-Click Automated Catalog Imagery Enrichment for all missing items
  const handleBatchEnrichImages = async () => {
    const missing = products.filter(p => !p.image);
    if (missing.length === 0) {
      setBatchMessage('All catalog items already have visual imagery assigned!');
      setTimeout(() => setBatchMessage(null), 4000);
      return;
    }

    sound.playClick();
    setIsBatchEnriching(true);

    try {
      let enrichedCount = 0;
      await db.transaction('rw', db.products, async () => {
        for (const prod of missing) {
          const matched = matchCuratedPreset(prod.name, prod.categoryId);
          const cat = categories.find(c => c.id === prod.categoryId);
          const imageUrl = matched
            ? matched.url
            : generateVectorPlaceholder({
                name: prod.name,
                sku: prod.sku,
                categoryName: cat?.name,
                themeColor: cat?.color,
              });

          await db.products.update(prod.id, { image: imageUrl });
          enrichedCount++;
        }
      });

      sound.playSuccess();
      await onRefreshData();
      setBatchMessage(`Successfully enriched ${enrichedCount} catalog items with visual imagery!`);
      setTimeout(() => setBatchMessage(null), 5000);
    } catch (err: any) {
      console.error('Batch enrich failed:', err);
      alert(`Batch enrichment error: ${err.message}`);
    } finally {
      setIsBatchEnriching(false);
    }
  };

  // Handle creating new product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSku.trim()) return;

    sound.playClick();
    const prodId = `prod_${Date.now()}`;
    const initialQty = parseInt(newInitialStock) || 0;
    const cost = parseFloat(newCost) || 0;

    const newProd: Product = {
      id: prodId,
      name: newName.trim(),
      sku: newSku.trim().toUpperCase(),
      barcode: newBarcode.trim() || `${Math.floor(100000000 + Math.random() * 900000000)}`,
      categoryId: newCategory,
      unit: newUnit,
      purchaseCost: cost,
      sellingPrice: parseFloat(newPrice) || 0,
      taxRate: currentLocation.taxRate,
      stockQuantity: initialQty,
      minStockLevel: parseInt(newMinStock) || 5,
      active: true,
      type: 'STANDARD',
      preparationStation: 'NONE',
      image: newImage.trim() || undefined,
    };

    await db.transaction('rw', [db.products, db.inventoryMovements], async () => {
      await db.products.add(newProd);

      if (initialQty > 0) {
        await db.inventoryMovements.add({
          id: `mov_${Date.now()}`,
          organizationId: 'org_nexora',
          locationId: currentLocation.id,
          productId: prodId,
          productName: newProd.name,
          movementType: 'OPENING',
          quantity: initialQty,
          unitCost: cost,
          referenceType: 'MANUAL',
          reasonCode: 'Initial product creation opening balance',
          createdBy: currentUser.name,
          createdAt: new Date().toISOString(),
        });
      }
    });

    setIsNewProductModal(false);
    setNewName('');
    setNewSku('');
    setNewBarcode('');
    setNewImage('');
    await onRefreshData();
  };

  // Movements for ledger inspection
  const productMovements = ledgerProduct
    ? movements
        .filter(m => m.productId === ledgerProduct.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Package className="w-6 h-6 text-sky-400" />
            Inventory & Stock Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Explainable stock movements, live valuation, cycle counts, automated safety threshold alerting, and immutable ledger auditing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="toggle-demand-forecasting-btn"
            onClick={() => {
              sound.playClick();
              setShowDemandForecasting(prev => !prev);
            }}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition shadow-xs ${
              showDemandForecasting
                ? 'bg-sky-600/20 border-sky-500/40 text-sky-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <span>{showDemandForecasting ? 'Hide Forecasting' : 'Demand Forecasting'}</span>
          </button>

          <button
            id="toggle-location-heatmap-btn"
            onClick={() => {
              sound.playClick();
              setShowLocationHeatmap(prev => !prev);
            }}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition shadow-xs ${
              showLocationHeatmap
                ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400" />
            <span>{showLocationHeatmap ? 'Hide Heatmap' : 'Location Heatmap'}</span>
          </button>

          <button
            id="bulk-import-csv-btn"
            onClick={() => {
              sound.playClick();
              setIsBulkImportOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white transition flex items-center gap-2 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Bulk CSV Import</span>
          </button>

          {/* 1-Click AI Catalog Imagery Enrichment */}
          <button
            id="batch-enrich-imagery-btn"
            onClick={handleBatchEnrichImages}
            disabled={isBatchEnriching}
            className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-bold text-purple-200 hover:text-white transition flex items-center gap-2 shadow-xs disabled:opacity-50"
            title="Auto-enrich products missing images with AI & curated studio imagery"
          >
            {isBatchEnriching ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            ) : (
              <Wand2 className="w-4 h-4 text-purple-400" />
            )}
            <span>AI Imagery Studio</span>
            {products.some(p => !p.image) && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500/30 text-purple-200 font-mono">
                {products.filter(p => !p.image).length} unassigned
              </span>
            )}
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setIsNewProductModal(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition flex items-center gap-2 shadow-md shadow-sky-950"
          >
            <Plus className="w-4 h-4" />
            Add Catalog Product
          </button>
        </div>
      </div>

      {/* Batch Enrichment Status Banner */}
      {batchMessage && (
        <div
          id="batch-enrichment-toast"
          className="bg-purple-950/40 border border-purple-500/40 text-purple-200 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{batchMessage}</span>
          </div>
          <button
            onClick={() => setBatchMessage(null)}
            className="p-1 text-purple-300 hover:text-white rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Automated Low-Stock Alerting Banner */}
      {lowStockStats.totalBelowThreshold > 0 && !isAlertBannerDismissed && (
        <div
          id="inventory-low-stock-alert-banner"
          className="bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Automated Stock Alert:</span>
                  <span className="text-amber-300">
                    {lowStockStats.totalBelowThreshold} Product{lowStockStats.totalBelowThreshold > 1 ? 's' : ''} Below Safety Threshold
                  </span>
                </h3>
                {lowStockStats.outOfStock > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3 text-rose-400" />
                    {lowStockStats.outOfStock} Critical
                  </span>
                )}
                {lowStockStats.lowStock > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    {lowStockStats.lowStock} Low Warning
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Automated monitoring has flagged inventory deficits. A total of{' '}
                <strong className="text-amber-300 font-mono font-bold">{lowStockStats.totalDeficit} units</strong>{' '}
                are required across affected items to restore healthy baseline safety buffers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              id="filter-below-threshold-btn"
              onClick={() => {
                sound.playClick();
                setStockFilter(stockFilter === 'BELOW_THRESHOLD' ? 'ALL' : 'BELOW_THRESHOLD');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                stockFilter === 'BELOW_THRESHOLD'
                  ? 'bg-amber-500 text-slate-950 shadow-amber-950 font-black'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{stockFilter === 'BELOW_THRESHOLD' ? 'Showing Depleted SKUs' : 'Filter Alerted SKUs'}</span>
            </button>

            <button
              onClick={() => setIsAlertBannerDismissed(true)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title="Dismiss warning banner"
              aria-label="Dismiss alert banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Predictive Demand Forecasting & Stock Depletion Projections */}
      {showDemandForecasting && (
        <DemandForecasting
          products={products}
          categories={categories}
          sales={sales}
          movements={movements}
          locations={locations}
          currencySymbol={currentLocation.currencySymbol}
          currentLocation={currentLocation}
          currentUser={currentUser}
          onRefreshData={onRefreshData}
          onQuickRestockClick={(product, recommendedQty) => {
            setAdjustingProduct(product);
            setAdjustQuantity(recommendedQty);
            setAdjustReason(`Forecasting replenishment recommendation (+${recommendedQty})`);
          }}
        />
      )}

      {/* Interactive Multi-Location Stock Consumption Heatmap (Recharts) */}
      {showLocationHeatmap && (
        <LocationHeatmap
          products={products}
          categories={categories}
          locations={locations}
          sales={sales}
          movements={movements}
          currencySymbol={currentLocation.currencySymbol}
        />
      )}

      {/* Automated Stock Status KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Catalog */}
        <button
          onClick={() => {
            sound.playClick();
            setStockFilter('ALL');
          }}
          className={`p-4 rounded-2xl border text-left transition ${
            stockFilter === 'ALL'
              ? 'bg-sky-950/40 border-sky-500/50 shadow-md shadow-sky-950'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total SKUs</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">{products.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Active catalog products</div>
        </button>

        {/* Healthy Range */}
        <button
          onClick={() => {
            sound.playClick();
            setStockFilter(stockFilter === 'HEALTHY' ? 'ALL' : 'HEALTHY');
          }}
          className={`p-4 rounded-2xl border text-left transition ${
            stockFilter === 'HEALTHY'
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-950'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">In Safety Range</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">{lowStockStats.healthy}</div>
          <div className="text-[11px] text-slate-400 mt-1">Adequate buffer levels</div>
        </button>

        {/* Low Stock Warning */}
        <button
          id="kpi-low-stock-warning"
          onClick={() => {
            sound.playClick();
            setStockFilter(stockFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK');
          }}
          className={`p-4 rounded-2xl border text-left transition ${
            stockFilter === 'LOW_STOCK'
              ? 'bg-amber-950/40 border-amber-500/60 shadow-md shadow-amber-950'
              : lowStockStats.lowStock > 0
              ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Low Stock Warning</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">{lowStockStats.lowStock}</div>
          <div className="text-[11px] text-amber-300/80 mt-1">Below safety threshold</div>
        </button>

        {/* Out of Stock Critical */}
        <button
          id="kpi-out-of-stock"
          onClick={() => {
            sound.playClick();
            setStockFilter(stockFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK');
          }}
          className={`p-4 rounded-2xl border text-left transition ${
            stockFilter === 'OUT_OF_STOCK'
              ? 'bg-rose-950/40 border-rose-500/60 shadow-md shadow-rose-950'
              : lowStockStats.outOfStock > 0
              ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Critical Depleted</span>
            <AlertOctagon className={`w-4 h-4 text-rose-400 ${lowStockStats.outOfStock > 0 ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">{lowStockStats.outOfStock}</div>
          <div className="text-[11px] text-rose-300/80 mt-1">Zero stock on hand</div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search catalog by name, SKU, or barcode..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
          />
        </div>

        {/* Category Select */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-hidden"
        >
          <option value="ALL">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Active Stock Filter Selector */}
        <select
          value={stockFilter}
          onChange={e => {
            sound.playClick();
            setStockFilter(e.target.value as any);
          }}
          className={`border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden transition ${
            stockFilter !== 'ALL'
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
              : 'bg-slate-950 border-slate-700 text-slate-300'
          }`}
        >
          <option value="ALL">Stock Status: All Products</option>
          <option value="BELOW_THRESHOLD">⚠️ All Below Threshold ({lowStockStats.totalBelowThreshold})</option>
          <option value="LOW_STOCK">🟡 Low Stock Warning ({lowStockStats.lowStock})</option>
          <option value="OUT_OF_STOCK">🔴 Critical Out of Stock ({lowStockStats.outOfStock})</option>
          <option value="HEALTHY">🟢 In Safety Range ({lowStockStats.healthy})</option>
        </select>

        {/* Low stock toggle quick button */}
        <button
          onClick={() => {
            sound.playClick();
            setStockFilter(prev => (prev === 'BELOW_THRESHOLD' ? 'ALL' : 'BELOW_THRESHOLD'));
          }}
          className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
            stockFilter === 'BELOW_THRESHOLD'
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-xs'
              : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Low Stock ({lowStockStats.totalBelowThreshold})</span>
        </button>
      </div>

      {/* Catalog Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">SKU / Barcode</th>
                <th className="p-3.5">Product & Visual</th>
                <th className="p-3.5">Cost / Price</th>
                <th className="p-3.5">Stock & Threshold Buffer</th>
                <th className="p-3.5">Alert Warning Status</th>
                <th className="p-3.5">Total Valuation</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No products match the selected filters or search query.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(prod => {
                  const isOutOfStock = prod.stockQuantity <= 0;
                  const isLow = prod.stockQuantity <= prod.minStockLevel;
                  const margin =
                    prod.sellingPrice > 0
                      ? (((prod.sellingPrice - prod.purchaseCost) / prod.sellingPrice) * 100).toFixed(1)
                      : '0.0';
                  const valuation = (prod.stockQuantity * prod.purchaseCost).toFixed(2);

                  // Buffer percentage for safety gauge
                  const targetLevel = Math.max(1, prod.minStockLevel * 2);
                  const safetyPct = Math.min(100, Math.max(0, Math.round((prod.stockQuantity / targetLevel) * 100)));

                  return (
                    <tr
                      key={prod.id}
                      className={`transition ${
                        isOutOfStock
                          ? 'bg-rose-950/20 border-l-4 border-l-rose-500 hover:bg-rose-950/30'
                          : isLow
                          ? 'bg-amber-950/20 border-l-4 border-l-amber-500 hover:bg-amber-950/30'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* SKU / Barcode */}
                      <td className="p-3.5 font-mono">
                        <div className="font-bold text-white">{prod.sku}</div>
                        <div className="text-[10px] text-slate-500">{prod.barcode}</div>
                      </td>

                      {/* Product Name & Visual Thumbnail */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          {/* Product Thumbnail with Click-to-Manage Image */}
                          <button
                            type="button"
                            id={`btn-thumb-${prod.id}`}
                            onClick={() => {
                              sound.playClick();
                              setSelectedImageProduct(prod);
                            }}
                            title="Manage product image (Link URL or generate with AI)"
                            className="group relative w-11 h-11 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shrink-0 hover:border-sky-500 transition shadow-inner flex items-center justify-center cursor-pointer"
                          >
                            {prod.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={prod.image}
                                alt={prod.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transition duration-200 group-hover:scale-110"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex flex-col items-center justify-center text-[10px] font-bold"
                                style={{
                                  backgroundColor: `${categories.find(c => c.id === prod.categoryId)?.color || '#0284c7'}25`,
                                  color: categories.find(c => c.id === prod.categoryId)?.color || '#38bdf8',
                                }}
                              >
                                <span>{prod.name.slice(0, 2).toUpperCase()}</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <Camera className="w-3.5 h-3.5" />
                            </div>
                          </button>

                          <div>
                            <div
                              onClick={() => {
                                sound.playClick();
                                setSelectedImageProduct(prod);
                              }}
                              className="font-bold text-white text-xs hover:text-sky-300 transition cursor-pointer leading-tight"
                            >
                              {prod.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold border"
                                style={{
                                  backgroundColor: `${categories.find(c => c.id === prod.categoryId)?.color || '#0284c7'}15`,
                                  borderColor: `${categories.find(c => c.id === prod.categoryId)?.color || '#0284c7'}40`,
                                  color: '#f8fafc',
                                }}
                              >
                                {categories.find(c => c.id === prod.categoryId)?.name || 'General'}
                              </span>
                              <span className="text-[10px] text-slate-400 capitalize">• {prod.unit}s</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cost / Price */}
                      <td className="p-3.5 font-mono">
                        <div className="text-slate-400">
                          {currentLocation.currencySymbol}{prod.purchaseCost.toFixed(2)} cost
                        </div>
                        <div className="font-bold text-emerald-400">
                          {currentLocation.currencySymbol}{prod.sellingPrice.toFixed(2)} ({margin}%)
                        </div>
                      </td>

                      {/* Stock & Threshold Buffer */}
                      <td className="p-3.5 font-mono">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className={isOutOfStock ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-white'}>
                            {prod.stockQuantity} {prod.unit}s
                          </span>
                          <span className="text-slate-400 text-[10px] font-normal">
                            Min Threshold: {prod.minStockLevel}
                          </span>
                        </div>

                        {/* Safety Buffer Meter Bar */}
                        <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${safetyPct}%` }}
                            className={`h-full transition-all duration-300 rounded-full ${
                              isOutOfStock
                                ? 'bg-rose-500'
                                : isLow
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                        </div>

                        {/* Deficit / Buffer indicator */}
                        <div className="text-[9.5px] mt-0.5">
                          {isOutOfStock ? (
                            <span className="text-rose-400 font-bold">
                              Deficit: -{prod.minStockLevel} {prod.unit}s below minimum
                            </span>
                          ) : isLow ? (
                            <span className="text-amber-400 font-bold">
                              Deficit: -{prod.minStockLevel - prod.stockQuantity} {prod.unit}s below minimum
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Buffer: +{prod.stockQuantity - prod.minStockLevel} over minimum
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Alert Warning Status Column with Visual Warning Badge */}
                      <td className="p-3.5">
                        {isOutOfStock ? (
                          <span
                            id={`badge-out-of-stock-${prod.id}`}
                            className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1.5 shadow-xs shadow-rose-950/50"
                          >
                            <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                            <span>CRITICAL OUT OF STOCK</span>
                          </span>
                        ) : isLow ? (
                          <span
                            id={`badge-low-stock-${prod.id}`}
                            className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1.5 shadow-xs shadow-amber-950/50"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>LOW STOCK WARNING</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 inline-flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>IN SAFETY RANGE</span>
                          </span>
                        )}
                      </td>

                      {/* Total Valuation */}
                      <td className="p-3.5 font-mono text-slate-300">
                        {currentLocation.currencySymbol}{valuation}
                      </td>

                      {/* Action buttons */}
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          id={`manage-image-btn-${prod.id}`}
                          onClick={() => {
                            sound.playClick();
                            setSelectedImageProduct(prod);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 hover:text-white text-[11px] font-semibold transition inline-flex items-center gap-1"
                          title="Link product image or generate AI imagery"
                        >
                          <ImageIcon className="w-3 h-3" />
                          Image
                        </button>
                        {isLow && (
                          <button
                            id={`quick-restock-btn-${prod.id}`}
                            onClick={() => handleOpenQuickRestock(prod)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black transition inline-flex items-center gap-1 shadow-xs"
                            title="Quick replenish up to safety threshold"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            Restock
                          </button>
                        )}
                        <button
                          onClick={() => {
                            sound.playClick();
                            setAdjustingProduct(prod);
                            setAdjustQuantity(0);
                            setAdjustReason('Cycle count recount');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => {
                            sound.playClick();
                            setLedgerProduct(prod);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 text-[11px] font-semibold transition inline-flex items-center gap-1"
                          title="Inspect Inventory Truth Ledger"
                        >
                          <History className="w-3 h-3" />
                          Ledger
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Ledger Inspection Drawer / Modal ("Why does this product show X units?") */}
      {ledgerProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{ledgerProduct.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                    SKU: {ledgerProduct.sku}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inventory Truth Ledger — Every historical movement explaining the current balance of{' '}
                  <strong className="text-emerald-400 font-mono">{ledgerProduct.stockQuantity} units</strong>.
                </p>
              </div>
              <button
                onClick={() => setLedgerProduct(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {productMovements.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No recorded ledger movements for this item.
                </div>
              ) : (
                <div className="space-y-2">
                  {productMovements.map(mov => (
                    <div
                      key={mov.id}
                      className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              mov.movementType === 'SALE'
                                ? 'bg-amber-500/20 text-amber-300'
                                : mov.movementType === 'PURCHASE_RECEIPT'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : mov.movementType === 'SALE_RETURN'
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {mov.movementType}
                          </span>
                          {mov.referenceId && (
                            <span className="text-slate-400 font-medium">Ref: {mov.referenceId}</span>
                          )}
                        </div>
                        <div className="text-slate-400 text-[11px] font-sans">{mov.reasonCode}</div>
                        <div className="text-[10px] text-slate-500">
                          By {mov.createdBy} • {new Date(mov.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div
                          className={`text-base font-black ${
                            mov.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                        </div>
                        <div className="text-[10px] text-slate-500">Cost: ${mov.unitCost.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 text-right">
              <button
                onClick={() => setLedgerProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form onSubmit={handleConfirmAdjustment} className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 bg-slate-950/80">
              <h3 className="text-base font-bold text-white">Adjust Stock: {adjustingProduct.name}</h3>
              <p className="text-xs text-slate-400">Current recorded balance: <strong className="text-white font-mono">{adjustingProduct.stockQuantity}</strong></p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Quantity Delta (+/-) *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustQuantity(prev => prev - 1)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-mono"
                  >
                    -1
                  </button>
                  <input
                    type="number"
                    required
                    value={adjustQuantity}
                    onChange={e => setAdjustQuantity(parseInt(e.target.value) || 0)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-lg font-mono font-bold text-white focus:outline-hidden focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustQuantity(prev => prev + 1)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-mono"
                  >
                    +1
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5 font-mono">
                  New calculated balance:{' '}
                  <strong className="text-sky-400">
                    {adjustingProduct.stockQuantity + adjustQuantity} units
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Adjustment Reason Code *
                </label>
                <select
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden"
                >
                  <option value="Cycle count recount">Cycle count recount</option>
                  <option value="Damaged during shipping">Damaged during shipping</option>
                  <option value="Spoilage / Expired ingredient">Spoilage / Expired ingredient</option>
                  <option value="Customer promotional sample">Customer promotional sample</option>
                  <option value="Shrinkage / Unaccounted loss">Shrinkage / Unaccounted loss</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjustQuantity === 0}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Ledger Adjustment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Product Modal */}
      {isNewProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form onSubmit={handleCreateProduct} className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 bg-slate-950/80">
              <h3 className="text-base font-bold text-white">Add Catalog Product</h3>
              <p className="text-xs text-slate-400">Configure new inventory item or retail SKU</p>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Vanilla Bean Chai Tea"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={e => setNewSku(e.target.value)}
                    placeholder="e.g. TEA-VBC-01"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white focus:outline-hidden focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={newBarcode}
                    onChange={e => setNewBarcode(e.target.value)}
                    placeholder="Auto-generated if blank"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Sales Unit
                  </label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    placeholder="piece, cup, bag..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Cost Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newCost}
                    onChange={e => setNewCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Selling Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Initial Stock Count
                  </label>
                  <input
                    type="number"
                    value={newInitialStock}
                    onChange={e => setNewInitialStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={e => setNewMinStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Product Image URL or Quick Auto-Fill */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-wider">
                    Product Image URL (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      const matched = matchCuratedPreset(newName, newCategory);
                      if (matched) {
                        setNewImage(matched.url);
                      } else {
                        const catObj = categories.find(c => c.id === newCategory);
                        const svgData = generateVectorPlaceholder({
                          name: newName || 'Catalog Product',
                          sku: newSku || 'SKU',
                          categoryName: catObj?.name,
                          themeColor: catObj?.color,
                        });
                        setNewImage(svgData);
                      }
                    }}
                    className="text-[10.5px] text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <Wand2 className="w-3 h-3" /> Auto-Detect Preset
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                    {newImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={newImage}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                  <input
                    type="url"
                    value={newImage}
                    onChange={e => setNewImage(e.target.value)}
                    placeholder="https://... or click Auto-Detect Preset"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewProductModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Catalog Item
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Inventory CSV Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        products={products}
        categories={categories}
        currentLocation={currentLocation}
        currentUser={currentUser}
        onSuccess={async () => {
          await onRefreshData();
        }}
      />

      {/* Product Image Linking & AI Generation Modal */}
      <ProductImageModal
        isOpen={!!selectedImageProduct}
        product={selectedImageProduct}
        category={categories.find(c => c.id === selectedImageProduct?.categoryId)}
        onClose={() => setSelectedImageProduct(null)}
        onSave={async () => {
          await onRefreshData();
        }}
      />
    </div>
  );
};
