import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { useVPPStore } from '../context/store'
// import { mockProsumers } from '../data/mockData' // REMOVED

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-vpp-border rounded px-3 py-2 shadow-sm text-xs font-josefin">
      <p className="font-bold text-vpp-forest mb-1">{label}</p>
      {payload.map((p) => {
        const val = Number(p.value || 0)
        return (
          <p key={p.dataKey} style={{ color: p.color }} className="font-light">
            {p.name}: {val >= 1000 ? `${(val / 1000).toFixed(2)} MW` : `${val.toFixed(1)} kW`}
          </p>
        )
      })}
    </div>
  )
}

function buildTypeData(assets = []) {
  const groups = {}
  assets.forEach((a) => {
    if (!groups[a.asset_type]) groups[a.asset_type] = { type: a.asset_type, output: 0, count: 0 }
    groups[a.asset_type].output += Number(a.active_power_kw || 0)
    groups[a.asset_type].count  += 1
  })
  return Object.values(groups)
}

function buildNodeData(nodes = []) {
  return nodes.map((n) => {
    const current = Number(n.current_load_mw || 0)
    const max = Number(n.max_load_mw || 1)
    return {
      name: n.node_name.replace('Node ', ''),
      load: current,
      max: max,
      pct: Math.round((current / max) * 100),
    }
  })
}

// FIXED: Now uses the 'prosumers' passed from the component
function buildWalletData(prosumers = []) {
  return prosumers.map((p) => ({
    name:    p.full_name,
    balance: Number(p.wallet_balance || 0),
    tariff:  p.tariff_class,
  }))
}

const TYPE_COLORS = {
  SOLAR:    '#F59E0B',
  WIND:     '#10B981',
  BATTERY:  '#3B82F6',
  INVERTER: '#8B5CF6',
}

export default function Analytics() {
  // 1. Pulled 'prosumers' from the store
  const { assets = [], gridNodes = [], chartHistory = [], prosumers = [] } = useVPPStore()

  const typeData   = buildTypeData(assets)
  const nodeData   = buildNodeData(gridNodes)
  
  // 2. Passed live prosumers to the builder function
  const walletData = buildWalletData(prosumers)
  
  const areaData   = chartHistory.slice(-20).map(point => ({
    ...point,
    solar: Number(point.solar || 0),
    wind: Number(point.wind || 0),
    battery: Number(point.battery || 0)
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold tracking-tight text-vpp-forest text-lg">Analytics</h1>
        <p className="text-vpp-dim text-xs font-light mt-0.5">
          Live aggregations from the VPP-Orchestrate database
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Output by Asset Type */}
        <div className="card p-4">
          <p className="font-bold tracking-tight text-vpp-forest text-sm mb-4">Output by Asset Type</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} tickFormatter={(v) => Number(v) >= 1000 ? `${(Number(v)/1000).toFixed(1)}M` : v} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="output" radius={[3,3,0,0]}>
                {typeData.map((entry) => (
                  <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? '#10B981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Node Load Utilisation */}
        <div className="card p-4">
          <p className="font-bold tracking-tight text-vpp-forest text-sm mb-4">Node Load Utilisation (%)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={nodeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pct" radius={[3,3,0,0]}>
                {nodeData.map((entry) => (
                  <Cell key={entry.name} fill={entry.pct >= 85 ? '#EF4444' : entry.pct >= 70 ? '#F59E0B' : '#10B981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid Output Over Time */}
      <div className="card p-4">
        <p className="font-bold tracking-tight text-vpp-forest text-sm mb-4">Grid Output Over Time (Live)</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={areaData}>
            <defs>
              <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/></linearGradient>
              <linearGradient id="gWind" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/></linearGradient>
              <linearGradient id="gBattery" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="time" tick={{ fontSize: 9 }} />
            <YAxis tickFormatter={(v) => Number(v) >= 1000 ? `${(Number(v)/1000).toFixed(1)}M` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="solar" stroke="#F59E0B" fill="url(#gSolar)" isAnimationActive={false} />
            <Area type="monotone" dataKey="wind" stroke="#10B981" fill="url(#gWind)" isAnimationActive={false} />
            <Area type="monotone" dataKey="battery" stroke="#3B82F6" fill="url(#gBattery)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Prosumer Wallet Balances (Now Live) */}
      <div className="card p-4">
        <p className="font-bold tracking-tight text-vpp-forest text-sm mb-4">Prosumer Wallet Balances</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={walletData} layout="vertical">
            <XAxis type="number" tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
            <YAxis type="category" dataKey="name" width={65} />
            <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Balance']} />
            <Bar dataKey="balance" radius={[0,3,3,0]}>
              {walletData.map((entry) => (
                <Cell key={entry.name} fill={entry.balance >= 0 ? '#10B981' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Battery Health Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-vpp-border"><p className="font-bold text-vpp-forest text-sm">Battery Health Summary</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-vpp-gray border-b border-vpp-border">
                {['Asset', 'Manufacturer', 'SOC %', 'Capacity kWh', 'Cycles', 'Chemistry', 'Health', 'Dispatchable kWh'].map((h) => (
                  <th key={h} className="text-left px-4 py-2 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.filter((a) => a.asset_type === 'BATTERY').map((a, i) => {
                const soc = Number(a.current_soc || 0)
                const cycles = Number(a.cycle_count || 0)
                const health = soc >= 70 && cycles < 2000 ? 'GOOD' : soc >= 40 && cycles < 4000 ? 'FAIR' : 'POOR'
                return (
                  <tr key={a.asset_id} className={i % 2 === 0 ? '' : 'bg-vpp-gray bg-opacity-50'}>
                    <td className="px-4 py-2 font-light">#{a.asset_id}</td>
                    <td className="px-4 py-2 font-light">{a.manufacturer}</td>
                    <td className="px-4 py-2 font-light">{soc.toFixed(1)}%</td>
                    <td className="px-4 py-2 font-light">{Number(a.capacity_kwh || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 font-light">{cycles}</td>
                    <td className="px-4 py-2 font-light">{a.chemistry}</td>
                    <td className="px-4 py-2">
                      <span className={health === 'GOOD' ? 'text-vpp-green' : health === 'FAIR' ? 'text-vpp-warn' : 'text-vpp-danger'}>{health}</span>
                    </td>
                    <td className="px-4 py-2 font-light">{Number(a.dispatchable_kwh || 0).toFixed(0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}