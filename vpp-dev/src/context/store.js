import { create } from 'zustand'

export const useVPPStore = create((set, get) => ({
  assets: [],
  selectedAsset: null,
  drawerOpen: false,
  events: [],
  gridNodes: [],
  p2pTrades: [],
  prosumers: [], // 1. Added to initial state
  activePage: 'dashboard',
  systemLive: true,
  chartHistory: [],

  setSelectedAsset: (asset) => set({ selectedAsset: asset, drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false, selectedAsset: null }),
  
  updateAssetOutput: (assetId, newOutput, newSoc) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.asset_id === assetId
          ? { 
              ...a, 
              active_power_kw: Number(newOutput || 0), 
              current_soc: newSoc !== null ? Number(newSoc) : a.current_soc 
            }
          : a
      ),
    })),

  updateAssetStatus: (assetId, status) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.asset_id === assetId ? { ...a, asset_status: status } : a
      ),
    })),

  addEvent: (event) =>
    set((state) => ({ events: [event, ...state.events].slice(0, 50) })),

  updateNodeLoad: (nodeId, load) =>
    set((state) => ({
      gridNodes: state.gridNodes.map((n) =>
        n.node_id === nodeId ? { ...n, current_load_mw: Number(load || 0) } : n
      ),
    })),

  pushChartPoint: (point) =>
    set((state) => ({ 
      chartHistory: [...state.chartHistory.slice(-29), {
        ...point,
        solar: Number(point.solar || 0),
        wind: Number(point.wind || 0),
        battery: Number(point.battery || 0),
        total: Number(point.total || 0)
      }] 
    })),

  setActivePage: (page) => set({ activePage: page }),

  fetchAll: async () => {
    try {
      // 2. Added /api/prosumers to the parallel fetch
      const [rawAssets, rawNodes, rawEvents, rawP2p, rawProsumers] = await Promise.all([
        fetch('/api/assets').then(r => r.json()),
        fetch('/api/nodes').then(r => r.json()),
        fetch('/api/events?limit=50').then(r => r.json()),
        fetch('/api/p2p').then(r => r.json()),
        fetch('/api/prosumers').then(r => r.json()), 
      ])

      const cleanAssets = (rawAssets || []).map(a => ({
        ...a,
        active_power_kw: Number(a.active_power_kw || 0),
        max_output_kw: Number(a.max_output_kw || 0),
        current_soc: a.current_soc != null ? Number(a.current_soc) : null,
        capacity_kwh: Number(a.capacity_kwh || 0),
        cycle_count: Number(a.cycle_count || 0),
        dispatchable_kwh: a.dispatchable_kwh != null ? Number(a.dispatchable_kwh) : 0,
      }))

      const cleanNodes = (rawNodes || []).map(n => ({
        ...n,
        current_load_mw: Number(n.current_load_mw || 0),
        max_load_mw: Number(n.max_load_mw || 0),
      }))

      const cleanP2p = (rawP2p || []).map(t => ({
        ...t,
        energy_kwh: Number(t.energy_kwh || 0),
        agreed_price: Number(t.agreed_price || 0),
        trade_amount: Number(t.trade_amount || 0),
      }))

      // 3. Clean Prosumer data
      const cleanProsumers = (rawProsumers || []).map(p => ({
        ...p,
        wallet_balance: Number(p.wallet_balance || 0)
      }))

      set({ 
        assets: cleanAssets, 
        gridNodes: cleanNodes, 
        events: rawEvents, 
        p2pTrades: cleanP2p, 
        prosumers: cleanProsumers, // 4. Set prosumers in state
        systemLive: true 
      })

    } catch (err) {
      console.error('Failed to fetch from API:', err)
      set({ systemLive: false })
    }
  },
}))