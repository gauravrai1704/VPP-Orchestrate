-- ============================================================
-- VPP-ORCHESTRATE: Stored Procedures
-- File: 03_stored_procedures.sql  |  Phase 3 – Spatial Logic
-- ============================================================
USE vpp_orchestrate;
DELIMITER $$

-- ────────────────────────────────────────────────────────────
-- PROCEDURE 1: sp_find_nearest_batteries
-- Takes a blackout-zone coordinate and returns the Top-5
-- closest batteries with SOC > min_soc_threshold.
-- Uses ST_Distance_Sphere (great-circle) with a Spatial Index.
--
-- Usage: CALL sp_find_nearest_batteries(51.5074, -0.1278, 50, 5);
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_find_nearest_batteries(
    IN  p_lat          DECIMAL(10,7),  -- Blackout zone latitude
    IN  p_lng          DECIMAL(10,7),  -- Blackout zone longitude
    IN  p_min_soc      DECIMAL(5,2),   -- Minimum SOC % required
    IN  p_top_n        INT             -- How many batteries to return
)
BEGIN
    DECLARE v_zone_point POINT;
    SET v_zone_point = ST_SRID(POINT(p_lng, p_lat), 4326);

    SELECT
        ea.asset_id,
        ea.manufacturer,
        ea.asset_status,
        sa.current_soc,
        sa.capacity_kwh,
        sa.max_discharge_rate_kw,
        gn.node_name,
        ROUND(
            ST_Distance_Sphere(ea.asset_location, v_zone_point) / 1000, 3
        )                           AS distance_km,
        -- Available energy considering discharge to 10% floor
        ROUND(sa.capacity_kwh * (sa.current_soc - 10) / 100, 2)  AS dispatchable_kwh
    FROM   Energy_Asset ea
    JOIN   Storage_Asset sa ON sa.asset_id = ea.asset_id
    JOIN   Grid_Node gn     ON gn.node_id  = ea.grid_node_id
    WHERE  sa.current_soc >= p_min_soc
      AND  ea.asset_status IN ('ACTIVE','IDLE')
      AND  MBRContains(
               -- Fast R-Tree bounding-box pre-filter (≈5.5km at 51°N)
               ST_SRID(ST_Envelope(
                   ST_Buffer(v_zone_point, 0.05)
               ), 4326),
               ea.asset_location
           )
    ORDER  BY distance_km ASC
    LIMIT  p_top_n;
END$$

-- ────────────────────────────────────────────────────────────
-- PROCEDURE 2: sp_dispatch_blackout_response
-- Orchestrates a full blackout-response:
--   1. Finds top-N nearby batteries
--   2. Sets them to DISCHARGING
--   3. Logs a BLACKOUT grid event
-- Wrapped in an atomic transaction.
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_dispatch_blackout_response(
    IN  p_lat       DECIMAL(10,7),
    IN  p_lng       DECIMAL(10,7),
    IN  p_node_id   INT UNSIGNED,
    OUT p_dispatched INT
)
BEGIN
    DECLARE v_zone_point  POINT;
    DECLARE v_event_id    BIGINT UNSIGNED;

    SET p_dispatched  = 0;
    SET v_zone_point  = ST_SRID(POINT(p_lng, p_lat), 4326);

    START TRANSACTION;

    -- Step 1: Update node to BLACKOUT
    UPDATE Grid_Node
    SET    node_status = 'BLACKOUT'
    WHERE  node_id = p_node_id;

    -- Step 2: Dispatch nearest batteries with SOC > 50%
    UPDATE Energy_Asset ea
    JOIN   Storage_Asset sa ON sa.asset_id = ea.asset_id
    SET    ea.asset_status = 'DISCHARGING',
           ea.updated_at   = NOW()
    WHERE  sa.current_soc > 50
      AND  ea.asset_status IN ('ACTIVE','IDLE')
      AND  ST_Distance_Sphere(ea.asset_location, v_zone_point) <= 5000 -- 5km radius
      AND  ST_Contains(
               ST_Buffer(v_zone_point, 0.045),
               ea.asset_location
           );

    SET p_dispatched = ROW_COUNT();

    -- Step 3: Log the blackout event
    INSERT INTO Grid_Event (event_type, node_id, severity, description, triggered_by)
    VALUES ('BLACKOUT', p_node_id, 'CRITICAL',
            CONCAT('Blackout response dispatched. ', p_dispatched, ' batteries activated.'),
            'MANUAL');

    COMMIT;
END$$

-- ────────────────────────────────────────────────────────────
-- PROCEDURE 3: sp_net_meter_invoice
-- Generates a net-metering invoice for a prosumer for a date range.
-- Uses Time-of-Use (ToU) pricing logic inline.
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_net_meter_invoice(
    IN  p_prosumer_id  INT UNSIGNED,
    IN  p_from_date    DATE,
    IN  p_to_date      DATE
)
BEGIN
    SELECT
        pa.full_name,
        pa.tariff_class,
        et.txn_type,
        et.tariff_period,
        COUNT(*)                        AS txn_count,
        ROUND(SUM(et.energy_kwh), 3)    AS total_kwh,
        ROUND(AVG(et.unit_price), 6)    AS avg_unit_price,
        ROUND(SUM(et.gross_amount), 4)  AS subtotal,
        CASE et.txn_type
            WHEN 'ENERGY_IN'  THEN 'CREDIT'
            WHEN 'ENERGY_OUT' THEN 'DEBIT'
            ELSE 'ADJUSTMENT'
        END                             AS ledger_side
    FROM   Energy_Transaction et
    JOIN   Prosumer_Account    pa ON pa.prosumer_id = et.prosumer_id
    WHERE  et.prosumer_id = p_prosumer_id
      AND  DATE(et.txn_ts) BETWEEN p_from_date AND p_to_date
      AND  et.txn_status = 'COMMITTED'
    GROUP  BY et.txn_type, et.tariff_period
    ORDER  BY et.txn_type, et.tariff_period;
END$$

-- ────────────────────────────────────────────────────────────
-- PROCEDURE 4: sp_calculate_grid_health_score
-- Returns a composite health score (0–100) per grid node,
-- factoring in load ratio, battery SOC, and active faults.
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_calculate_grid_health_score()
BEGIN
    SELECT
        gn.node_id,
        gn.node_name,
        gn.node_status,
        ROUND(gn.current_load_mw / gn.max_load_mw * 100, 1)          AS load_pct,
        ROUND(AVG(sa.current_soc), 1)                                  AS avg_battery_soc,
        COUNT(DISTINCT ge.event_id)                                    AS open_faults,
        -- Composite health: 100 = perfect, 0 = critical
        GREATEST(0, ROUND(
            100
            - (gn.current_load_mw / gn.max_load_mw * 40)   -- load penalty (max 40pts)
            - (CASE WHEN AVG(sa.current_soc) < 20 THEN 30
                    WHEN AVG(sa.current_soc) < 50 THEN 15
                    ELSE 0 END)                              -- battery penalty
            - (COUNT(DISTINCT ge.event_id) * 5)             -- fault penalty
        , 1))                                                           AS health_score
    FROM   Grid_Node gn
    LEFT   JOIN Energy_Asset ea ON ea.grid_node_id = gn.node_id AND ea.asset_type = 'BATTERY'
    LEFT   JOIN Storage_Asset sa ON sa.asset_id = ea.asset_id
    LEFT   JOIN Grid_Event ge   ON ge.node_id = gn.node_id
                                AND ge.resolved_ts IS NULL
                                AND ge.severity IN ('WARNING','CRITICAL')
    GROUP  BY gn.node_id, gn.node_name, gn.node_status,
              gn.current_load_mw, gn.max_load_mw
    ORDER  BY health_score ASC;
END$$

DELIMITER ;
