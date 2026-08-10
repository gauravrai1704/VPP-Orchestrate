import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { useVPPStore } from '../context/store'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-vpp-border rounded px-3 py-2 shadow-sm text-xs font-josefin">
      <p className="font-bold text-vpp-forest mb-1">{label}</p>
      {payload.map((p) => {
        // Ensure the value is a number for the tooltip display
        const val = Number(p.value || 0)
        return (
          <p key={p.dataKey} style={{ color: p.color }} className="font-light">
            {p.name}: {val >= 1000
              ? `${(val / 1000).toFixed(2)} MW`
              : `${val.toFixed(0)} kW`}
          </p>
        )
      })}
    </div>
  )
}

export default function GridOutputChart() {
  const chartHistory = useVPPStore((s) => s.chartHistory) || []
  
  // CRITICAL: Clean the data by converting strings to Numbers before passing to Recharts
  const recent = chartHistory.slice(-20).map(item => ({
    ...item,
    solar: Number(item.solar || 0),
    wind: Number(item.wind || 0),
    battery: Number(item.battery || 0),
    total: Number(item.total || 0)
  }))

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold tracking-tight text-vpp-forest text-sm">
          Total Grid Output
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-vpp-green live-dot" />
          <span className="stat-label text-xs">Updating every 3s</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={recent} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fontFamily: "'Josefin Sans'", fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fontFamily: "'Josefin Sans'", fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
            // Cast to Number for the Y-Axis labels
            tickFormatter={(v) => {
              const val = Number(v)
              return val >= 1000 ? `${(val/1000).toFixed(1)}M` : val
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '10px', fontFamily: "'Josefin Sans'", paddingTop: '8px' }}
          />
          <Line
            type="monotone" dataKey="solar" name="Solar" dot={false}
            stroke="#F59E0B" strokeWidth={1.5} isAnimationActive={false}
          />
          <Line
            type="monotone" dataKey="wind" name="Wind" dot={false}
            stroke="#10B981" strokeWidth={1.5} isAnimationActive={false}
          />
          <Line
            type="monotone" dataKey="battery" name="Battery" dot={false}
            stroke="#3B82F6" strokeWidth={1.5} isAnimationActive={false}
          />
          <Line
            type="monotone" dataKey="total" name="Total" dot={false}
            stroke="#064E3B" strokeWidth={2} strokeDasharray="4 2"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}