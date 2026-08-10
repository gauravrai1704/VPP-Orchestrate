import { useState } from 'react'
import { useVPPStore } from '../context/store'
import { AssetIcon } from './AssetIcons'

const STATUS_CLASS = {
  ACTIVE:       'badge-active',
  IDLE:         'badge-idle',
  FAULT:        'badge-fault',
  MAINTENANCE:  'badge-warn',
  DISCHARGING:  'badge-active',
}

function EfficiencyBar({ value, max }) {
  // Ensure we are doing math on numbers
  const val = Number(value || 0)
  const maximum = Number(max || 1) // Avoid division by zero
  const pct = Math.min(100, (val / maximum) * 100)
  const color = pct > 70 ? '#10B981' : pct > 40 ? '#F59E0B' : '#EF4444'
  
  return (
    <div className="w-full bg-gray-100 rounded-full h-1">
      <div
        className="h-1 rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

export default function AssetCard({ asset }) {
  const [hovered, setHovered] = useState(false)
  const setSelectedAsset = useVPPStore((s) => s.setSelectedAsset)

  // Explicitly cast to Number for the label logic
  const activePower = Number(asset.active_power_kw || 0)
  const maxPower = Number(asset.max_output_kw || 0)

  const outputLabel = activePower >= 1000
    ? `${(activePower / 1000).toFixed(2)} MW`
    : `${activePower.toFixed(1)} kW`

  const efficiencyPct = maxPower > 0
    ? Math.round((activePower / maxPower) * 100)
    : null

  const iconColor = asset.asset_status === 'FAULT' ? '#EF4444'
    : asset.asset_status === 'IDLE'  ? '#9CA3AF'
    : '#10B981'

  return (
    <div
      className={[
        'card p-4 cursor-pointer transition-all duration-200 animate-fade-in relative overflow-hidden',
        hovered ? 'shadow-md border-vpp-green' : 'shadow-sm hover:shadow-md',
        asset.asset_status === 'FAULT' ? 'border-red-300' : '',
      ].join(' ')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setSelectedAsset(asset)}
    >
      {/* Active pulse stripe */}
      {asset.asset_status === 'ACTIVE' || asset.asset_status === 'DISCHARGING' ? (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-vpp-green opacity-60" />
      ) : null}

      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold tracking-tight text-vpp-forest text-sm leading-tight">
            {asset.manufacturer}
          </p>
          <p className="text-vpp-dim text-xs font-light">{asset.model_number}</p>
        </div>
        <AssetIcon
          type={asset.asset_type}
          size={36}
          color={iconColor}
          soc={asset.current_soc}
        />
      </div>

      {/* Output value */}
      <div className="mb-1">
        <p className="stat-value text-xl animate-fade-in" key={outputLabel}>
          {outputLabel}
        </p>
        <p className="stat-label">current output</p>
      </div>

      {/* Efficiency bar */}
      {efficiencyPct !== null && (
        <div className="mt-2">
          <EfficiencyBar value={activePower} max={maxPower} />
          <p className="text-vpp-dim text-xs font-light mt-0.5">
            {efficiencyPct}% of max capacity
          </p>
        </div>
      )}

      {/* Battery SOC */}
      {asset.current_soc != null && (
        <div className="mt-2">
          <EfficiencyBar value={asset.current_soc} max={100} />
          <p className="text-vpp-dim text-xs font-light mt-0.5">
            SOC {Number(asset.current_soc).toFixed(1)}%
            {asset.dispatchable_kwh
              ? ` · ${Number(asset.dispatchable_kwh).toFixed(0)} kWh dispatchable`
              : ''}
          </p>
        </div>
      )}

      {/* Hover-reveal extra data */}
      {hovered && (
        <div className="mt-2 pt-2 border-t border-vpp-border animate-fade-in">
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="stat-label text-xs">node</span>
            <span className="text-vpp-forest text-xs font-light">#{asset.grid_node_id}</span>
            {asset.chemistry && (
              <>
                <span className="stat-label text-xs">chemistry</span>
                <span className="text-vpp-forest text-xs font-light">{asset.chemistry}</span>
              </>
            )}
            {asset.panel_count != null && (
              <>
                <span className="stat-label text-xs">panels</span>
                <span className="text-vpp-forest text-xs font-light">{asset.panel_count.toLocaleString()}</span>
              </>
            )}
            {asset.panel_efficiency && (
              <>
                <span className="stat-label text-xs">efficiency</span>
                <span className="text-vpp-forest text-xs font-light">{asset.panel_efficiency}%</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className="mt-3 flex items-center justify-between">
        <span className={STATUS_CLASS[asset.asset_status] ?? 'badge-idle'}>
          <span className={[
            'w-1.5 h-1.5 rounded-full inline-block',
            asset.asset_status === 'ACTIVE' || asset.asset_status === 'DISCHARGING'
              ? 'bg-vpp-green live-dot'
              : asset.asset_status === 'FAULT'
              ? 'bg-vpp-danger'
              : 'bg-gray-400',
          ].join(' ')} />
          {asset.asset_status}
        </span>
        <span className="text-vpp-dim text-xs font-light">{asset.asset_type}</span>
      </div>
    </div>
  )
}