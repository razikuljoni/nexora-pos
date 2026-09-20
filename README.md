# NEXORA POS

> **Enterprise-Grade, Offline-First Point of Sale & Predictive Inventory System**

NEXORA POS is a progressive web application (PWA) designed for retail, grocery, and hospitality environments. It combines **sub-second local checkout**, **double-entry inventory and cash ledgers**, **predictive seasonality demand forecasting**, and **zero-latency offline operations** backed by browser IndexedDB.

---

## Architecture & System Mindmap

```
+-------------------------------------------------------------------------------+
|                                  NEXORA POS                                   |
+-------------------------------------------------------------------------------+
         |                                |                            |
         v                                v                            v
+------------------+            +-------------------+        +------------------+
|   POS CHECKOUT   |            | INVENTORY ENGINE  |        | MANAGER & SHIFT  |
| - Sub-second Cart|            | - Double-Entry Log|        | - Till Float/Drop|
| - Multi-Tender   |            | - Transfers/Alerts|        | - Variance Audit |
| - Barcode & QR   |            | - SKU Reorder ROP |        | - Multi-Widget BI|
+------------------+            +-------------------+        +------------------+
         |                                |                            |
         +--------------------------------+----------------------------+
                                          |
                                          v
                   +---------------------------------------------+
                   |       PREDICTIVE FORECASTING ENGINE         |
                   | - Empirical Burn-Rate Velocity (7/14/30d)   |
                   | - Weekly Seasonality & Day-of-Week Weights  |
                   | - Dynamic Safety Stock & EOQ Buffer         |
                   | - 21-Day Depletion Trajectory Curves        |
                   | - 1-Click Replenish & Purchase Order (PO)   |
                   +---------------------------------------------+
                                          |
                                          v
                   +---------------------------------------------+
                   |       STORAGE & OFFLINE PERSISTENCE         |
                   | - Dexie IndexedDB (Zero Network Dependency) |
                   | - Local Sync Outbox & Audit Trails          |
                   | - Service Worker Asset & Shell Cache        |
                   +---------------------------------------------+
```

---

## Key Features

### 1. High-Speed Terminal & POS Checkout
- **Adaptive Layout**: Optimized for desktop touchscreens, tablets, and smartphones.
- **Multi-Tender Payments**: Cash with quick change calculators, Card, Mobile NFC/QR, and Store Credit.
- **Fast Search & Barcode Emulation**: Sub-millisecond SKU, barcode, and product name lookups.
- **Digital & Thermal Receipts**: Generates ESC/POS printable receipts with digital QR verification codes.

### 2. Predictive Inventory & Seasonality Demand Forecasting
- **Historical Velocity Modeling**: Calculates daily run-rates across customizable lookback windows (7, 14, 30 days).
- **Seasonality Profiles**:
  - *Weekly Rhythm*: Computes day-of-week demand multipliers from historical sales.
  - *Weekend Surge*: Applies dynamic weekend weighting.
  - *Momentum*: Evaluates recent 7-day velocity acceleration vs. prior periods.
- **Runway & Stockout Date Forecasting**: Computes exact days of remaining inventory and projected stockout calendar dates.
- **Automated Reorder Recommendations**: Calculates Reorder Points (ROP) and Economic Order Quantity buffers using supplier lead times.
- **21-Day Depletion Simulation**: Interactive visual trajectory charts showing unreplenished vs. replenished stock projections.
- **Instant PO Generation**: Creates vendor-specific Purchase Orders with 1-click ledger application.

### 3. Cash Management & Shift Reconciliations
- **Cash Drawer Life Cycle**: Opening float, paid-in/paid-out entries, bank safe drops, and blind count end-of-shift reconciliations.
- **Explainable Variance Audits**: Automatic overage/shortage calculation with immutable audit events.

### 4. Offline-First Resilience
- **Zero-Network Downtime**: All catalog queries, sales processing, and inventory updates execute locally in IndexedDB via Dexie.
- **Sync Outbox**: Transactions are queued locally and synchronized seamlessly when connectivity is restored.

---

## Project Structure

```
.
├── app/                          # Next.js App Router
│   ├── api/                      # Server-side API routes & Gemini endpoints
│   ├── verify/                   # Fiscal receipt QR verification page
│   ├── globals.css               # Tailwind CSS imports & animations
│   ├── layout.tsx                # Root layout, viewport & PWA metadata
│   ├── manifest.ts               # PWA Web App Manifest configuration
│   ├── page.tsx                  # Main POS application orchestrator
│   ├── robots.ts                 # Production crawler directives
│   └── sitemap.ts                # Production sitemap generator
│
├── components/                   # Modular React UI Components
│   ├── cart/                     # Shopping cart, line modifiers, tenders
│   ├── cash/                     # Cash drawer, shift management, float logs
│   ├── customers/                # Customer directory, loyalty, store credit
│   ├── dashboard/                # Manager Analytics & Widget Control
│   │   ├── PredictiveForecastingWidget.tsx  # Seasonality & PO demand engine
│   │   ├── SalesChartWidget.tsx             # Sales velocity chart
│   │   ├── SalesHeatmapWidget.tsx           # Thermal traffic heatmap
│   │   ├── LowStockAlertsWidget.tsx         # Real-time stock alerts
│   │   ├── CategoryBreakdownWidget.tsx      # Department revenue shares
│   │   ├── RegisterPulseWidget.tsx          # Till cash pulse & sync health
│   │   └── ManagerDashboardView.tsx         # Dashboard layout orchestrator
│   ├── inventory/                # SKU catalog, stock ledger, transfers, POs
│   ├── pos/                      # Catalog grid, category pills, search bar
│   ├── receipts/                 # Thermal receipt preview & QR generator
│   └── ui/                       # Shared navigation, modals, badges, inputs
│
├── hooks/                        # Custom React Hooks
│   ├── useBarcodeScanner.ts      # Hardware keyboard-wedge scanner listener
│   └── useKeyboardShortcuts.ts   # POS terminal hotkey handlers
│
├── lib/                          # Core Business Logic & Infrastructure
│   ├── audio.ts                  # Audio feedback synthesizers (clicks/alerts)
│   ├── db.ts                     # Dexie IndexedDB database & schema tables
│   ├── mockData.ts               # Seed catalog, suppliers, and sample sales
│   ├── types.ts                  # Complete TypeScript domain interfaces
│   └── services/                 # ACID domain transaction services
│       ├── cashService.ts        # Shift floats, safe drops & reconciliation
│       ├── inventoryService.ts   # Double-entry inventory ledger & POs
│       ├── receiptService.ts     # Receipt formatting & verification hashing
│       └── salesService.ts       # Atomic checkout & sale completion
│
├── public/                       # Static Assets & PWA Icons
│   ├── apple-touch-icon.png      # iOS home screen icon
│   ├── icon.svg                  # Vector application emblem
│   ├── pwa-192x192.png           # Android PWA icon
│   ├── pwa-512x512.png           # High-resolution splash icon
│   └── sw.js                     # Offline Service Worker cache worker
│
├── .github/workflows/ci.yml      # GitHub Actions CI/CD automation
├── ARCHITECTURE.md               # Detailed system architecture specification
├── CHANGELOG.md                  # Semantic Versioning release notes
├── CONTRIBUTING.md               # Contributor guidelines and standards
├── DEPLOYMENT.md                 # Production deployment runbook
├── Dockerfile                    # Multi-stage production container configuration
└── LICENSE                       # MIT Open-Source License
```

---

## Getting Started

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Start development server on port 3000
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000).

### Build for Production
```bash
# Compile and build standalone application
npm run build

# Start production server
npm run start
```

### Run with Docker
```bash
# Build Docker image
docker build -t nexora-pos .

# Run container on port 3000
docker run -p 3000:3000 nexora-pos
```

---

## Keyboard Shortcuts for POS Terminals

| Key | Action |
| --- | --- |
| `F2` or `/` | Focus product search input |
| `F4` or `Space` | Open tender / payment modal |
| `F8` | Park / hold current transaction |
| `F9` | Retrieve parked transactions |
| `Escape` | Dismiss active modal or clear selection |

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
