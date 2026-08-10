import { useVPPStore } from '../context/store'

const NODE_STATUS_STYLE = {
  NORMAL:      'text-vpp-green   bg-emerald-50  border-emerald-200',
  STRESSED:    'text-vpp-warn    bg-amber-50    border-amber-200',
  BLACKOUT:    'text-vpp-danger  bg-red-50      border-red-200',
  MAINTENANCE: 'text-vpp-dim     bg-gray-100    border-gray-200',
}

export default function GridNodePanel() {
  const gridNodes = useVPPStore((s) => s.gridNodes) || []

  return (
    <div className="card p-4">
      <p className="font-bold tracking-tight text-vpp-forest text-sm mb-3">
        Grid Nodes
      </p>
      <div className="space-y-2">
        {gridNodes.map((node) => {
          // 1. Force Number casting to prevent "String / String" math errors
          const currentLoad = Number(node.current_load_mw || 0)
          const maxLoad = Number(node.max_load_mw || 1) // Default to 1 to avoid Division by Zero
          
          const pct = Math.round((currentLoad / maxLoad) * 100)
          const barColor = pct >= 85 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'

          return (
            <div key={node.node_id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-vpp-forest text-xs font-bold truncate">
                    {node.node_name}
                  </span>
                  <span className={[
                    'text-xs font-bold tracking-widest uppercase border px-1.5 py-0.5 rounded',
                    NODE_STATUS_STYLE[node.node_status] ?? NODE_STATUS_STYLE.NORMAL,
                  ].join(' ')}>
                    {node.node_status}
                  </span>
                </div>
                {/* 2. Progress Bar Background */}
                <div className="w-full bg-gray-100 rounded-full h-1">
                  <div
                    className="h-1 rounded-full transition-all duration-700"
                    style={{ 
                      width: `${Math.min(100, pct)}%`, 
                      backgroundColor: barColor 
                    }}
                  />
                </div>
                <p className="text-vpp-dim text-xs font-light mt-0.5">
                  {currentLoad.toFixed(1)} / {maxLoad.toFixed(0)} MW · {pct}%
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}