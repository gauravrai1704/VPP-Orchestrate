// ============================================================
// VPP-Orchestrate Express Backend
// File: server.js
// Run: node server.js  (from the backend/ folder)
// Requires: npm install express mysql2 cors dotenv
// ============================================================
import express   from 'express'
import mysql     from 'mysql2/promise'
import cors      from 'cors'
import dotenv    from 'dotenv'
import morgan    from 'morgan'

dotenv.config()

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(morgan('dev'))
app.use(cors())
app.use(express.json())

// ── Database connection pool ──────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     process.env.DB_PORT     ?? 3306,
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'vpp_orchestrate',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
})

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message })
  }
})

// ── Grid Nodes ───────────────────────────────────────────────
app.get('/api/nodes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT node_id, node_name, node_type, max_load_mw, current_load_mw, node_status, load_utilisation_pct, is_overloaded FROM Grid_Node'
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Assets ───────────────────────────────────────────────────
app.get('/api/assets', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        ea.asset_id, ea.asset_type, ea.manufacturer, ea.model_number,
        ea.installation_date, ea.grid_node_id, ea.asset_status,
        ga.max_output_kw, ga.panel_efficiency, ga.panel_count,
        sa.capacity_kwh, sa.current_soc, sa.cycle_count,
        sa.chemistry, sa.max_charge_rate_kw, sa.max_discharge_rate_kw,
        sa.dispatchable_kwh, sa.health_category,
        -- Latest telemetry reading
        (SELECT tr.active_power_kw FROM Telemetry_Raw tr
         WHERE tr.asset_id = ea.asset_id ORDER BY tr.ts DESC LIMIT 1)
         AS active_power_kw,
        (SELECT tr.voltage FROM Telemetry_Raw tr
         WHERE tr.asset_id = ea.asset_id ORDER BY tr.ts DESC LIMIT 1)
         AS latest_voltage,
        (SELECT tr.temperature_c FROM Telemetry_Raw tr
         WHERE tr.asset_id = ea.asset_id ORDER BY tr.ts DESC LIMIT 1)
         AS latest_temp
      FROM Energy_Asset ea
      LEFT JOIN Generation_Asset ga ON ga.asset_id = ea.asset_id
      LEFT JOIN Storage_Asset    sa ON sa.asset_id = ea.asset_id
      ORDER BY ea.asset_id
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/assets/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ea.*, ga.max_output_kw, ga.panel_efficiency, ga.panel_count,
             sa.capacity_kwh, sa.current_soc, sa.cycle_count,
             sa.chemistry, sa.dispatchable_kwh, sa.health_category
      FROM Energy_Asset ea
      LEFT JOIN Generation_Asset ga ON ga.asset_id = ea.asset_id
      LEFT JOIN Storage_Asset    sa ON sa.asset_id = ea.asset_id
      WHERE ea.asset_id = ?
    `, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Asset not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update asset status (kill switch / re-route)
app.patch('/api/assets/:id/status', async (req, res) => {
  const { status } = req.body
  const allowed = ['ACTIVE', 'IDLE', 'MAINTENANCE', 'DISCHARGING']
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` })
  }
  try {
    await pool.query(
      'UPDATE Energy_Asset SET asset_status = ? WHERE asset_id = ?',
      [status, req.params.id]
    )
    // Log the manual change as a grid event
    await pool.query(
      `INSERT INTO Grid_Event (event_type, asset_id, severity, description, triggered_by)
       VALUES ('LOAD_BALANCE', ?, 'INFO', ?, 'API')`,
      [req.params.id, `Asset #${req.params.id} status changed to ${status} via API`]
    )
    res.json({ success: true, asset_id: req.params.id, new_status: status })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Telemetry ────────────────────────────────────────────────
app.get('/api/telemetry/:assetId', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '50'), 200)
  try {
    const [rows] = await pool.query(
      `SELECT reading_id, asset_id, ts, voltage, frequency_hz,
              temperature_c, active_power_kw, reactive_power_kvar, soc_snapshot
       FROM Telemetry_Raw
       WHERE asset_id = ?
       ORDER BY ts DESC LIMIT ?`,
      [req.params.assetId, limit]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Grid Events ──────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  const limit    = Math.min(parseInt(req.query.limit ?? '50'), 200)
  const severity = req.query.severity
  try {
    let sql = `
      SELECT ge.event_id, ge.event_type, ge.severity,
             ge.event_ts, ge.resolved_ts, ge.description, ge.triggered_by,
             gn.node_name, ea.manufacturer, ea.model_number
      FROM Grid_Event ge
      LEFT JOIN Grid_Node    gn ON gn.node_id  = ge.node_id
      LEFT JOIN Energy_Asset ea ON ea.asset_id = ge.asset_id
    `
    const params = []
    if (severity) { sql += ' WHERE ge.severity = ?'; params.push(severity) }
    sql += ' ORDER BY ge.event_ts DESC LIMIT ?'
    params.push(limit)
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Prosumers ────────────────────────────────────────────────
app.get('/api/prosumers', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pa.prosumer_id, pa.full_name, pa.email, pa.tariff_class,
              pa.wallet_balance, pa.enrollment_date, pa.is_active,
              gn.node_name
       FROM Prosumer_Account pa
       JOIN Grid_Node gn ON gn.node_id = pa.grid_node_id
       ORDER BY pa.prosumer_id`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Transactions ─────────────────────────────────────────────
app.get('/api/transactions', async (req, res) => {
  const prosumerId = req.query.prosumer_id
  try {
    let sql = `
      SELECT et.txn_id, et.prosumer_id, et.asset_id, et.txn_type,
             et.energy_kwh, et.unit_price, et.gross_amount,
             et.tariff_period, et.txn_ts, et.txn_status,
             pa.full_name AS prosumer_name
      FROM Energy_Transaction et
      JOIN Prosumer_Account   pa ON pa.prosumer_id = et.prosumer_id
    `
    const params = []
    if (prosumerId) { sql += ' WHERE et.prosumer_id = ?'; params.push(prosumerId) }
    sql += ' ORDER BY et.txn_ts DESC LIMIT 100'
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── P2P Offers (two-way verification) ────────────────────────

// List all OPEN offers (any prosumer can browse)
app.get('/api/p2p/offers', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        o.offer_id, o.energy_kwh, o.asking_price,
        ROUND(o.energy_kwh * o.asking_price, 2) AS total_value,
        o.message, o.offer_status, o.created_at, o.expires_at,
        s.full_name  AS seller_name,
        s.prosumer_id AS seller_id,
        s.tariff_class,
        ea.asset_type AS energy_source,
        ea.asset_id
      FROM P2P_Trade_Offer o
      JOIN Prosumer_Account s  ON s.prosumer_id = o.seller_id
      JOIN Energy_Asset     ea ON ea.asset_id   = o.asset_id
      WHERE o.offer_status = 'OPEN'
        AND o.expires_at > NOW()
      ORDER BY o.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Seller posts a new offer
app.post('/api/p2p/offers', async (req, res) => {
  const { seller_id, asset_id, energy_kwh, asking_price, message } = req.body
  console.log('POST /api/p2p/offers body:', req.body)   // ADD THIS LINE

  if (!seller_id || !asset_id || !energy_kwh || !asking_price) {
    return res.status(400).json({
      error: 'Missing required fields: seller_id, asset_id, energy_kwh, asking_price',
    })
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO P2P_Trade_Offer
         (seller_id, asset_id, energy_kwh, asking_price, message)
       VALUES (?, ?, ?, ?, ?)`,
      [seller_id, asset_id, energy_kwh, asking_price, message ?? null]
    )
    const [[offer]] = await pool.query(
      `SELECT o.*, s.full_name AS seller_name
       FROM P2P_Trade_Offer o
       JOIN Prosumer_Account s ON s.prosumer_id = o.seller_id
       WHERE o.offer_id = ?`,
      [result.insertId]
    )
    res.status(201).json({ success: true, offer })
  } catch (err) {
    console.error('POST /api/p2p/offers error:', err.message)   // ADD THIS LINE
    res.status(400).json({ error: err.message })
  }
})

// Buyer accepts an offer → calls sp_record_p2p_trade → writes to blockchain ledger
app.post('/api/p2p/offers/:id/accept', async (req, res) => {
  const { buyer_id } = req.body
  const offerId = req.params.id
  if (!buyer_id) return res.status(400).json({ error: 'Missing buyer_id' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Lock and validate the offer
    const [[offer]] = await conn.query(
      `SELECT * FROM P2P_Trade_Offer WHERE offer_id = ? AND offer_status = 'OPEN' FOR UPDATE`,
      [offerId]
    )
    if (!offer) {
      await conn.rollback()
      conn.release()
      return res.status(409).json({ error: 'Offer is no longer available' })
    }
    if (offer.seller_id === parseInt(buyer_id)) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'Seller cannot accept their own offer' })
    }

    // 2. Call the existing stored procedure to record on the hash chain ledger
    await conn.query(
      `CALL sp_record_p2p_trade(?, ?, ?, ?, ?, @block_id, @block_hash)`,
      [offer.seller_id, buyer_id, offer.asset_id, offer.energy_kwh, offer.asking_price]
    )
    const [[ledger]] = await conn.query(
      'SELECT @block_id AS block_id, @block_hash AS block_hash'
    )

    // 3. Mark the offer as accepted
    await conn.query(
      `UPDATE P2P_Trade_Offer
       SET offer_status = 'ACCEPTED',
           buyer_id     = ?,
           block_id     = ?,
           accepted_at  = NOW()
       WHERE offer_id = ?`,
      [buyer_id, ledger.block_id, offerId]
    )

    await conn.commit()
    conn.release()

    res.json({
      success: true,
      block_id:   ledger.block_id,
      block_hash: ledger.block_hash,
      offer_id:   offerId,
    })
  } catch (err) {
    await conn.rollback()
    conn.release()
    res.status(400).json({ error: err.message })
  }
})

// Seller cancels their own open offer
app.delete('/api/p2p/offers/:id', async (req, res) => {
  const { seller_id } = req.body
  if (!seller_id) return res.status(400).json({ error: 'Missing seller_id' })
  try {
    const [result] = await pool.query(
      `UPDATE P2P_Trade_Offer
       SET offer_status = 'CANCELLED'
       WHERE offer_id = ? AND seller_id = ? AND offer_status = 'OPEN'`,
      [req.params.id, seller_id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Offer not found or already closed' })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// ── P2P Trades ───────────────────────────────────────────────
app.get('/api/p2p', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT pt.block_id, pt.trade_ts, pt.energy_kwh, pt.agreed_price,
             pt.trade_amount, pt.trade_status, pt.is_valid,
             LEFT(pt.block_hash, 16) AS hash_preview,
             LEFT(pt.prev_hash,  16) AS prev_hash_preview,
             s.full_name AS seller, b.full_name AS buyer,
             ea.asset_type AS energy_source
      FROM P2P_Trade_Ledger pt
      JOIN Prosumer_Account s  ON s.prosumer_id  = pt.seller_id
      JOIN Prosumer_Account b  ON b.prosumer_id  = pt.buyer_id
      JOIN Energy_Asset     ea ON ea.asset_id    = pt.asset_id
      ORDER BY pt.block_id DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/p2p', async (req, res) => {
  const { seller_id, buyer_id, asset_id, energy_kwh, price } = req.body
  if (!seller_id || !buyer_id || !asset_id || !energy_kwh || !price) {
    return res.status(400).json({ error: 'Missing required fields: seller_id, buyer_id, asset_id, energy_kwh, price' })
  }
  try {
    await pool.query(
      `CALL sp_record_p2p_trade(?, ?, ?, ?, ?, @block_id, @block_hash)`,
      [seller_id, buyer_id, asset_id, energy_kwh, price]
    )
    const [[result]] = await pool.query('SELECT @block_id AS block_id, @block_hash AS block_hash')
    res.json({ success: true, block_id: result.block_id, block_hash: result.block_hash })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/api/p2p/verify', async (req, res) => {
  try {
    const [rows] = await pool.query('CALL sp_verify_p2p_chain()')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Grid Health Score (stored procedure) ─────────────────────
app.get('/api/grid/health', async (req, res) => {
  try {
    const [rows] = await pool.query('CALL sp_calculate_grid_health(@c)')
    res.json(rows[0] ?? [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Fault Propagation (recursive CTE) ────────────────────────
app.get('/api/grid/fault/:nodeId', async (req, res) => {
  try {
    const [rows] = await pool.query('CALL sp_fault_propagation(?)', [req.params.nodeId])
    res.json(rows[0] ?? [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Net Meter Invoice ─────────────────────────────────────────
app.get('/api/invoice/:prosumerId', async (req, res) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'Provide ?from=YYYY-MM-DD&to=YYYY-MM-DD' })
  try {
    const [rows] = await pool.query(
      'CALL sp_net_meter_invoice(?, ?, ?)',
      [req.params.prosumerId, from, to]
    )
    res.json(rows[0] ?? [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Dynamic TOU Price ─────────────────────────────────────────
app.get('/api/price', async (req, res) => {
  const { ts, tariff, dr } = req.query
  const timestamp = ts ?? new Date().toISOString().slice(0, 19).replace('T', ' ')
  const tariffClass = tariff ?? 'RESIDENTIAL'
  const demandResp  = dr === 'true' ? 1 : 0
  try {
    const [[row]] = await pool.query(
      'SELECT fn_dynamic_tou_price(?, ?, ?) AS price',
      [timestamp, tariffClass, demandResp]
    )
    res.json({ price: row.price, tariff: tariffClass, timestamp, demand_response: !!demandResp })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Audit Trail ───────────────────────────────────────────────
app.get('/api/audit', async (req, res) => {
  const assetId = req.query.asset_id
  try {
    let sql = `
      SELECT al.log_id, al.audit_ts, al.table_name, al.asset_id,
             al.column_changed, al.old_value, al.new_value,
             al.operation, al.changed_by,
             ea.manufacturer, ea.model_number
      FROM Asset_Audit_Log al
      JOIN Energy_Asset ea ON ea.asset_id = al.asset_id
    `
    const params = []
    if (assetId) { sql += ' WHERE al.asset_id = ?'; params.push(assetId) }
    sql += ' ORDER BY al.audit_ts DESC LIMIT 100'
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Analytics views ───────────────────────────────────────────
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_grid_dashboard')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/analytics/billing', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_dynamic_billing LIMIT 100')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/analytics/thermal', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM vw_thermal_anomalies WHERE thermal_flag != 'NORMAL' LIMIT 50"
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`VPP-Orchestrate API running on http://localhost:${PORT}`)
  console.log('Endpoints:')
  console.log('  GET  /api/health')
  console.log('  GET  /api/nodes')
  console.log('  GET  /api/assets')
  console.log('  GET  /api/assets/:id')
  console.log('  PATCH /api/assets/:id/status')
  console.log('  GET  /api/telemetry/:assetId')
  console.log('  GET  /api/events')
  console.log('  GET  /api/prosumers')
  console.log('  GET  /api/transactions')
  console.log('  GET  /api/p2p')
  console.log('  POST /api/p2p')
  console.log('  GET  /api/p2p/verify')
  console.log('  GET  /api/grid/health')
  console.log('  GET  /api/grid/fault/:nodeId')
  console.log('  GET  /api/invoice/:prosumerId?from=&to=')
  console.log('  GET  /api/price?ts=&tariff=&dr=')
  console.log('  GET  /api/audit')
  console.log('  GET  /api/analytics/dashboard')
  console.log('  GET  /api/analytics/billing')
  console.log('  GET  /api/analytics/thermal')
})
