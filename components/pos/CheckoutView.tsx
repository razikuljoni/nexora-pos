'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Barcode,
  ShoppingBag,
  Trash2,
  Tag,
  Clock,
  User,
  Plus,
  Minus,
  Check,
  Percent,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type {
  Product,
  Category,
  CartItem,
  Customer,
  SelectedModifier,
  HeldOrder,
  Sale,
  Location,
  Register,
  User as StaffUser,
  BusinessMode,
} from '@/lib/types';
import { sound } from '@/lib/audio';
import { completeSale, holdCurrentOrder, deleteHeldOrder } from '@/lib/services/posService';
import { ModifierModal } from './ModifierModal';
import { ScannerModal } from './ScannerModal';
import { PaymentModal } from './PaymentModal';
import { ReceiptModal } from './ReceiptModal';
import { HeldOrdersDrawer } from './HeldOrdersDrawer';
import { CustomerSelectModal } from './CustomerSelectModal';

interface CheckoutViewProps {
  products: Product[];
  categories: Category[];
  currentLocation: Location;
  currentRegister: Register;
  currentUser: StaffUser;
  businessMode: BusinessMode;
  isOffline: boolean;
  heldOrders: HeldOrder[];
  customers: Customer[];
  onRefreshData: () => Promise<void>;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  products,
  categories,
  currentLocation,
  currentRegister,
  currentUser,
  businessMode,
  isOffline,
  heldOrders,
  customers,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'COUNTER' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('COUNTER');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined);
  const [wholeCartDiscountPercent, setWholeCartDiscountPercent] = useState<number>(0);

  // Modals state
  const [activeModifierProduct, setActiveModifierProduct] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isHeldDrawerOpen, setIsHeldDrawerOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter products by mode, category, search tokens
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!p.active) return false;
      if (businessMode === 'CAFE' && p.categoryId === 'cat_merch' && selectedCategory !== 'cat_merch') {
        // Cafe mode prioritizes food/drink
      }
      if (selectedCategory !== 'ALL' && p.categoryId !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
      );
    });
  }, [products, businessMode, selectedCategory, searchQuery]);

  // Handle adding product to cart
  const handleProductClick = (product: Product) => {
    sound.playClick();
    if (product.modifierGroups && product.modifierGroups.length > 0) {
      setActiveModifierProduct(product);
      return;
    }

    addItemToCart(product, [], undefined);
  };

  const addItemToCart = (product: Product, modifiers: SelectedModifier[], notes?: string) => {
    const modifierExtra = modifiers.reduce((acc, m) => acc + m.priceDelta, 0);
    const unitPrice = product.sellingPrice + modifierExtra;

    setCartItems(prev => {
      // Check if exact same product with same modifiers and notes already in cart
      const existingIdx = prev.findIndex(
        it =>
          it.productId === product.id &&
          it.notes === notes &&
          JSON.stringify(it.selectedModifiers || []) === JSON.stringify(modifiers || [])
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const item = updated[existingIdx];
        const newQty = item.quantity + 1;
        const discountAmt = (unitPrice * newQty * item.discountPercentage) / 100;
        const taxAmt = (unitPrice * newQty - discountAmt) * product.taxRate;
        const total = unitPrice * newQty - discountAmt + taxAmt;

        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          discountAmount: discountAmt,
          taxAmount: taxAmt,
          total,
        };
        return updated;
      } else {
        const discountAmt = 0;
        const taxAmt = unitPrice * product.taxRate;
        const total = unitPrice + taxAmt;

        const newItem: CartItem = {
          cartItemId: `ci_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice,
          purchaseCost: product.purchaseCost,
          quantity: 1,
          discountPercentage: 0,
          discountAmount: discountAmt,
          taxAmount: taxAmt,
          total,
          notes,
          selectedModifiers: modifiers,
          preparationStation: product.preparationStation,
        };
        return [...prev, newItem];
      }
    });
  };

  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    sound.playClick();
    setCartItems(prev =>
      prev
        .map(item => {
          if (item.cartItemId !== cartItemId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;

          const lineSub = item.unitPrice * newQty;
          const discountAmt = (lineSub * item.discountPercentage) / 100;
          const taxAmt = (lineSub - discountAmt) * (item.taxAmount / Math.max(1, item.unitPrice * item.quantity));
          const total = lineSub - discountAmt + taxAmt;

          return {
            ...item,
            quantity: newQty,
            discountAmount: discountAmt,
            taxAmount: taxAmt,
            total,
          };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    sound.playClick();
    setCartItems(prev => prev.filter(it => it.cartItemId !== cartItemId));
  };

  const handleApplyLineDiscount = (cartItemId: string, percent: number) => {
    sound.playClick();
    setCartItems(prev =>
      prev.map(item => {
        if (item.cartItemId !== cartItemId) return item;
        const lineSub = item.unitPrice * item.quantity;
        const discountAmt = (lineSub * percent) / 100;
        const taxRate = item.taxAmount / Math.max(1, item.unitPrice * item.quantity);
        const taxAmt = (lineSub - discountAmt) * taxRate;
        const total = lineSub - discountAmt + taxAmt;

        return {
          ...item,
          discountPercentage: percent,
          discountAmount: discountAmt,
          taxAmount: taxAmt,
          total,
        };
      })
    );
  };

  // Cart Calculations
  const subtotalBeforeDiscounts = cartItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const lineDiscountTotal = cartItems.reduce((acc, it) => acc + it.discountAmount, 0);
  const cartLevelDiscountAmt = ((subtotalBeforeDiscounts - lineDiscountTotal) * wholeCartDiscountPercent) / 100;
  const totalDiscounts = lineDiscountTotal + cartLevelDiscountAmt;
  const subtotalAfterDiscounts = Math.max(0, subtotalBeforeDiscounts - totalDiscounts);
  const totalTax = cartItems.reduce((acc, it) => acc + it.taxAmount, 0);
  const grandTotal = Number((subtotalAfterDiscounts + totalTax).toFixed(2));

  // Hold Order Action
  const handleHoldOrder = async () => {
    if (cartItems.length === 0) return;
    sound.playClick();

    const title = selectedCustomer
      ? `${selectedCustomer.name} (${cartItems.length} items)`
      : `${orderType} #${Math.floor(100 + Math.random() * 900)}`;

    await holdCurrentOrder(
      title,
      cartItems,
      grandTotal,
      orderType,
      currentUser.id,
      currentRegister.id,
      selectedCustomer?.name,
      selectedCustomer?.id
    );

    setCartItems([]);
    setSelectedCustomer(undefined);
    setWholeCartDiscountPercent(0);
    await onRefreshData();
  };

  const handleResumeHeldOrder = (order: HeldOrder) => {
    sound.playClick();
    setCartItems(order.items);
    setOrderType(order.orderType);
    if (order.customerId) {
      const cust = customers.find(c => c.id === order.customerId);
      setSelectedCustomer(cust);
    }
    deleteHeldOrder(order.id);
    setIsHeldDrawerOpen(false);
    onRefreshData();
  };

  const handleHoldOrderRef = useRef(handleHoldOrder);
  const cartItemsCountRef = useRef(cartItems.length);

  useEffect(() => {
    handleHoldOrderRef.current = handleHoldOrder;
    cartItemsCountRef.current = cartItems.length;
  });

  // Keyboard Shortcuts (F2 search, F4 customer, F6 hold, F8 payment, Esc clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setIsCustomerModalOpen(true);
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (cartItemsCountRef.current > 0) handleHoldOrderRef.current();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cartItemsCountRef.current > 0) setIsPaymentOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Barcode scanned
  const handleBarcodeScanned = (barcode: string) => {
    const found = products.find(p => p.barcode === barcode || p.sku.toLowerCase() === barcode.toLowerCase());
    if (found) {
      sound.playScanBeep();
      if (found.modifierGroups && found.modifierGroups.length > 0) {
        setActiveModifierProduct(found);
      } else {
        addItemToCart(found, [], undefined);
      }
    } else {
      sound.playError();
    }
  };

  // Complete Payment Action
  const handleCompleteSale = async (payments: any[]) => {
    try {
      const sale = await completeSale({
        organizationId: 'org_nexora',
        locationId: currentLocation.id,
        registerId: currentRegister.id,
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        items: cartItems,
        subtotal: subtotalBeforeDiscounts,
        discountTotal: totalDiscounts,
        taxTotal: totalTax,
        total: grandTotal,
        payments,
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
        isOffline,
      });

      setLastCompletedSale(sale);
      setIsPaymentOpen(false);
      setIsReceiptOpen(true);
      setCartItems([]);
      setSelectedCustomer(undefined);
      setWholeCartDiscountPercent(0);
      setTableNumber('');
      await onRefreshData();
    } catch (err) {
      console.error('[CheckoutView] Sale completion error:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
      {/* LEFT / CENTER: Catalog & Fast Product Search Column */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800 bg-slate-950">
        {/* Top Control Bar: Search, Barcode trigger, Category pills */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/40">
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products by name, SKU, or brand (F2)..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Barcode scanner action button */}
            <button
              onClick={() => {
                sound.playClick();
                setIsScannerOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 hover:text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
              title="Open Barcode & Optical Scanner"
            >
              <Barcode className="w-4 h-4" />
              <span className="hidden sm:inline">Scan Barcode</span>
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => {
                sound.playClick();
                setSelectedCategory('ALL');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  sound.playClick();
                  setSelectedCategory(cat.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-800/60 hover:bg-slate-700 text-slate-300 border border-slate-700/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center space-y-2">
              <ShoppingBag className="w-10 h-10 text-slate-600 stroke-1" />
              <div className="text-sm font-medium text-slate-400">No products matching your search</div>
              <p className="text-xs max-w-xs">Try clearing search filters or scanning a valid item barcode.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map(prod => {
                const isLowStock = prod.stockQuantity <= prod.minStockLevel;
                const hasModifiers = prod.modifierGroups && prod.modifierGroups.length > 0;
                return (
                  <button
                    key={prod.id}
                    onClick={() => handleProductClick(prod)}
                    className="bg-slate-900/90 hover:bg-slate-850 active:scale-[0.98] border border-slate-800 hover:border-sky-500/50 rounded-xl p-3 text-left flex flex-col justify-between transition-all duration-150 group shadow-sm hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-mono font-semibold text-slate-500 group-hover:text-sky-400">
                          {prod.sku}
                        </span>
                        {hasModifiers ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300">
                            Custom
                          </span>
                        ) : (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                              isLowStock
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {prod.stockQuantity} in stock
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-xs text-white line-clamp-2 leading-snug group-hover:text-sky-200">
                        {prod.name}
                      </h3>
                      {prod.description && (
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">
                          {prod.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="font-black font-mono text-sm text-emerald-400">
                        {currentLocation.currencySymbol}{prod.sellingPrice.toFixed(2)}
                      </span>
                      <span className="p-1 rounded-md bg-slate-800 group-hover:bg-sky-500 group-hover:text-white text-slate-400 transition">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Current Cart & Payment Summary Column */}
      <div className="w-full lg:w-96 xl:w-[420px] bg-slate-900 border-t lg:border-t-0 border-slate-800 flex flex-col shrink-0">
        {/* Cart Top Bar: Order Type, Table, Customer */}
        <div className="p-3.5 border-b border-slate-800 space-y-2 bg-slate-950/60">
          <div className="flex items-center justify-between gap-2">
            {/* Order Type Selector */}
            <div className="grid grid-cols-4 gap-1 flex-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
              {(['COUNTER', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    sound.playClick();
                    setOrderType(type);
                  }}
                  className={`py-1.5 rounded-lg uppercase tracking-wider transition ${
                    orderType === type
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type === 'COUNTER' ? 'Counter' : type === 'DINE_IN' ? 'Dine In' : type === 'TAKEAWAY' ? 'Takeout' : 'Delivery'}
                </button>
              ))}
            </div>

            {/* Table number if dine-in */}
            {orderType === 'DINE_IN' && (
              <input
                type="text"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                placeholder="Table #"
                className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-hidden"
              />
            )}
          </div>

          {/* Customer Attachment Bar */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <button
              onClick={() => {
                sound.playClick();
                setIsCustomerModalOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                selectedCustomer
                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              {selectedCustomer ? (
                <span>
                  {selectedCustomer.name} ({selectedCustomer.points} pts)
                </span>
              ) : (
                <span>Attach Customer (F4)</span>
              )}
            </button>

            {/* Held Orders quick badge */}
            <button
              onClick={() => {
                sound.playClick();
                setIsHeldDrawerOpen(true);
              }}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Held ({heldOrders.length})</span>
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-2">
          {cartItems.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-center space-y-2">
              <ShoppingBag className="w-9 h-9 text-slate-600 stroke-1" />
              <div className="text-xs font-semibold text-slate-400">Cart is empty</div>
              <p className="text-[11px] text-slate-500 max-w-[200px]">
                Scan a barcode or click products from the catalog to begin.
              </p>
            </div>
          ) : (
            cartItems.map(item => (
              <div
                key={item.cartItemId}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-xs text-white leading-snug">{item.name}</h4>
                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                      <div className="text-[10px] text-sky-400 mt-0.5 space-y-0.5">
                        {item.selectedModifiers.map(m => (
                          <div key={m.optionId}>+ {m.optionName} ({currentLocation.currencySymbol}{m.priceDelta.toFixed(2)})</div>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px] text-slate-400 italic mt-0.5">
                        &quot;{item.notes}&quot;
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      {currentLocation.currencySymbol}{item.unitPrice.toFixed(2)} / unit
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-sm text-white">
                      {currentLocation.currencySymbol}{item.total.toFixed(2)}
                    </div>
                    {item.discountAmount > 0 && (
                      <div className="text-[10px] text-emerald-400 font-mono">
                        -{currentLocation.currencySymbol}{item.discountAmount.toFixed(2)} ({item.discountPercentage}%)
                      </div>
                    )}
                  </div>
                </div>

                {/* Quantity Controls & Line Discount */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-700/40">
                  <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-700/50">
                    <button
                      onClick={() => handleUpdateQuantity(item.cartItemId, -1)}
                      className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-xs text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.cartItemId, 1)}
                      className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Line discount buttons */}
                  <div className="flex items-center gap-1">
                    {[5, 10].map(pct => (
                      <button
                        key={pct}
                        onClick={() => handleApplyLineDiscount(item.cartItemId, item.discountPercentage === pct ? 0 : pct)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                          item.discountPercentage === pct
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                    <button
                      onClick={() => handleRemoveItem(item.cartItemId)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition ml-1"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Financial Summary & Actions Box */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
          {/* Order-level Discount Pills */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">Cart Discount:</span>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              {[0, 5, 10, 15].map(pct => (
                <button
                  key={pct}
                  onClick={() => {
                    sound.playClick();
                    setWholeCartDiscountPercent(pct);
                  }}
                  className={`px-2 py-0.5 rounded-md font-semibold transition ${
                    wholeCartDiscountPercent === pct
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {pct === 0 ? 'None' : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Subtotal, Tax, Total */}
          <div className="space-y-1 text-xs text-slate-400 border-t border-slate-800/80 pt-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-200">
                {currentLocation.currencySymbol}{subtotalBeforeDiscounts.toFixed(2)}
              </span>
            </div>
            {totalDiscounts > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discounts:</span>
                <span className="font-mono">
                  -{currentLocation.currencySymbol}{totalDiscounts.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax ({(currentLocation.taxRate * 100).toFixed(2)}%):</span>
              <span className="font-mono text-slate-200">
                {currentLocation.currencySymbol}{totalTax.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-white pt-1.5 border-t border-slate-800">
              <span className="uppercase tracking-wider">Total Payable:</span>
              <span className="font-mono text-emerald-400 text-xl">
                {currentLocation.currencySymbol}{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Buttons: Hold, Clear, Charge */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <button
              onClick={handleHoldOrder}
              disabled={cartItems.length === 0}
              className="py-3 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-bold text-xs flex flex-col items-center justify-center transition border border-slate-700"
              title="Suspend this cart to serve next customer (F6)"
            >
              <Clock className="w-4 h-4 mb-0.5" />
              <span>Hold (F6)</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setCartItems([]);
                setSelectedCustomer(undefined);
                setWholeCartDiscountPercent(0);
              }}
              disabled={cartItems.length === 0}
              className="py-3 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-rose-400 font-bold text-xs flex flex-col items-center justify-center transition border border-slate-700"
              title="Clear cart items"
            >
              <Trash2 className="w-4 h-4 mb-0.5" />
              <span>Clear</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setIsPaymentOpen(true);
              }}
              disabled={cartItems.length === 0}
              className="col-span-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition active:scale-[0.98]"
            >
              <span>CHARGE (F8)</span>
              <span className="font-mono text-xs bg-emerald-700 px-2 py-0.5 rounded-md">
                {currentLocation.currencySymbol}{grandTotal.toFixed(2)}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Modals */}
      <ModifierModal
        isOpen={!!activeModifierProduct}
        product={activeModifierProduct}
        currencySymbol={currentLocation.currencySymbol}
        onConfirm={(prod, mods, notes) => {
          addItemToCart(prod, mods, notes);
          setActiveModifierProduct(null);
        }}
        onClose={() => setActiveModifierProduct(null)}
      />

      <ScannerModal
        isOpen={isScannerOpen}
        onScan={handleBarcodeScanned}
        onClose={() => setIsScannerOpen(false)}
      />

      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        customers={customers}
        selectedCustomerId={selectedCustomer?.id}
        onSelectCustomer={cust => setSelectedCustomer(cust)}
        onCustomerCreated={newCust => onRefreshData()}
        onClose={() => setIsCustomerModalOpen(false)}
      />

      <HeldOrdersDrawer
        isOpen={isHeldDrawerOpen}
        heldOrders={heldOrders}
        currencySymbol={currentLocation.currencySymbol}
        onResume={handleResumeHeldOrder}
        onDelete={async id => {
          await deleteHeldOrder(id);
          await onRefreshData();
        }}
        onClose={() => setIsHeldDrawerOpen(false)}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        total={grandTotal}
        currencySymbol={currentLocation.currencySymbol}
        onComplete={handleCompleteSale}
        onClose={() => setIsPaymentOpen(false)}
      />

      <ReceiptModal
        isOpen={isReceiptOpen}
        sale={lastCompletedSale}
        location={currentLocation}
        onClose={() => setIsReceiptOpen(false)}
        onNewSale={() => {
          setIsReceiptOpen(false);
          setLastCompletedSale(null);
        }}
      />
    </div>
  );
};
