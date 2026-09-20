# Changelog

All notable changes to the **NEXORA POS** project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-09-20

### Added
- **Predictive Inventory & Seasonality Demand Forecasting**:
  - Empirical sales history velocity analysis with configurable time horizons (7, 14, 30 days).
  - Multi-profile seasonality modeling (Dynamic Weekly Rhythm with day-of-week distribution, Weekend/Peak Surge, and Short-term Momentum growth factor).
  - Automated Reorder Point (ROP) and Economic Order Quantity (EOQ) buffer formulas based on supplier lead times and safety stocks.
  - Interactive 21-day inventory depletion and replenishment simulation modal chart with Recharts.
  - 1-click single-item restock and batch critical replenishment directly applied to Dexie ledger with audit trails.
  - Formal Purchase Order (PO) creation modal with supplier assignment and clipboard requisition export.
- **Production CI/CD Automation**:
  - GitHub Actions workflow for linting, type validation, and standalone Docker bundle verification.
  - Multi-stage Alpine Dockerfile with standalone Node.js runtime and automated container healthcheck.
  - Complete architecture, deployment, and contributing specifications.

### Enhanced
- **Responsive Navigation & Ergonomics**:
  - Ergonomic mobile bottom navigation bar with active indicators.
  - Fluid POS sub-tab switching between catalog and floating checkout cart on small screens.
  - High-density desktop tables and responsive mobile transaction/stock cards.

---

## [1.1.0] - 2026-08-15

### Added
- **Cash & Register Shift Management**:
  - Cash float initialization, paid-in/paid-out, safe drops, and end-of-shift reconciliation variance tracking.
  - Complete audit event logging with actor attribution and timestamps.
- **Inventory Ledger & Stock Transfers**:
  - Multi-location stock transfer dispatch and receipt workflows.
  - Real-time stock alerts with critical threshold notifications.

---

## [1.0.0] - 2026-07-01

### Added
- Initial production release of NEXORA POS.
- Offline-first IndexedDB storage via Dexie.js.
- Dual Retail & Café operational modes with modifiers, table seating, and kitchen station routing.
- Sub-second checkout workflow supporting Cash, Card, Mobile Wallet, and Store Credit.
- Digital thermal receipt generation with QR-code fiscal verification.
