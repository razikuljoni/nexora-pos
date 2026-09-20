// NEXORA POS - Master Domain Types & Data Contracts

export type BusinessMode = 'RETAIL' | 'CAFE';

export type UserRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'CASHIER'
  | 'STOCK_OPERATOR'
  | 'KITCHEN'
  | 'AUDITOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pin: string;
  avatar?: string;
  permissions: string[];
}

export interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  timezone: string;
  taxRate: number; // e.g. 0.08 for 8%
  currencySymbol: string;
  currencyCode: string;
}

export interface Register {
  id: string;
  locationId: string;
  name: string;
  code: string;
  isOnline: boolean;
}

export interface Device {
  id: string;
  name: string;
  locationId: string;
  registerId: string;
  platform: string;
  lastSeenAt: string;
  status: 'ACTIVE' | 'OFFLINE';
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  options: ModifierOption[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  brand?: string;
  unit: string;
  purchaseCost: number;
  sellingPrice: number;
  taxRate: number;
  stockQuantity: number;
  minStockLevel: number;
  isWeighted?: boolean;
  active: boolean;
  image?: string;
  type: 'STANDARD' | 'VARIANT' | 'WEIGHTED' | 'COMPOSITE' | 'RECIPE' | 'SERVICE';
  modifierGroups?: ModifierGroup[];
  preparationStation?: 'BAR' | 'KITCHEN' | 'NONE';
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  color: string;
  icon?: string;
  mode: 'RETAIL' | 'CAFE' | 'ALL';
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  purchaseCost: number;
  quantity: number;
  discountPercentage: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes?: string;
  selectedModifiers?: SelectedModifier[];
  preparationStation?: 'BAR' | 'KITCHEN' | 'NONE';
}

export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_WALLET' | 'STORE_CREDIT';

export interface PaymentRecord {
  id: string;
  method: PaymentMethod;
  amount: number;
  tendered?: number;
  changeDue?: number;
  reference?: string;
  status: 'CAPTURED' | 'PENDING';
  processedAt: string;
}

export interface Sale {
  id: string;
  orderNumber: string;
  organizationId: string;
  locationId: string;
  registerId: string;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  items: CartItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  payments: PaymentRecord[];
  status: 'COMPLETED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'VOIDED';
  orderType: 'COUNTER' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableNumber?: string;
  notes?: string;
  isOfflineCreated: boolean;
  syncedAt: string | null;
  createdAt: string;
}

export interface HeldOrder {
  id: string;
  title: string;
  orderType: 'COUNTER' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableNumber?: string;
  customerName?: string;
  customerId?: string;
  items: CartItem[];
  subtotal: number;
  notes?: string;
  heldAt: string;
  cashierId: string;
  registerId: string;
}

export interface Shift {
  id: string;
  organizationId: string;
  locationId: string;
  registerId: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  status: 'OPEN' | 'CLOSED';
  cashSales: number;
  cardSales: number;
  mobileSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  safeDrops: number;
  expectedCash: number;
  countedCash: number | null;
  variance: number | null;
  varianceReason: string | null;
  notes?: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: 'FLOAT' | 'CASH_IN' | 'CASH_OUT' | 'SAFE_DROP' | 'SALE' | 'REFUND';
  amount: number;
  reason: string;
  cashierId: string;
  createdAt: string;
}

export type InventoryMovementType =
  | 'OPENING'
  | 'SALE'
  | 'SALE_RETURN'
  | 'PURCHASE_RECEIPT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'WASTAGE'
  | 'COUNT_RECONCILIATION';

export interface InventoryMovement {
  id: string;
  organizationId: string;
  locationId: string;
  productId: string;
  productName: string;
  movementType: InventoryMovementType;
  quantity: number; // positive or negative
  unitCost: number;
  referenceType?: 'SALE' | 'PURCHASE_ORDER' | 'TRANSFER' | 'MANUAL';
  referenceId?: string;
  reasonCode?: string;
  createdBy: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  productsSuppliedCount: number;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  receivedQuantity: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  locationId: string;
  status: 'DRAFT' | 'APPROVED' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED';
  items: PurchaseOrderItem[];
  totalCost: number;
  orderedAt: string;
  receivedAt?: string;
  notes?: string;
}

export interface StockTransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  status: 'REQUESTED' | 'IN_TRANSIT' | 'RECEIVED';
  items: StockTransferItem[];
  createdAt: string;
  receivedAt?: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  totalSpent: number;
  visitCount: number;
  tier: 'REGULAR' | 'SILVER' | 'GOLD' | 'VIP';
  notes?: string;
  createdAt: string;
}

export interface LoyaltyMovement {
  id: string;
  customerId: string;
  type: 'EARNED' | 'REDEEMED' | 'ADJUSTED';
  points: number;
  referenceId?: string;
  reason?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: 'RENT' | 'UTILITIES' | 'SUPPLIES' | 'MAINTENANCE' | 'REFRESHMENTS' | 'MARKETING' | 'MISC';
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD';
  vendor: string;
  description: string;
  locationId: string;
  date: string;
  createdBy: string;
  affectsCashDrawer: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  locationId: string;
}

export interface SyncCommand {
  id: string;
  organizationId: string;
  locationId: string;
  terminalId: string;
  actorId: string;
  deviceSequence: number;
  idempotencyKey: string;
  commandType:
    | 'SALE_CREATED'
    | 'REFUND_CREATED'
    | 'CASH_MOVEMENT_CREATED'
    | 'STOCK_ADJUSTED'
    | 'SHIFT_OPENED'
    | 'SHIFT_CLOSED'
    | 'ORDER_UPDATED'
    | 'PURCHASE_RECEIVED'
    | 'TRANSFER_COMMITTED';
  aggregateId: string;
  payload: any;
  createdAt: string;
  retryCount: number;
  status: 'PENDING' | 'SENDING' | 'ACKED' | 'FAILED' | 'CONFLICT';
}

export interface KitchenTicket {
  id: string;
  saleId: string;
  orderNumber: string;
  orderType: 'COUNTER' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableNumber?: string;
  items: Array<{
    name: string;
    quantity: number;
    modifiers?: string[];
    notes?: string;
    station: 'BAR' | 'KITCHEN';
  }>;
  status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED';
  createdAt: string;
  readyAt?: string;
}

export type PrintJobType = 'RECEIPT' | 'Z_REPORT' | 'X_REPORT' | 'KITCHEN_TICKET' | 'END_OF_DAY';
export type PrintJobStatus = 'QUEUED' | 'PRINTING' | 'COMPLETED' | 'FAILED';

export interface PrintJob {
  id: string;
  type: PrintJobType;
  title: string;
  status: PrintJobStatus;
  createdAt: string;
  completedAt?: string;
  lastAttemptAt?: string;
  error?: string;
  retryCount: number;
  maxRetries?: number;
  printerName: string;
  paperWidth: '80mm' | '58mm';
  copies: number;
  targetId?: string;
  payloadRaw: string;
  payloadMetadata?: {
    orderNumber?: string;
    totalAmount?: number;
    cashierName?: string;
    customerName?: string;
    shiftId?: string;
    locationName?: string;
    verificationUrl?: string;
  };
}
