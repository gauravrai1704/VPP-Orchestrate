# VPP-Orchestrate Frontend & Backend

Full-stack React + Express dashboard for the VPP-Orchestrate MySQL database.

## Setup Instructions

### Prerequisites
- Node.js 18+
- MySQL 8.0 with vpp_orchestrate database set up (run SQL commands in the dump file)

---

### Step 1 — Install frontend dependencies

Open a terminal in the `vpp-dev/` folder:

```bash
npm install
```
---

### Step 2 — Set up the backend

Open a second terminal in the `vpp-dev/backend/` folder:

```bash
npm install
```

Edit `.env`:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=vpp_orchestrate
```

Note: You need to create the database using the .sql code sin the dump file.
---

### Step 3 — Start the backend API

```bash
cd backend
npm start
```

You should see:
```
VPP-Orchestrate API running on http://localhost:3001
```

Test it:
```
http://localhost:3001/api/health
http://localhost:3001/api/assets
http://localhost:3001/api/nodes
```

---

### Step 4 — Start the frontend

In a separate terminal from the `vpp-dev/` root:

```bash
npm run dev
```

Open: **http://localhost:5173**

---

## Project Structure

```
vpp-dev/
├── src/
│   ├── components/
│   │   ├── AssetCard.jsx       — Asset card with hover states
│   │   ├── AssetDrawer.jsx     — Slide-over drill-down panel
│   │   ├── AssetIcons.jsx      — SVG Solar/Wind/Battery/Inverter icons
│   │   ├── EventFeed.jsx       — Live event feed
│   │   ├── GridNodePanel.jsx   — Node load bars
│   │   ├── GridOutputChart.jsx — Recharts live output chart
│   │   └── Sidebar.jsx         — Navigation sidebar
│   ├── pages/
│   │   ├── Dashboard.jsx       — Main dashboard
│   │   ├── AssetManagement.jsx — Filter/search all assets
│   │   ├── EventLogs.jsx       — Event log with severity filters
│   │   ├── Analytics.jsx       — Charts and battery health table
│   │   └── P2PTrading.jsx      — Blockchain P2P ledger
|	|	|__ NovelFeatures.jsx
│   ├── context/
│   │   └── store.js            — Zustand global state
│   |
│   │   
│   ├── hooks/
│   │   └── useSimulation.js    — 3-second live simulation loop
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── backend/
│   ├── server.js               — Express API (19 endpoints)
│   ├── package.json
│   └── .env                    - Not shared as it contins password
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```


## Connecting to Live Database

The Vite config proxies `/api/*` to `http://localhost:3001`. When the backend is running with a live MySQL connection, all pages pull real data. To switch a page from mock to live data, replace `useVPPStore` reads with `fetch('/api/...')` calls using `useEffect`.

## API Endpoints (Express backend)

```
GET  /api/health
GET  /api/nodes
GET  /api/assets
GET  /api/assets/:id
PATCH /api/assets/:id/status        body: { status: "ACTIVE"|"IDLE"|"MAINTENANCE" }
GET  /api/telemetry/:assetId        ?limit=50
GET  /api/events                    ?severity=CRITICAL&limit=50
GET  /api/prosumers
GET  /api/transactions              ?prosumer_id=1
GET  /api/p2p
POST /api/p2p                       body: { seller_id, buyer_id, asset_id, energy_kwh, price }
GET  /api/p2p/verify
GET  /api/grid/health
GET  /api/grid/fault/:nodeId
GET  /api/invoice/:prosumerId       ?from=2025-01-01&to=2025-03-31
GET  /api/price                     ?ts=2025-07-15 18:30:00&tariff=RESIDENTIAL&dr=false
GET  /api/audit                     ?asset_id=6
GET  /api/analytics/dashboard
GET  /api/analytics/billing
GET  /api/analytics/thermal
```
