import { useEffect, useRef } from 'react'
import { useVPPStore } from '../context/store'

// Simulates WebSocket / polling by fluctuating asset outputs every 3 seconds
const EVENT_TEMPLATES = [
  (asset) => `${asset.manufacturer} ${asset.model_number}: Output stabilised at ${Number(asset?.active_power_kw || 0).toFixed(1)} kW`,
  (asset) => `${asset.manufacturer} ${asset.model_number}: Real-time reading updated`,
  ()      => 'Grid health recalculated — all nodes nominal',
  ()      => 'Auto load-balance trigger evaluated',
  (asset) => `Telemetry received from ${asset?.manufacturer} ${asset?.model_number}`,
]

const EVENT_TYPES = ['LOAD_BALANCE', 'VOLTAGE_SAG', 'FREQ_DEVIATION', 'BATTERY_FULL', 'OVERLOAD']
const SEVERITIES  = ['INFO', 'INFO', 'INFO', 'WARNING', 'WARNING', 'CRITICAL']

function fluctuate(value, pct = 0.04) {
  const numValue = Number(value || 0); // Force to number
  const delta = numValue * pct * (Math.random() * 2 - 1)
  return Math.max(0, numValue + delta)
}

export function useSimulation() {
  const { assets, updateAssetOutput, pushChartPoint, addEvent } = useVPPStore()
  const intervalRef = useRef(null)
  const tickRef     = useRef(0)

  useEffect(() => {
    if (!assets || assets.length === 0) return; // Guard against empty assets

    intervalRef.current = setInterval(() => {
      tickRef.current++
      const tick = tickRef.current

      // Update each active asset's output
      assets.forEach((a) => {
        if (a.asset_status === 'FAULT' || a.asset_status === 'MAINTENANCE') return

        const currentOutput = Number(a.active_power_kw || 0)
        const currentSoc = a.current_soc != null ? Number(a.current_soc) : null

        const newOutput = fluctuate(currentOutput, 0.03)
        const newSoc    = currentSoc !== null
          ? Math.min(100, Math.max(0, currentSoc + (Math.random() * 0.4 - 0.2)))
          : null

        updateAssetOutput(a.asset_id, newOutput, newSoc)
      })

      // Push chart point - Ensure we cast to Number during the reduction
      const solar   = assets.filter(a => a.asset_type === 'SOLAR').reduce((s, a) => s + Number(a.active_power_kw || 0), 0)
      const wind    = assets.filter(a => a.asset_type === 'WIND').reduce((s, a)  => s + Number(a.active_power_kw || 0), 0)
      const battery = assets.filter(a => a.asset_type === 'BATTERY').reduce((s, a) => s + Number(a.active_power_kw || 0), 0)

      pushChartPoint({
        time:    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        solar:   parseFloat(solar.toFixed(1)),
        wind:    parseFloat(wind.toFixed(1)),
        battery: parseFloat(battery.toFixed(1)),
        total:   parseFloat((solar + wind + battery).toFixed(1)),
      })

      // Occasionally fire a simulated event (every ~15s)
      if (tick % 5 === 0) {
        const asset    = assets[Math.floor(Math.random() * assets.length)]
        const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)]
        
        // Safety check to ensure template receives an asset
        const description = asset ? template(asset) : 'System heartbeat signal received';

        addEvent({
          event_id:    Date.now(),
          event_type:  EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)],
          severity:    SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
          event_ts:    new Date().toISOString(),
          description: description,
          node_name:   `Node Alpha`,
          triggered_by: 'TRIGGER',
        })
      }
    }, 3000)

    return () => clearInterval(intervalRef.current)
  }, [assets, updateAssetOutput, pushChartPoint, addEvent])
}