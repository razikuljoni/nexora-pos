// NEXORA POS - Core Transaction Engine & POS Domain Service
import { db } from '../db';
import type {
  Sale,
  CartItem,
  PaymentRecord,
  HeldOrder,
  SyncCommand,
  AuditEvent,
  KitchenTicket,
  InventoryMovement,
  CashMovement,
} from '../types';
import {
  INITIAL_LOCATIONS,
  INITIAL_REGISTERS,
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_SUPPLIERS,
  INITIAL_CUSTOMERS,
  INITIAL_SHIFT,
  INITIAL_INVENTORY_MOVEMENTS,
  INITIAL_PURCHASE_ORDERS,
} from '../mockData';

export async function initDatabaseIfEmpty() {
  const prodCount = await db.products.count();
  if (prodCount === 0) {
    await db.transaction('rw', [
      db.products,
      db.categories,
      db.shifts,
      db.suppliers,
      db.customers,
      db.inventoryMovements,
      db.purchaseOrders,
      db.auditEvents,
    ], async () => {
      await db.products.bulkAdd(INITIAL_PRODUCTS);
      await db.categories.bulkAdd(INITIAL_CATEGORIES);
      await db.shifts.add(INITIAL_SHIFT);
      await db.suppliers.bulkAdd(INITIAL_SUPPLIERS);
      await db.customers.bulkAdd(INITIAL_CUSTOMERS);
      await db.inventoryMovements.bulkAdd(INITIAL_INVENTORY_MOVEMENTS);
      await db.purchaseOrders.bulkAdd(INITIAL_PURCHASE_ORDERS);
      await db.auditEvents.add({
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorId: 'usr_owner',
        actorName: 'Elena Vance',
        action: 'SYSTEM_INITIALIZED',
        entityType: 'ORGANIZATION',
        entityId: 'org_nexora',
        details: 'Initial database provisioned with store catalog and operational shifts',
        locationId: 'loc_flagship',
      });
    });
  }
}

export interface CompleteSaleInput {
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
  orderType: 'COUNTER' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableNumber?: string;
  notes?: string;
  isOffline: boolean;
}

export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const orderNumber = `NX-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const sale: Sale = {
    id: saleId,
    orderNumber,
    organizationId: input.organizationId,
    locationId: input.locationId,
    registerId: input.registerId,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    customerId: input.customerId,
    customerName: input.customerName,
    items: input.items,
    subtotal: input.subtotal,
    discountTotal: input.discountTotal,
    taxTotal: input.taxTotal,
    total: input.total,
    payments: input.payments,
    status: 'COMPLETED',
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    notes: input.notes,
    isOfflineCreated: input.isOffline,
    syncedAt: input.isOffline ? null : now,
    createdAt: now,
  };

  await db.transaction('rw', [
    db.sales,
    db.products,
    db.inventoryMovements,
    db.shifts,
    db.cashMovements,
    db.kitchenTickets,
    db.auditEvents,
    db.syncOutbox,
    db.customers,
    db.loyaltyMovements,
  ], async () => {
    // 1. Commit Sale
    await db.sales.add(sale);

    // 2. Decrement stock & append Inventory movements
    for (const item of input.items) {
      const product = await db.products.get(item.productId);
      if (product) {
        const newQty = (product.stockQuantity || 0) - item.quantity;
        await db.products.update(product.id, { stockQuantity: newQty });

        const movement: InventoryMovement = {
          id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          organizationId: input.organizationId,
          locationId: input.locationId,
          productId: item.productId,
          productName: item.name,
          movementType: 'SALE',
          quantity: -item.quantity,
          unitCost: item.purchaseCost,
          referenceType: 'SALE',
          referenceId: orderNumber,
          reasonCode: `Sale completed at counter: ${orderNumber}`,
          createdBy: input.cashierName,
          createdAt: now,
        };
        await db.inventoryMovements.add(movement);
      }
    }

    // 3. Update Shift finances & Cash Movement
    const activeShift = await db.shifts.filter(s => s.status === 'OPEN').first();
    let cashPaid = 0;
    let cardPaid = 0;
    let mobilePaid = 0;

    for (const pay of input.payments) {
      if (pay.method === 'CASH') cashPaid += pay.amount;
      if (pay.method === 'CARD') cardPaid += pay.amount;
      if (pay.method === 'MOBILE_WALLET') mobilePaid += pay.amount;
    }

    if (activeShift) {
      const updatedExpectedCash = activeShift.expectedCash + cashPaid;
      await db.shifts.update(activeShift.id, {
        cashSales: activeShift.cashSales + cashPaid,
        cardSales: activeShift.cardSales + cardPaid,
        mobileSales: activeShift.mobileSales + mobilePaid,
        expectedCash: updatedExpectedCash,
      });

      if (cashPaid > 0) {
        const cashMov: CashMovement = {
          id: `csh_${Date.now()}`,
          shiftId: activeShift.id,
          type: 'SALE',
          amount: cashPaid,
          reason: `Cash tender for order ${orderNumber}`,
          cashierId: input.cashierId,
          createdAt: now,
        };
        await db.cashMovements.add(cashMov);
      }
    }

    // 4. Kitchen / Bar Ticket generation if relevant
    const kitchenItems = input.items.filter(
      item => item.preparationStation === 'BAR' || item.preparationStation === 'KITCHEN'
    );
    if (kitchenItems.length > 0) {
      const ticket: KitchenTicket = {
        id: `kt_${Date.now()}`,
        saleId,
        orderNumber,
        orderType: input.orderType,
        tableNumber: input.tableNumber,
        items: kitchenItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          modifiers: item.selectedModifiers?.map(m => `${m.groupName}: ${m.optionName}`),
          notes: item.notes,
          station: item.preparationStation === 'BAR' ? 'BAR' : 'KITCHEN',
        })),
        status: 'NEW',
        createdAt: now,
      };
      await db.kitchenTickets.add(ticket);
    }

    // 5. Customer Loyalty accumulation
    if (input.customerId) {
      const customer = await db.customers.get(input.customerId);
      if (customer) {
        const pointsEarned = Math.floor(input.total);
        await db.customers.update(customer.id, {
          points: customer.points + pointsEarned,
          totalSpent: customer.totalSpent + input.total,
          visitCount: customer.visitCount + 1,
        });

        await db.loyaltyMovements.add({
          id: `lym_${Date.now()}`,
          customerId: customer.id,
          type: 'EARNED',
          points: pointsEarned,
          referenceId: orderNumber,
          reason: `Points earned from purchase ${orderNumber}`,
          createdAt: now,
        });
      }
    }

    // 6. Audit Trail
    const audit: AuditEvent = {
      id: `aud_${Date.now()}`,
      timestamp: now,
      actorId: input.cashierId,
      actorName: input.cashierName,
      action: 'SALE_COMPLETED',
      entityType: 'SALE',
      entityId: orderNumber,
      details: `Completed sale ${orderNumber} for $${input.total.toFixed(2)} (${input.items.length} items)`,
      locationId: input.locationId,
    };
    await db.auditEvents.add(audit);

    // 7. Enqueue Sync Command (Outbox Pattern)
    const syncCommand: SyncCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      organizationId: input.organizationId,
      locationId: input.locationId,
      terminalId: input.registerId,
      actorId: input.cashierId,
      deviceSequence: Date.now(),
      idempotencyKey: `idemp_${saleId}`,
      commandType: 'SALE_CREATED',
      aggregateId: saleId,
      payload: sale,
      createdAt: now,
      retryCount: 0,
      status: input.isOffline ? 'PENDING' : 'ACKED',
    };
    await db.syncOutbox.add(syncCommand);
  });

  return sale;
}

export async function holdCurrentOrder(
  title: string,
  items: CartItem[],
  subtotal: number,
  orderType: 'COUNTER' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY',
  cashierId: string,
  registerId: string,
  customerName?: string,
  customerId?: string,
  notes?: string
): Promise<HeldOrder> {
  const heldOrder: HeldOrder = {
    id: `held_${Date.now()}`,
    title: title || `Ticket #${Math.floor(100 + Math.random() * 900)}`,
    items,
    subtotal,
    orderType,
    customerName,
    customerId,
    notes,
    heldAt: new Date().toISOString(),
    cashierId,
    registerId,
  };
  await db.heldOrders.add(heldOrder);
  return heldOrder;
}

export async function deleteHeldOrder(id: string) {
  await db.heldOrders.delete(id);
}

export async function processRefund(
  sale: Sale,
  refundAmount: number,
  reason: string,
  cashierId: string,
  cashierName: string,
  restockItems: boolean = true
) {
  const now = new Date().toISOString();

  await db.transaction('rw', [
    db.sales,
    db.products,
    db.inventoryMovements,
    db.shifts,
    db.cashMovements,
    db.auditEvents,
    db.syncOutbox,
  ], async () => {
    await db.sales.update(sale.id, {
      status: refundAmount >= sale.total ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    });

    if (restockItems) {
      for (const item of sale.items) {
        const prod = await db.products.get(item.productId);
        if (prod) {
          await db.products.update(prod.id, { stockQuantity: (prod.stockQuantity || 0) + item.quantity });
          await db.inventoryMovements.add({
            id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            organizationId: sale.organizationId,
            locationId: sale.locationId,
            productId: item.productId,
            productName: item.name,
            movementType: 'SALE_RETURN',
            quantity: item.quantity,
            unitCost: item.purchaseCost,
            referenceType: 'SALE',
            referenceId: sale.orderNumber,
            reasonCode: `Customer return: ${reason}`,
            createdBy: cashierName,
            createdAt: now,
          });
        }
      }
    }

    // Active shift refund adjustment
    const activeShift = await db.shifts.filter(s => s.status === 'OPEN').first();
    if (activeShift) {
      await db.shifts.update(activeShift.id, {
        cashRefunds: activeShift.cashRefunds + refundAmount,
        expectedCash: Math.max(0, activeShift.expectedCash - refundAmount),
      });

      await db.cashMovements.add({
        id: `csh_${Date.now()}`,
        shiftId: activeShift.id,
        type: 'REFUND',
        amount: -refundAmount,
        reason: `Refund for ${sale.orderNumber}: ${reason}`,
        cashierId,
        createdAt: now,
      });
    }

    await db.auditEvents.add({
      id: `aud_${Date.now()}`,
      timestamp: now,
      actorId: cashierId,
      actorName: cashierName,
      action: 'SALE_REFUNDED',
      entityType: 'SALE',
      entityId: sale.orderNumber,
      details: `Processed refund of $${refundAmount.toFixed(2)} on ${sale.orderNumber}. Reason: ${reason}`,
      locationId: sale.locationId,
    });

    await db.syncOutbox.add({
      id: `cmd_${Date.now()}`,
      organizationId: sale.organizationId,
      locationId: sale.locationId,
      terminalId: sale.registerId,
      actorId: cashierId,
      deviceSequence: Date.now(),
      idempotencyKey: `idemp_ref_${sale.id}_${Date.now()}`,
      commandType: 'REFUND_CREATED',
      aggregateId: sale.id,
      payload: { saleId: sale.id, refundAmount, reason },
      createdAt: now,
      retryCount: 0,
      status: 'ACKED',
    });
  });
}
