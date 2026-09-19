// NEXORA POS - Dexie Typed IndexedDB Layer
import Dexie, { type Table } from 'dexie';
import type {
  Product,
  Category,
  Location,
  Register,
  User,
  Sale,
  HeldOrder,
  Shift,
  CashMovement,
  InventoryMovement,
  Supplier,
  PurchaseOrder,
  StockTransfer,
  Customer,
  LoyaltyMovement,
  Expense,
  AuditEvent,
  SyncCommand,
  KitchenTicket,
} from './types';

export class NexoraDatabase extends Dexie {
  locations!: Table<Location, string>;
  registers!: Table<Register, string>;
  users!: Table<User, string>;
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  sales!: Table<Sale, string>;
  heldOrders!: Table<HeldOrder, string>;
  shifts!: Table<Shift, string>;
  cashMovements!: Table<CashMovement, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  suppliers!: Table<Supplier, string>;
  purchaseOrders!: Table<PurchaseOrder, string>;
  stockTransfers!: Table<StockTransfer, string>;
  customers!: Table<Customer, string>;
  loyaltyMovements!: Table<LoyaltyMovement, string>;
  expenses!: Table<Expense, string>;
  auditEvents!: Table<AuditEvent, string>;
  syncOutbox!: Table<SyncCommand, string>;
  kitchenTickets!: Table<KitchenTicket, string>;

  constructor() {
    super('nexora_pos_db');
    this.version(1).stores({
      locations: 'id, code, name',
      registers: 'id, locationId, code',
      users: 'id, username, role',
      products: 'id, sku, barcode, categoryId, name, stockQuantity, active',
      categories: 'id, code, mode',
      sales: 'id, orderNumber, createdAt, status, locationId, cashierId, customerId',
      heldOrders: 'id, heldAt, customerName',
      shifts: 'id, status, openedAt, closedAt, locationId, cashierId',
      cashMovements: 'id, shiftId, type, createdAt',
      inventoryMovements: 'id, productId, locationId, movementType, createdAt',
      suppliers: 'id, name',
      purchaseOrders: 'id, poNumber, supplierId, status, orderedAt',
      stockTransfers: 'id, transferNumber, fromLocationId, toLocationId, status',
      customers: 'id, phone, name, email',
      loyaltyMovements: 'id, customerId, createdAt',
      expenses: 'id, date, locationId, category',
      auditEvents: 'id, timestamp, action, actorId, locationId',
      syncOutbox: 'id, status, idempotencyKey, createdAt',
      kitchenTickets: 'id, saleId, orderNumber, status, createdAt',
    });
  }

}

export const db = new NexoraDatabase();
