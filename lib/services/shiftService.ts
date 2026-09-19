// NEXORA POS - Shift & Cash Drawer Service (Smart Close)
import { db } from '../db';
import type { Shift, CashMovement, AuditEvent, SyncCommand } from '../types';

export async function getActiveShift(): Promise<Shift | undefined> {
  return await db.shifts.filter(s => s.status === 'OPEN').first();
}

export async function openShift(
  organizationId: string,
  locationId: string,
  registerId: string,
  cashierId: string,
  cashierName: string,
  openingFloat: number,
  notes?: string
): Promise<Shift> {
  const existing = await getActiveShift();
  if (existing) {
    throw new Error('A shift is already open on this register. Please close it first.');
  }

  const shiftId = `shift_${Date.now()}`;
  const now = new Date().toISOString();

  const newShift: Shift = {
    id: shiftId,
    organizationId,
    locationId,
    registerId,
    cashierId,
    cashierName,
    openedAt: now,
    closedAt: null,
    openingFloat,
    status: 'OPEN',
    cashSales: 0,
    cardSales: 0,
    mobileSales: 0,
    cashRefunds: 0,
    cashIn: 0,
    cashOut: 0,
    safeDrops: 0,
    expectedCash: openingFloat,
    countedCash: null,
    variance: null,
    varianceReason: null,
    notes,
  };

  await db.transaction('rw', [db.shifts, db.cashMovements, db.auditEvents, db.syncOutbox], async () => {
    await db.shifts.add(newShift);

    await db.cashMovements.add({
      id: `csh_${Date.now()}`,
      shiftId,
      type: 'FLOAT',
      amount: openingFloat,
      reason: 'Opening cash float',
      cashierId,
      createdAt: now,
    });

    await db.auditEvents.add({
      id: `aud_${Date.now()}`,
      timestamp: now,
      actorId: cashierId,
      actorName: cashierName,
      action: 'SHIFT_OPENED',
      entityType: 'SHIFT',
      entityId: shiftId,
      details: `Opened shift with $${openingFloat.toFixed(2)} float on register ${registerId}`,
      locationId,
    });

    await db.syncOutbox.add({
      id: `cmd_${Date.now()}`,
      organizationId,
      locationId,
      terminalId: registerId,
      actorId: cashierId,
      deviceSequence: Date.now(),
      idempotencyKey: `idemp_shift_open_${shiftId}`,
      commandType: 'SHIFT_OPENED',
      aggregateId: shiftId,
      payload: newShift,
      createdAt: now,
      retryCount: 0,
      status: 'ACKED',
    });
  });

  return newShift;
}

export async function recordCashMovement(
  shiftId: string,
  type: 'CASH_IN' | 'CASH_OUT' | 'SAFE_DROP',
  amount: number,
  reason: string,
  cashierId: string,
  cashierName: string,
  locationId: string
) {
  const shift = await db.shifts.get(shiftId);
  if (!shift || shift.status !== 'OPEN') {
    throw new Error('Shift not found or already closed');
  }

  const now = new Date().toISOString();

  await db.transaction('rw', [db.shifts, db.cashMovements, db.auditEvents], async () => {
    let newExpected = shift.expectedCash;
    let cashInUpdate = shift.cashIn;
    let cashOutUpdate = shift.cashOut;
    let safeDropsUpdate = shift.safeDrops;

    if (type === 'CASH_IN') {
      newExpected += amount;
      cashInUpdate += amount;
    } else if (type === 'CASH_OUT') {
      newExpected -= amount;
      cashOutUpdate += amount;
    } else if (type === 'SAFE_DROP') {
      newExpected -= amount;
      safeDropsUpdate += amount;
    }

    await db.shifts.update(shiftId, {
      expectedCash: newExpected,
      cashIn: cashInUpdate,
      cashOut: cashOutUpdate,
      safeDrops: safeDropsUpdate,
    });

    await db.cashMovements.add({
      id: `csh_${Date.now()}`,
      shiftId,
      type,
      amount: type === 'CASH_IN' ? amount : -amount,
      reason,
      cashierId,
      createdAt: now,
    });

    await db.auditEvents.add({
      id: `aud_${Date.now()}`,
      timestamp: now,
      actorId: cashierId,
      actorName: cashierName,
      action: `CASH_${type}`,
      entityType: 'SHIFT',
      entityId: shiftId,
      details: `${type.replace('_', ' ')} of $${amount.toFixed(2)}. Reason: ${reason}`,
      locationId,
    });
  });
}

export async function closeShift(
  shiftId: string,
  countedCash: number,
  varianceReason: string | null,
  notes: string | undefined,
  cashierId: string,
  cashierName: string,
  locationId: string
): Promise<Shift> {
  const shift = await db.shifts.get(shiftId);
  if (!shift || shift.status !== 'OPEN') {
    throw new Error('Active shift not found');
  }

  const now = new Date().toISOString();
  const variance = Number((countedCash - shift.expectedCash).toFixed(2));

  const updatedFields = {
    status: 'CLOSED' as const,
    closedAt: now,
    countedCash,
    variance,
    varianceReason: variance !== 0 ? varianceReason : null,
    notes: notes || shift.notes,
  };

  await db.transaction('rw', [db.shifts, db.auditEvents, db.syncOutbox], async () => {
    await db.shifts.update(shiftId, updatedFields);

    await db.auditEvents.add({
      id: `aud_${Date.now()}`,
      timestamp: now,
      actorId: cashierId,
      actorName: cashierName,
      action: 'SHIFT_CLOSED',
      entityType: 'SHIFT',
      entityId: shiftId,
      details: `Shift closed. Expected: $${shift.expectedCash.toFixed(2)}, Counted: $${countedCash.toFixed(2)}, Variance: $${variance.toFixed(2)}`,
      locationId,
    });

    await db.syncOutbox.add({
      id: `cmd_${Date.now()}`,
      organizationId: shift.organizationId,
      locationId,
      terminalId: shift.registerId,
      actorId: cashierId,
      deviceSequence: Date.now(),
      idempotencyKey: `idemp_shift_close_${shiftId}`,
      commandType: 'SHIFT_CLOSED',
      aggregateId: shiftId,
      payload: { ...shift, ...updatedFields },
      createdAt: now,
      retryCount: 0,
      status: 'ACKED',
    });
  });

  return { ...shift, ...updatedFields };
}
