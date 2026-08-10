import { useState, useRef, useEffect } from 'react'
import { useVPPStore } from '../context/store'

// ─────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────

function Badge({ children, color = 'green' }) {
  const styles = {
    green:  'text-vpp-green  bg-emerald-50  border-emerald-200',
    amber:  'text-vpp-warn   bg-amber-50    border-amber-200',
    danger: 'text-vpp-danger bg-red-50      border-red-200',
    forest: 'text-white      bg-vpp-forest  border-transparent',
    purple: 'text-purple-700 bg-purple-50   border-purple-200',
    blue:   'text-blue-700   bg-blue-50     border-blue-200',
  }
  return (
    <span className={`inline-flex items-center text-xs font-bold tracking-widest uppercase border px-2 py-0.5 rounded ${styles[color]}`}>
      {children}
    </span>
  )
}

function SectionHeader({ num, title, badge, badgeColor }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-josefin text-vpp-dim text-xs font-bold tracking-widest w-6 shrink-0">
        {String(num).padStart(2, '0')}
      </span>
      <h2 className="font-bold tracking-tight text-vpp-forest text-base">{title}</h2>
      {badge && <Badge color={badgeColor}>{badge}</Badge>}
    </div>
  )
}

function CodePane({ code }) {
  // Syntax-highlight keywords in the code string
  const html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /\b(SELECT|FROM|WHERE|JOIN|LEFT|ON|GROUP BY|ORDER BY|HAVING|WITH|RECURSIVE|UNION ALL|AS|CASE|WHEN|THEN|ELSE|END|CREATE|FUNCTION|PROCEDURE|RETURNS|BEGIN|DECLARE|SET|RETURN|IF|CALL|ALTER|TABLE|ADD|GENERATED|ALWAYS|VIRTUAL|STORED|TRIGGER|AFTER|BEFORE|INSERT|UPDATE|DELETE|INTO|VALUES|NOT|AND|BETWEEN|IN|LIMIT|DISTINCT|COUNT|SUM|AVG|ROUND|CONCAT|FLOOR|RAND|HOUR|MONTH|DAYOFWEEK|DETERMINISTIC|START TRANSACTION|COMMIT|ROLLBACK)\b/g,
      '<span style="color:#ff7b72">$1</span>'
    )
    .replace(/'([^']*)'/g, '<span style="color:#a5d6ff">\'$1\'</span>')
    .replace(/\b(\d+(\.\d+)?)\b/g, '<span style="color:#f8c555">$1</span>')
    .replace(/(--[^\n]*)/g, '<span style="color:#6a737d;font-style:italic">$1</span>')
    .replace(/\b(fn_\w+|sp_\w+|vw_\w+)/g, '<span style="color:#d2a8ff">$1</span>')

  return (
    <div
      className="rounded-lg overflow-x-auto text-xs font-mono leading-relaxed p-4"
      style={{ background: '#1a1b1e', color: '#c9d1d9' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ToggleCard({ children, code, prose }) {
  const [view, setView] = useState('prose')
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0 mr-4">{prose}</div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => setView('prose')}
            className={`px-3 py-1 rounded text-xs font-bold tracking-widest uppercase transition-colors ${
              view === 'prose'
                ? 'bg-vpp-green text-white'
                : 'border border-vpp-border text-vpp-dim hover:border-vpp-green hover:text-vpp-forest'
            }`}
          >
            Demo
          </button>
          <button
            onClick={() => setView('code')}
            className={`px-3 py-1 rounded text-xs font-bold tracking-widest uppercase transition-colors ${
              view === 'code'
                ? 'bg-vpp-forest text-white'
                : 'border border-vpp-border text-vpp-dim hover:border-vpp-forest hover:text-vpp-forest'
            }`}
          >
            &lt;/&gt; SQL
          </button>
        </div>
      </div>
      {view === 'prose' ? children : <CodePane code={code} />}
    </div>
  )
}

// ─────────────────────────────────────────────
// Feature 1: Virtual KPI Columns
// ─────────────────────────────────────────────

const KPI_SQL = `-- Grid_Node: load utilisation (VIRTUAL, zero storage)
ALTER TABLE Grid_Node
  ADD load_utilisation_pct DECIMAL(5,2)
  GENERATED ALWAYS AS
  (ROUND(current_load_mw / max_load_mw * 100, 1)) VIRTUAL,

  ADD is_overloaded TINYINT
  GENERATED ALWAYS AS
  (current_load_mw / max_load_mw > 0.90) VIRTUAL;

-- Storage_Asset: battery health (VIRTUAL)
ALTER TABLE Storage_Asset
  ADD dispatchable_kwh DECIMAL(10,3)
  GENERATED ALWAYS AS
  (capacity_kwh * (current_soc - 10) / 100) VIRTUAL,

  ADD health_category VARCHAR(10)
  GENERATED ALWAYS AS (
    CASE WHEN current_soc >= 60 THEN 'GOOD'
         WHEN current_soc >= 30 THEN 'FAIR'
         ELSE 'POOR'
    END) VIRTUAL;

-- Zero bytes stored. Recomputed on every SELECT. ✓`

function VirtualKPIDemo() {
  const { assets = [], gridNodes = [] } = useVPPStore()

  // Prefer live data; fall back to sliders
  const liveNode = gridNodes[0]
  const liveBattery = assets.find(a => a.asset_type === 'BATTERY')

  const [currentLoad, setCurrentLoad] = useState(liveNode?.current_load_mw ?? 82)
  const [maxLoad]     = useState(liveNode?.max_load_mw ?? 150)
  const [soc, setSoc] = useState(liveBattery?.current_soc ?? 75)

  useEffect(() => {
    if (liveNode) setCurrentLoad(Number(liveNode.current_load_mw) || 82)
  }, [liveNode])
  useEffect(() => {
    if (liveBattery) setSoc(Number(liveBattery.current_soc) || 75)
  }, [liveBattery])

  const util     = ((currentLoad / maxLoad) * 100).toFixed(1)
  const overload = currentLoad / maxLoad > 0.90 ? 1 : 0
  const dispatch = ((liveBattery?.capacity_kwh ?? 3900) * (soc - 10) / 100).toFixed(0)
  const health   = soc >= 60 ? 'GOOD' : soc >= 30 ? 'FAIR' : 'POOR'

  const healthColor = health === 'GOOD' ? 'text-vpp-green' : health === 'FAIR' ? 'text-vpp-warn' : 'text-vpp-danger'

  return (
    <div className="space-y-4">
      {/* Live KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="stat-label text-xs mb-1">load_utilisation_pct</p>
          <p className="font-bold text-vpp-forest text-xl">{util}%</p>
          <p className="text-vpp-dim text-xs font-light mt-0.5">VIRTUAL GENERATED</p>
        </div>
        <div className="card p-3 text-center">
          <p className="stat-label text-xs mb-1">is_overloaded</p>
          <p className={`font-bold text-xl ${overload ? 'text-vpp-danger' : 'text-vpp-green'}`}>{overload}</p>
          <p className="text-vpp-dim text-xs font-light mt-0.5">VIRTUAL GENERATED</p>
        </div>
        <div className="card p-3 text-center">
          <p className="stat-label text-xs mb-1">dispatchable_kwh</p>
          <p className="font-bold text-vpp-forest text-xl">{Number(dispatch).toLocaleString()}</p>
          <p className="text-vpp-dim text-xs font-light mt-0.5">VIRTUAL GENERATED</p>
        </div>
        <div className="card p-3 text-center">
          <p className="stat-label text-xs mb-1">health_category</p>
          <p className={`font-bold text-xl ${healthColor}`}>{health}</p>
          <p className="text-vpp-dim text-xs font-light mt-0.5">VIRTUAL GENERATED</p>
        </div>
      </div>

      {/* Sliders */}
      <div className="card p-4 space-y-3">
        <p className="stat-label text-xs">Adjust inputs — computed columns update instantly</p>
        <div className="flex items-center gap-3">
          <label className="stat-label text-xs w-36 shrink-0">Current load (MW)</label>
          <input
            type="range" min="0" max={maxLoad} step="0.5"
            value={currentLoad}
            onChange={e => setCurrentLoad(Number(e.target.value))}
            className="flex-1"
          />
          <span className="font-josefin text-vpp-forest text-xs font-bold w-14 text-right">
            {Number(currentLoad).toFixed(1)} MW
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="stat-label text-xs w-36 shrink-0">Battery SOC (%)</label>
          <input
            type="range" min="0" max="100" step="0.5"
            value={soc}
            onChange={e => setSoc(Number(e.target.value))}
            className="flex-1"
          />
          <span className="font-josefin text-vpp-forest text-xs font-bold w-14 text-right">
            {Number(soc).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Feature 2: Dynamic TOU Tariff Engine
// ─────────────────────────────────────────────

const TOU_SQL = `CREATE FUNCTION fn_dynamic_tou_price(
  p_ts TIMESTAMP, p_tariff VARCHAR(20), p_dr BOOLEAN
) RETURNS DECIMAL(8,6) DETERMINISTIC
BEGIN
  DECLARE base_rate, season_f, weekend_f,
           tariff_f, dr_f DECIMAL(6,4);
  DECLARE hr INT;
  SET hr = HOUR(p_ts);

  -- 1. Base rate by hour band
  SET base_rate = CASE
    WHEN hr BETWEEN 17 AND 21 THEN 0.25   -- PEAK
    WHEN hr BETWEEN  7 AND 16 THEN 0.15   -- SHOULDER
    ELSE 0.08                              -- OFF-PEAK
  END;

  -- 2. Seasonal factor
  SET season_f = CASE
    WHEN MONTH(p_ts) IN(5,6,7,8) THEN 1.25  -- summer
    WHEN MONTH(p_ts) IN(12,1,2)  THEN 1.15  -- winter
    ELSE 1.00 END;

  -- 3. Weekend discount
  SET weekend_f = IF(DAYOFWEEK(p_ts) IN(1,7), 0.85, 1.00);

  -- 4. Tariff class volume discount
  SET tariff_f = CASE p_tariff
    WHEN 'COMMERCIAL' THEN 0.90
    WHEN 'INDUSTRIAL' THEN 0.80
    ELSE 1.00 END;

  -- 5. Demand-response surcharge (+50% peak only)
  SET dr_f = IF(p_dr AND hr BETWEEN 17 AND 21, 1.50, 1.00);

  RETURN base_rate * season_f * weekend_f * tariff_f * dr_f;
END`

function TOUDemo() {
  const [hour, setHour]       = useState(18)
  const [month, setMonth]     = useState(4)
  const [tariff, setTariff]   = useState('RESIDENTIAL')
  const [weekend, setWeekend] = useState(false)
  const [dr, setDr]           = useState(false)

  const period   = hour >= 17 && hour <= 21 ? 'PEAK' : hour >= 7 && hour <= 16 ? 'SHOULDER' : 'OFF-PEAK'
  const base     = hour >= 17 && hour <= 21 ? 0.25 : hour >= 7 && hour <= 16 ? 0.15 : 0.08
  const sf       = [5,6,7,8].includes(month) ? 1.25 : [12,1,2].includes(month) ? 1.15 : 1.00
  const wf       = weekend ? 0.85 : 1.00
  const tf       = tariff === 'COMMERCIAL' ? 0.90 : tariff === 'INDUSTRIAL' ? 0.80 : 1.00
  const drf      = (dr && period === 'PEAK') ? 1.50 : 1.00
  const price    = base * sf * wf * tf * drf

  const periodColor = period === 'PEAK' ? 'text-vpp-danger bg-red-50 border-red-200'
    : period === 'SHOULDER' ? 'text-vpp-warn bg-amber-50 border-amber-200'
    : 'text-blue-700 bg-blue-50 border-blue-200'

  // Build 24-hour bar data
  const barHeights = Array.from({ length: 24 }, (_, h) => {
    const b = h >= 17 && h <= 21 ? 0.25 : h >= 7 && h <= 16 ? 0.15 : 0.08
    return { h, height: (b / 0.25) * 100, active: h === hour }
  })

  return (
    <div className="space-y-4">
      {/* Price display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="stat-label text-xs mb-1">fn_dynamic_tou_price( )</p>
          <p className="font-bold text-vpp-forest text-3xl tracking-tight">
            ${price.toFixed(6)}
          </p>
          <p className="text-vpp-dim text-xs font-light mb-2">per kWh</p>
          <span className={`inline-flex items-center text-xs font-bold tracking-widest uppercase border px-2 py-0.5 rounded ${periodColor}`}>
            {period}
          </span>
          <div className="mt-3 space-y-1 font-mono text-xs text-vpp-dim">
            <p>base:     × {base.toFixed(2)}</p>
            <p>season:   × {sf.toFixed(2)}</p>
            <p>weekend:  × {wf.toFixed(2)}</p>
            <p>tariff:   × {tf.toFixed(2)}</p>
            <p>DR surge: × {drf.toFixed(2)}</p>
            <p className="text-vpp-forest font-bold border-t border-vpp-border pt-1">
              = ${price.toFixed(6)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* 24-hour bar chart */}
          <div className="card p-3">
            <p className="stat-label text-xs mb-2">Click an hour</p>
            <div className="flex items-end gap-0.5 h-16">
              {barHeights.map(({ h, height, active }) => (
                <button
                  key={h}
                  onClick={() => setHour(h)}
                  className="flex-1 rounded-t transition-all duration-150"
                  style={{
                    height: `${height}%`,
                    minHeight: 4,
                    background: active ? '#064E3B'
                      : h >= 17 && h <= 21 ? '#EF4444'
                      : h >= 7 && h <= 16 ? '#F59E0B'
                      : '#3B82F6',
                    opacity: active ? 1 : 0.55,
                  }}
                  title={`${h}:00`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {[0, 6, 12, 18, 23].map(h => (
                <span key={h} className="stat-label text-xs">{h}h</span>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="stat-label text-xs w-28 shrink-0">Hour: {String(hour).padStart(2,'0')}:00</label>
              <input type="range" min="0" max="23" step="1" value={hour}
                onChange={e => setHour(Number(e.target.value))} className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="stat-label text-xs w-28 shrink-0">Tariff class</label>
              <select value={tariff} onChange={e => setTariff(e.target.value)}
                className="flex-1 border border-vpp-border rounded px-2 py-1 text-xs font-josefin text-vpp-forest focus:outline-none focus:border-vpp-green">
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial (−10%)</option>
                <option value="INDUSTRIAL">Industrial (−20%)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="stat-label text-xs w-28 shrink-0">Season / month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="flex-1 border border-vpp-border rounded px-2 py-1 text-xs font-josefin text-vpp-forest focus:outline-none focus:border-vpp-green">
                <option value={6}>June (summer +25%)</option>
                <option value={1}>January (winter +15%)</option>
                <option value={4}>April (neutral)</option>
              </select>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={weekend} onChange={e => setWeekend(e.target.checked)} />
                <span className="stat-label text-xs">Weekend (−15%)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dr} onChange={e => setDr(e.target.checked)} />
                <span className="stat-label text-xs">Demand response (+50% peak)</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Feature 3: Recursive Fault Propagation
// ─────────────────────────────────────────────

const FAULT_SQL = `WITH RECURSIVE fault_cascade AS (
  -- Anchor: the failed node
  SELECT node_id, node_name, node_status,
         0 AS depth,
         node_name AS propagation_path
  FROM   Grid_Node
  WHERE  node_id = :origin_id  -- the failed node

  UNION ALL

  -- Recursive: each child node inherits the fault
  SELECT gn.node_id, gn.node_name,
         gn.node_status,
         fc.depth + 1,
         CONCAT(fc.propagation_path, ' → ', gn.node_name)
  FROM   Grid_Node gn
  JOIN   fault_cascade fc
         ON gn.parent_node_id = fc.node_id
)
SELECT depth, propagation_path,
       node_status,
       COUNT(ea.asset_id) AS assets_at_risk,
       SUM(sa.dispatchable_kwh) AS dispatchable_kwh_lost
FROM   fault_cascade fc
LEFT JOIN Energy_Asset ea ON ea.grid_node_id = fc.node_id
LEFT JOIN Storage_Asset sa ON sa.asset_id    = ea.asset_id
GROUP BY depth, propagation_path, node_status
ORDER BY depth;`

// Topology mirrors the DB seed data
const TOPOLOGY = {
  1: { name: 'Node Alpha', type: 'SUBSTATION',   parent: null,  children: [3, 4] },
  2: { name: 'Node Beta',  type: 'SUBSTATION',   parent: null,  children: [5]    },
  3: { name: 'Node East',  type: 'TRANSFORMER',  parent: 1,     children: []     },
  4: { name: 'Node West',  type: 'TRANSFORMER',  parent: 1,     children: []     },
  5: { name: 'Node South', type: 'DISTRIBUTION', parent: 2,     children: []     },
}

function getDescendants(nodeId) {
  const result = [nodeId]
  TOPOLOGY[nodeId].children.forEach(child => {
    result.push(...getDescendants(child))
  })
  return result
}

function FaultPropagationDemo() {
  const [origin, setOrigin] = useState(null)
  const [cascadeStep, setCascadeStep] = useState([])
  const [logLines, setLogLines] = useState([])
  const [running, setRunning] = useState(false)
  const timerRef = useRef(null)

  function reset() {
    clearTimeout(timerRef.current)
    setOrigin(null)
    setCascadeStep([])
    setLogLines([])
    setRunning(false)
  }

  function simulate(nodeId) {
    reset()
    setOrigin(nodeId)
    setRunning(true)

    const cascade = getDescendants(nodeId)
    const newLines = []

    cascade.forEach((id, i) => {
      timerRef.current = setTimeout(() => {
        setCascadeStep(prev => [...prev, id])
        const depth = i
        const label = depth === 0 ? '[ORIGIN]' : `[depth ${depth}]`
        const severity = depth === 0 ? 'BLACKOUT' : depth === cascade.length - 1 ? 'CRITICAL' : 'AFFECTED'
        newLines.push({ id, label, name: TOPOLOGY[id].name, severity })
        setLogLines([...newLines])
        if (i === cascade.length - 1) setRunning(false)
      }, i * 600)
    })
  }

  const getNodeStyle = (id) => {
    if (!cascadeStep.includes(id)) return 'card border'
    const idx = cascadeStep.indexOf(id)
    if (idx === 0) return 'card border-2 border-vpp-danger bg-red-50'
    if (cascadeStep.indexOf(id) === cascadeStep.length - 1 && cascadeStep.length > 1)
      return 'card border-2 border-vpp-danger bg-red-50'
    return 'card border-2 border-vpp-warn bg-amber-50'
  }

  const getStatusText = (id) => {
    if (!cascadeStep.includes(id)) return 'NORMAL'
    const idx = cascadeStep.indexOf(id)
    if (idx === 0) return 'BLACKOUT'
    return 'AFFECTED'
  }

  const safeNodes = Object.keys(TOPOLOGY)
    .map(Number)
    .filter(id => origin !== null && !getDescendants(origin).includes(id))

  return (
    <div className="space-y-4">
      {/* Node grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(TOPOLOGY).map(([id, node]) => {
          const numId = Number(id)
          return (
            <div key={id} className={`${getNodeStyle(numId)} p-3 transition-all duration-400`}>
              <p className="font-bold text-xs text-vpp-forest">{node.name}</p>
              <p className="text-vpp-dim text-xs font-light">{node.type}</p>
              <p className={`text-xs font-bold mt-1 tracking-widest uppercase ${
                getStatusText(numId) === 'BLACKOUT' ? 'text-vpp-danger'
                : getStatusText(numId) === 'AFFECTED' ? 'text-vpp-warn'
                : safeNodes.includes(numId) && origin !== null ? 'text-vpp-green'
                : 'text-vpp-dim'
              }`}>
                {safeNodes.includes(numId) && origin !== null ? 'ISOLATED OK' : getStatusText(numId)}
              </p>
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TOPOLOGY).filter(([, n]) => n.parent === null).map(([id, node]) => (
          <button key={id} onClick={() => simulate(Number(id))} disabled={running}
            className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50">
            ▶ Fail {node.name}
          </button>
        ))}
        {Object.entries(TOPOLOGY).filter(([, n]) => n.children.length > 0 && n.parent !== null).map(([id, node]) => (
          <button key={id} onClick={() => simulate(Number(id))} disabled={running}
            className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50">
            ▶ Fail {node.name}
          </button>
        ))}
        <button onClick={reset} className="btn-ghost text-xs px-3 py-1.5">↺ Reset</button>
      </div>

      {/* Log output */}
      {logLines.length > 0 && (
        <div className="space-y-1.5">
          {logLines.map(({ id, label, name, severity }) => (
            <div key={id} className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-mono animate-fade-in ${
              severity === 'BLACKOUT' ? 'bg-red-50 border border-red-200 text-red-800'
              : severity === 'CRITICAL' ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}>
              <span className="font-bold">{label}</span>
              <span>{name}</span>
              <span>→</span>
              <span className="font-bold">{severity}</span>
            </div>
          ))}
          {!running && safeNodes.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded text-xs font-mono bg-emerald-50 border border-emerald-200 text-emerald-800 animate-fade-in">
              <span className="font-bold">[isolated]</span>
              <span>{safeNodes.map(id => TOPOLOGY[id].name).join(', ')}</span>
              <span>→</span>
              <span className="font-bold">SAFE</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Feature 4: Blockchain P2P Ledger
// ─────────────────────────────────────────────

const CHAIN_SQL = `-- Each block's hash cryptographically links to the previous block
INSERT INTO P2P_Trade_Ledger (
  prev_hash, seller_id, buyer_id,
  asset_id, energy_kwh, agreed_price, nonce
)
SELECT
  -- SHA2 of previous block's content
  (SELECT block_hash FROM P2P_Trade_Ledger
   ORDER BY block_id DESC LIMIT 1),
  :seller, :buyer, :asset,
  :kwh, :price,
  FLOOR(RAND() * 999999)
FROM DUAL;

-- block_hash column is GENERATED ALWAYS AS STORED:
-- SHA2(CONCAT(prev_hash, seller_id, buyer_id,
--             energy_kwh, agreed_price, nonce), 256)

-- Chain integrity verification stored procedure:
CALL sp_verify_p2p_chain();
-- Returns: total_blocks | valid_blocks | tampered_blocks | verdict`

const SEED_BLOCKS = [
  { id: 1, seller: 'Windward', buyer: 'GreenCo', kwh: 500,  amount: 55.00, hash: '70e734c6a6adbf44', prev: '0000000000000000' },
  { id: 2, seller: 'Alice',    buyer: 'GreenCo', kwh: 45,   amount: 3.60,  hash: '1b52429f57d732e0', prev: '70e734c6a6adbf44' },
  { id: 3, seller: 'Windward', buyer: 'Alice',   kwh: 80,   amount: 10.40, hash: 'd354f781dac4721f', prev: '1b52429f57d732e0' },
  { id: 4, seller: 'Bob',      buyer: 'Alice',   kwh: 10,   amount: 0.70,  hash: 'b7a7a7e1238b0bcd', prev: 'd354f781dac4721f' },
]

function BlockchainDemo() {
  const { p2pTrades = [] } = useVPPStore()
  const [tampered, setTampered] = useState(false)

  // Prefer live data
  const liveBlocks = p2pTrades.slice(0, 4).map((t, i) => ({
    id: t.block_id ?? i + 1,
    seller: t.seller ?? '—',
    buyer: t.buyer ?? '—',
    kwh: Number(t.energy_kwh || 0),
    amount: Number(t.trade_amount || 0),
    hash: t.hash_preview ?? SEED_BLOCKS[i]?.hash ?? '???',
    prev: t.prev_hash_preview ?? SEED_BLOCKS[i]?.prev ?? '???',
  }))

  const blocks = liveBlocks.length >= 2 ? liveBlocks : SEED_BLOCKS

  // Tamper: mutate block #2's amount and invalidate chain forward
  const displayBlocks = blocks.map((b, i) => ({
    ...b,
    amount: tampered && i === 1 ? 999.99 : b.amount,
    valid: tampered ? i < 1 : true,
  }))

  const allValid = displayBlocks.every(b => b.valid)

  return (
    <div className="space-y-3">
      {/* Blocks */}
      {displayBlocks.map((b, i) => (
        <div key={b.id}>
          {i > 0 && (
            <div className="flex items-center gap-2 my-1 ml-4">
              <div className="w-px h-4 bg-vpp-green" />
              <span className="text-vpp-dim text-xs font-mono font-light">
                prev_hash links ↑
              </span>
            </div>
          )}
          <div className={`card p-3 transition-all duration-300 ${
            !b.valid ? 'border-vpp-danger bg-red-50' : 'hover:border-vpp-green'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="stat-label text-xs font-bold">BLOCK #{b.id}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded border tracking-widest uppercase ${
                  b.valid
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-red-700 bg-red-50 border-red-200'
                }`}>
                  {b.valid ? '✓ VALID' : '✗ TAMPERED'}
                </span>
              </div>
              <span className="text-vpp-dim text-xs">
                {b.seller} → {b.buyer} · {b.kwh.toFixed(1)} kWh ·{' '}
                <span className={b.valid ? 'text-vpp-forest' : 'text-vpp-danger font-bold'}>
                  ${b.amount.toFixed(2)}
                </span>
              </span>
            </div>
            <p className="font-mono text-xs text-vpp-dim font-light truncate">
              hash: {b.hash}{'0'.repeat(16)}&hellip;
            </p>
            <p className="font-mono text-xs text-vpp-dim font-light truncate">
              prev: {b.prev}{'0'.repeat(16)}&hellip;
            </p>
          </div>
        </div>
      ))}

      {/* Chain status */}
      <div className={`rounded-lg px-4 py-3 text-center text-xs font-bold tracking-widest uppercase transition-all duration-300 ${
        allValid
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          : 'bg-red-50 border border-red-200 text-red-700'
      }`}>
        {allValid
          ? 'CHAIN INTEGRITY: OK — sp_verify_p2p_chain() → 0 tampered blocks'
          : 'CHAIN COMPROMISED — block #2 hash mismatch, blocks 3–4 invalidated'}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button onClick={() => setTampered(true)} disabled={tampered}
          className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40">
          ⚡ Tamper block #2
        </button>
        <button onClick={() => setTampered(false)}
          className="btn-primary text-xs px-3 py-1.5">
          ↺ Restore chain
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Feature 5: Architecture overview
// ─────────────────────────────────────────────

const ARCH_LAYERS = [
  {
    label: 'React',
    sub: 'Dashboard · TOU slider\nFault map · P2P board',
    color: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
  },
  {
    label: '→',
    sub: null,
    color: 'bg-transparent border-0',
    text: 'text-vpp-dim text-lg',
    arrow: true,
  },
  {
    label: 'Express',
    sub: 'REST API\n19 endpoints\nProxy :3001',
    color: 'bg-vpp-gray border-vpp-border',
    text: 'text-vpp-forest',
  },
  {
    label: '→',
    sub: null,
    color: 'bg-transparent border-0',
    text: 'text-vpp-dim text-lg',
    arrow: true,
  },
  {
    label: 'Procedures',
    sub: 'sp_dispatch\nsp_invoice\nsp_health_score',
    color: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
  },
  {
    label: '⇄',
    sub: null,
    color: 'bg-transparent border-0',
    text: 'text-vpp-dim text-lg',
    arrow: true,
  },
  {
    label: 'Triggers',
    sub: 'auto_load_balance\nbattery_soc_guard\nledger_balance',
    color: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
  },
  {
    label: '⇄',
    sub: null,
    color: 'bg-transparent border-0',
    text: 'text-vpp-dim text-lg',
    arrow: true,
  },
  {
    label: 'MySQL 8.0',
    sub: '12 tables · 7 views\nSpatial + RANGE\nACID / InnoDB',
    color: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
  },
]

const FEATURE_BADGES = [
  { label: '4 Virtual KPI cols',  color: 'green'  },
  { label: 'SHA-256 hash chain',  color: 'purple' },
  { label: '5-factor TOU pricing',color: 'amber'  },
  { label: 'WITH RECURSIVE CTE',  color: 'danger' },
  { label: 'RANGE partitioning',  color: 'blue'   },
  { label: 'Spatial index R-Tree',color: 'forest' },
  { label: 'ACID compliant',      color: 'green'  },
]

function ArchitecturePanel() {
  return (
    <div className="card p-4 space-y-4">
      {/* Layer strip */}
      <div className="flex items-stretch gap-0 overflow-x-auto rounded-lg border border-vpp-border">
        {ARCH_LAYERS.map((layer, i) =>
          layer.arrow ? (
            <div key={i} className="flex items-center justify-center px-1 shrink-0 text-vpp-dim text-base font-bold">
              {layer.label}
            </div>
          ) : (
            <div key={i} className={`flex-1 min-w-0 border-r border-vpp-border last:border-r-0 p-3 ${layer.color}`}>
              <p className={`font-bold text-xs tracking-tight mb-1 ${layer.text}`}>{layer.label}</p>
              <p className="text-vpp-dim text-xs font-light whitespace-pre-line leading-relaxed">
                {layer.sub}
              </p>
            </div>
          )
        )}
      </div>

      {/* Feature badge cloud */}
      <div className="flex flex-wrap gap-2">
        {FEATURE_BADGES.map(({ label, color }) => (
          <Badge key={label} color={color}>{label}</Badge>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function NovelFeatures() {
  return (
    <div className="space-y-8 pb-8">
      {/* Page header */}
      <div>
        <h1 className="font-bold tracking-tight text-vpp-forest text-lg flex items-center flex-wrap gap-2">
          Novel &amp; Advanced Features
          <Badge color="forest"></Badge>
        </h1>
        <p className="text-vpp-dim text-xs font-light mt-0.5">
          Five interactive demos  
        </p>
      </div>

      {/* ── 01 Virtual KPI Columns ── */}
      <section>
        <SectionHeader num={1} title="Virtual KPI columns" badge="Zero storage overhead" badgeColor="green" />
        <ToggleCard
          code={KPI_SQL}
          prose={
            <p className="text-vpp-dim text-xs font-light leading-relaxed">
              Columns that compute themselves on every <code className="font-mono text-vpp-forest">SELECT</code>.{' '}
              No storage cost, no stale data, no application logic needed.
            </p>
          }
        >
          <VirtualKPIDemo />
        </ToggleCard>
      </section>

      {/* ── 02 Dynamic TOU Tariff Engine ── */}
      <section>
        <SectionHeader num={2} title="Dynamic time-of-use tariff engine" badge="Live pricing" badgeColor="amber" />
        <ToggleCard
          code={TOU_SQL}
          prose={
            <p className="text-vpp-dim text-xs font-light leading-relaxed">
              A deterministic stored function: 5 multiplicative factors — hour band, season, weekend, tariff class, demand-response.
              Called inline in any <code className="font-mono text-vpp-forest">SELECT</code> or billing view.
            </p>
          }
        >
          <TOUDemo />
        </ToggleCard>
      </section>

      {/* ── 03 Recursive Fault Propagation ── */}
      <section>
        <SectionHeader num={3} title="Recursive fault propagation tree" badge="WITH RECURSIVE" badgeColor="danger" />
        <ToggleCard
          code={FAULT_SQL}
          prose={
            <p className="text-vpp-dim text-xs font-light leading-relaxed">
              A single <code className="font-mono text-vpp-forest">WITH RECURSIVE</code> CTE walks the{' '}
              <code className="font-mono text-vpp-forest">parent_node_id</code> self-reference to cascade a failure
              through the grid hierarchy, counting assets at risk at each depth.
            </p>
          }
        >
          <FaultPropagationDemo />
        </ToggleCard>
      </section>

      {/* ── 04 Blockchain P2P Ledger ── */}
      <section>
        <SectionHeader num={4} title="Blockchain-based P2P energy ledger" badge="Cryptographically verified" badgeColor="purple" />
        <ToggleCard
          code={CHAIN_SQL}
          prose={
            <p className="text-vpp-dim text-xs font-light leading-relaxed">
              Each trade record is a block storing <code className="font-mono text-vpp-forest">SHA2(prev_hash ∥ trade_data, 256)</code>{' '}
              as a <code className="font-mono text-vpp-forest">GENERATED STORED</code> column.
              Tamper any block and <code className="font-mono text-vpp-forest">sp_verify_p2p_chain()</code> detects the break.
            </p>
          }
        >
          <BlockchainDemo />
        </ToggleCard>
      </section>

      {/* ── 05 Architecture ── */}
      <section>
        <SectionHeader num={5} title="Full-stack architecture" badge="ACID compliant" badgeColor="blue" />
        <p className="text-vpp-dim text-xs font-light mb-4">
          React dashboard → Express API → MySQL stored procedures, triggers, and scheduled events — the complete stack.
        </p>
        <ArchitecturePanel />
      </section>
    </div>
  )
}
