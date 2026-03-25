-- ============================================================
-- VPP-ORCHESTRATE: Analytical Views
-- File: 04_analytical_views.sql  |  Phase 4 – Analytics Layer
-- ============================================================
USE vpp_orchestrate;

-- ────────────────────────────────────────────────────────────
-- VIEW 1: vw_efficiency_decay
-- Tracks inverter / panel efficiency degradation over time.
-- Uses a 10-reading rolling average (ROWS BETWEEN) per asset.
-- Flags anomalies where efficiency drops >10% from rolling mean.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_efficiency_decay AS
SELECT
    tr.asset_id,
    ea.asset_type,
    tr.ts,
    tr.active_power_kw,
    ga.max_output_kw,
    ROUND(tr.active_power_kw / NULLIF(ga.max_output_kw, 0) * 100, 2)   AS efficiency_pct,
    ROUND(AVG(tr.active_power_kw / NULLIF(ga.max_output_kw, 0) * 100)
        OVER (
            PARTITION BY tr.asset_id
            ORDER BY tr.ts
            ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
        ), 2)                                                           AS rolling_avg_eff_10,
    ROUND(tr.active_power_kw / NULLIF(ga.max_output_kw, 0) * 100
        - AVG(tr.active_power_kw / NULLIF(ga.max_output_kw, 0) * 100)
            OVER (
                PARTITION BY tr.asset_id
                ORDER BY tr.ts
                ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
            ), 2)                                                       AS efficiency_delta,
    CASE
        WHEN (tr.active_power_kw / NULLIF(ga.max_output_kw, 0) * 100)
             < AVG(tr.active_power_kw / NULLIF(ga.max_output_kw, 0) * 100)
                 OVER (PARTITION BY tr.asset_id ORDER BY tr.ts ROWS BETWEEN 9 PRECEDING AND CURRENT ROW)
             - 10
        THEN 'ANOMALY'
        ELSE 'NORMAL'
    END                                                                 AS efficiency_flag
FROM   Telemetry_Raw   tr
JOIN   Energy_Asset    ea ON ea.asset_id = tr.asset_id
JOIN   Generation_Asset ga ON ga.asset_id = tr.asset_id
WHERE  tr.active_power_kw IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- VIEW 2: vw_thermal_anomalies
-- Uses LAG() and LEAD() to detect rapid temperature spikes.
-- Flags readings where temp rose > 5°C in the prior reading.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_thermal_anomalies AS
SELECT
    asset_id,
    ts,
    temperature_c,
    LAG(temperature_c)  OVER (PARTITION BY asset_id ORDER BY ts) AS prev_temp,
    LEAD(temperature_c) OVER (PARTITION BY asset_id ORDER BY ts) AS next_temp,
    TIMESTAMPDIFF(
        SECOND,
        LAG(ts) OVER (PARTITION BY asset_id ORDER BY ts),
        ts
    )                                                            AS secs_since_prev,
    ROUND(temperature_c
        - LAG(temperature_c) OVER (PARTITION BY asset_id ORDER BY ts), 2) AS temp_delta_c,
    CASE
        WHEN temperature_c
             - LAG(temperature_c) OVER (PARTITION BY asset_id ORDER BY ts) > 5
         AND TIMESTAMPDIFF(
                 SECOND,
                 LAG(ts) OVER (PARTITION BY asset_id ORDER BY ts),
                 ts) <= 60
        THEN 'THERMAL_SPIKE'
        WHEN temperature_c > 80
        THEN 'OVER_TEMP'
        ELSE 'NORMAL'
    END                                                          AS thermal_flag
FROM  Telemetry_Raw
WHERE temperature_c IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- VIEW 3: vw_tou_billing
-- Time-of-Use billing view using window functions.
-- Ranks each kWh transaction within its hour-block and prices
-- it according to peak / off-peak / shoulder tariffs.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_tou_billing AS
SELECT
    et.txn_id,
    et.prosumer_id,
    pa.full_name,
    et.asset_id,
    et.txn_type,
    et.energy_kwh,
    HOUR(et.txn_ts)                                              AS txn_hour,
    -- Determine ToU period
    CASE
        WHEN HOUR(et.txn_ts) BETWEEN 17 AND 21 THEN 'PEAK'
        WHEN HOUR(et.txn_ts) BETWEEN 7  AND 16 THEN 'SHOULDER'
        ELSE 'OFF_PEAK'
    END                                                          AS tou_period,
    -- Price per kWh by period
    CASE
        WHEN HOUR(et.txn_ts) BETWEEN 17 AND 21 THEN 0.250000
        WHEN HOUR(et.txn_ts) BETWEEN 7  AND 16 THEN 0.150000
        ELSE 0.080000
    END                                                          AS tou_price,
    -- Cost with ToU pricing
    ROUND(et.energy_kwh *
        CASE
            WHEN HOUR(et.txn_ts) BETWEEN 17 AND 21 THEN 0.25
            WHEN HOUR(et.txn_ts) BETWEEN 7  AND 16 THEN 0.15
            ELSE 0.08
        END, 4)                                                  AS tou_cost,
    -- Running daily total per prosumer
    ROUND(SUM(et.energy_kwh *
        CASE
            WHEN HOUR(et.txn_ts) BETWEEN 17 AND 21 THEN 0.25
            WHEN HOUR(et.txn_ts) BETWEEN 7  AND 16 THEN 0.15
            ELSE 0.08
        END)
        OVER (
            PARTITION BY et.prosumer_id, DATE(et.txn_ts)
            ORDER BY et.txn_ts
            ROWS UNBOUNDED PRECEDING
        ), 4)                                                    AS running_daily_total,
    et.txn_ts,
    et.txn_status
FROM   Energy_Transaction et
JOIN   Prosumer_Account   pa ON pa.prosumer_id = et.prosumer_id
WHERE  et.txn_status = 'COMMITTED';


-- ────────────────────────────────────────────────────────────
-- VIEW 4: vw_grid_dashboard
-- Executive-level overview of real-time grid health.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_grid_dashboard AS
SELECT
    gn.node_id,
    gn.node_name,
    gn.node_status,
    gn.current_load_mw,
    gn.max_load_mw,
    ROUND(gn.current_load_mw / gn.max_load_mw * 100, 1)        AS load_utilisation_pct,
    COUNT(DISTINCT ea.asset_id)                                  AS total_assets,
    SUM(CASE WHEN ea.asset_status = 'ACTIVE'       THEN 1 ELSE 0 END) AS assets_active,
    SUM(CASE WHEN ea.asset_status = 'DISCHARGING'  THEN 1 ELSE 0 END) AS batteries_discharging,
    SUM(CASE WHEN ea.asset_status = 'FAULT'        THEN 1 ELSE 0 END) AS assets_in_fault,
    ROUND(AVG(sa.current_soc), 1)                               AS avg_battery_soc_pct,
    (SELECT COUNT(*) FROM Grid_Event ge2
     WHERE  ge2.node_id = gn.node_id
       AND  ge2.resolved_ts IS NULL
       AND  ge2.severity = 'CRITICAL')                          AS open_critical_events
FROM   Grid_Node gn
LEFT   JOIN Energy_Asset ea  ON ea.grid_node_id = gn.node_id
LEFT   JOIN Storage_Asset sa ON sa.asset_id = ea.asset_id
GROUP  BY gn.node_id, gn.node_name, gn.node_status,
          gn.current_load_mw, gn.max_load_mw;


-- ────────────────────────────────────────────────────────────
-- VIEW 5: vw_battery_health_ranking
-- Ranks batteries by health using composite scoring.
-- Operators use this for maintenance scheduling.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_battery_health_ranking AS
SELECT
    ea.asset_id,
    ea.manufacturer,
    gn.node_name,
    sa.current_soc,
    sa.capacity_kwh,
    sa.cycle_count,
    sa.chemistry,
    ea.asset_status,
    -- Health score: SOC weighted 40%, Cycle Count penalty 30%, Status penalty 30%
    ROUND(
        (sa.current_soc * 0.4)
        + GREATEST(0, (1 - sa.cycle_count / 6000.0) * 30)
        + (CASE ea.asset_status
               WHEN 'ACTIVE'      THEN 30
               WHEN 'IDLE'        THEN 25
               WHEN 'DISCHARGING' THEN 20
               WHEN 'MAINTENANCE' THEN 10
               ELSE 0
           END)
    , 1)                                                        AS battery_health_score,
    RANK() OVER (
        ORDER BY (sa.current_soc * 0.4
                  + GREATEST(0, (1 - sa.cycle_count / 6000.0) * 30))
        DESC
    )                                                           AS health_rank,
    DATE(ea.installation_date)                                  AS install_date,
    DATEDIFF(CURDATE(), ea.installation_date)                   AS age_days
FROM   Energy_Asset    ea
JOIN   Storage_Asset   sa ON sa.asset_id    = ea.asset_id
JOIN   Grid_Node       gn ON gn.node_id     = ea.grid_node_id;
