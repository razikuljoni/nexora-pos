'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Clock,
  Package,
  FileText,
  Settings,
  Wifi,
  WifiOff,
  Download,
  Volume2,
  VolumeX,
  Store,
  User,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Search,
  Command,
} from 'lucide-react';
import { db } from '@/lib/db';
import { seedDatabase, INITIAL_LOCATIONS, INITIAL_REGISTERS, INITIAL_USERS } from '@/lib/mockData';
import { sound } from '@/lib/audio';
import { syncEngine, syncOutbox } from '@/lib/services/syncService';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import type {
  Product,
  Category,
  Location,
  Register,
  User as StaffUser,
  Customer,
  Shift,
  HeldOrder,
  Sale,
  InventoryMovement,
  CashMovement,
  SyncCommand,
  BusinessMode,
} from '@/lib/types';

import { CheckoutView } from '@/components/pos/CheckoutView';
import { ShiftView } from '@/components/shifts/ShiftView';
import { InventoryView } from '@/components/inventory/InventoryView';
import { OrdersView } from '@/components/orders/OrdersView';
import { SettingsView } from '@/components/settings/SettingsView';
import { OfflineConfidenceModal } from '@/components/offline/OfflineConfidenceModal';
import { CommandPalette } from '@/components/command/CommandPalette';

export default function NexoraPOSApp() {
  const [activeTab, setActiveTab] = useState<'checkout' | 'shifts' | 'inventory' | 'orders' | 'settings'>('checkout');
  const [businessMode, setBusinessMode] = useState<BusinessMode>('RETAIL');
  const [isLoading, setIsLoading] = useState(true);

  // Core Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>(INITIAL_LOCATIONS);
  const [currentLocation, setCurrentLocation] = useState<Location>(INITIAL_LOCATIONS[0]);
  const [registers, setRegisters] = useState<Register[]>(INITIAL_REGISTERS);
  const [currentRegister, setCurrentRegister] = useState<Register>(INITIAL_REGISTERS[0]);
  const [users, setUsers] = useState<StaffUser[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<StaffUser>(INITIAL_USERS[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Operational State
  const [activeShift, setActiveShift] = useState<Shift | undefined>(undefined);
  const [pastShifts, setPastShifts] = useState<Shift[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [pendingSyncCommands, setPendingSyncCommands] = useState<SyncCommand[]>([]);

  // Offline Simulation & Status
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [isBrowserOnline, setIsBrowserOnline] = useState(true);
  const [isConfidenceModalOpen, setIsConfidenceModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  // Global Command Palette & Quick Action State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [pendingCheckoutAction, setPendingCheckoutAction] = useState<{ action: string; payload?: any; timestamp: number } | null>(null);
  const [pendingInventoryAction, setPendingInventoryAction] = useState<{ action: string; payload?: any; timestamp: number } | null>(null);
  const [commandToast, setCommandToast] = useState<{ message: string; id: number } | null>(null);

  const { isInstallable, install } = usePWAInstall();

  const isActuallyOffline = isSimulatedOffline || !isBrowserOnline;

  // Load / Refresh Data from IndexedDB
  const refreshData = useCallback(async () => {
    try {
      const pCount = await db.products.count();
      if (pCount === 0) {
        await seedDatabase();
      } else {
        const sCount = await db.sales.count();
        if (sCount === 0) {
          const { INITIAL_SALES, INITIAL_PURCHASE_ORDERS } = await import('@/lib/mockData');
          await db.sales.bulkAdd(INITIAL_SALES);
          const poCount = await db.purchaseOrders.count();
          if (poCount === 0) {
            await db.purchaseOrders.bulkAdd(INITIAL_PURCHASE_ORDERS);
          }
        }
      }

      const [
        prods,
        cats,
        locs,
        regs,
        usrs,
        custs,
        allShifts,
        helds,
        sls,
        invMovs,
        cMovs,
        outbox,
      ] = await Promise.all([
        db.products.toArray(),
        db.categories.toArray(),
        db.locations.toArray(),
        db.registers.toArray(),
        db.users.toArray(),
        db.customers.toArray(),
        db.shifts.reverse().sortBy('openedAt'),
        db.heldOrders.toArray(),
        db.sales.reverse().sortBy('createdAt'),
        db.inventoryMovements.reverse().sortBy('createdAt'),
        db.cashMovements.reverse().sortBy('createdAt'),
        db.syncOutbox.where('status').equals('PENDING').toArray(),
      ]);

      setProducts(prods);
      setCategories(cats);
      if (locs.length > 0) setLocations(locs);
      if (regs.length > 0) setRegisters(regs);
      if (usrs.length > 0) setUsers(usrs);
      setCustomers(custs);

      const openShift = allShifts.find(s => s.status === 'OPEN');
      setActiveShift(openShift);
      setPastShifts(allShifts);
      setHeldOrders(helds);
      setSales(sls);
      setInventoryMovements(invMovs);
      setPendingSyncCommands(outbox);

      if (openShift) {
        const shiftCashMovs = cMovs.filter(m => m.shiftId === openShift.id);
        setCashMovements(shiftCashMovs);
      } else {
        setCashMovements(cMovs.slice(0, 30));
      }
    } catch (err) {
      console.error('[Nexora POS] Data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync Action
  const handleTriggerSync = useCallback(async () => {
    if (isActuallyOffline) return;
    setIsSyncing(true);
    try {
      await syncOutbox();
      await refreshData();
      sound.playSuccess();
    } catch (err) {
      console.error('[Sync] Sync failed:', err);
      sound.playError();
    } finally {
      setIsSyncing(false);
    }
  }, [isActuallyOffline, refreshData]);

  // Initial Load
  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        refreshData().catch(console.error);
      }
    }, 0);

    // Browser online/offline listeners
    const handleOnline = () => {
      setIsBrowserOnline(true);
      if (!isSimulatedOffline) {
        handleTriggerSync();
      }
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Global keyboard listener for tabs & Command Palette (Ctrl+K, Cmd+K, F1)
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        sound.playClick();
        setIsCommandPaletteOpen(prev => !prev);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('checkout');
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);

    return () => {
      ignore = true;
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleGlobalKeys);
    };
  }, [refreshData, isSimulatedOffline, handleTriggerSync]);

  const toggleSound = useCallback(() => {
    const next = !audioMuted;
    setAudioMuted(next);
    sound.setMuted(next);
  }, [audioMuted]);

  const showToast = useCallback((message: string) => {
    setCommandToast({ message, id: Date.now() });
    setTimeout(() => {
      setCommandToast(prev => (prev?.message === message ? null : prev));
    }, 3200);
  }, []);

  // Handle actions executed from Global Command Palette
  const handleCommandQuickAction = useCallback(
    async (actionId: string, payload?: any) => {
      if (actionId === 'NO_SALE_DRAWER_KICK') {
        sound.playSaleSuccess();
        showToast('Cash drawer opened (No-Sale kick logged to audit trail)');
        try {
          await db.auditEvents.add({
            id: `aud_${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: currentUser.id,
            actorName: currentUser.name,
            action: 'DRAWER_KICK_NO_SALE',
            entityType: 'REGISTER',
            entityId: currentRegister.id,
            details: `Cashier ${currentUser.name} triggered No-Sale drawer kick via Command Palette`,
            locationId: currentLocation.id,
          });
        } catch (err) {
          console.error('[CommandPalette] Audit log error:', err);
        }
      } else if (actionId === 'REPRINT_LAST_RECEIPT') {
        setActiveTab('checkout');
        setPendingCheckoutAction({ action: 'REPRINT_LAST_RECEIPT', timestamp: Date.now() });
        showToast('Opening last completed receipt...');
      } else if (actionId === 'OPEN_SCANNER') {
        setActiveTab('checkout');
        setPendingCheckoutAction({ action: 'OPEN_SCANNER', timestamp: Date.now() });
      } else if (actionId === 'HOLD_ORDER') {
        setActiveTab('checkout');
        setPendingCheckoutAction({ action: 'HOLD_ORDER', timestamp: Date.now() });
      } else if (actionId === 'VIEW_HELD_ORDERS') {
        setActiveTab('checkout');
        setPendingCheckoutAction({ action: 'VIEW_HELD_ORDERS', timestamp: Date.now() });
      } else if (actionId === 'START_RETURN') {
        setActiveTab('checkout');
        setPendingCheckoutAction({ action: 'START_RETURN', timestamp: Date.now() });
      } else if (actionId === 'SELECT_CUSTOMER') {
        setActiveTab('checkout');
        setPendingCheckoutAction({ action: 'SELECT_CUSTOMER', timestamp: Date.now() });
      } else if (actionId === 'CLEAR_CART') {
        setActiveTab('checkout');
        setPendingCheckoutAction({ action: 'CLEAR_CART', timestamp: Date.now() });
        showToast('Cleared active cart');
      } else if (actionId === 'APPLY_DISCOUNT') {
        setActiveTab('checkout');
        setPendingCheckoutAction({ action: 'APPLY_DISCOUNT', payload, timestamp: Date.now() });
        showToast(`Applied ${payload?.percent}% cart discount`);
      } else if (actionId === 'OPEN_PRINT_QUEUE') {
        setActiveTab('settings');
        showToast('Navigated to Thermal Print Queue');
        setTimeout(() => {
          document.getElementById('settings-thermal-print-queue')?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      } else if (actionId === 'SYNC_OUTBOX') {
        showToast('Synchronizing offline outbox with cloud server...');
        await handleTriggerSync();
      } else if (actionId === 'OPEN_OFFLINE_DIAGNOSTICS') {
        setIsConfidenceModalOpen(true);
      } else if (actionId === 'TOGGLE_OFFLINE') {
        const next = !isSimulatedOffline;
        setIsSimulatedOffline(next);
        sound.playClick();
        showToast(next ? 'Simulating Offline Mode (Disconnected)' : 'Restored Online Mode (Reconnected)');
      } else if (actionId === 'TOGGLE_SOUND') {
        toggleSound();
        showToast(!audioMuted ? 'Web Audio Haptics Muted' : 'Web Audio Haptics Unmuted');
      } else if (actionId === 'TOGGLE_BUSINESS_MODE') {
        const next = businessMode === 'RETAIL' ? 'CAFE' : 'RETAIL';
        setBusinessMode(next);
        sound.playClick();
        showToast(`Switched Business Mode to ${next === 'RETAIL' ? 'Retail High-Speed' : 'Café / QSR'}`);
      } else if (actionId === 'SWITCH_LOCATION' && payload?.location) {
        setCurrentLocation(payload.location);
        sound.playClick();
        showToast(`Active location: ${payload.location.name}`);
        refreshData();
      } else if (actionId === 'SWITCH_USER' && payload?.user) {
        setCurrentUser(payload.user);
        sound.playClick();
        showToast(`Active cashier: ${payload.user.name} (${payload.user.role})`);
      } else if (actionId === 'ADD_NEW_PRODUCT') {
        setActiveTab('inventory');
        setPendingInventoryAction({ action: 'ADD_NEW_PRODUCT', timestamp: Date.now() });
      } else if (actionId === 'VIEW_LOW_STOCK') {
        setActiveTab('inventory');
        setPendingInventoryAction({ action: 'VIEW_LOW_STOCK', timestamp: Date.now() });
        showToast('Filtered inventory to Low Stock & Depleted SKUs');
      } else if (actionId === 'EXPORT_BACKUP') {
        setActiveTab('settings');
        showToast('Navigated to Encrypted Backup section');
        setTimeout(() => {
          document.getElementById('btn-open-export-archive-modal')?.click();
        }, 150);
      }
    },
    [
      currentUser,
      currentRegister,
      currentLocation,
      isSimulatedOffline,
      audioMuted,
      businessMode,
      handleTriggerSync,
      showToast,
      refreshData,
      toggleSound,
    ]
  );

  const handleAddProductFromPalette = useCallback(
    (product: Product) => {
      setActiveTab('checkout');
      setPendingCheckoutAction({
        action: 'ADD_TO_CART',
        payload: { product },
        timestamp: Date.now(),
      });
      showToast(`Added "${product.name}" to cart`);
    },
    [showToast]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 p-4">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="font-bold text-sm text-white">Initializing NEXORA Offline Engine...</div>
        <p className="text-xs text-slate-500 mt-1">Mounting IndexedDB and local business state</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Application Navigation Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0">
        {/* Brand & Mode */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-md shadow-sky-950">
              NX
            </div>
            <div>
              <div className="text-xs font-black tracking-wider text-white flex items-center gap-1.5">
                <span>NEXORA</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  POS
                </span>
              </div>
              <div className="text-[10px] text-slate-400 leading-none">
                {businessMode === 'RETAIL' ? 'Retail Scanner' : 'Café / QSR'} • {currentLocation.name}
              </div>
            </div>
          </div>

          {/* Offline Confidence Indicator Pill */}
          <button
            onClick={() => {
              sound.playClick();
              setIsConfidenceModalOpen(true);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              isActuallyOffline
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
            }`}
            title="Click to open Offline Confidence & Outbox Diagnostic"
          >
            {isActuallyOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>OFFLINE ({pendingSyncCommands.length})</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>ONLINE {pendingSyncCommands.length > 0 ? `(${pendingSyncCommands.length} pending)` : ''}</span>
              </>
            )}
          </button>

          {/* Global Command Palette Omnibar Trigger */}
          <button
            id="btn-open-command-palette"
            type="button"
            onClick={() => {
              sound.playClick();
              setIsCommandPaletteOpen(true);
            }}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs transition cursor-pointer"
            title="Open Global Command Palette (Ctrl+K or ⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="hidden lg:inline text-[11px] text-slate-300 font-medium">Search products or actions...</span>
            <span className="lg:hidden text-[11px] text-slate-300 font-medium">Search...</span>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 rounded-md">
              <span className="text-[9px]">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Center Nav Views (Desktop & Tablet) */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('checkout');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'checkout'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Checkout (F1)</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('shifts');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'shifts'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Shift & Drawer</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('inventory');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'inventory'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Inventory Ledger</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('orders');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'orders'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Orders & Returns</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('settings');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'settings'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Right Status Controls */}
        <div className="flex items-center gap-2">
          {/* PWA Install Button */}
          {isInstallable && (
            <button
              onClick={() => {
                sound.playClick();
                install();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition"
              title="Install Nexora POS PWA to desktop / tablet"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install PWA</span>
            </button>
          )}

          {/* Sound Mute/Unmute Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title={audioMuted ? 'Unmute Web Audio Haptics' : 'Mute Web Audio Haptics'}
          >
            {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
          </button>

          {/* Cashier Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-sky-400">
              {currentUser.name.slice(0, 1)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-white leading-tight">{currentUser.name}</div>
              <div className="text-[10px] text-slate-400 leading-none">{currentUser.role}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Secondary Navigation Row */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 flex items-center justify-around py-1.5 px-2">
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('checkout');
          }}
          className={`py-1 px-2.5 rounded-lg text-xs font-bold flex flex-col items-center ${
            activeTab === 'checkout' ? 'text-sky-400' : 'text-slate-400'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="text-[10px]">Checkout</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('shifts');
          }}
          className={`py-1 px-2.5 rounded-lg text-xs font-bold flex flex-col items-center ${
            activeTab === 'shifts' ? 'text-sky-400' : 'text-slate-400'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span className="text-[10px]">Shift</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('inventory');
          }}
          className={`py-1 px-2.5 rounded-lg text-xs font-bold flex flex-col items-center ${
            activeTab === 'inventory' ? 'text-sky-400' : 'text-slate-400'
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="text-[10px]">Stock</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('orders');
          }}
          className={`py-1 px-2.5 rounded-lg text-xs font-bold flex flex-col items-center ${
            activeTab === 'orders' ? 'text-sky-400' : 'text-slate-400'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-[10px]">Orders</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('settings');
          }}
          className={`py-1 px-2.5 rounded-lg text-xs font-bold flex flex-col items-center ${
            activeTab === 'settings' ? 'text-sky-400' : 'text-slate-400'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-[10px]">Settings</span>
        </button>
      </div>

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'checkout' && (
          <CheckoutView
            products={products}
            categories={categories}
            currentLocation={currentLocation}
            currentRegister={currentRegister}
            currentUser={currentUser}
            businessMode={businessMode}
            isOffline={isActuallyOffline}
            heldOrders={heldOrders}
            customers={customers}
            onRefreshData={refreshData}
            pendingAction={pendingCheckoutAction}
            onClearPendingAction={() => setPendingCheckoutAction(null)}
            onCartItemsCountChange={count => setCartItemsCount(count)}
          />
        )}

        {activeTab === 'shifts' && (
          <ShiftView
            activeShift={activeShift}
            pastShifts={pastShifts}
            cashMovements={cashMovements}
            currentLocation={currentLocation}
            currentUser={currentUser}
            onRefreshData={refreshData}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            products={products}
            categories={categories}
            movements={inventoryMovements}
            locations={locations}
            sales={sales}
            currentLocation={currentLocation}
            currentUser={currentUser}
            onRefreshData={refreshData}
            pendingAction={pendingInventoryAction}
            onClearPendingAction={() => setPendingInventoryAction(null)}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersView
            sales={sales}
            currentLocation={currentLocation}
            currentUser={currentUser}
            onRefreshData={refreshData}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            locations={locations}
            currentLocation={currentLocation}
            registers={registers}
            currentRegister={currentRegister}
            users={users}
            currentUser={currentUser}
            businessMode={businessMode}
            onSetBusinessMode={mode => setBusinessMode(mode)}
            onSwitchLocation={loc => setCurrentLocation(loc)}
            onSwitchRegister={reg => setCurrentRegister(reg)}
            onSwitchUser={usr => setCurrentUser(usr)}
            onRefreshData={refreshData}
          />
        )}
      </main>

      {/* Global Command Palette Modal (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        products={products}
        categories={categories}
        locations={locations}
        currentLocation={currentLocation}
        registers={registers}
        currentRegister={currentRegister}
        users={users}
        currentUser={currentUser}
        businessMode={businessMode}
        activeTab={activeTab}
        cartItemsCount={cartItemsCount}
        isActuallyOffline={isActuallyOffline}
        audioMuted={audioMuted}
        onSelectTab={tab => {
          setActiveTab(tab);
          sound.playClick();
        }}
        onAddProductToCart={handleAddProductFromPalette}
        onQuickAction={handleCommandQuickAction}
      />

      {/* Quick Action Global HUD Toast Banner */}
      {commandToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-sky-500/40 text-sky-200 text-xs font-semibold shadow-2xl shadow-black/80 flex items-center gap-2.5 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />
            <span>{commandToast.message}</span>
          </div>
        </div>
      )}

      {/* Offline Confidence & Sync Diagnostic Modal */}
      <OfflineConfidenceModal
        isOpen={isConfidenceModalOpen}
        onClose={() => {
          setIsConfidenceModalOpen(false);
          refreshData();
        }}
      />
    </div>
  );
}
