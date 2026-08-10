import { useVPPStore } from '../context/store'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard'        },
  { id: 'assets',     label: 'Asset Management' },
  { id: 'events',     label: 'Event Logs'       },
  { id: 'analytics',  label: 'Analytics'        },
  { id: 'p2p',        label: 'P2P Trading'      },
  { id: 'novel',      label: 'Novel Features'   },
]

export default function Sidebar() {
  const { activePage, setActivePage, systemLive } = useVPPStore()

  return (
    <aside className="w-56 min-h-screen bg-vpp-forest flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-emerald-800">
        <div className="flex items-center gap-2 mb-1">
          {/* VPP logo mark — two interlocking lightning bolts */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12,2 4,12 10,12 8,20 16,10 10,10" fill="#10B981" fillOpacity="0.15" />
            <line x1="11" y1="2"  x2="11" y2="20" stroke="#10B981" strokeOpacity="0.25" />
          </svg>
          <span className="font-josefin font-bold tracking-tight text-white text-sm">
            VPP-Orchestrate
          </span>
        </div>
        <p className="text-emerald-400 text-xs font-light tracking-widest uppercase pl-7">
          Virtual Power Plant
        </p>
      </div>

      {/* System live badge */}
      <div className="px-6 py-4 border-b border-emerald-800">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-vpp-green live-dot shrink-0"
          />
          <span className="text-emerald-300 text-xs font-bold tracking-widest uppercase">
            {systemLive ? 'System Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={[
              'w-full text-left px-4 py-2.5 rounded text-xs font-bold tracking-widest uppercase transition-all duration-150',
              activePage === item.id
                ? 'bg-vpp-green text-white'
                : 'text-emerald-300 hover:bg-emerald-800 hover:text-white',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-emerald-800">
        <p className="text-emerald-600 text-xs font-light tracking-wide">
          MySQL 8.0 · InnoDB
        </p>
        <p className="text-emerald-600 text-xs font-light">
          9 tables · ACID
        </p>
      </div>
    </aside>
  )
}
