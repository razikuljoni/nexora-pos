'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  ShoppingBag,
  Clock,
  Package,
  FileText,
  Settings,
  Zap,
  Printer,
  RotateCcw,
  Barcode,
  Trash2,
  PauseCircle,
  PlayCircle,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Store,
  User,
  Coins,
  Sparkles,
  Check,
  ArrowRight,
  Percent,
  ShieldCheck,
  RefreshCw,
  Plus,
  AlertTriangle,
  Download,
  CornerDownLeft,
  Tag,
  X,
  Layers,
  ChevronRight,
  LayoutDashboard,
  Flame,
} from 'lucide-react';
import { sound } from '@/lib/audio';
import { motion, AnimatePresence } from 'motion/react';
import type {
  Product,
  Category,
  Location,
  Register,
  User as StaffUser,
  BusinessMode,
} from '@/lib/types';

export type PaletteCategoryFilter = 'ALL' | 'PRODUCTS' | 'TABS' | 'ACTIONS';

export interface CommandItem {
  id: string;
  type: 'PRODUCT' | 'TAB' | 'ACTION' | 'LOCATION' | 'USER';
  title: string;
  subtitle: string;
  categoryLabel?: string;
  badge?: string;
  shortcut?: string;
  icon: React.ReactNode;
  keywords?: string[];
  product?: Product;
  tab?: 'checkout' | 'shifts' | 'inventory' | 'orders' | 'dashboard' | 'settings';
  actionId?: string;
  payload?: any;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  // Core Data
  products: Product[];
  categories: Category[];
  locations: Location[];
  currentLocation: Location;
  registers: Register[];
  currentRegister: Register;
  users: StaffUser[];
  currentUser: StaffUser;
  businessMode: BusinessMode;
  activeTab: 'checkout' | 'shifts' | 'inventory' | 'orders' | 'dashboard' | 'settings';
  // State Handlers
  onSelectTab: (tab: 'checkout' | 'shifts' | 'inventory' | 'orders' | 'dashboard' | 'settings') => void;
  onAddProductToCart: (product: Product) => void;
  onQuickAction: (actionId: string, payload?: any) => void;
  // Status
  isActuallyOffline: boolean;
  audioMuted: boolean;
  cartItemsCount: number;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  products,
  categories,
  locations,
  currentLocation,
  registers,
  currentRegister,
  users,
  currentUser,
  businessMode,
  activeTab,
  onSelectTab,
  onAddProductToCart,
  onQuickAction,
  isActuallyOffline,
  audioMuted,
  cartItemsCount,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<PaletteCategoryFilter>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Category ID to Name mapping for rapid lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Build static Tab Navigation items
  const tabItems: CommandItem[] = useMemo(() => {
    return [
      {
        id: 'tab_checkout',
        type: 'TAB',
        title: 'Checkout POS',
        subtitle: 'Active cart, barcode scanner, item catalog & payments',
        badge: activeTab === 'checkout' ? 'Current Tab' : undefined,
        shortcut: 'F1',
        icon: <ShoppingBag className="w-4 h-4 text-sky-400" />,
        tab: 'checkout',
        keywords: ['pos', 'checkout', 'register', 'cart', 'cashier', 'sale', 'counter'],
      },
      {
        id: 'tab_shifts',
        type: 'TAB',
        title: 'Shift & Cash Drawer',
        subtitle: 'Opening float, cash drops, paid in/out & Z-Report reconciliation',
        badge: activeTab === 'shifts' ? 'Current Tab' : undefined,
        icon: <Clock className="w-4 h-4 text-amber-400" />,
        tab: 'shifts',
        keywords: ['shift', 'drawer', 'cash', 'z-report', 'x-report', 'float', 'reconcile', 'close shift'],
      },
      {
        id: 'tab_inventory',
        type: 'TAB',
        title: 'Inventory & Stock Ledger',
        subtitle: 'Live stock quantities, reorder alerts, adjustments & purchase orders',
        badge: activeTab === 'inventory' ? 'Current Tab' : undefined,
        icon: <Package className="w-4 h-4 text-emerald-400" />,
        tab: 'inventory',
        keywords: ['inventory', 'stock', 'ledger', 'catalog', 'skus', 'counts', 'reorder', 'supplies'],
      },
      {
        id: 'tab_orders',
        type: 'TAB',
        title: 'Orders & Completed Sales',
        subtitle: 'Transaction audit trail, receipts, itemized refunds & order history',
        badge: activeTab === 'orders' ? 'Current Tab' : undefined,
        icon: <FileText className="w-4 h-4 text-purple-400" />,
        tab: 'orders',
        keywords: ['orders', 'sales', 'receipts', 'returns', 'refunds', 'history', 'completed'],
      },
      {
        id: 'tab_dashboard',
        type: 'TAB',
        title: 'Manager Dashboard',
        subtitle: 'Customizable drag-and-drop analytics, sales heatmaps & low stock widgets',
        badge: activeTab === 'dashboard' ? 'Current Tab' : undefined,
        icon: <LayoutDashboard className="w-4 h-4 text-sky-400" />,
        tab: 'dashboard',
        keywords: ['dashboard', 'manager', 'analytics', 'widgets', 'heatmap', 'charts', 'kpis', 'reorder'],
      },
      {
        id: 'tab_settings',
        type: 'TAB',
        title: 'Settings & Peripherals',
        subtitle: 'Thermal print queue, scanner hardware, locations & registers',
        badge: activeTab === 'settings' ? 'Current Tab' : undefined,
        icon: <Settings className="w-4 h-4 text-indigo-400" />,
        tab: 'settings',
        keywords: ['settings', 'printers', 'hardware', 'peripherals', 'queue', 'devices', 'config'],
      },
    ];
  }, [activeTab]);

  // Build Quick Action items
  const actionItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      {
        id: 'action_open_manager_dashboard',
        type: 'ACTION',
        title: 'Open Manager Dashboard',
        subtitle: 'View customizable sales charts, velocity heatmaps & stock alerts',
        icon: <LayoutDashboard className="w-4 h-4 text-sky-400" />,
        actionId: 'OPEN_MANAGER_DASHBOARD',
        keywords: ['dashboard', 'manager', 'kpis', 'analytics', 'widgets'],
      },
      {
        id: 'action_no_sale_drawer',
        type: 'ACTION',
        title: 'Open Cash Drawer (No-Sale)',
        subtitle: 'Pop open the physical cash drawer and log event to audit trail',
        shortcut: 'Alt+D',
        icon: <Coins className="w-4 h-4 text-amber-400" />,
        actionId: 'NO_SALE_DRAWER_KICK',
        keywords: ['no sale', 'kick drawer', 'open drawer', 'cash box', 'pop drawer', 'money'],
      },
      {
        id: 'action_reprint_receipt',
        type: 'ACTION',
        title: 'Reprint Last Receipt',
        subtitle: 'Open thermal receipt slip preview & reprint for latest transaction',
        shortcut: 'Alt+P',
        icon: <Printer className="w-4 h-4 text-sky-400" />,
        actionId: 'REPRINT_LAST_RECEIPT',
        keywords: ['reprint', 'receipt', 'print last', 'ticket', 'thermal slip', 'paper'],
      },
      {
        id: 'action_barcode_scanner',
        type: 'ACTION',
        title: 'Open Camera Barcode Scanner',
        subtitle: 'Launch camera viewfinder to scan 1D UPC/EAN or QR codes',
        shortcut: 'F3',
        icon: <Barcode className="w-4 h-4 text-emerald-400" />,
        actionId: 'OPEN_SCANNER',
        keywords: ['scanner', 'camera', 'barcode', 'qr', 'upc', 'scan', 'webcam'],
      },
      {
        id: 'action_hold_cart',
        type: 'ACTION',
        title: 'Park / Hold Current Order',
        subtitle: cartItemsCount > 0
          ? `Park active cart with ${cartItemsCount} item(s) to retrieve later`
          : 'Hold current order (Cart is currently empty)',
        shortcut: 'F6',
        badge: cartItemsCount > 0 ? `${cartItemsCount} items in cart` : undefined,
        icon: <PauseCircle className="w-4 h-4 text-amber-400" />,
        actionId: 'HOLD_ORDER',
        keywords: ['hold', 'park', 'save cart', 'suspend', 'pause order'],
      },
      {
        id: 'action_view_held',
        type: 'ACTION',
        title: 'View Parked / Held Orders',
        subtitle: 'Browse list of suspended customer carts to resume or void',
        icon: <PlayCircle className="w-4 h-4 text-sky-400" />,
        actionId: 'VIEW_HELD_ORDERS',
        keywords: ['held orders', 'parked', 'resume cart', 'saved orders', 'retrieve'],
      },
      {
        id: 'action_quick_return',
        type: 'ACTION',
        title: 'Process Return or Refund',
        subtitle: 'Lookup order by receipt number or scan barcode to issue return',
        shortcut: 'Alt+R',
        icon: <RotateCcw className="w-4 h-4 text-rose-400" />,
        actionId: 'START_RETURN',
        keywords: ['return', 'refund', 'exchange', 'void sale', 'credit'],
      },
      {
        id: 'action_attach_customer',
        type: 'ACTION',
        title: 'Attach Customer / VIP Member',
        subtitle: 'Assign loyalty account to active transaction for member discounts',
        shortcut: 'F4',
        icon: <User className="w-4 h-4 text-teal-400" />,
        actionId: 'SELECT_CUSTOMER',
        keywords: ['customer', 'vip', 'loyalty', 'member', 'account', 'client'],
      },
      {
        id: 'action_discount_10',
        type: 'ACTION',
        title: 'Apply 10% Whole-Cart Discount',
        subtitle: 'Apply 10% promotional reduction across entire current order',
        icon: <Percent className="w-4 h-4 text-amber-400" />,
        actionId: 'APPLY_DISCOUNT',
        payload: { percent: 10 },
        keywords: ['discount 10', '10%', 'promo', 'coupon', 'ten percent'],
      },
      {
        id: 'action_discount_20',
        type: 'ACTION',
        title: 'Apply 20% Whole-Cart Discount',
        subtitle: 'Apply 20% manager discount across entire current order',
        icon: <Percent className="w-4 h-4 text-rose-400" />,
        actionId: 'APPLY_DISCOUNT',
        payload: { percent: 20 },
        keywords: ['discount 20', '20%', 'manager discount', 'coupon', 'twenty percent'],
      },
      {
        id: 'action_clear_cart',
        type: 'ACTION',
        title: 'Clear / Void Current Cart',
        subtitle: cartItemsCount > 0 ? `Remove all ${cartItemsCount} items from cart` : 'Empty cart',
        icon: <Trash2 className="w-4 h-4 text-rose-400" />,
        actionId: 'CLEAR_CART',
        keywords: ['clear cart', 'void cart', 'reset', 'empty cart', 'cancel order'],
      },
      {
        id: 'action_thermal_queue',
        type: 'ACTION',
        title: 'Thermal Print Queue & Spooler',
        subtitle: 'Inspect queued or failed ESC/POS print jobs, retry batch, check printer',
        icon: <Printer className="w-4 h-4 text-indigo-400" />,
        actionId: 'OPEN_PRINT_QUEUE',
        keywords: ['print queue', 'spooler', 'thermal', 'epson', 'retry print', 'failed prints', 'jobs'],
      },
      {
        id: 'action_sync_outbox',
        type: 'ACTION',
        title: 'Sync Offline Outbox Now',
        subtitle: 'Force push pending offline mutations to cloud replication backend',
        icon: <RefreshCw className="w-4 h-4 text-sky-400" />,
        actionId: 'SYNC_OUTBOX',
        keywords: ['sync', 'outbox', 'push', 'replicate', 'cloud sync', 'offline sync'],
      },
      {
        id: 'action_offline_diagnostics',
        type: 'ACTION',
        title: 'Offline Confidence & Diagnostics',
        subtitle: 'Inspect local storage persistence, network status & queued mutations',
        icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
        actionId: 'OPEN_OFFLINE_DIAGNOSTICS',
        keywords: ['offline confidence', 'diagnostics', 'telemetry', 'storage', 'database', 'health'],
      },
      {
        id: 'action_toggle_offline_sim',
        type: 'ACTION',
        title: isActuallyOffline ? 'Disable Simulated Offline (Go Online)' : 'Simulate Offline Mode (Disconnect)',
        subtitle: isActuallyOffline
          ? 'Re-enable simulated online network connectivity and trigger auto-sync'
          : 'Sever simulated network to test zero-latency local fallback',
        badge: isActuallyOffline ? 'Currently Offline' : 'Currently Online',
        icon: isActuallyOffline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-amber-400" />,
        actionId: 'TOGGLE_OFFLINE',
        keywords: ['offline', 'online', 'simulate', 'disconnect', 'airplane mode', 'network'],
      },
      {
        id: 'action_toggle_sound',
        type: 'ACTION',
        title: audioMuted ? 'Unmute Web Audio Haptics' : 'Mute Web Audio Haptics',
        subtitle: audioMuted ? 'Enable tactile synthesizer feedback on scanner and keypad' : 'Silence synthesizer chimes',
        badge: audioMuted ? 'Muted' : 'Active',
        icon: audioMuted ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />,
        actionId: 'TOGGLE_SOUND',
        keywords: ['sound', 'audio', 'mute', 'unmute', 'beeps', 'volume', 'chime'],
      },
      {
        id: 'action_toggle_business_mode',
        type: 'ACTION',
        title: `Switch Mode: ${businessMode === 'RETAIL' ? 'Switch to Café / QSR Mode' : 'Switch to Retail Scanner Mode'}`,
        subtitle: `Currently in ${businessMode === 'RETAIL' ? 'Retail High-Speed Scanner' : 'Café / QSR Food & Drink'} mode`,
        icon: <Store className="w-4 h-4 text-teal-400" />,
        actionId: 'TOGGLE_BUSINESS_MODE',
        keywords: ['mode', 'cafe', 'retail', 'qsr', 'restaurant', 'layout', 'switch mode'],
      },
      {
        id: 'action_add_product',
        type: 'ACTION',
        title: 'Add New Product to Catalog',
        subtitle: 'Open inventory form to create a new item with barcode, tax & SKU',
        icon: <Plus className="w-4 h-4 text-emerald-400" />,
        actionId: 'ADD_NEW_PRODUCT',
        keywords: ['new product', 'add item', 'create product', 'inventory add', 'new sku'],
      },
      {
        id: 'action_view_low_stock',
        type: 'ACTION',
        title: 'Filter Low Stock & Reorder Alerts',
        subtitle: 'Jump to inventory ledger filtered to depleted or reorder items',
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        actionId: 'VIEW_LOW_STOCK',
        keywords: ['low stock', 'out of stock', 'deficit', 'reorder', 'replenish', 'alerts'],
      },
      {
        id: 'action_export_backup',
        type: 'ACTION',
        title: 'Export Local Database Backup',
        subtitle: 'Save complete encrypted JSON archive of local IndexedDB tables',
        icon: <Download className="w-4 h-4 text-indigo-400" />,
        actionId: 'EXPORT_BACKUP',
        keywords: ['backup', 'export', 'download data', 'archive', 'save database'],
      },
    ];

    // Add quick Location switch items
    locations.forEach(loc => {
      items.push({
        id: `action_loc_${loc.id}`,
        type: 'LOCATION',
        title: `Switch Location: ${loc.name}`,
        subtitle: `${loc.code} • ${loc.address} (${loc.currencyCode})`,
        badge: loc.id === currentLocation.id ? 'Active Location' : undefined,
        icon: <Store className="w-4 h-4 text-sky-400" />,
        actionId: 'SWITCH_LOCATION',
        payload: { location: loc },
        keywords: ['location', 'store', 'branch', loc.name.toLowerCase(), loc.code.toLowerCase()],
      });
    });

    // Add quick User / Cashier switch items
    users.forEach(u => {
      items.push({
        id: `action_user_${u.id}`,
        type: 'USER',
        title: `Switch User: ${u.name}`,
        subtitle: `Role: ${u.role} • PIN Login Profile`,
        badge: u.id === currentUser.id ? 'Active User' : undefined,
        icon: <User className="w-4 h-4 text-teal-400" />,
        actionId: 'SWITCH_USER',
        payload: { user: u },
        keywords: ['user', 'cashier', 'staff', 'login', 'operator', u.name.toLowerCase(), u.role.toLowerCase()],
      });
    });

    return items;
  }, [
    cartItemsCount,
    isActuallyOffline,
    audioMuted,
    businessMode,
    locations,
    currentLocation,
    users,
    currentUser,
  ]);

  // Build searchable Product items
  const productItems: CommandItem[] = useMemo(() => {
    return products.map(p => {
      const catName = categoryMap.get(p.categoryId) || 'General';
      const hasModifiers = Boolean(p.modifierGroups && p.modifierGroups.length > 0);
      const isOutOfStock = p.stockQuantity <= 0;
      const isLowStock = !isOutOfStock && p.stockQuantity <= p.minStockLevel;

      let stockText = `${p.stockQuantity} in stock`;
      let stockColor = 'text-emerald-400';
      if (isOutOfStock) {
        stockText = 'Out of stock';
        stockColor = 'text-rose-400';
      } else if (isLowStock) {
        stockText = `${p.stockQuantity} left (Low)`;
        stockColor = 'text-amber-400';
      }

      return {
        id: `prod_${p.id}`,
        type: 'PRODUCT',
        title: p.name,
        subtitle: `${catName} • SKU: ${p.sku} • Barcode: ${p.barcode}`,
        categoryLabel: catName,
        badge: hasModifiers ? 'Customizable' : undefined,
        shortcut: undefined,
        icon: <Tag className="w-4 h-4 text-sky-400" />,
        product: p,
        keywords: [
          p.name.toLowerCase(),
          p.sku.toLowerCase(),
          p.barcode,
          catName.toLowerCase(),
          p.brand ? p.brand.toLowerCase() : '',
          stockText.toLowerCase(),
        ],
        payload: {
          priceFormatted: `${currentLocation.currencySymbol}${p.sellingPrice.toFixed(2)}`,
          stockText,
          stockColor,
          hasModifiers,
        },
      };
    });
  }, [products, categoryMap, currentLocation]);

  // Compute filtered & searched items
  const filteredItems = useMemo(() => {
    let effectiveQuery = query.trim().toLowerCase();
    let categoryOverride: PaletteCategoryFilter = activeCategoryFilter;

    // Support prefix syntax:
    // ">" or "/a" -> ACTIONS
    // "#" or "/t" -> TABS
    // "@" or "/p" -> PRODUCTS
    if (effectiveQuery.startsWith('>')) {
      categoryOverride = 'ACTIONS';
      effectiveQuery = effectiveQuery.slice(1).trim();
    } else if (effectiveQuery.startsWith('#')) {
      categoryOverride = 'TABS';
      effectiveQuery = effectiveQuery.slice(1).trim();
    } else if (effectiveQuery.startsWith('@')) {
      categoryOverride = 'PRODUCTS';
      effectiveQuery = effectiveQuery.slice(1).trim();
    }

    let candidates: CommandItem[] = [];
    if (categoryOverride === 'ALL') {
      // Prioritize: Tabs first if query matches, Actions, Products
      candidates = [...tabItems, ...actionItems, ...productItems];
    } else if (categoryOverride === 'PRODUCTS') {
      candidates = productItems;
    } else if (categoryOverride === 'TABS') {
      candidates = tabItems;
    } else if (categoryOverride === 'ACTIONS') {
      candidates = actionItems;
    }

    if (!effectiveQuery) {
      // Default view when query is empty: show popular tabs, top quick actions, and recent products
      if (categoryOverride === 'ALL') {
        return [
          ...tabItems,
          ...actionItems.slice(0, 10),
          ...productItems.slice(0, 8),
        ];
      }
      return candidates.slice(0, 40);
    }

    // Split search query into tokens
    const tokens = effectiveQuery.split(/\s+/).filter(Boolean);

    const matches = candidates.filter(item => {
      const targetString = `${item.title} ${item.subtitle} ${(item.keywords || []).join(' ')} ${item.badge || ''}`.toLowerCase();
      return tokens.every(token => targetString.includes(token));
    });

    // Limit total results to prevent rendering slowdown
    return matches.slice(0, 60);
  }, [query, activeCategoryFilter, tabItems, actionItems, productItems]);

  // Auto focus input and reset query when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setQuery('');
        setActiveCategoryFilter('ALL');
        setSelectedIndex(0);
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex, isOpen]);

  // Execute selected item
  const handleExecuteItem = useCallback(
    (item: CommandItem) => {
      if (!item) return;

      if (item.type === 'TAB' && item.tab) {
        sound.playClick();
        onSelectTab(item.tab);
        onClose();
        return;
      }

      if (item.type === 'PRODUCT' && item.product) {
        sound.playScanBeep();
        onAddProductToCart(item.product);
        onClose();
        return;
      }

      if (
        (item.type === 'ACTION' || item.type === 'LOCATION' || item.type === 'USER') &&
        item.actionId
      ) {
        sound.playClick();
        onQuickAction(item.actionId, item.payload);
        onClose();
        return;
      }
    },
    [onSelectTab, onAddProductToCart, onQuickAction, onClose]
  );

  // Global Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleExecuteItem(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Cycle through categories: ALL -> PRODUCTS -> TABS -> ACTIONS -> ALL
      const categories: PaletteCategoryFilter[] = ['ALL', 'PRODUCTS', 'TABS', 'ACTIONS'];
      const nextIdx = (categories.indexOf(activeCategoryFilter) + (e.shiftKey ? -1 : 1) + 4) % 4;
      setActiveCategoryFilter(categories[nextIdx]);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="global-command-palette-backdrop"
        className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:pt-16 bg-black/75 backdrop-blur-sm"
        onClick={e => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          id="global-command-palette-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Command Palette"
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Top Search Input Box */}
        <div className="relative border-b border-slate-800 bg-slate-950/90 px-4 py-3.5 flex items-center gap-3">
          <Search className="w-5 h-5 text-sky-400 shrink-0" />
          <input
            ref={inputRef}
            id="command-palette-search-input"
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a product name, barcode, jump to tab, or quick action..."
            className="flex-1 bg-transparent text-white placeholder-slate-400 text-sm font-medium focus:outline-hidden"
            autoComplete="off"
            spellCheck="false"
          />

          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded-md">
              ESC
            </kbd>
            <span className="text-[11px] text-slate-400">close</span>
          </div>
        </div>

        {/* Category Filter Chips Bar */}
        <div className="px-3 py-2 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1">
            <button
              id="cmd-chip-all"
              onClick={() => {
                setActiveCategoryFilter('ALL');
                inputRef.current?.focus();
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeCategoryFilter === 'ALL'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>All</span>
            </button>

            <button
              id="cmd-chip-products"
              onClick={() => {
                setActiveCategoryFilter('PRODUCTS');
                inputRef.current?.focus();
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeCategoryFilter === 'PRODUCTS'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Products ({products.length})</span>
            </button>

            <button
              id="cmd-chip-tabs"
              onClick={() => {
                setActiveCategoryFilter('TABS');
                inputRef.current?.focus();
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeCategoryFilter === 'TABS'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tabs ({tabItems.length})</span>
            </button>

            <button
              id="cmd-chip-actions"
              onClick={() => {
                setActiveCategoryFilter('ACTIONS');
                inputRef.current?.focus();
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeCategoryFilter === 'ACTIONS'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Quick Actions</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400">
            <span className="font-mono text-slate-400">Prefixes:</span>
            <span className="font-mono text-sky-400 font-bold">&gt;</span> actions
            <span className="text-slate-400">•</span>
            <span className="font-mono text-sky-400 font-bold">@</span> products
            <span className="text-slate-400">•</span>
            <span className="font-mono text-sky-400 font-bold">#</span> tabs
          </div>
        </div>

        {/* Results Scrollable List */}
        <div
          ref={listContainerRef}
          id="command-palette-results-list"
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/40 max-h-[55vh]"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">No matching results</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Could not find any products, tabs, or quick actions matching &quot;{query}&quot;. Try searching for &quot;coffee&quot;, &quot;shift&quot;, &quot;drawer&quot;, or &quot;sync&quot;.
              </p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  ref={el => {
                    itemRefs.current[index] = el;
                  }}
                  id={`cmd-item-${item.id}`}
                  onClick={() => handleExecuteItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3 py-2.5 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-sky-600/20 border border-sky-500/40 text-white shadow-xs'
                      : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                  }`}
                >
                  {/* Left Icon & Title */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition ${
                        isSelected
                          ? 'bg-sky-500/25 border-sky-400/50 shadow-xs'
                          : 'bg-slate-800 border-slate-700/80 text-slate-400'
                      }`}
                    >
                      {item.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold truncate ${
                            isSelected ? 'text-white' : 'text-slate-100'
                          }`}
                        >
                          {item.title}
                        </span>

                        {item.badge && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${
                              item.badge === 'Customizable'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : item.badge === 'Current Tab' || item.badge === 'Active User' || item.badge === 'Active Location'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}

                        {item.type === 'PRODUCT' && item.payload?.stockText && (
                          <span
                            className={`text-[10px] font-medium shrink-0 flex items-center gap-1 ${item.payload.stockColor}`}
                          >
                            <span>●</span>
                            <span>{item.payload.stockText}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  {/* Right Price / Action Hint */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.type === 'PRODUCT' && item.payload?.priceFormatted && (
                      <span className="text-xs font-black font-mono text-emerald-400">
                        {item.payload.priceFormatted}
                      </span>
                    )}

                    {item.shortcut && (
                      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 rounded-md">
                        {item.shortcut}
                      </kbd>
                    )}

                    {isSelected && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-sky-300 bg-sky-500/20 border border-sky-400/30 px-2 py-0.5 rounded-md">
                        <span>
                          {item.type === 'PRODUCT'
                            ? item.badge === 'Customizable'
                              ? 'Configure'
                              : 'Add to Cart'
                            : item.type === 'TAB'
                            ? 'Switch'
                            : 'Run'}
                        </span>
                        <CornerDownLeft className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Keyboard Navigation Hints Bar */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-mono font-bold text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-mono font-bold text-[10px]">
                ↓
              </kbd>
              <span className="text-slate-400">Navigate</span>
            </div>

            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-mono font-bold text-[10px]">
                ↵
              </kbd>
              <span className="text-slate-400">Select</span>
            </div>

            <div className="hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-mono font-bold text-[10px]">
                Tab
              </kbd>
              <span className="text-slate-400">Filter category</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-400">
              {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-mono text-[10px] text-sky-400 font-bold">NEXORA Omnibar</span>
          </div>
        </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
