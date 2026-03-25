-- ============================================================
-- VPP-ORCHESTRATE: Triggers & Event Scheduler
-- File: 02_triggers_events.sql  |  Phase 2 – Logic & Automation
-- ============================================================
USE vpp_orchestrate;
DELIMITER $$

-- ────────────────────────────────────────────────────────────
-- TRIGGER 1: auto_load_balance
-- Fires AFTER each telemetry insert.
-- If voltage < 210V (under-voltage), the battery on that grid
-- node is put into DISCHARGING mode to stabilise the line.
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER auto_load_balance
AFTER INSERT ON Telemetry_Raw
FOR EACH ROW
BEGIN
    DECLARE v_node_id      INT UNSIGNED;
    DECLARE v_grid_demand  DECIMAL(10,3);

    -- Resolve the grid node for the asset
    SELECT grid_node_id INTO v_node_id
    FROM   Energy_Asset
    WHERE  asset_id = NEW.asset_id
    LIMIT  1;

    SELECT current_load_mw INTO v_grid_demand
    FROM   Grid_Node
    WHERE  node_id = v_node_id
    LIMIT  1;

    -- Under-voltage AND grid is under stress → discharge nearest battery
    IF NEW.voltage < 210 AND v_grid_demand > 0 THEN
        UPDATE Energy_Asset ea
        JOIN   Storage_Asset sa ON sa.asset_id = ea.asset_id
        SET    ea.asset_status = 'DISCHARGING',
               ea.updated_at   = NOW()
        WHERE  ea.grid_node_id = v_node_id
          AND  sa.current_soc  > 20
          AND  ea.asset_status NOT IN ('FAULT','MAINTENANCE')
        LIMIT  3;   -- activate up to 3 batteries per event

        -- Log the event
        INSERT INTO Grid_Event (event_type, node_id, asset_id, severity, description, triggered_by)
        VALUES ('LOAD_BALANCE', v_node_id, NEW.asset_id, 'WARNING',
                CONCAT('Auto-discharge triggered. Voltage=', NEW.voltage, 'V, Node load=', v_grid_demand, 'MW'),
                'TRIGGER');
    END IF;

    -- ── Guard-dog: over-voltage fault logging ──
    IF NEW.voltage > 245 THEN
        INSERT INTO Grid_Event (event_type, node_id, asset_id, severity, description, triggered_by)
        VALUES ('VOLTAGE_SAG', v_node_id, NEW.asset_id, 'CRITICAL',
                CONCAT('Over-voltage detected: ', NEW.voltage, 'V on asset ', NEW.asset_id),
                'TRIGGER');
    END IF;

    -- ── Guard-dog: frequency deviation ──
    IF NEW.frequency_hz NOT BETWEEN 49.5 AND 50.5 THEN
        INSERT INTO Grid_Event (event_type, node_id, asset_id, severity, description, triggered_by)
        VALUES ('FREQ_DEVIATION', v_node_id, NEW.asset_id, 'WARNING',
                CONCAT('Frequency deviation: ', NEW.frequency_hz, ' Hz'),
                'TRIGGER');
    END IF;
END$$

-- ────────────────────────────────────────────────────────────
-- TRIGGER 2: battery_soc_guard
-- Fires AFTER UPDATE on Storage_Asset.
-- Prevents hardware damage by forcing IDLE when SOC ≤ 10%.
-- Flags BATTERY_FULL event when SOC ≥ 95%.
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER battery_soc_guard
AFTER UPDATE ON Storage_Asset
FOR EACH ROW
BEGIN
    IF NEW.current_soc <= 10 AND OLD.current_soc > 10 THEN
        UPDATE Energy_Asset
        SET    asset_status = 'IDLE',
               updated_at   = NOW()
        WHERE  asset_id = NEW.asset_id;

        INSERT INTO Grid_Event (event_type, asset_id, severity, description, triggered_by)
        VALUES ('BATTERY_LOW', NEW.asset_id, 'CRITICAL',
                CONCAT('Battery SOC critically low: ', NEW.current_soc, '%. Asset forced IDLE.'),
                'TRIGGER');
    END IF;

    IF NEW.current_soc >= 95 AND OLD.current_soc < 95 THEN
        INSERT INTO Grid_Event (event_type, asset_id, severity, description, triggered_by)
        VALUES ('BATTERY_FULL', NEW.asset_id, 'INFO',
                CONCAT('Battery fully charged. SOC=', NEW.current_soc, '%.'),
                'TRIGGER');
    END IF;
END$$

-- ────────────────────────────────────────────────────────────
-- TRIGGER 3: transaction_ledger_balance
-- BEFORE INSERT on Energy_Transaction.
-- Ensures the prosumer wallet is updated atomically.
-- Credits add to wallet; debits subtract (ENERGY_IN = prosumer sells to grid).
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER transaction_ledger_balance
BEFORE INSERT ON Energy_Transaction
FOR EACH ROW
BEGIN
    SET NEW.txn_status = 'COMMITTED';

    IF NEW.txn_type = 'ENERGY_IN' THEN
        -- Prosumer exported energy → credit their wallet
        UPDATE Prosumer_Account
        SET    wallet_balance = wallet_balance + (NEW.energy_kwh * NEW.unit_price)
        WHERE  prosumer_id = NEW.prosumer_id;
    ELSEIF NEW.txn_type = 'ENERGY_OUT' THEN
        -- Prosumer consumed energy → debit their wallet
        UPDATE Prosumer_Account
        SET    wallet_balance = wallet_balance - (NEW.energy_kwh * NEW.unit_price)
        WHERE  prosumer_id = NEW.prosumer_id;
    END IF;
END$$

-- ────────────────────────────────────────────────────────────
-- EVENT: grid_health_monitor
-- Runs every 1 minute.
-- Calculates the Grid Health Score for each node and flags
-- OVERLOAD events when load exceeds 85% of max capacity.
-- ────────────────────────────────────────────────────────────
CREATE EVENT grid_health_monitor
ON SCHEDULE EVERY 1 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Flag overloaded nodes
    INSERT INTO Grid_Event (event_type, node_id, severity, description, triggered_by)
    SELECT 'OVERLOAD',
           node_id,
           CASE WHEN (current_load_mw / max_load_mw) >= 0.95 THEN 'CRITICAL'
                WHEN (current_load_mw / max_load_mw) >= 0.85 THEN 'WARNING'
           END,
           CONCAT('Node load at ',
                  ROUND((current_load_mw / max_load_mw) * 100, 1),
                  '%. Load=', current_load_mw, 'MW / Max=', max_load_mw, 'MW'),
           'EVENT_SCHEDULER'
    FROM Grid_Node
    WHERE current_load_mw / max_load_mw >= 0.85
      AND node_status != 'BLACKOUT';

    -- Update node_status flags
    UPDATE Grid_Node
    SET    node_status = CASE
               WHEN current_load_mw / max_load_mw >= 0.95 THEN 'STRESSED'
               WHEN current_load_mw / max_load_mw >= 0.85 THEN 'STRESSED'
               ELSE 'NORMAL'
           END
    WHERE  node_status NOT IN ('BLACKOUT','MAINTENANCE');

    -- Auto-resolve old grid events (>1 hour without follow-up)
    UPDATE Grid_Event
    SET    resolved_ts = NOW()
    WHERE  resolved_ts IS NULL
      AND  event_ts < DATE_SUB(NOW(), INTERVAL 1 HOUR)
      AND  event_type NOT IN ('BLACKOUT','FAULT');
END$$

-- ────────────────────────────────────────────────────────────
-- EVENT: daily_billing_rollup
-- Runs daily at 23:58 to finalise ToU billing for the day.
-- ────────────────────────────────────────────────────────────
CREATE EVENT daily_billing_rollup
ON SCHEDULE EVERY 1 DAY
STARTS CONCAT(CURDATE(), ' 23:58:00')
DO
BEGIN
    -- Mark all PENDING transactions from today as COMMITTED
    UPDATE Energy_Transaction
    SET    txn_status = 'COMMITTED'
    WHERE  txn_status = 'PENDING'
      AND  DATE(txn_ts) = CURDATE();
END$$

DELIMITER ;
