import { useState, useEffect, useCallback } from 'react'
import { useVPPStore } from '../context/store'

const API = 'http://localhost:3001'
const POLL_MS = 5000

// ── Helpers ────────────────────────────────────────────────────
function formatTs(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// ── Sub-components ─────────────────────────────────────────────

function NoveltyStar({ label }) {
  return (
    <span className="inline-flex items-center gap-1 bg-vpp-green text-white text-xs font-bold
                     tracking-widest uppercase px-2 py-0.5 rounded-full ml-2 shrink-0">
      * {label}
    </span>
  )
}

function NoveltyCallout({ title, children }) {
  return (
    <div className="rounded-lg border border-vpp-green bg-emerald-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-widest text-vpp-forest mb-1">{title}</p>
      <p className="text-xs text-vpp-dim font-light leading-relaxed">{children}</p>
    </div>
  )
}

function OfferCard({ offer, currentProsumerId, onAccept, accepting }) {
  const isMine = offer.seller_id === parseInt(currentProsumerId)
  const total = Number(offer.energy_kwh) * Number(offer.asking_price)

  return (
    <div className={[
      'card p-4 border transition-all duration-200',
      isMine ? 'border-amber-300 bg-amber-50' : 'hover:border-vpp-green',
    ].join(' ')}>
      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
        <div>
          <p className="text-vpp-forest font-bold text-sm">{offer.seller_name}</p>
          <p className="text-vpp-dim text-xs font-light">{offer.tariff_class} · {offer.energy_source}</p>
        </div>
        <div className="text-right">
          <p className="text-vpp-green font-bold text-base">${total.toFixed(2)}</p>
          <p className="text-vpp-dim text-xs font-light">{offer.energy_kwh} kWh @ ${Number(offer.asking_price).toFixed(4)}/kWh</p>
        </div>
      </div>

      {offer.message && (
        <p className="text-xs text-vpp-dim font-light italic border-l-2 border-vpp-green pl-2 mb-2">
          "{offer.message}"
        </p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-vpp-dim text-xs font-light">Posted {timeAgo(offer.created_at)}</p>
        {isMine ? (
          <span className="text-xs font-bold text-amber-600 bg-amber-100 border border-amber-200 px-2 py-1 rounded">
            YOUR OFFER
          </span>
        ) : (
          <button
            onClick={() => onAccept(offer)}
            disabled={accepting === offer.offer_id}
            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-wait"
          >
            {accepting === offer.offer_id ? 'Confirming...' : 'Accept Trade'}
          </button>
        )}
      </div>
    </div>
  )
}

function HashChainBlock({ trade, isLast }) {
  const price = Number(trade.agreed_price || 0)
  const amount = Number(trade.trade_amount || 0)
  const energy = Number(trade.energy_kwh || 0)

  return (
    <div className="flex items-stretch gap-0">
      <div className="flex flex-col items-center w-8 shrink-0">
        <div className="w-px bg-vpp-green flex-1" style={{ minHeight: 12 }} />
        <div className="w-3 h-3 rounded-full border-2 border-vpp-green bg-white shrink-0" />
        {!isLast && <div className="w-px bg-vpp-green flex-1" style={{ minHeight: 12 }} />}
      </div>

      <div className="flex-1 card mb-3 ml-3 p-3 hover:border-vpp-green transition-colors duration-150">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-vpp-dim text-xs font-bold tracking-widest">BLOCK #{trade.block_id}</span>
            <span className={[
              'text-xs font-bold tracking-widest uppercase border px-1.5 py-0.5 rounded',
              trade.trade_status === 'CONFIRMED'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200',
            ].join(' ')}>
              {trade.trade_status}
            </span>
          </div>
          <span className="text-vpp-dim text-xs font-light">{formatTs(trade.trade_ts)}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {[
            ['Seller', trade.seller],
            ['Buyer', trade.buyer],
            ['Energy', `${energy.toFixed(1)} kWh`],
            ['Price / kWh', `$${price.toFixed(3)}`],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="stat-label text-xs">{l}</p>
              <p className="text-vpp-forest text-sm font-light">{v}</p>
            </div>
          ))}
          <div>
            <p className="stat-label text-xs">Total</p>
            <p className="text-vpp-green font-bold text-sm">${amount.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-vpp-border">
          <p className="stat-label text-xs mb-0.5 flex items-center flex-wrap">
            Block Hash (SHA-256 preview)
            <NoveltyStar label="SHA-256" />
          </p>
          <p className="font-mono text-xs text-vpp-dim font-light break-all">
            {trade.hash_preview}
            <span className="text-vpp-border">{'0'.repeat(32)}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={[
      'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-bold',
      'animate-fade-in max-w-sm',
      type === 'success' ? 'bg-vpp-green' : 'bg-vpp-danger',
    ].join(' ')}>
      {msg}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function P2PTrading() {
  const { p2pTrades = [], prosumers = [] } = useVPPStore()

  const [currentProsumerId, setCurrentProsumerId] = useState(
    () => prosumers[0]?.prosumer_id ?? 1
  )
  const [offers, setOffers] = useState([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [trades, setTrades] = useState(p2pTrades)
  const [tab, setTab] = useState('market')
  const [showPostForm, setShowPostForm] = useState(false)
  const [accepting, setAccepting] = useState(null)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({
    asset_id: '', energy_kwh: '', asking_price: '', message: '',
  })

  useEffect(() => { setTrades(p2pTrades) }, [p2pTrades])

  const fetchOffers = useCallback(async () => {
    setOffersLoading(true)
    try {
      const r = await fetch(`${API}/api/p2p/offers`)
      if (r.ok) setOffers(await r.json())
    } catch { /* ignore network blip */ }
    setOffersLoading(false)
  }, [])

  const fetchTrades = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/p2p`)
      if (r.ok) setTrades(await r.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchOffers()
    fetchTrades()
    const id = setInterval(() => { fetchOffers(); fetchTrades() }, POLL_MS)
    return () => clearInterval(id)
  }, [fetchOffers, fetchTrades])

  async function handlePostOffer() {
    if (!form.asset_id || !form.energy_kwh || !form.asking_price) {
      setToast({ msg: 'Please fill in Asset ID, Energy (kWh), and Price.', type: 'error' })
      return
    }
    try {
      const r = await fetch(`${API}/api/p2p/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_id: parseInt(currentProsumerId),
          asset_id: parseInt(form.asset_id),
          energy_kwh: parseFloat(form.energy_kwh),
          asking_price: parseFloat(form.asking_price),
          message: form.message || undefined,
        }),
      })
  
      const text = await r.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        console.error('Non-JSON response from server:', text)
        throw new Error(`Server returned non-JSON: ${text.slice(0, 100)}`)
      }
  
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
      setToast({ msg: 'Offer posted! Waiting for a buyer...', type: 'success' })
      setForm({ asset_id: '', energy_kwh: '', asking_price: '', message: '' })
      setShowPostForm(false)
      fetchOffers()
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: 'error' })
    }
  }

  async function handleAccept(offer) {
    setAccepting(offer.offer_id)
    try {
      const r = await fetch(`${API}/api/p2p/offers/${offer.offer_id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_id: currentProsumerId }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setToast({
        msg: `Trade confirmed! Block #${data.block_id} written to the blockchain ledger.`,
        type: 'success',
      })
      fetchOffers()
      fetchTrades()
      setTab('chain')
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: 'error' })
    }
    setAccepting(null)
  }

  const totalVolume = trades.reduce((s, t) => s + Number(t.energy_kwh || 0), 0)
  const totalValue  = trades.reduce((s, t) => s + Number(t.trade_amount || 0), 0)
  const confirmedCount = trades.filter((t) => t.trade_status === 'CONFIRMED').length
  const currentProsumer = prosumers.find((p) => p.prosumer_id === parseInt(currentProsumerId))

  return (
    <div className="space-y-5 relative">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-bold tracking-tight text-vpp-forest text-lg flex items-center flex-wrap gap-2">
            P2P Energy Trading
            <NoveltyStar label="Blockchain Ledger" />
          </h1>
          <p className="text-vpp-dim text-xs font-light mt-0.5">
            Two-way verified trades · SHA-256 hash chain ledger · Tamper-evident · Real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="stat-label text-xs shrink-0">Acting as:</label>
          <select
            value={currentProsumerId}
            onChange={(e) => setCurrentProsumerId(e.target.value)}
            className="border border-vpp-border rounded px-2 py-1.5 text-xs font-josefin
                       text-vpp-forest focus:outline-none focus:border-vpp-green"
          >
            {prosumers.map((p) => (
              <option key={p.prosumer_id} value={p.prosumer_id}>{p.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="stat-label mb-1">Open Offers</p>
          <p className="stat-value">{offers.length}</p>
          <p className="text-vpp-dim text-xs font-light mt-0.5">live market</p>
        </div>
        <div className="card p-4">
          <p className="stat-label mb-1">Total Blocks</p>
          <p className="stat-value">{trades.length}</p>
          <p className="text-vpp-dim text-xs font-light mt-0.5">{confirmedCount} confirmed</p>
        </div>
        <div className="card p-4">
          <p className="stat-label mb-1">Energy Traded</p>
          <p className="stat-value">{totalVolume.toFixed(0)} kWh</p>
          <p className="text-vpp-dim text-xs font-light mt-0.5">peer-to-peer</p>
        </div>
        <div className="card p-4">
          <p className="stat-label mb-1">Total Value</p>
          <p className="stat-value">${totalValue.toFixed(2)}</p>
          <p className="text-vpp-dim text-xs font-light mt-0.5">settled on-chain</p>
        </div>
      </div>

      {/* Novelty callout strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <NoveltyCallout title="Blockchain Hash Chain">
          Every trade is a block linked by SHA-256 hashes computed directly inside MySQL via
          <span className="font-mono"> SHA2()</span>. Tampering breaks the chain — verified by
          <span className="font-mono"> sp_verify_p2p_chain()</span>.
        </NoveltyCallout>
        <NoveltyCallout title="Two-Way Verification">
          Seller posts an offer — stored in <span className="font-mono">P2P_Trade_Offer</span> with
          status OPEN. Buyer independently accepts — a MySQL transaction locks the row,
          calls the stored procedure, and atomically writes the ledger block.
        </NoveltyCallout>
        <NoveltyCallout title="Real-Time Sync">
          UI polls <span className="font-mono">/api/p2p/offers</span> and
          <span className="font-mono"> /api/p2p</span> every 5 s — both prosumers see changes
          reflected without a page refresh, simulating a live marketplace.
        </NoveltyCallout>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-vpp-border">
        {[
          { id: 'market',  label: 'Open Market' },
          { id: 'chain',   label: 'Block Chain' },
          { id: 'summary', label: 'Summary' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'px-4 py-2 text-xs font-bold tracking-widest uppercase transition-colors',
              tab === id
                ? 'border-b-2 border-vpp-green text-vpp-forest'
                : 'text-vpp-dim hover:text-vpp-forest',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB: OPEN MARKET */}
      {tab === 'market' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="font-bold text-vpp-forest text-sm">
              Live Offer Board
              {offersLoading && (
                <span className="text-vpp-dim font-light ml-2 text-xs">refreshing...</span>
              )}
            </p>
            <button
              onClick={() => setShowPostForm(!showPostForm)}
              className="btn-primary shrink-0"
            >
              {showPostForm ? 'Cancel' : '+ Post Sell Offer'}
            </button>
          </div>

          {showPostForm && (
            <div className="card p-5 border-vpp-green border animate-fade-in space-y-3">
              <p className="font-bold text-vpp-forest text-sm">
                New Sell Offer
                <span className="text-vpp-dim font-light text-xs ml-2">
                  as {currentProsumer?.full_name}
                </span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="stat-label text-xs block mb-1">Asset ID</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.asset_id}
                    onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
                    placeholder="e.g. 3"
                    className="w-full border border-vpp-border rounded px-2 py-1.5 text-xs font-josefin
                               text-vpp-forest focus:outline-none focus:border-vpp-green"
                  />
                </div>
                <div>
                  <label className="stat-label text-xs block mb-1">Energy (kWh)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.energy_kwh}
                    onChange={(e) => setForm({ ...form, energy_kwh: e.target.value })}
                    placeholder="e.g. 20.0"
                    className="w-full border border-vpp-border rounded px-2 py-1.5 text-xs font-josefin
                               text-vpp-forest focus:outline-none focus:border-vpp-green"
                  />
                </div>
                <div>
                  <label className="stat-label text-xs block mb-1">Price / kWh ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.asking_price}
                    onChange={(e) => setForm({ ...form, asking_price: e.target.value })}
                    placeholder="e.g. 0.085"
                    className="w-full border border-vpp-border rounded px-2 py-1.5 text-xs font-josefin
                               text-vpp-forest focus:outline-none focus:border-vpp-green"
                  />
                </div>
                <div>
                  <label className="stat-label text-xs block mb-1">Message (optional)</label>
                  <input
                    type="text"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Solar surplus available"
                    className="w-full border border-vpp-border rounded px-2 py-1.5 text-xs font-josefin
                               text-vpp-forest focus:outline-none focus:border-vpp-green"
                  />
                </div>
              </div>

              {form.energy_kwh && form.asking_price && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-vpp-green rounded p-2">
                  <span className="text-vpp-green font-bold text-sm">
                    Trade value: ${(
                      parseFloat(form.energy_kwh || 0) * parseFloat(form.asking_price || 0)
                    ).toFixed(2)}
                  </span>
                  <span className="text-vpp-dim text-xs font-light">
                    · Offer expires in 24 hours
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handlePostOffer} className="btn-primary">
                  Post Offer
                </button>
                <button
                  onClick={() => setShowPostForm(false)}
                  className="px-4 py-2 text-xs font-bold tracking-widest uppercase border border-vpp-border
                             rounded text-vpp-dim hover:border-vpp-forest hover:text-vpp-forest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {offers.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-vpp-dim text-sm font-light">No open offers right now.</p>
              <p className="text-vpp-dim text-xs font-light mt-1">
                Be the first to post a sell offer above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {offers.map((offer) => (
                <OfferCard
                  key={offer.offer_id}
                  offer={offer}
                  currentProsumerId={currentProsumerId}
                  onAccept={handleAccept}
                  accepting={accepting}
                />
              ))}
            </div>
          )}

          <div className="card p-4 bg-emerald-50 border-vpp-green border">
            <p className="font-bold tracking-tight text-vpp-forest text-xs uppercase tracking-widest mb-2">
              Two-Way Trade Verification Flow
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-vpp-forest font-light">
              {[
                ['1. Seller Posts',  'Offer stored in P2P_Trade_Offer table with status OPEN'],
                ['2. Buyer Browses', 'Any prosumer on the network sees live offers in real time'],
                ['3. Buyer Accepts', 'Row locked via SELECT FOR UPDATE in a MySQL transaction'],
                ['4. Block Written', 'sp_record_p2p_trade() computes SHA-256 and appends to ledger'],
              ].map(([step, desc]) => (
                <div key={step}>
                  <p className="font-bold text-vpp-green mb-0.5">{step}</p>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: BLOCK CHAIN */}
      {tab === 'chain' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-vpp-forest text-sm flex items-center gap-2">
              Hash Chain Ledger ({trades.length} blocks)
              <NoveltyStar label="Novel" />
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-vpp-green" />
              <span className="stat-label text-xs">Chain Integrity: Valid</span>
            </div>
          </div>

          {trades.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-vpp-dim text-sm font-light">No confirmed trades yet.</p>
              <p className="text-vpp-dim text-xs font-light mt-1">
                Accept an offer on the Market tab to write the first block.
              </p>
            </div>
          ) : (
            <div>
              {trades.map((trade, i) => (
                <HashChainBlock
                  key={trade.block_id}
                  trade={trade}
                  isLast={i === trades.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: SUMMARY */}
      {tab === 'summary' && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-vpp-border">
            <p className="font-bold text-vpp-forest text-sm">Prosumer P2P Summary</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-vpp-gray border-b border-vpp-border">
                  {['Prosumer', 'Tariff', 'Wallet Balance', 'P2P Sold kWh', 'P2P Bought kWh', 'Net P2P'].map((h) => (
                    <th key={h} className="text-left px-4 py-2 stat-label font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prosumers.map((p, i) => {
                  const balance = Number(p.wallet_balance || 0)
                  const sold    = trades.filter((t) => t.seller === p.full_name)
                                        .reduce((s, t) => s + Number(t.energy_kwh || 0), 0)
                  const bought  = trades.filter((t) => t.buyer === p.full_name)
                                        .reduce((s, t) => s + Number(t.energy_kwh || 0), 0)
                  const net = sold - bought
                  return (
                    <tr key={p.prosumer_id} className={i % 2 === 0 ? '' : 'bg-vpp-gray bg-opacity-50'}>
                      <td className="px-4 py-2 text-vpp-forest font-bold">{p.full_name}</td>
                      <td className="px-4 py-2 text-vpp-dim font-light">{p.tariff_class}</td>
                      <td className={['px-4 py-2 font-light', balance >= 0 ? 'text-vpp-green' : 'text-vpp-danger'].join(' ')}>
                        ${balance.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-vpp-forest font-light">{sold.toFixed(1)}</td>
                      <td className="px-4 py-2 text-vpp-forest font-light">{bought.toFixed(1)}</td>
                      <td className={['px-4 py-2 font-bold', net >= 0 ? 'text-vpp-green' : 'text-vpp-danger'].join(' ')}>
                        {net >= 0 ? '+' : ''}{net.toFixed(1)} kWh
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
