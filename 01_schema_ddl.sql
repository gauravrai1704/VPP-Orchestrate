-- ============================================================
-- VPP-ORCHESTRATE: Virtual Power Plant Orchestration System
-- File: 01_schema_ddl.sql  |  Phase 1 – Schema & Spatial Setup
-- Database: MySQL 8.0+  |  Engine: InnoDB  |  SRID: 4326
-- ============================================================

-- ── Global Config ────────────────────────────────────────────
SET GLOBAL event_scheduler = ON;
CREATE DATABASE IF NOT EXISTS vpp_orchestrate
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE vpp_orchestrate;

-- ============================================================
-- CLUSTER A: ASSET HIERARCHY  (ISA / Specialization)
-- ============================================================

-- Supertype: every physical device in the grid
CREATE TABLE Energy_Asset (
    asset_id        INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    asset_type      ENUM('SOLAR','WIND','BATTERY','INVERTER') NOT NULL,
    manufacturer    VARCHAR(100)    NOT NULL,
    model_number    VARCHAR(100),
    installation_date DATE          NOT NULL,
    asset_location  POINT           NOT NULL SRID 4326,   -- WGS-84 GPS coords
    grid_node_id    INT UNSIGNED    NOT NULL,
    asset_status    ENUM('ACTIVE','IDLE','FAULT','MAINTENANCE','DISCHARGING') DEFAULT 'ACTIVE',
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    SPATIAL INDEX idx_asset_location (asset_location),
    INDEX idx_grid_node (grid_node_id),
    INDEX idx_asset_type (asset_type),
    INDEX idx_status (asset_status)
) ENGINE=InnoDB;

-- Subtype: Generation assets (Solar panels, Wind turbines)
CREATE TABLE Generation_Asset (
    asset_id        INT UNSIGNED    PRIMARY KEY,
    max_output_kw   DECIMAL(10,3)   NOT NULL,
    panel_efficiency DECIMAL(5,2)   NOT NULL COMMENT 'Percentage 0-100',
    panel_count     INT UNSIGNED    DEFAULT 1,
    orientation_deg DECIMAL(5,2)    COMMENT 'Azimuth degrees (Solar)',
    CONSTRAINT chk_efficiency CHECK (panel_efficiency BETWEEN 0 AND 100),
    CONSTRAINT chk_max_output CHECK (max_output_kw > 0),
    FOREIGN KEY (asset_id) REFERENCES Energy_Asset(asset_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Subtype: Storage assets (Batteries)
CREATE TABLE Storage_Asset (
    asset_id        INT UNSIGNED    PRIMARY KEY,
    capacity_kwh    DECIMAL(10,3)   NOT NULL,
    current_soc     DECIMAL(5,2)    NOT NULL DEFAULT 100.00 COMMENT 'State of Charge 0-100%',
    cycle_count     INT UNSIGNED    DEFAULT 0,
    chemistry       ENUM('LFP','NMC','NCA','VRLA') DEFAULT 'LFP',
    max_charge_rate_kw   DECIMAL(8,3),
    max_discharge_rate_kw DECIMAL(8,3),
    CONSTRAINT chk_soc CHECK (current_soc BETWEEN 0 AND 100),
    CONSTRAINT chk_capacity CHECK (capacity_kwh > 0),
    FOREIGN KEY (asset_id) REFERENCES Energy_Asset(asset_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- CLUSTER B: GRID TOPOLOGY
-- ============================================================

-- Substations and transformer nodes
CREATE TABLE Grid_Node (
    node_id         INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    node_name       VARCHAR(120)    NOT NULL,
    node_type       ENUM('SUBSTATION','TRANSFORMER','DISTRIBUTION') DEFAULT 'SUBSTATION',
    location        POINT           NOT NULL SRID 4326,
    service_radius_km DECIMAL(8,3)  DEFAULT 5.000,
    max_load_mw     DECIMAL(10,3)   NOT NULL,
    current_load_mw DECIMAL(10,3)   DEFAULT 0.000,
    node_status     ENUM('NORMAL','STRESSED','BLACKOUT','MAINTENANCE') DEFAULT 'NORMAL',
    SPATIAL INDEX idx_node_location (location),
    CONSTRAINT chk_current_load CHECK (current_load_mw >= 0)
) ENGINE=InnoDB;

ALTER TABLE Energy_Asset
    ADD CONSTRAINT fk_asset_node
    FOREIGN KEY (grid_node_id) REFERENCES Grid_Node(node_id);

-- ============================================================
-- CLUSTER C: TELEMETRY STREAM  (Weak Entity, Partitioned)
-- ============================================================

CREATE TABLE Telemetry_Raw (
    reading_id      BIGINT UNSIGNED AUTO_INCREMENT,
    asset_id        INT UNSIGNED    NOT NULL,
    ts              DATETIME(3)     NOT NULL,  -- millisecond precision
    voltage         DECIMAL(7,3)    NOT NULL,
    frequency_hz    DECIMAL(6,3)    NOT NULL   DEFAULT 50.000,
    temperature_c   DECIMAL(6,2),
    active_power_kw DECIMAL(10,3),
    reactive_power_kvar DECIMAL(10,3),
    soc_snapshot    DECIMAL(5,2)    COMMENT 'SOC at time of reading (Storage assets only)',
    CONSTRAINT chk_voltage   CHECK (voltage     BETWEEN 190 AND 250),
    CONSTRAINT chk_frequency CHECK (frequency_hz BETWEEN 45  AND 55),
    PRIMARY KEY (reading_id, ts),
    INDEX idx_tel_asset_ts (asset_id, ts),
    INDEX idx_tel_ts (ts)
) ENGINE=InnoDB
PARTITION BY RANGE (YEAR(ts) * 100 + MONTH(ts)) (
    PARTITION p2024_01 VALUES LESS THAN (202402),
    PARTITION p2024_02 VALUES LESS THAN (202403),
    PARTITION p2024_03 VALUES LESS THAN (202404),
    PARTITION p2024_04 VALUES LESS THAN (202405),
    PARTITION p2024_05 VALUES LESS THAN (202406),
    PARTITION p2024_06 VALUES LESS THAN (202407),
    PARTITION p2024_07 VALUES LESS THAN (202408),
    PARTITION p2024_08 VALUES LESS THAN (202409),
    PARTITION p2024_09 VALUES LESS THAN (202410),
    PARTITION p2024_10 VALUES LESS THAN (202411),
    PARTITION p2024_11 VALUES LESS THAN (202412),
    PARTITION p2024_12 VALUES LESS THAN (202501),
    PARTITION p2025_q1 VALUES LESS THAN (202504),
    PARTITION p2025_q2 VALUES LESS THAN (202507),
    PARTITION p2025_q3 VALUES LESS THAN (202510),
    PARTITION p_future  VALUES LESS THAN MAXVALUE
);

-- ============================================================
-- CLUSTER D: PROSUMERS & FINANCIAL LEDGER
-- ============================================================

CREATE TABLE Prosumer_Account (
    prosumer_id     INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(200)    NOT NULL,
    email           VARCHAR(254)    UNIQUE NOT NULL,
    grid_node_id    INT UNSIGNED    NOT NULL,
    wallet_balance  DECIMAL(12,4)   NOT NULL DEFAULT 0.0000,
    tariff_class    ENUM('RESIDENTIAL','COMMERCIAL','INDUSTRIAL') DEFAULT 'RESIDENTIAL',
    enrollment_date DATE            NOT NULL,
    is_active       BOOLEAN         DEFAULT TRUE,
    CONSTRAINT chk_wallet CHECK (wallet_balance >= -9999),  -- allow overdraft up to limit
    FOREIGN KEY (grid_node_id) REFERENCES Grid_Node(node_id),
    INDEX idx_prosumer_node (grid_node_id)
) ENGINE=InnoDB;

-- Bridge table: one prosumer can own many assets
CREATE TABLE Prosumer_Asset (
    prosumer_id     INT UNSIGNED    NOT NULL,
    asset_id        INT UNSIGNED    NOT NULL,
    ownership_pct   DECIMAL(5,2)    NOT NULL DEFAULT 100.00,
    since_date      DATE            NOT NULL,
    PRIMARY KEY (prosumer_id, asset_id),
    CONSTRAINT chk_ownership CHECK (ownership_pct BETWEEN 0.01 AND 100),
    FOREIGN KEY (prosumer_id) REFERENCES Prosumer_Account(prosumer_id),
    FOREIGN KEY (asset_id)    REFERENCES Energy_Asset(asset_id)
) ENGINE=InnoDB;

-- Dual-ledger transaction table
CREATE TABLE Energy_Transaction (
    txn_id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prosumer_id     INT UNSIGNED    NOT NULL,
    asset_id        INT UNSIGNED    NOT NULL,
    txn_type        ENUM('ENERGY_IN','ENERGY_OUT','ADJUSTMENT','FEE') NOT NULL,
    energy_kwh      DECIMAL(10,4)   NOT NULL,
    unit_price      DECIMAL(8,6)    NOT NULL COMMENT 'Price per kWh in currency',
    gross_amount    DECIMAL(12,4)   GENERATED ALWAYS AS (energy_kwh * unit_price) STORED,
    tariff_period   ENUM('PEAK','OFF_PEAK','SHOULDER')  NOT NULL,
    txn_ts          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    txn_status      ENUM('PENDING','COMMITTED','REVERSED') DEFAULT 'PENDING',
    reference_id    VARCHAR(64)     COMMENT 'External invoice or batch ref',
    CONSTRAINT chk_energy_kwh CHECK (energy_kwh > 0),
    FOREIGN KEY (prosumer_id) REFERENCES Prosumer_Account(prosumer_id),
    FOREIGN KEY (asset_id)    REFERENCES Energy_Asset(asset_id),
    INDEX idx_txn_prosumer_ts (prosumer_id, txn_ts),
    INDEX idx_txn_type (txn_type, txn_ts)
) ENGINE=InnoDB;

-- ============================================================
-- CLUSTER E: GRID EVENTS LOG
-- ============================================================

CREATE TABLE Grid_Event (
    event_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_type      ENUM('BLACKOUT','OVERLOAD','VOLTAGE_SAG','FREQ_DEVIATION',
                         'BATTERY_LOW','BATTERY_FULL','LOAD_BALANCE','MAINTENANCE') NOT NULL,
    node_id         INT UNSIGNED,
    asset_id        INT UNSIGNED,
    severity        ENUM('INFO','WARNING','CRITICAL') DEFAULT 'INFO',
    event_ts        TIMESTAMP(3)    DEFAULT CURRENT_TIMESTAMP(3),
    resolved_ts     TIMESTAMP       NULL,
    description     TEXT,
    triggered_by    ENUM('TRIGGER','EVENT_SCHEDULER','MANUAL','API') DEFAULT 'TRIGGER',
    FOREIGN KEY (node_id)   REFERENCES Grid_Node(node_id),
    FOREIGN KEY (asset_id)  REFERENCES Energy_Asset(asset_id),
    INDEX idx_event_type_ts (event_type, event_ts),
    INDEX idx_event_node (node_id, event_ts)
) ENGINE=InnoDB;

-- ============================================================
-- ROLE-BASED ACCESS CONTROL (RBAC)
-- ============================================================

-- Create roles
CREATE ROLE IF NOT EXISTS 'grid_operator';
CREATE ROLE IF NOT EXISTS 'prosumer_user';
CREATE ROLE IF NOT EXISTS 'data_analyst';
CREATE ROLE IF NOT EXISTS 'vpp_admin';

-- Grid Operator: can read everything, can update asset status & node load
GRANT SELECT ON vpp_orchestrate.* TO 'grid_operator';
GRANT UPDATE (asset_status, updated_at) ON vpp_orchestrate.Energy_Asset TO 'grid_operator';
GRANT UPDATE (current_soc, cycle_count) ON vpp_orchestrate.Storage_Asset TO 'grid_operator';
GRANT UPDATE (current_load_mw, node_status) ON vpp_orchestrate.Grid_Node TO 'grid_operator';
GRANT INSERT ON vpp_orchestrate.Grid_Event TO 'grid_operator';

-- Prosumer: can only see their own billing (row-level security via views)
GRANT SELECT ON vpp_orchestrate.Prosumer_Account TO 'prosumer_user';
GRANT SELECT ON vpp_orchestrate.Energy_Transaction TO 'prosumer_user';

-- Data Analyst: read-only across all tables and views
GRANT SELECT ON vpp_orchestrate.* TO 'data_analyst';

-- VPP Admin: full control
GRANT ALL PRIVILEGES ON vpp_orchestrate.* TO 'vpp_admin' WITH GRANT OPTION;
