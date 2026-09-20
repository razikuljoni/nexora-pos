# NEXORA POS — System Architecture & Design Specification

This document provides a comprehensive technical overview of the **NEXORA POS** platform architecture, data synchronization protocols, state management, and offline storage models.

---

## 1. High-Level System Architecture Mindmap

```
+-----------------------------------------------------------------------------+
|                                 NEXORA POS                                  |
|                   (Offline-First Progressive Web App)                       |
+-----------------------------------------------------------------------------+
                                       |
    +----------------------------------+----------------------------------+
    |                                  |                                  |
    v                                  v                                  v
+-----------------------+  +-----------------------+  +-----------------------+
|    UI / CLIENT LAYER  |  |    BUSINESS DOMAIN    |  |     STORAGE LAYER     |
| - React 19 / Next.js  |  | - Order / Cart Engine |  | - Dexie IndexedDB     |
| - Tailwind CSS v4     |  | - Inventory Ledgers   |  | - Service Worker      |
| - Responsive POS View |  | - Cash Management     |  | - Local Outbox Queue  |
| - Executive Analytics |  | - Demand Forecasting  |  | - Offline Sync Worker |
+-----------------------+  +-----------------------+  +-----------------------+
                                       |
    +----------------------------------+----------------------------------+
    |                                  |                                  |
    v                                  v                                  v
+-----------------------+  +-----------------------+  +-----------------------+
|  PREDICTIVE ENGINE    |  | HARDWARE INTEGRATION  |  |  FISCAL AUDIT LAYER   |
| - Sales Run-Rate      |  | - Thermal Printing    |  | - Double-Entry Ledger |
| - Seasonality Weights |  | - Barcode Scanning    |  | - Immutable Audit Log |
| - Dynamic ROP / Buffer|  | - Cash Drawer Kicks   |  | - QR Verification     |
+-----------------------+  +-----------------------+  +-----------------------+
```

---

## 2. Core Operational Workflows

### A. Point-of-Sale (POS) Checkout & Transaction Lifecycle
```
[Scan / Select Item] ---> [Calculate Taxes & Modifiers] ---> [Tender Payment (Cash/Card)]
                                                                   |
                                                                   v
[Print / Digital Receipt] <--- [Record Audit Log] <--- [Deduct Stock & Update Ledger]
```

### B. Predictive Inventory Forecasting & Reorder Workflow
```
[Historical Sales Stream]
          |
          v
[Compute Velocity & Day-of-Week Seasonality Multipliers]
          |
          v
[Simulate Daily Depletion Countdown (Runway & Stockout Date)]
          |
          v
[Calculate Safety Stock & Suggested Reorder Buffer (EOQ)]
          |
          +---> [1-Click Direct Restock Ledger Update]
          |
          +---> [Generate Official Purchase Order (PO) to Vendor]
```

---

## 3. Database Schema Overview (Dexie IndexedDB)

NEXORA POS uses a multi-table schema in browser IndexedDB, ensuring zero-latency access and complete resilience against network outages:

- **`products`**: Product catalog, SKUs, barcodes, categories, costs, and current stock balances.
- **`categories`**: Department classification and display styles.
- **`sales`**: Complete transaction records, payment splits, itemizations, and sync states.
- **`shifts`**: Cash drawer shift lifecycle (opening float, sales totals, variances, closures).
- **`cashMovements`**: Individual paid-in, paid-out, safe drops, and cash adjust records.
- **`inventoryMovements`**: Immutable double-entry inventory transactions (sales, purchases, transfers, adjustments).
- **`suppliers`**: Wholesale vendors and supplier directory.
- **`purchaseOrders`**: Automated and manual procurement orders with line item quantities.
- **`stockTransfers`**: Inter-location inventory movement requests and receipt reconciliations.
- **`auditEvents`**: Compliance tracking for manager overrides, voids, refunds, and adjustments.
- **`syncOutbox`**: Idempotent offline command queue for server reconciliation.

---

## 4. Security & Compliance Model

1. **Role-Based Access Control (RBAC)**: Supports `OWNER`, `MANAGER`, `SUPERVISOR`, `CASHIER`, and `STOCK_OPERATOR` roles with granular permission checks.
2. **Offline-First Security**: PIN-based authentication verified locally with secure session stores.
3. **Fiscal Verification**: Digital receipts contain cryptographically signed verification URLs and timestamps for customer assurance.
