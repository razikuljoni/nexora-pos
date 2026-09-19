'use client';

import React, { useState } from 'react';
import {
  Package,
  Search,
  Plus,
  ArrowUpDown,
  History,
  AlertTriangle,
  FileSpreadsheet,
  X,
  Check,
  Filter,
} from 'lucide-react';
import type { Product, Category, InventoryMovement, Location, User as StaffUser } from '@/lib/types';
import { db } from '@/lib/db';
import { adjustStock } from '@/lib/services/inventoryService';
import { sound } from '@/lib/audio';

interface InventoryViewProps {
  products: Product[];
  categories: Category[];
  movements: InventoryMovement[];
  currentLocation: Location;
  currentUser: StaffUser;
  onRefreshData: () => Promise<void>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  categories,
  movements,
  currentLocation,
  currentUser,
  onRefreshData,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modals & Drawers
  const [ledgerProduct, setLedgerProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Cycle count recount');
  const [isNewProductModal, setIsNewProductModal] = useState(false);

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

  const filteredProducts = products.filter(p => {
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
            Explainable stock movements, live valuation, cycle counts, and immutable ledger auditing.
          </p>
        </div>

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

        {/* Low stock toggle button */}
        <button
          onClick={() => setOnlyLowStock(!onlyLowStock)}
          className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
            onlyLowStock
              ? 'bg-rose-500/20 border-rose-500 text-rose-300'
              : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Low Stock Only
        </button>
      </div>

      {/* Catalog Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">SKU / Barcode</th>
                <th className="p-3.5">Product Name</th>
                <th className="p-3.5">Cost</th>
                <th className="p-3.5">Selling Price</th>
                <th className="p-3.5">Margin</th>
                <th className="p-3.5">Stock Level</th>
                <th className="p-3.5">Total Valuation</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.map(prod => {
                const isLow = prod.stockQuantity <= prod.minStockLevel;
                const margin =
                  prod.sellingPrice > 0
                    ? (((prod.sellingPrice - prod.purchaseCost) / prod.sellingPrice) * 100).toFixed(1)
                    : '0.0';
                const valuation = (prod.stockQuantity * prod.purchaseCost).toFixed(2);

                return (
                  <tr key={prod.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-mono">
                      <div className="font-bold text-white">{prod.sku}</div>
                      <div className="text-[10px] text-slate-500">{prod.barcode}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{prod.name}</div>
                      <div className="text-[10px] text-slate-400">{prod.unit}</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">
                      {currentLocation.currencySymbol}{prod.purchaseCost.toFixed(2)}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      {currentLocation.currencySymbol}{prod.sellingPrice.toFixed(2)}
                    </td>
                    <td className="p-3.5 font-mono text-sky-400 font-medium">{margin}%</td>
                    <td className="p-3.5 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[11px] inline-flex items-center gap-1 ${
                          isLow
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        }`}
                      >
                        {isLow && <AlertTriangle className="w-3 h-3" />}
                        {prod.stockQuantity} {prod.unit}s
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {currentLocation.currencySymbol}{valuation}
                    </td>
                    <td className="p-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => {
                          sound.playClick();
                          setAdjustingProduct(prod);
                          setAdjustQuantity(0);
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
              })}
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
    </div>
  );
};
