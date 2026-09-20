// NEXORA POS - Offline Synchronization Engine & Outbox Manager
import { db } from '../db';
import type { SyncCommand } from '../types';

export interface SyncEngineStatus {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  isSyncing: boolean;
  dbHealthy: boolean;
  isAutoSyncEnabled: boolean;
  autoSyncIntervalSec: number;
}

class SyncService {
  private isSimulatedOffline: boolean = false;
  private isSyncing: boolean = false;
  private lastSyncTime: string | null = null;
  private isAutoSyncEnabled: boolean = true;
  private autoSyncIntervalMs: number = 30000; // 30 seconds
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(status: SyncEngineStatus) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
      this.lastSyncTime = new Date().toISOString();

      try {
        const storedSetting = localStorage.getItem('nexora_auto_background_sync_enabled');
        if (storedSetting !== null) {
          this.isAutoSyncEnabled = storedSetting !== 'false';
        } else {
          this.isAutoSyncEnabled = true;
        }
      } catch {
        this.isAutoSyncEnabled = true;
      }

      if (this.isAutoSyncEnabled) {
        this.startPeriodicSync();
      }
    }
  }

  public subscribe(fn: (status: SyncEngineStatus) => void) {
    this.listeners.add(fn);
    queueMicrotask(() => {
      this.getStatus().then(status => fn(status));
    });
    return () => {
      this.listeners.delete(fn);
    };
  }

  private async notify() {
    const status = await this.getStatus();
    this.listeners.forEach(fn => fn(status));
  }

  public isNetworkOnline(): boolean {
    if (this.isSimulatedOffline) return false;
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  public setSimulatedOffline(simulated: boolean) {
    this.isSimulatedOffline = simulated;
    this.notify();
    if (!simulated && this.isAutoSyncEnabled) {
      this.syncOutbox();
    }
  }

  public getIsSimulatedOffline(): boolean {
    return this.isSimulatedOffline;
  }

  public setAutoSyncEnabled(enabled: boolean) {
    this.isAutoSyncEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexora_auto_background_sync_enabled', enabled ? 'true' : 'false');
      } catch (e) {
        console.warn('Could not persist auto sync setting to localStorage:', e);
      }
    }

    if (enabled) {
      this.startPeriodicSync();
      if (this.isNetworkOnline() && !this.isSyncing) {
        this.syncOutbox();
      }
    } else {
      this.stopPeriodicSync();
    }
    this.notify();
  }

  public getIsAutoSyncEnabled(): boolean {
    return this.isAutoSyncEnabled;
  }

  public setAutoSyncIntervalSec(seconds: number) {
    const validSeconds = Math.max(10, Math.min(600, seconds));
    this.autoSyncIntervalMs = validSeconds * 1000;
    if (this.isAutoSyncEnabled) {
      this.startPeriodicSync();
    }
    this.notify();
  }

  private startPeriodicSync() {
    this.stopPeriodicSync();
    if (typeof window !== 'undefined') {
      this.autoSyncTimer = setInterval(() => {
        this.runPeriodicSyncCheck();
      }, this.autoSyncIntervalMs);
    }
  }

  private stopPeriodicSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  public async runPeriodicSyncCheck(): Promise<void> {
    if (!this.isAutoSyncEnabled || !this.isNetworkOnline() || this.isSyncing) {
      return;
    }
    try {
      const pendingCount = await db.syncOutbox.filter(c => c.status === 'PENDING').count();
      if (pendingCount > 0) {
        await this.syncOutbox();
      }
    } catch (err) {
      console.error('[SyncService] Periodic sync check failed:', err);
    }
  }

  private handleNetworkChange() {
    this.notify();
    if (this.isNetworkOnline() && this.isAutoSyncEnabled) {
      this.syncOutbox();
    }
  }

  public async getPendingCommands(): Promise<SyncCommand[]> {
    return await db.syncOutbox.filter(c => c.status === 'PENDING').toArray();
  }

  public async getStatus(): Promise<SyncEngineStatus> {
    let pendingCount = 0;
    let dbHealthy = true;
    try {
      pendingCount = await db.syncOutbox.filter(c => c.status === 'PENDING').count();
    } catch {
      dbHealthy = false;
    }

    return {
      isOnline: this.isNetworkOnline(),
      isSimulatedOffline: this.isSimulatedOffline,
      lastSyncTime: this.lastSyncTime,
      pendingCount,
      isSyncing: this.isSyncing,
      dbHealthy,
      isAutoSyncEnabled: this.isAutoSyncEnabled,
      autoSyncIntervalSec: Math.round(this.autoSyncIntervalMs / 1000),
    };
  }

  public async syncOutbox(): Promise<{ processed: number; failed: number }> {
    if (!this.isNetworkOnline() || this.isSyncing) {
      return { processed: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notify();

    try {
      const pending = await db.syncOutbox.filter(c => c.status === 'PENDING').toArray();
      let processed = 0;

      for (const cmd of pending) {
        // Mark as SENDING
        await db.syncOutbox.update(cmd.id, { status: 'SENDING' });

        // Simulate network dispatch with guaranteed server idempotency
        await new Promise(r => setTimeout(r, 120));

        // Mark as ACKED
        await db.syncOutbox.update(cmd.id, { status: 'ACKED' });
        processed++;
      }

      this.lastSyncTime = new Date().toISOString();
      return { processed, failed: 0 };
    } catch (err) {
      console.error('[SyncService] Outbox sync error:', err);
      return { processed: 0, failed: 1 };
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  public async forceFullResync(): Promise<void> {
    const all = await db.syncOutbox.toArray();
    for (const item of all) {
      await db.syncOutbox.update(item.id, { status: 'PENDING' });
    }
    await this.syncOutbox();
  }
}

export const syncEngine = new SyncService();
export const syncOutbox = () => syncEngine.syncOutbox();

