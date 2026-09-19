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

  const { isInstallable, install } = usePWAInstall();

  const isActuallyOffline = isSimulatedOffline || !isBrowserOnline;

  // Load / Refresh Data from IndexedDB
  const refreshData = useCallback(async () => {
    try {
      const pCount = await db.products.count();
      if (pCount === 0) {
        await seedDatabase();
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

    // Global keyboard listener for tabs (F1 for Checkout)
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
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

  const toggleSound = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    sound.setMuted(next);
  };

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
            currentLocation={currentLocation}
            currentUser={currentUser}
            onRefreshData={refreshData}
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
