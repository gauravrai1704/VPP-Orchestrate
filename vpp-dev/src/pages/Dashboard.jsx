import { useVPPStore } from '../context/store'
import AssetCard from '../components/AssetCard'
import GridOutputChart from '../components/GridOutputChart'
import EventFeed from '../components/EventFeed'
import GridNodePanel from '../components/GridNodePanel'

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-4">
      <p className="stat-label mb-1">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="text-vpp-dim text-xs font-light mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { assets = [], events = [] } = useVPPStore()
  const totalOutput = assets.reduce((s, a) => s + Number(a.active_power_kw || 0), 0)
  
  const activeCount = assets.filter((a) => a.asset_status === 'ACTIVE' || a.asset_status === 'DISCHARGING').length
  const faultCount = assets.filter((a) => a.asset_status === 'FAULT').length
  const criticalCount = events.filter((e) => e.severity === 'CRITICAL' && !e.resolved_ts).length
  const totalMW = (typeof totalOutput === 'number' && totalOutput >= 1000)
    ? `${(totalOutput / 1000).toFixed(2)} MW`
    : `${(totalOutput || 0).toFixed(0)} kW`

  return (
    <div className="space-y-5">
      {/* Top KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Output"
          value={totalMW}
          sub={`${assets.length} assets`}
        />
        <StatCard
          label="Active Assets"
          value={activeCount}
          sub={`${assets.length - activeCount} offline`}
        />
        <StatCard
          label="Grid Faults"
          value={faultCount}
          sub={faultCount === 0 ? 'All systems nominal' : 'Investigate required'}
        />
        <StatCard
          label="Critical Events"
          value={criticalCount}
          sub="unresolved"
        />
      </div>

      {/* Chart + Nodes row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <GridOutputChart />
        </div>
        <GridNodePanel />
      </div>

      {/* Asset grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold tracking-tight text-vpp-forest text-sm">
            Asset Grid
          </p>
          <p className="stat-label text-xs">Click any card to drill down</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {assets.map((asset) => (
            <AssetCard key={asset.asset_id} asset={asset} />
          ))}
        </div>
      </div>

      {/* Event feed */}
      <EventFeed maxHeight="240px" />
    </div>
  )
}
