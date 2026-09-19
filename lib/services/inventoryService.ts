// NEXORA POS - Inventory Truth & Stock Ledger Service
import { db } from '../db';
import type {
  Product,
  InventoryMovement,
  InventoryMovementType,
  PurchaseOrder,
  StockTransfer,
  AuditEvent,
} from '../types';

export async function adjustStock(
  productId: string,
  quantityDelta: number,
  movementType: InventoryMovementType,
  reasonCode: string,
  actorId: string,
  actorName: string,
  locationId: string,
  organizationId: string
) {
  const product = await db.products.get(productId);
  if (!product) throw new Error('Product not found');

  const now = new Date().toISOString();
  const newQuantity = (product.stockQuantity || 0) + quantityDelta;

  await db.transaction('rw', [db.products, db.inventoryMovements, db.auditEvents, db.syncOutbox], async () => {
    await db.products.update(productId, { stockQuantity: newQuantity });

    const movement: InventoryMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      organizationId,
      locationId,
      productId,
      productName: product.name,
      movementType,
      quantity: quantityDelta,
      unitCost: product.purchaseCost,
      referenceType: 'MANUAL',
      reasonCode,
      createdBy: actorName,
      createdAt: now,
    };
    await db.inventoryMovements.add(movement);

    await db.auditEvents.add({
      id: `aud_${Date.now()}`,
      timestamp: now,
      actorId,
      actorName,
      action: 'INVENTORY_ADJUSTED',
      entityType: 'PRODUCT',
      entityId: product.sku,
      details: `Adjusted ${product.name} by ${quantityDelta > 0 ? '+' : ''}${quantityDelta} (${reasonCode}). New balance: ${newQuantity}`,
      locationId,
    });

    await db.syncOutbox.add({
      id: `cmd_${Date.now()}`,
      organizationId,
      locationId,
      terminalId: 'reg_01',
      actorId,
      deviceSequence: Date.now(),
      idempotencyKey: `idemp_adj_${productId}_${Date.now()}`,
      commandType: 'STOCK_ADJUSTED',
      aggregateId: productId,
      payload: { productId, quantityDelta, newQuantity, reasonCode },
      createdAt: now,
      retryCount: 0,
      status: 'ACKED',
    });
  });

  return newQuantity;
}

export async function receivePurchaseOrder(
  poId: string,
  actorName: string,
  actorId: string,
  locationId: string,
  organizationId: string
) {
  const po = await db.purchaseOrders.get(poId);
  if (!po) throw new Error('Purchase order not found');

  const now = new Date().toISOString();

  await db.transaction('rw', [db.purchaseOrders, db.products, db.inventoryMovements, db.auditEvents], async () => {
    // Update each item in inventory
    for (const item of po.items) {
      const product = await db.products.get(item.productId);
      if (product) {
        const received = item.quantity; // receive full remaining
        const newQty = (product.stockQuantity || 0) + received;
        await db.products.update(product.id, { stockQuantity: newQty });

        await db.inventoryMovements.add({
          id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          organizationId,
          locationId,
          productId: product.id,
          productName: product.name,
          movementType: 'PURCHASE_RECEIPT',
          quantity: received,
          unitCost: item.unitCost,
          referenceType: 'PURCHASE_ORDER',
          referenceId: po.poNumber,
          reasonCode: `Received delivery from ${po.supplierName}`,
          createdBy: actorName,
          createdAt: now,
        });
      }
    }

    await db.purchaseOrders.update(poId, {
      status: 'RECEIVED',
      receivedAt: now,
      items: po.items.map(it => ({ ...it, receivedQuantity: it.quantity })),
    });

    await db.auditEvents.add({
      id: `aud_${Date.now()}`,
      timestamp: now,
      actorId,
      actorName,
      action: 'PURCHASE_ORDER_RECEIVED',
      entityType: 'PURCHASE_ORDER',
      entityId: po.poNumber,
      details: `Received full order ${po.poNumber} from ${po.supplierName}. Total inventory valued at $${po.totalCost.toFixed(2)}`,
      locationId,
    });
  });
}

export async function createStockTransfer(
  fromLocationId: string,
  fromLocationName: string,
  toLocationId: string,
  toLocationName: string,
  items: Array<{ productId: string; productName: string; sku: string; quantity: number }>,
  actorName: string,
  actorId: string,
  organizationId: string,
  notes?: string
): Promise<StockTransfer> {
  const transferId = `tr_${Date.now()}`;
  const transferNumber = `TR-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const transfer: StockTransfer = {
    id: transferId,
    transferNumber,
    fromLocationId,
    fromLocationName,
    toLocationId,
    toLocationName,
    status: 'IN_TRANSIT',
    items,
    createdAt: now,
    notes,
  };

  await db.transaction('rw', [db.stockTransfers, db.products, db.inventoryMovements, db.auditEvents], async () => {
    await db.stockTransfers.add(transfer);

    for (const item of items) {
      const prod = await db.products.get(item.productId);
      if (prod) {
        // Transfer out decrements origin
        const updated = Math.max(0, (prod.stockQuantity || 0) - item.quantity);
        await db.products.update(prod.id, { stockQuantity: updated });

        await db.inventoryMovements.add({
          id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          organizationId,
          locationId: fromLocationId,
          productId: prod.id,
          productName: prod.name,
          movementType: 'TRANSFER_OUT',
          quantity: -item.quantity,
          unitCost: prod.purchaseCost,
          referenceType: 'TRANSFER',
          referenceId: transferNumber,
          reasonCode: `Dispatched to ${toLocationName}`,
          createdBy: actorName,
          createdAt: now,
        });
      }
    }

    await db.auditEvents.add({
      id: `aud_${Date.now()}`,
      timestamp: now,
      actorId,
      actorName,
      action: 'TRANSFER_DISPATCHED',
      entityType: 'STOCK_TRANSFER',
      entityId: transferNumber,
      details: `Dispatched transfer ${transferNumber} from ${fromLocationName} to ${toLocationName}`,
      locationId: fromLocationId,
    });
  });

  return transfer;
}

export async function receiveStockTransfer(
  transferId: string,
  actorName: string,
  actorId: string,
  organizationId: string
) {
  const transfer = await db.stockTransfers.get(transferId);
  if (!transfer || transfer.status === 'RECEIVED') return;

  const now = new Date().toISOString();

  await db.transaction('rw', [db.stockTransfers, db.products, db.inventoryMovements, db.auditEvents], async () => {
    await db.stockTransfers.update(transferId, {
      status: 'RECEIVED',
      receivedAt: now,
    });

    for (const item of transfer.items) {
      const prod = await db.products.get(item.productId);
      if (prod) {
        // Transfer in increments destination
        await db.products.update(prod.id, { stockQuantity: (prod.stockQuantity || 0) + item.quantity });

        await db.inventoryMovements.add({
          id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          organizationId,
          locationId: transfer.toLocationId,
          productId: prod.id,
          productName: prod.name,
          movementType: 'TRANSFER_IN',
          quantity: item.quantity,
          unitCost: prod.purchaseCost,
          referenceType: 'TRANSFER',
          referenceId: transfer.transferNumber,
          reasonCode: `Received from ${transfer.fromLocationName}`,
          createdBy: actorName,
          createdAt: now,
        });
      }
    }

    await db.auditEvents.add({
      id: `aud_${Date.now()}`,
      timestamp: now,
      actorId,
      actorName,
      action: 'TRANSFER_RECEIVED',
      entityType: 'STOCK_TRANSFER',
      entityId: transfer.transferNumber,
      details: `Received stock transfer ${transfer.transferNumber} at ${transfer.toLocationName}`,
      locationId: transfer.toLocationId,
    });
  });
}
