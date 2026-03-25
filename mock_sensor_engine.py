#!/usr/bin/env python3
"""
VPP-Orchestrate | Mock IoT Sensor Engine
File: mock_sensor_engine.py

Simulates 1,000+ IoT sensors across solar, wind, and battery assets,
generating high-frequency telemetry INSERT statements against MySQL.

Features:
  - Realistic voltage/frequency drift with Gaussian noise
  - Blackout simulation via --blackout flag
  - Configurable concurrency (ThreadPoolExecutor)
  - Batch INSERT for high throughput

Dependencies:
    pip install mysql-connector-python faker tqdm

Usage:
    # Normal operation — 60 seconds of telemetry
    python mock_sensor_engine.py --host localhost --db vpp_orchestrate --duration 60

    # Simulate a blackout on node 3
    python mock_sensor_engine.py --duration 30 --blackout-node 3

    # High-frequency stress test (10 readings/sec per sensor)
    python mock_sensor_engine.py --duration 10 --rate 10 --workers 20
"""

import argparse
import json
import math
import random
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

try:
    import mysql.connector
    from mysql.connector import pooling
    HAS_MYSQL = True
except ImportError:
    HAS_MYSQL = False
    print("[WARN] mysql-connector-python not installed. Running in DRY-RUN mode.")

# ── Configuration ─────────────────────────────────────────────────────────────

@dataclass
class SensorConfig:
    asset_id: int
    asset_type: str          # SOLAR | WIND | BATTERY | INVERTER
    nominal_voltage: float = 230.0
    nominal_freq: float = 50.0
    max_power_kw: float = 10.0
    node_id: int = 1
    blackout_mode: bool = False

    def generate_reading(self) -> dict:
        """Produce one realistic telemetry reading."""
        now = datetime.now(timezone.utc)

        # Gaussian drift around nominal
        voltage = random.gauss(self.nominal_voltage, 3.5)
        freq    = random.gauss(self.nominal_freq, 0.15)

        # Simulate blackout: voltage sags to 195-205V
        if self.blackout_mode:
            voltage = random.gauss(198.0, 2.0)
            freq    = random.gauss(49.2, 0.3)

        # Clamp to sensor constraint range (190–250V, 45–55Hz)
        voltage = max(190.1, min(249.9, round(voltage, 3)))
        freq    = max(45.1,  min(54.9,  round(freq, 3)))

        # Power output depends on type and time of day
        hour = now.hour
        solar_factor = max(0, math.sin(math.pi * (hour - 6) / 12)) if 6 <= hour <= 18 else 0
        wind_factor  = random.uniform(0.2, 0.9)

        if self.asset_type == 'SOLAR':
            active_power = round(self.max_power_kw * solar_factor * random.uniform(0.85, 1.0), 3)
        elif self.asset_type == 'WIND':
            active_power = round(self.max_power_kw * wind_factor, 3)
        elif self.asset_type == 'BATTERY':
            # Battery discharging during peak (17-21h) or low-voltage events
            if hour in range(17, 22) or self.blackout_mode:
                active_power = round(self.max_power_kw * random.uniform(0.5, 0.9), 3)
            else:
                active_power = round(self.max_power_kw * random.uniform(0.0, 0.2), 3)
        else:
            active_power = round(self.max_power_kw * random.uniform(0.1, 0.7), 3)

        temperature = round(random.gauss(42.0, 5.0), 2)
        # Thermal spike simulation (1% chance)
        if random.random() < 0.01:
            temperature += random.uniform(6, 12)

        soc = round(random.uniform(15, 98), 2) if self.asset_type == 'BATTERY' else None

        return {
            "asset_id":         self.asset_id,
            "ts":               now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
            "voltage":          voltage,
            "frequency_hz":     freq,
            "temperature_c":    temperature,
            "active_power_kw":  active_power,
            "reactive_power_kvar": round(active_power * random.uniform(0.05, 0.15), 3),
            "soc_snapshot":     soc,
        }


# ── Seed asset list ───────────────────────────────────────────────────────────

def generate_asset_configs(n_sensors: int, blackout_nodes: list) -> List[SensorConfig]:
    configs = []
    types = ['SOLAR'] * 50 + ['WIND'] * 20 + ['BATTERY'] * 25 + ['INVERTER'] * 5
    for i in range(1, n_sensors + 1):
        atype = types[i % len(types)]
        node  = (i % 10) + 1
        configs.append(SensorConfig(
            asset_id       = i,
            asset_type     = atype,
            nominal_voltage= random.gauss(230, 2),
            max_power_kw   = random.uniform(5, 100) if atype != 'BATTERY' else random.uniform(50, 500),
            node_id        = node,
            blackout_mode  = node in blackout_nodes,
        ))
    return configs


# ── Database writer ───────────────────────────────────────────────────────────

INSERT_SQL = """
    INSERT INTO Telemetry_Raw
        (asset_id, ts, voltage, frequency_hz, temperature_c,
         active_power_kw, reactive_power_kvar, soc_snapshot)
    VALUES
        (%(asset_id)s, %(ts)s, %(voltage)s, %(frequency_hz)s,
         %(temperature_c)s, %(active_power_kw)s, %(reactive_power_kvar)s,
         %(soc_snapshot)s)
"""

def batch_insert(cnx_pool, readings: list, dry_run: bool = False) -> int:
    """Insert a batch of readings. Returns number inserted."""
    if dry_run:
        return len(readings)
    try:
        cnx = cnx_pool.get_connection()
        cur = cnx.cursor()
        cur.executemany(INSERT_SQL, readings)
        cnx.commit()
        count = cur.rowcount
        cur.close()
        cnx.close()
        return count
    except Exception as exc:
        print(f"[DB ERROR] {exc}")
        return 0


# ── Main simulation loop ──────────────────────────────────────────────────────

def run_simulation(args):
    configs    = generate_asset_configs(args.sensors, args.blackout_node)
    dry_run    = not HAS_MYSQL or args.dry_run

    cnx_pool   = None
    if not dry_run:
        cnx_pool = pooling.MySQLConnectionPool(
            pool_name="vpp_pool",
            pool_size=args.workers,
            host=args.host,
            port=args.port,
            user=args.user,
            password=args.password,
            database=args.db,
        )

    total_inserted = 0
    start_time     = time.time()
    end_time       = start_time + args.duration
    batch_size     = 100   # rows per INSERT batch

    print(f"[VPP Sensor Engine] Starting: {len(configs)} sensors, "
          f"rate={args.rate} Hz, duration={args.duration}s, dry_run={dry_run}")
    if args.blackout_node:
        print(f"[VPP Sensor Engine] ⚡ BLACKOUT simulated on nodes: {args.blackout_node}")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        while time.time() < end_time:
            tick_start = time.time()
            batch      = []

            # Gather one reading per sensor this tick
            futures = [pool.submit(cfg.generate_reading) for cfg in configs]
            for f in as_completed(futures):
                batch.append(f.result())

            # Write in chunks
            futures_write = []
            for i in range(0, len(batch), batch_size):
                chunk = batch[i:i+batch_size]
                futures_write.append(
                    pool.submit(batch_insert, cnx_pool, chunk, dry_run)
                )
            for fw in as_completed(futures_write):
                total_inserted += fw.result()

            elapsed   = time.time() - start_time
            remaining = end_time - time.time()
            print(f"\r  Elapsed: {elapsed:5.1f}s | Inserted: {total_inserted:,} rows | "
                  f"Remaining: {remaining:4.1f}s", end="", flush=True)

            # Throttle to target rate (readings per second)
            tick_duration = time.time() - tick_start
            sleep_time    = (1.0 / args.rate) - tick_duration
            if sleep_time > 0:
                time.sleep(sleep_time)

    print(f"\n[VPP Sensor Engine] Done. Total rows: {total_inserted:,} "
          f"in {time.time()-start_time:.1f}s")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VPP-Orchestrate Mock Sensor Engine")
    parser.add_argument("--host",          default="127.0.0.1")
    parser.add_argument("--port",          default=3306,    type=int)
    parser.add_argument("--user",          default="vpp_admin")
    parser.add_argument("--password",      default="")
    parser.add_argument("--db",            default="vpp_orchestrate")
    parser.add_argument("--sensors",       default=1000,    type=int,  help="Number of virtual sensors")
    parser.add_argument("--duration",      default=60,      type=int,  help="Simulation duration in seconds")
    parser.add_argument("--rate",          default=1,       type=float,help="Readings per second per sensor")
    parser.add_argument("--workers",       default=10,      type=int,  help="Thread pool size")
    parser.add_argument("--blackout-node", default=[],      type=int,  nargs="+",
                        dest="blackout_node", metavar="NODE_ID",
                        help="Simulate blackout on these node IDs")
    parser.add_argument("--dry-run",       action="store_true",       help="Generate readings without DB writes")
    args = parser.parse_args()

    run_simulation(args)
