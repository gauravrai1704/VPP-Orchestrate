-- ============================================================
-- VPP-ORCHESTRATE: Expanded Seed Data
-- File: 05_seed_data_expanded.sql
-- Run AFTER: 01_schema_ddl.sql, 02_triggers_events.sql
-- ============================================================
USE vpp_orchestrate;

SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing data (run in dependency order)
DELETE FROM Grid_Event;
DELETE FROM Energy_Transaction;
DELETE FROM Telemetry_Raw;
DELETE FROM Prosumer_Asset;
DELETE FROM Prosumer_Account;
DELETE FROM Generation_Asset;
DELETE FROM Storage_Asset;
DELETE FROM Energy_Asset;
DELETE FROM Grid_Node;

-- Reset auto-increment counters
ALTER TABLE Grid_Node          AUTO_INCREMENT = 1;
ALTER TABLE Energy_Asset       AUTO_INCREMENT = 1;
ALTER TABLE Prosumer_Account   AUTO_INCREMENT = 1;
ALTER TABLE Telemetry_Raw      AUTO_INCREMENT = 1;
ALTER TABLE Energy_Transaction AUTO_INCREMENT = 1;
ALTER TABLE Grid_Event         AUTO_INCREMENT = 1;

-- ============================================================
-- 1. GRID NODES  (5 nodes)
-- ============================================================
INSERT INTO Grid_Node
    (node_name, node_type, max_load_mw, current_load_mw, node_status)
VALUES
    ('Node Alpha',    'SUBSTATION',   150.0,  82.5, 'NORMAL'),
    ('Node Beta',     'SUBSTATION',   120.0,  95.4, 'STRESSED'),
    ('Node East',     'TRANSFORMER',   40.0,  12.0, 'NORMAL'),
    ('Node West',     'TRANSFORMER',   40.0,  38.0, 'NORMAL'),
    ('Node South',    'DISTRIBUTION',  20.0,   5.0, 'NORMAL');

-- ============================================================
-- 2. ENERGY ASSETS  (10 assets)
-- ============================================================
INSERT INTO Energy_Asset
    (asset_type, manufacturer, model_number, installation_date, grid_node_id, asset_status)
VALUES
-- Solar panels (asset_id 1, 2, 3)
    ('SOLAR',   'SunPower',  'SP-440',  '2022-03-15', 1, 'ACTIVE'),
    ('SOLAR',   'LG Solar',  'LG-400',  '2023-01-20', 2, 'ACTIVE'),
    ('SOLAR',   'Panasonic', 'PAN-400', '2021-07-11', 3, 'ACTIVE'),
-- Wind turbines (asset_id 4, 5)
    ('WIND',    'Vestas',    'V150',    '2020-05-01', 4, 'ACTIVE'),
    ('WIND',    'Siemens',   'SG-132',  '2021-09-30', 5, 'ACTIVE'),
-- Batteries (asset_id 6, 7, 8)
    ('BATTERY', 'Tesla',     'Mega-2',  '2023-06-01', 1, 'ACTIVE'),
    ('BATTERY', 'CATL',      'Ener-1',  '2023-08-15', 2, 'IDLE'),
    ('BATTERY', 'BYD',       'Box-HVS', '2022-11-20', 3, 'ACTIVE'),
-- Inverters (asset_id 9, 10)
    ('INVERTER','SMA',       'Tri-25',  '2022-03-15', 1, 'ACTIVE'),
    ('INVERTER','Fronius',   'Symo-15', '2023-01-20', 2, 'ACTIVE');

-- ============================================================
-- 3. GENERATION ASSETS  (solar + wind subtypes)
-- ============================================================
INSERT INTO Generation_Asset
    (asset_id, max_output_kw, panel_efficiency, panel_count, orientation_deg)
VALUES
    (1,  440.0, 22.8, 1000, 180.0),   -- SunPower solar
    (2,  440.0, 21.5, 1000, 175.0),   -- LG solar
    (3,  400.0, 20.9,  800, 185.0),   -- Panasonic solar
    (4, 4500.0, 48.0,    1, NULL),    -- Vestas wind
    (5, 5000.0, 49.5,    1, NULL);    -- Siemens wind

-- ============================================================
-- 4. STORAGE ASSETS  (battery subtypes)
-- ============================================================
INSERT INTO Storage_Asset
    (asset_id, capacity_kwh, current_soc, cycle_count, chemistry,
     max_charge_rate_kw, max_discharge_rate_kw)
VALUES
    (6, 3900.0, 87.5, 312, 'LFP', 1500.0, 1500.0),   -- Tesla
    (7, 2800.0, 42.0, 189, 'NMC',  900.0,  900.0),   -- CATL
    (8, 1920.0, 71.3, 445, 'LFP',  600.0,  600.0);   -- BYD

-- ============================================================
-- 5. PROSUMER ACCOUNTS  (4 prosumers)
-- ============================================================
INSERT INTO Prosumer_Account
    (full_name, email, grid_node_id, wallet_balance, tariff_class, enrollment_date)
VALUES
    ('Alice',    'alice@vpp.com',   1,   245.82, 'RESIDENTIAL', '2022-04-01'),
    ('Bob',      'bob@vpp.com',     2,   -12.50, 'RESIDENTIAL', '2023-02-14'),
    ('GreenCo',  'ops@greenco.com', 1,  8920.00, 'COMMERCIAL',  '2021-11-01'),
    ('Windward', 'grid@windco.com', 4, 42500.00, 'INDUSTRIAL',  '2020-06-15');

-- ============================================================
-- 6. PROSUMER → ASSET OWNERSHIP
-- ============================================================
INSERT INTO Prosumer_Asset (prosumer_id, asset_id, ownership_pct, since_date) VALUES
    (1, 1, 100.00, '2022-03-15'),   -- Alice owns Solar 1
    (2, 2, 100.00, '2023-01-20'),   -- Bob owns Solar 2
    (3, 3, 100.00, '2021-07-11'),   -- GreenCo owns Solar 3
    (3, 6,  80.00, '2023-06-01'),   -- GreenCo 80% Tesla battery
    (1, 6,  20.00, '2023-06-01'),   -- Alice 20% Tesla battery
    (4, 4, 100.00, '2020-05-01'),   -- Windward owns Wind 1
    (4, 5, 100.00, '2021-09-30');   -- Windward owns Wind 2

-- ============================================================
-- 7. TELEMETRY READINGS  (~30 rows)
-- Spread across assets, dates, and conditions.
-- Row 4 has low voltage (208V) → triggers auto_load_balance
-- Row 12 has high temperature → triggers thermal anomaly view
-- ============================================================
INSERT INTO Telemetry_Raw
    (asset_id, ts, voltage, frequency_hz, temperature_c, active_power_kw, reactive_power_kvar, soc_snapshot)
VALUES
-- Solar 1 (asset 1) — morning ramp-up on 1 March
    (1, '2025-03-01 07:00:00.000', 230.5, 50.01, 35.0,  80.0,  8.8, NULL),
    (1, '2025-03-01 09:00:00.000', 231.0, 50.00, 37.2, 220.0, 24.2, NULL),
    (1, '2025-03-01 12:00:00.000', 231.8, 49.99, 39.5, 410.0, 45.1, NULL),
    (1, '2025-03-01 15:00:00.000', 230.2, 50.02, 38.0, 300.0, 33.0, NULL),
    (1, '2025-03-01 18:00:00.000', 229.5, 50.01, 36.5,  60.0,  6.6, NULL),

-- Solar 2 (asset 2) — next day
    (2, '2025-03-02 08:00:00.000', 230.8, 49.98, 34.0, 150.0, 16.5, NULL),
    (2, '2025-03-02 11:00:00.000', 231.2, 50.01, 38.0, 380.0, 41.8, NULL),
    (2, '2025-03-02 14:00:00.000', 230.9, 50.00, 40.5, 420.0, 46.2, NULL),
    (2, '2025-03-02 17:00:00.000', 208.2, 49.70, 34.0,  50.0,  5.5, NULL),   -- LOW VOLTAGE → trigger fires

-- Wind 1 (asset 4) — variable wind
    (4, '2025-03-01 06:00:00.000', 232.0, 50.05, 28.0, 2200.0, 242.0, NULL),
    (4, '2025-03-01 10:00:00.000', 231.5, 50.02, 29.5, 3800.0, 418.0, NULL),
    (4, '2025-03-01 14:00:00.000', 230.0, 49.97, 31.0, 4100.0, 451.0, NULL),
    (4, '2025-03-01 20:00:00.000', 231.0, 50.00, 27.5, 1500.0, 165.0, NULL),

-- Wind 2 (asset 5)
    (5, '2025-03-02 08:00:00.000', 230.5, 50.01, 30.0, 2900.0, 319.0, NULL),
    (5, '2025-03-02 14:00:00.000', 231.0, 50.00, 33.0, 4500.0, 495.0, NULL),
    (5, '2025-03-02 20:00:00.000', 229.8, 49.99, 29.0, 3100.0, 341.0, NULL),

-- Tesla Battery (asset 6) — discharging during peak hours
    (6, '2025-03-01 10:00:00.000', 229.5, 50.02, 31.0,  750.0,  82.5,  87.5),
    (6, '2025-03-01 17:00:00.000', 229.8, 50.01, 32.0, 1200.0, 132.0,  75.0),
    (6, '2025-03-01 19:00:00.000', 230.0, 50.00, 33.5, 1400.0, 154.0,  61.0),
    (6, '2025-03-01 21:00:00.000', 230.2, 49.99, 31.5,  500.0,  55.0,  55.0),
    (6, '2025-03-02 08:00:00.000', 230.5, 50.01, 30.0,  200.0,  22.0,  52.0),

-- CATL Battery (asset 7)
    (7, '2025-03-01 12:00:00.000', 230.0, 50.00, 29.0,  200.0,  22.0,  42.0),
    (7, '2025-03-01 18:00:00.000', 230.1, 50.01, 30.5,  400.0,  44.0,  35.0),

-- BYD Battery (asset 8) — thermal spike on row below
    (8, '2025-03-01 10:00:00.000', 229.8, 50.00, 38.0,  300.0,  33.0,  71.0),
    (8, '2025-03-01 10:01:00.000', 229.9, 50.01, 52.0,  310.0,  34.1,  70.5),   -- +14°C spike → thermal anomaly
    (8, '2025-03-01 12:00:00.000', 230.0, 50.00, 41.0,  320.0,  35.2,  67.0),
    (8, '2025-03-02 10:00:00.000', 230.2, 49.99, 39.5,  280.0,  30.8,  63.0),

-- Solar 3 (asset 3) — slightly lower efficiency (older panels)
    (3, '2025-03-01 10:00:00.000', 230.0, 50.00, 36.0,  310.0,  34.1, NULL),
    (3, '2025-03-01 13:00:00.000', 230.5, 50.01, 38.5,  360.0,  39.6, NULL),
    (3, '2025-03-02 11:00:00.000', 229.8, 49.98, 37.0,  290.0,  31.9, NULL);

-- ============================================================
-- 8. ENERGY TRANSACTIONS  (~25 rows)
-- Mix of ENERGY_IN (prosumer sells), ENERGY_OUT (buys),
-- across all 3 tariff periods, all 4 prosumers.
-- ============================================================
INSERT INTO Energy_Transaction
    (prosumer_id, asset_id, txn_type, energy_kwh, unit_price, tariff_period, txn_ts, txn_status)
VALUES
-- Alice (prosumer 1) — residential, sells solar, buys at night
    (1, 1, 'ENERGY_IN',  42.5, 0.250000, 'PEAK',     '2025-03-01 18:00:00', 'COMMITTED'),
    (1, 1, 'ENERGY_IN',  30.0, 0.150000, 'SHOULDER', '2025-03-01 12:00:00', 'COMMITTED'),
    (1, 1, 'ENERGY_IN',  18.0, 0.080000, 'OFF_PEAK', '2025-03-02 02:00:00', 'COMMITTED'),
    (1, 1, 'ENERGY_OUT', 15.8, 0.250000, 'PEAK',     '2025-03-01 19:00:00', 'COMMITTED'),
    (1, 1, 'ENERGY_OUT', 22.0, 0.080000, 'OFF_PEAK', '2025-03-02 23:00:00', 'COMMITTED'),
    (1, 1, 'ENERGY_IN',  35.0, 0.150000, 'SHOULDER', '2025-03-03 10:00:00', 'COMMITTED'),
    (1, 1, 'ENERGY_OUT', 10.5, 0.150000, 'SHOULDER', '2025-03-04 14:00:00', 'COMMITTED'),

-- Bob (prosumer 2) — residential, smaller solar, mostly buys
    (2, 2, 'ENERGY_OUT', 22.3, 0.080000, 'OFF_PEAK', '2025-03-01 23:00:00', 'COMMITTED'),
    (2, 2, 'ENERGY_OUT', 18.0, 0.250000, 'PEAK',     '2025-03-02 18:30:00', 'COMMITTED'),
    (2, 2, 'ENERGY_IN',  25.0, 0.150000, 'SHOULDER', '2025-03-02 11:00:00', 'COMMITTED'),
    (2, 2, 'ENERGY_OUT', 14.0, 0.080000, 'OFF_PEAK', '2025-03-03 01:00:00', 'COMMITTED'),
    (2, 2, 'ENERGY_IN',  20.0, 0.250000, 'PEAK',     '2025-03-03 17:30:00', 'COMMITTED'),
    (2, 2, 'ENERGY_OUT', 30.0, 0.150000, 'SHOULDER', '2025-03-04 09:00:00', 'COMMITTED'),

-- GreenCo (prosumer 3) — commercial, large solar + battery
    (3, 3,  'ENERGY_IN',  980.0, 0.250000, 'PEAK',     '2025-03-01 18:00:00', 'COMMITTED'),
    (3, 6,  'ENERGY_IN',  500.0, 0.250000, 'PEAK',     '2025-03-01 19:00:00', 'COMMITTED'),
    (3, 3,  'ENERGY_IN',  750.0, 0.150000, 'SHOULDER', '2025-03-02 12:00:00', 'COMMITTED'),
    (3, 6,  'ENERGY_OUT', 300.0, 0.150000, 'SHOULDER', '2025-03-02 09:00:00', 'COMMITTED'),
    (3, 3,  'ENERGY_IN',  620.0, 0.080000, 'OFF_PEAK', '2025-03-03 03:00:00', 'COMMITTED'),
    (3, 6,  'ENERGY_OUT', 200.0, 0.080000, 'OFF_PEAK', '2025-03-03 02:00:00', 'COMMITTED'),

-- Windward (prosumer 4) — industrial, large wind farm
    (4, 4, 'ENERGY_IN', 2450.0, 0.150000, 'SHOULDER', '2025-03-01 11:00:00', 'COMMITTED'),
    (4, 5, 'ENERGY_IN', 3100.0, 0.150000, 'SHOULDER', '2025-03-01 13:00:00', 'COMMITTED'),
    (4, 4, 'ENERGY_IN', 1800.0, 0.250000, 'PEAK',     '2025-03-01 18:00:00', 'COMMITTED'),
    (4, 5, 'ENERGY_IN', 2200.0, 0.250000, 'PEAK',     '2025-03-02 17:00:00', 'COMMITTED'),
    (4, 4, 'ENERGY_IN', 4000.0, 0.080000, 'OFF_PEAK', '2025-03-03 02:00:00', 'COMMITTED'),
    (4, 5, 'ENERGY_OUT',  500.0, 0.080000, 'OFF_PEAK', '2025-03-03 04:00:00', 'COMMITTED');

-- ============================================================
-- 9. GRID EVENTS  (8 rows — mix of auto and manual)
-- ============================================================
INSERT INTO Grid_Event
    (event_type, node_id, asset_id, severity, event_ts, resolved_ts, description, triggered_by)
VALUES
    ('LOAD_BALANCE', 2, 2, 'WARNING',
     '2025-03-02 17:00:00', '2025-03-02 17:45:00',
     'Low voltage 208.2V on Node Beta. Batteries dispatched.', 'TRIGGER'),

    ('OVERLOAD', 2, NULL, 'WARNING',
     '2025-03-01 18:30:00', '2025-03-01 19:15:00',
     'Node Beta load at 79.5%. Approaching limit.', 'EVENT_SCHEDULER'),

    ('OVERLOAD', 2, NULL, 'CRITICAL',
     '2025-03-02 19:00:00', NULL,
     'Node Beta load at 95.4%. CRITICAL overload.', 'EVENT_SCHEDULER'),

    ('BATTERY_LOW', 7, NULL, 'CRITICAL',
     '2025-03-01 20:00:00', '2025-03-02 06:00:00',
     'CATL battery SOC at 8%. Forced to IDLE.', 'TRIGGER'),

    ('BATTERY_FULL', 6, NULL, 'INFO',
     '2025-03-02 14:00:00', '2025-03-02 14:00:01',
     'Tesla battery fully charged. SOC = 95.2%.', 'TRIGGER'),

    ('FREQ_DEVIATION', 2, 2, 'WARNING',
     '2025-03-02 17:00:00', '2025-03-02 17:10:00',
     'Frequency dropped to 49.7 Hz on Node Beta.', 'TRIGGER'),

    ('VOLTAGE_SAG', 1, 1, 'INFO',
     '2025-03-01 07:00:00', '2025-03-01 07:30:00',
     'Minor voltage sag 229.5V during morning startup.', 'TRIGGER'),

    ('MAINTENANCE', 4, NULL, 'INFO',
     '2025-03-05 08:00:00', NULL,
     'Scheduled maintenance on Node West transformer.', 'MANUAL');

-- ============================================================
SET FOREIGN_KEY_CHECKS = 1;

-- Quick row count check
SELECT 'Grid_Node'           AS table_name, COUNT(*) AS row_count FROM Grid_Node
UNION ALL SELECT 'Energy_Asset',       COUNT(*) FROM Energy_Asset
UNION ALL SELECT 'Generation_Asset',   COUNT(*) FROM Generation_Asset
UNION ALL SELECT 'Storage_Asset',      COUNT(*) FROM Storage_Asset
UNION ALL SELECT 'Prosumer_Account',   COUNT(*) FROM Prosumer_Account
UNION ALL SELECT 'Prosumer_Asset',     COUNT(*) FROM Prosumer_Asset
UNION ALL SELECT 'Telemetry_Raw',      COUNT(*) FROM Telemetry_Raw
UNION ALL SELECT 'Energy_Transaction', COUNT(*) FROM Energy_Transaction
UNION ALL SELECT 'Grid_Event',         COUNT(*) FROM Grid_Event;
