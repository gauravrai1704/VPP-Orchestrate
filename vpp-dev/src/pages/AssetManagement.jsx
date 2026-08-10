import { useState } from 'react'
import { useVPPStore } from '../context/store'
import AssetCard from '../components/AssetCard'

const FILTERS = ['ALL', 'SOLAR', 'WIND', 'BATTERY', 'INVERTER']
const STATUSES = ['ALL', 'ACTIVE', 'IDLE', 'FAULT', 'MAINTENANCE', 'DISCHARGING']

export default function AssetManagement() {
  // 1. Added fallback to empty array to prevent crashes during initial load
  const { assets = [] } = useVPPStore()
  const [typeFilter,   setTypeFilter]   = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search,       setSearch]       = useState('')

  const filtered = assets.filter((a) => {
    if (typeFilter   !== 'ALL' && a.asset_type   !== typeFilter)   return false
    if (statusFilter !== 'ALL' && a.asset_status !== statusFilter) return false
    if (search && !`${a.manufacturer} ${a.model_number}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // 2. Calculate unique node count safely
  const uniqueNodes = [...new Set(assets.map(a => a.grid_node_id))].length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-bold tracking-tight text-vpp-forest text-lg">Asset Management</h1>
        <p className="text-vpp-dim text-xs font-light mt-0.5">
          {assets.length} assets registered across {uniqueNodes} grid nodes
        </p>
      </div>

      {/* Filters (Logic remains the same) */}
      <div className="card p-4 space-y-3">
        <input
          type="text"
          placeholder="Search manufacturer or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-vpp-border rounded px-3 py-2 text-xs font-josefin
                     text-vpp-forest placeholder-vpp-dim focus:outline-none focus:border-vpp-green
                     transition-colors"
        />

        <div className="flex flex-wrap gap-2">
          <span className="stat-label text-xs self-center mr-1">Type:</span>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={[
                'px-3 py-1 rounded text-xs font-bold tracking-widest uppercase transition-colors duration-150',
                typeFilter === f
                  ? 'bg-vpp-green text-white'
                  : 'bg-vpp-gray border border-vpp-border text-vpp-dim hover:border-vpp-green hover:text-vpp-green',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="stat-label text-xs self-center mr-1">Status:</span>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'px-3 py-1 rounded text-xs font-bold tracking-widest uppercase transition-colors duration-150',
                statusFilter === s
                  ? 'bg-vpp-forest text-white'
                  : 'bg-vpp-gray border border-vpp-border text-vpp-dim hover:border-vpp-forest hover:text-vpp-forest',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="stat-label text-xs">
        Showing {filtered.length} of {assets.length} assets
      </p>

      {/* Asset grid */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-vpp-dim text-sm font-light">No assets match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((asset) => (
            <AssetCard key={asset.asset_id} asset={asset} />
          ))}
        </div>
      )}

      {/* Summary table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-vpp-border">
          <p className="font-bold tracking-tight text-vpp-forest text-sm">Asset Summary Table</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-vpp-gray border-b border-vpp-border">
                <th className="text-left px-4 py-2 stat-label font-bold">ID</th>
                <th className="text-left px-4 py-2 stat-label font-bold">Manufacturer</th>
                <th className="text-left px-4 py-2 stat-label font-bold">Model</th>
                <th className="text-left px-4 py-2 stat-label font-bold">Type</th>
                <th className="text-left px-4 py-2 stat-label font-bold">Node</th>
                <th className="text-left px-4 py-2 stat-label font-bold">Status</th>
                <th className="text-right px-4 py-2 stat-label font-bold">Output (kW)</th>
                <th className="text-right px-4 py-2 stat-label font-bold">SOC %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr
                  key={a.asset_id}
                  className={[
                    'border-b border-gray-50 hover:bg-emerald-50 cursor-pointer transition-colors',
                    i % 2 === 0 ? '' : 'bg-vpp-gray bg-opacity-50',
                  ].join(' ')}
                >
                  <td className="px-4 py-2 text-vpp-dim font-light">#{a.asset_id}</td>
                  <td className="px-4 py-2 text-vpp-forest font-light">{a.manufacturer}</td>
                  <td className="px-4 py-2 text-vpp-dim font-light">{a.model_number}</td>
                  <td className="px-4 py-2 text-vpp-dim font-light">{a.asset_type}</td>
                  <td className="px-4 py-2 text-vpp-dim font-light">#{a.grid_node_id}</td>
                  <td className="px-4 py-2">
                    <span className={[
                      'font-bold tracking-widest uppercase',
                      a.asset_status === 'ACTIVE' || a.asset_status === 'DISCHARGING'
                        ? 'text-vpp-green'
                        : a.asset_status === 'FAULT'
                        ? 'text-vpp-danger'
                        : 'text-vpp-dim',
                    ].join(' ')}>
                      {a.asset_status}
                    </span>
                  </td>
                  {/* 3. CRITICAL: Forced Number casting for table cells */}
                  <td className="px-4 py-2 text-right text-vpp-forest font-light">
                    {a.active_power_kw != null ? Number(a.active_power_kw).toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-vpp-forest font-light">
                    {a.current_soc != null ? `${Number(a.current_soc).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}