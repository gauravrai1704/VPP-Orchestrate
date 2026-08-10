import { useVPPStore } from './context/store'
import { useSimulation } from './hooks/useSimulation'
import Sidebar from './components/Sidebar'
import AssetDrawer from './components/AssetDrawer'
import Dashboard from './pages/Dashboard'
import AssetManagement from './pages/AssetManagement'
import EventLogs from './pages/EventLogs'
import Analytics from './pages/Analytics'
import P2PTrading from './pages/P2PTrading'
import NovelFeatures from './pages/NovelFeatures'
import { useEffect } from 'react'

const PAGE_TITLES = {
  dashboard:  'Dashboard',
  assets:     'Asset Management',
  events:     'Event Logs',
  analytics:  'Analytics',
  p2p:        'P2P Trading',
  novel:      'Novel Features',
}

function PageContent({ page }) {
  switch (page) {
    case 'dashboard': return <Dashboard />
    case 'assets':    return <AssetManagement />
    case 'events':    return <EventLogs />
    case 'analytics': return <Analytics />
    case 'p2p':       return <P2PTrading />
    case 'novel':     return <NovelFeatures />
    default:          return <Dashboard />
  }
}

export default function App() {
  const activePage = useVPPStore((s) => s.activePage)

  // Start the 3-second simulation loop
  useSimulation()

  const fetchAll = useVPPStore((s) => s.fetchAll)

  useEffect(() => {
    fetchAll()                          // load on first render
    const id = setInterval(fetchAll, 10000)  // refresh every 10 seconds
    return () => clearInterval(id)
  }, [fetchAll])

  return (
    <div className="flex min-h-screen bg-vpp-gray font-josefin">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-vpp-border px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-bold tracking-tight text-vpp-forest text-base">
              {PAGE_TITLES[activePage] ?? 'Dashboard'}
            </h1>
            <p className="text-vpp-dim text-xs font-light">
              VPP-Orchestrate · MySQL 8.0 · InnoDB · ACID Compliant
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-vpp-green live-dot" />
              <span className="text-vpp-dim text-xs font-bold tracking-widest uppercase">Live</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-vpp-border" />
            <span className="hidden sm:block text-vpp-dim text-xs font-light">
              {new Date().toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </span>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-5 md:p-6">
          <PageContent page={activePage} />
        </main>
      </div>

      {/* Asset drill-down drawer */}
      <AssetDrawer />
    </div>
  )
}
