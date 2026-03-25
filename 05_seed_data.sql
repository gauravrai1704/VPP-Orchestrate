-- ============================================================
-- VPP-ORCHESTRATE: Sample Seed Data
-- File: 05_seed_data.sql
-- Run after schema + triggers are set up.
-- ============================================================
USE vpp_orchestrate;

-- Disable FK checks during bulk insert
SET FOREIGN_KEY_CHECKS = 0;

-- ── Grid Nodes ──────────────────────────────────────────────
INSERT INTO Grid_Node (node_name, node_type, location, service_radius_km, max_load_mw, current_load_mw) VALUES
('Substation Alpha',   'SUBSTATION',   ST_SRID(POINT(-0.1278, 51.5074), 4326), 5.0,  150.0, 82.5),
('Substation Beta',    'SUBSTATION',   ST_SRID(POINT(-0.0900, 51.5120), 4326), 4.5,  120.0, 95.4),   -- stressed
('Transformer East-1', 'TRANSFORMER',  ST_SRID(POINT(-0.0650, 51.4980), 4326), 2.0,   40.0, 12.0),
('Transformer West-1', 'TRANSFORMER',  ST_SRID(POINT(-0.1900, 51.5200), 4326), 2.0,   40.0, 38.0),
('Distribution Node 5','DISTRIBUTION', ST_SRID(POINT(-0.1100, 51.4850), 4326), 1.5,   20.0,  5.0);

-- ── Energy Assets ────────────────────────────────────────────
INSERT INTO Energy_Asset (asset_type, manufacturer, model_number, installation_date, asset_location, grid_node_id, asset_status) VALUES
-- Solar panels
('SOLAR',   'SunPower',     'SPR-A440-WHT-D', '2022-03-15', ST_SRID(POINT(-0.1295, 51.5065), 4326), 1, 'ACTIVE'),
('SOLAR',   'LG Solar',     'LG400N2W-A5',    '2023-01-20', ST_SRID(POINT(-0.0920, 51.5100), 4326), 2, 'ACTIVE'),
('SOLAR',   'Panasonic',    'EVPV400HK',       '2021-07-11', ST_SRID(POINT(-0.0670, 51.4970), 4326), 3, 'ACTIVE'),
-- Wind turbines
('WIND',    'Vestas',       'V150-4.5MW',      '2020-05-01', ST_SRID(POINT(-0.1950, 51.5210), 4326), 4, 'ACTIVE'),
('WIND',    'Siemens Gamesa','SG-5.0-132',     '2021-09-30', ST_SRID(POINT(-0.1150, 51.4840), 4326), 5, 'ACTIVE'),
-- Batteries
('BATTERY', 'Tesla',        'Megapack 2XL',    '2023-06-01', ST_SRID(POINT(-0.1270, 51.5080), 4326), 1, 'ACTIVE'),
('BATTERY', 'CATL',         'EnerOne Plus',    '2023-08-15', ST_SRID(POINT(-0.0880, 51.5110), 4326), 2, 'IDLE'),
('BATTERY', 'BYD',          'Battery-Box HVS', '2022-11-20', ST_SRID(POINT(-0.0640, 51.4990), 4326), 3, 'ACTIVE'),
-- Inverters
('INVERTER','SMA Solar',    'Sunny Tripower',  '2022-03-15', ST_SRID(POINT(-0.1298, 51.5062), 4326), 1, 'ACTIVE'),
('INVERTER','Fronius',      'Symo Advanced',   '2023-01-20', ST_SRID(POINT(-0.0925, 51.5098), 4326), 2, 'ACTIVE');

-- ── Generation Assets ────────────────────────────────────────
INSERT INTO Generation_Asset (asset_id, max_output_kw, panel_efficiency, panel_count, orientation_deg)
SELECT asset_id,
    CASE asset_type
        WHEN 'SOLAR' THEN 440.0
        WHEN 'WIND'  THEN 4500.0
    END,
    CASE asset_type
        WHEN 'SOLAR' THEN 22.8
        WHEN 'WIND'  THEN 48.0
    END,
    CASE asset_type WHEN 'SOLAR' THEN 1000 ELSE 1 END,
    180.0
FROM Energy_Asset WHERE asset_type IN ('SOLAR','WIND');

-- ── Storage Assets ───────────────────────────────────────────
INSERT INTO Storage_Asset (asset_id, capacity_kwh, current_soc, cycle_count, chemistry, max_charge_rate_kw, max_discharge_rate_kw)
VALUES
(6,  3900.0, 87.5, 312, 'LFP', 1500.0, 1500.0),   -- Tesla Megapack
(7,  2800.0, 42.0, 189, 'NMC',  900.0,  900.0),   -- CATL
(8,  1920.0, 71.3, 445, 'LFP',  600.0,  600.0);   -- BYD

-- ── Prosumers ────────────────────────────────────────────────
INSERT INTO Prosumer_Account (full_name, email, grid_node_id, wallet_balance, tariff_class, enrollment_date) VALUES
('Alice Pemberton', 'alice@example.com',  1,  245.82, 'RESIDENTIAL', '2022-04-01'),
('Bob Tanaka',      'bob@example.com',    2,  -12.50, 'RESIDENTIAL', '2023-02-14'),
('GreenCo Ltd',     'ops@greenco.io',     1, 8920.00, 'COMMERCIAL',  '2021-11-01'),
('Windward Energy', 'grid@windward.net',  4, 42500.0, 'INDUSTRIAL',  '2020-06-15');

-- ── Prosumer → Asset ownership ───────────────────────────────
INSERT INTO Prosumer_Asset (prosumer_id, asset_id, ownership_pct, since_date) VALUES
(1, 1, 100.00, '2022-03-15'),   -- Alice owns Solar 1
(2, 2, 100.00, '2023-01-20'),   -- Bob owns Solar 2
(3, 6,  80.00, '2023-06-01'),   -- GreenCo 80% Megapack
(4, 4, 100.00, '2020-05-01'),   -- Windward owns Wind 1
(4, 5, 100.00, '2021-09-30'),   -- Windward owns Wind 2
(3, 6,  20.00, '2023-06-01');   -- Alice 20% stake in Megapack (double-ownership)

-- ── Sample Telemetry ─────────────────────────────────────────
INSERT INTO Telemetry_Raw (asset_id, ts, voltage, frequency_hz, temperature_c, active_power_kw, reactive_power_kvar, soc_snapshot) VALUES
(1, '2025-03-01 10:00:00.000', 231.2, 50.01, 38.5, 385.2, 42.1, NULL),
(1, '2025-03-01 10:00:01.000', 230.8, 49.99, 38.7, 383.0, 41.8, NULL),
(6, '2025-03-01 10:00:00.000', 229.5, 50.02, 31.2, 750.0, 82.5, 87.5),
(6, '2025-03-01 17:30:00.000', 208.2, 49.7,  34.0, 1200.0,130.0, 65.0),  -- under-voltage → trigger fires
(7, '2025-03-01 10:00:00.000', 230.0, 50.00, 29.0, 200.0, 22.0, 42.0);

-- ── Sample Transactions (Net-Metering) ───────────────────────
INSERT INTO Energy_Transaction (prosumer_id, asset_id, txn_type, energy_kwh, unit_price, tariff_period, txn_status) VALUES
(1, 1, 'ENERGY_IN',  42.5,  0.250000, 'PEAK',     'COMMITTED'),
(1, 1, 'ENERGY_IN',  30.0,  0.150000, 'SHOULDER', 'COMMITTED'),
(1, 1, 'ENERGY_OUT', 15.8,  0.250000, 'PEAK',     'COMMITTED'),
(2, 2, 'ENERGY_OUT', 22.3,  0.080000, 'OFF_PEAK', 'COMMITTED'),
(3, 6, 'ENERGY_IN',  980.0, 0.250000, 'PEAK',     'COMMITTED'),
(4, 4, 'ENERGY_IN', 2450.0, 0.150000, 'SHOULDER', 'COMMITTED');

SET FOREIGN_KEY_CHECKS = 1;

-- Confirm load
SELECT 'Grid Nodes'           AS entity, COUNT(*) AS rows FROM Grid_Node
UNION ALL
SELECT 'Energy Assets',        COUNT(*) FROM Energy_Asset
UNION ALL
SELECT 'Storage Assets',       COUNT(*) FROM Storage_Asset
UNION ALL
SELECT 'Prosumers',            COUNT(*) FROM Prosumer_Account
UNION ALL
SELECT 'Transactions',         COUNT(*) FROM Energy_Transaction
UNION ALL
SELECT 'Telemetry rows',       COUNT(*) FROM Telemetry_Raw;
