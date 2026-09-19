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
}

class SyncService {
  private isSimulatedOffline: boolean = false;
  private isSyncing: boolean = false;
  private lastSyncTime: string | null = null;
  private listeners: Set<(status: SyncEngineStatus) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
      this.lastSyncTime = new Date().toISOString();
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
    if (!simulated) {
      this.syncOutbox();
    }
  }

  public getIsSimulatedOffline(): boolean {
    return this.isSimulatedOffline;
  }

  private handleNetworkChange() {
    this.notify();
    if (this.isNetworkOnline()) {
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

