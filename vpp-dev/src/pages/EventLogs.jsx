import { useState } from 'react'
import { useVPPStore } from '../context/store'

const SEVERITY_COLORS = {
  INFO:     { dot: 'bg-vpp-green',   row: '',               badge: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  WARNING:  { dot: 'bg-vpp-warn',    row: 'bg-amber-50',    badge: 'text-amber-700   bg-amber-50   border-amber-200'   },
  CRITICAL: { dot: 'bg-vpp-danger',  row: 'bg-red-50',      badge: 'text-red-700     bg-red-50     border-red-200'     },
}

const EVENT_TYPE_LABELS = {
  LOAD_BALANCE:   'Load Balance',
  OVERLOAD:       'Overload',
  VOLTAGE_SAG:    'Voltage Sag',
  FREQ_DEVIATION: 'Freq Deviation',
  BATTERY_LOW:    'Battery Low',
  BATTERY_FULL:   'Battery Full',
  MAINTENANCE:    'Maintenance',
  BLACKOUT:       'Blackout',
}

function formatTs(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit',
    minute: '2-digit', second: '2-digit',
  })
}

export default function EventLogs() {
  const { events } = useVPPStore()
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [typeFilter,     setTypeFilter]     = useState('ALL')

  const filtered = events.filter((e) => {
    if (severityFilter !== 'ALL' && e.severity   !== severityFilter) return false
    if (typeFilter     !== 'ALL' && e.event_type !== typeFilter)     return false
    return true
  })

  const critCount = events.filter((e) => e.severity === 'CRITICAL').length
  const warnCount = events.filter((e) => e.severity === 'WARNING').length
  const infoCount = events.filter((e) => e.severity === 'INFO').length

  const uniqueTypes = [...new Set(events.map((e) => e.event_type))]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-bold tracking-tight text-vpp-forest text-lg">Event Logs</h1>
        <p className="text-vpp-dim text-xs font-light mt-0.5">
          Database-triggered and scheduler-generated events in real time
        </p>
      </div>

      {/* Severity KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 border-l-4 border-vpp-danger">
          <p className="stat-label mb-1">Critical</p>
          <p className="stat-value text-vpp-danger">{critCount}</p>
        </div>
        <div className="card p-4 border-l-4 border-vpp-warn">
          <p className="stat-label mb-1">Warning</p>
          <p className="stat-value text-vpp-warn">{warnCount}</p>
        </div>
        <div className="card p-4 border-l-4 border-vpp-green">
          <p className="stat-label mb-1">Info</p>
          <p className="stat-value text-vpp-green">{infoCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="stat-label text-xs self-center mr-1">Severity:</span>
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={[
                'px-3 py-1 rounded text-xs font-bold tracking-widest uppercase transition-colors',
                severityFilter === s
                  ? 'bg-vpp-green text-white'
                  : 'bg-vpp-gray border border-vpp-border text-vpp-dim hover:border-vpp-green hover:text-vpp-forest',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="stat-label text-xs self-center mr-1">Type:</span>
          {['ALL', ...uniqueTypes].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={[
                'px-3 py-1 rounded text-xs font-bold tracking-widest uppercase transition-colors',
                typeFilter === t
                  ? 'bg-vpp-forest text-white'
                  : 'bg-vpp-gray border border-vpp-border text-vpp-dim hover:border-vpp-forest hover:text-vpp-forest',
              ].join(' ')}
            >
              {t === 'ALL' ? 'ALL' : (EVENT_TYPE_LABELS[t] ?? t)}
            </button>
          ))}
        </div>
      </div>

      {/* Events table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-vpp-border flex items-center justify-between">
          <p className="font-bold tracking-tight text-vpp-forest text-sm">
            {filtered.length} events
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-vpp-green live-dot" />
            <span className="stat-label text-xs">Live</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-vpp-dim text-sm font-light">
            No events match the current filters.
          </p>
        ) : (
          <div className="divide-y divide-vpp-border">
            {filtered.map((e) => {
              const style = SEVERITY_COLORS[e.severity] ?? SEVERITY_COLORS.INFO
              return (
                <div
                  key={e.event_id}
                  className={['px-4 py-3 flex items-start gap-3 animate-fade-in', style.row].join(' ')}
                >
                  <span className={['mt-1.5 w-2 h-2 rounded-full shrink-0', style.dot].join(' ')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={[
                        'text-xs font-bold tracking-widest uppercase border px-1.5 py-0.5 rounded',
                        style.badge,
                      ].join(' ')}>
                        {e.severity}
                      </span>
                      <span className="text-vpp-dim text-xs font-bold tracking-widest uppercase">
                        {EVENT_TYPE_LABELS[e.event_type] ?? e.event_type}
                      </span>
                      <span className="text-vpp-dim text-xs">·</span>
                      <span className="text-vpp-dim text-xs font-light">{e.node_name}</span>
                      <span className="text-vpp-dim text-xs">·</span>
                      <span className="text-vpp-dim text-xs font-light">
                        {e.triggered_by}
                      </span>
                    </div>
                    <p className="text-vpp-forest text-xs font-light mt-1 leading-snug">
                      {e.description}
                    </p>
                    <p className="text-vpp-dim text-xs font-light mt-0.5">
                      {formatTs(e.event_ts)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
