import { useVPPStore } from '../context/store'

const SEVERITY_STYLE = {
  INFO:     'border-l-2 border-vpp-green  bg-emerald-50',
  WARNING:  'border-l-2 border-vpp-warn   bg-amber-50',
  CRITICAL: 'border-l-2 border-vpp-danger bg-red-50',
}

const SEVERITY_DOT = {
  INFO:     'bg-vpp-green',
  WARNING:  'bg-vpp-warn',
  CRITICAL: 'bg-vpp-danger live-dot',
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function EventFeed({ maxHeight = '280px' }) {
  const events = useVPPStore((s) => s.events)

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-vpp-border flex items-center justify-between">
        <p className="font-bold tracking-tight text-vpp-forest text-sm">Event Feed</p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-vpp-green live-dot" />
          <span className="stat-label text-xs">Live</span>
        </div>
      </div>

      <div
        className="overflow-y-auto divide-y divide-vpp-border"
        style={{ maxHeight }}
      >
        {events.length === 0 ? (
          <p className="px-4 py-6 text-vpp-dim text-xs font-light text-center">
            No events recorded
          </p>
        ) : (
          events.map((e) => (
            <div
              key={e.event_id}
              className={[
                'px-4 py-2.5 animate-fade-in',
                SEVERITY_STYLE[e.severity] ?? '',
              ].join(' ')}
            >
              <div className="flex items-start gap-2">
                <span className={[
                  'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
                  SEVERITY_DOT[e.severity] ?? 'bg-gray-400',
                ].join(' ')} />
                <div className="flex-1 min-w-0">
                  <p className="text-vpp-forest text-xs font-light leading-snug">
                    {e.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="stat-label text-xs">{e.event_type}</span>
                    <span className="text-vpp-dim text-xs">·</span>
                    <span className="stat-label text-xs">{e.node_name}</span>
                    <span className="text-vpp-dim text-xs">·</span>
                    <span className="stat-label text-xs">{timeAgo(e.event_ts)}</span>
                  </div>
                </div>
                <span className={[
                  'shrink-0 text-xs font-bold tracking-widest uppercase px-1.5 py-0.5 rounded',
                  e.severity === 'CRITICAL' ? 'text-red-700   bg-red-100'
                  : e.severity === 'WARNING' ? 'text-amber-700 bg-amber-100'
                  : 'text-emerald-700 bg-emerald-100',
                ].join(' ')}>
                  {e.severity}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
