import { useVPPStore } from '../context/store'
import { AssetIcon } from './AssetIcons'
import { X } from 'lucide-react'

const TELEMETRY_HISTORY = [
  { time: '10:00', output: 385, soc: 88 },
  { time: '10:03', output: 391, soc: 87 },
  { time: '10:06', output: 378, soc: 87 },
  { time: '10:09', output: 402, soc: 86 },
  { time: '10:12', output: 395, soc: 86 },
]

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-vpp-border last:border-0">
      <span className="stat-label text-xs">{label}</span>
      <span className="text-vpp-forest text-sm font-light">{value ?? '—'}</span>
    </div>
  )
}

export default function AssetDrawer() {
  const { drawerOpen, selectedAsset, closeDrawer, updateAssetStatus, addEvent } = useVPPStore()

  if (!drawerOpen || !selectedAsset) return null

  const a = selectedAsset

  function handleKillSwitch() {
    const newStatus = a.asset_status === 'ACTIVE' ? 'IDLE' : 'ACTIVE'
    updateAssetStatus(a.asset_id, newStatus)
    addEvent({
      event_id:    Date.now(),
      event_type:  'LOAD_BALANCE',
      severity:    'WARNING',
      event_ts:    new Date().toISOString(),
      description: `${a.manufacturer} ${a.model_number} manually set to ${newStatus} by operator`,
      node_name:   `Node #${a.grid_node_id}`,
      triggered_by: 'MANUAL',
    })
  }

  function handleReroute() {
    addEvent({
      event_id:    Date.now(),
      event_type:  'LOAD_BALANCE',
      severity:    'INFO',
      event_ts:    new Date().toISOString(),
      description: `Reroute command issued to ${a.manufacturer} ${a.model_number}`,
      node_name:   `Node #${a.grid_node_id}`,
      triggered_by: 'MANUAL',
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-20 z-40 transition-opacity"
        onClick={closeDrawer}
      />

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 animate-slide-in flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-vpp-border">
          <div className="flex items-center gap-3">
            <AssetIcon
              type={a.asset_type}
              size={32}
              color={a.asset_status === 'FAULT' ? '#EF4444' : '#10B981'}
              soc={a.current_soc}
            />
            <div>
              <p className="font-bold tracking-tight text-vpp-forest text-sm">{a.manufacturer}</p>
              <p className="text-vpp-dim text-xs font-light">{a.model_number}</p>
            </div>
          </div>
          <button
            onClick={closeDrawer}
            className="text-vpp-dim hover:text-vpp-forest transition-colors p-1"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Current output */}
          <div className="p-5 border-b border-vpp-border bg-vpp-gray">
            <p className="stat-label mb-1">current output</p>
            <p className="stat-value text-3xl">
              {a.active_power_kw >= 1000
                ? `${(a.active_power_kw / 1000).toFixed(3)} MW`
                : `${a.active_power_kw?.toFixed(2)} kW`}
            </p>
            {a.current_soc != null && (
              <p className="text-vpp-dim text-xs font-light mt-1">
                State of Charge: {a.current_soc?.toFixed(1)}%
              </p>
            )}
          </div>

          {/* Asset details */}
          <div className="p-5 border-b border-vpp-border">
            <p className="font-bold tracking-tight text-vpp-forest text-xs uppercase tracking-widest mb-3">
              Configuration
            </p>
            <InfoRow label="asset id"        value={`#${a.asset_id}`} />
            <InfoRow label="type"            value={a.asset_type} />
            <InfoRow label="status"          value={a.asset_status} />
            <InfoRow label="grid node"       value={`Node #${a.grid_node_id}`} />
            <InfoRow label="installed"       value={a.installation_date} />
            {a.panel_count    != null && <InfoRow label="panels"    value={a.panel_count?.toLocaleString()} />}
            {a.panel_efficiency != null && <InfoRow label="efficiency" value={`${a.panel_efficiency}%`} />}
            {a.capacity_kwh   != null && <InfoRow label="capacity"  value={`${a.capacity_kwh?.toLocaleString()} kWh`} />}
            {a.cycle_count    != null && <InfoRow label="cycles"    value={a.cycle_count} />}
            {a.chemistry      != null && <InfoRow label="chemistry" value={a.chemistry} />}
            {a.max_output_kw  != null && <InfoRow label="max output" value={`${a.max_output_kw?.toLocaleString()} kW`} />}
            {a.dispatchable_kwh != null && <InfoRow label="dispatchable" value={`${a.dispatchable_kwh?.toFixed(0)} kWh`} />}
          </div>

          {/* Recent telemetry */}
          <div className="p-5 border-b border-vpp-border">
            <p className="font-bold tracking-tight text-vpp-forest text-xs uppercase tracking-widest mb-3">
              Recent Telemetry
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b border-vpp-border">
                  <th className="stat-label pb-1 font-bold">time</th>
                  <th className="stat-label pb-1 font-bold">output kW</th>
                  {a.current_soc != null && <th className="stat-label pb-1 font-bold">soc %</th>}
                </tr>
              </thead>
              <tbody>
                {TELEMETRY_HISTORY.map((row) => (
                  <tr key={row.time} className="border-b border-gray-50">
                    <td className="py-1 font-light text-vpp-dim">{row.time}</td>
                    <td className="py-1 font-light text-vpp-forest">{row.output}</td>
                    {a.current_soc != null && <td className="py-1 font-light text-vpp-forest">{row.soc}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-5 border-t border-vpp-border space-y-2">
          <button
            onClick={handleKillSwitch}
            className={[
              'w-full py-2.5 rounded font-bold tracking-tight text-sm transition-colors duration-150',
              a.asset_status === 'ACTIVE'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'btn-primary',
            ].join(' ')}
          >
            {a.asset_status === 'ACTIVE' ? 'Deactivate Asset' : 'Activate Asset'}
          </button>
          <button
            onClick={handleReroute}
            className="w-full btn-ghost py-2.5"
          >
            Re-route Output
          </button>
        </div>
      </div>
    </>
  )
}
