#!/usr/bin/env python3
"""Daily plain-English database health email. Doubles as a heartbeat: if the email stops
arriving, the monitoring stack itself is down. Run from cron through job.sh."""
import json, subprocess, sys, time, urllib.parse, urllib.request

import os
HDB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(HDB, ".env")):
    if "=" in line and not line.startswith("#"):
        k, _, v = line.strip().partition("="); env[k] = v
PROM = f"http://127.0.0.1:{env.get('PROMETHEUS_PORT', '9090')}"
LABEL = env.get("ENV_LABEL", env.get("ENV_NAME", ""))

def q(expr):
    try:
        url = f"{PROM}/api/v1/query?" + urllib.parse.urlencode({"query": expr})
        r = json.load(urllib.request.urlopen(url, timeout=10))["data"]["result"]
        return [(x["metric"], float(x["value"][1])) for x in r]
    except Exception:
        return None

def one(expr):
    r = q(expr)
    return r[0][1] if r else None

def age(seconds):
    if seconds is None: return "unknown"
    s = int(seconds)
    if s < 3600: return f"{s // 60} min ago"
    if s < 86400: return f"{s // 3600} h {(s % 3600) // 60} min ago"
    return f"{s // 86400} days {(s % 86400) // 3600} h ago"

def size(b):
    if b is None: return "unknown"
    for u in ("B", "KB", "MB", "GB", "TB"):
        if b < 1024: return f"{b:.0f} {u}" if u == "B" else f"{b:.1f} {u}"
        b /= 1024

problems = []
up = one("pg_up")
if up != 1: problems.append("The database is NOT reachable by monitoring.")
uptime = one("time() - pg_postmaster_start_time_seconds")
dbsize = one('sum(pg_database_size_bytes{datname="hearth"})')
conns = one("100 * sum(pg_stat_activity_count) / max(pg_settings_max_connections)")
disk = one('100 * node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}')
wal_fail = one("increase(pg_stat_archiver_failed_count[24h])")
repo = one("hearth_pgbackrest_repo_size_bytes")
offsite = one("hearth_pgbackrest_offsite_configured")
backups = {m.get("type"): v for m, v in (q("time() - hearth_pgbackrest_last_backup_timestamp_seconds") or [])}
drill = one("time() - hearth_restore_drill_last_success_timestamp_seconds")
drill_dur = one("hearth_restore_drill_duration_seconds")
pitr = one("time() - hearth_pitr_drill_last_success_timestamp_seconds")

newest = min(backups.values()) if backups else None
if newest is None or newest > 93600: problems.append("No backup in the last 26 hours.")
if wal_fail and wal_fail > 0: problems.append(f"Continuous backup (WAL archiving) failed {int(wal_fail)} time(s) in 24 hours.")
if drill is None or drill > 777600: problems.append("No successful restore test in over 9 days.")
if disk is not None and disk < 15: problems.append(f"Disk is nearly full ({disk:.0f}% free).")
if offsite == 0: problems.append("Backups exist only on this server (no off-server copy configured).")

firing = []
try:
    alerts = json.load(urllib.request.urlopen(f"{PROM}/api/v1/alerts", timeout=10))["data"]["alerts"]
    firing = [a["labels"]["alertname"] for a in alerts if a["state"] == "firing"]
except Exception:
    problems.append("Could not read the alert list from Prometheus.")
if firing: problems.append("Alerts firing right now: " + ", ".join(sorted(set(firing))))

verdict = "ALL GOOD" if not problems else f"{len(problems)} THING(S) NEED ATTENTION"
lines = [f"Hearth & One database health ({LABEL}), {time.strftime('%A %d %B %Y, %H:%M')}", "", f"Overall: {verdict}", ""]
lines += [f"  * {p}" for p in problems] + ([""] if problems else [])
lines += [
    "Database",
    f"  running for:        {age(uptime).replace(' ago', '')}",
    f"  size:               {size(dbsize)}",
    f"  connections used:   {conns:.0f}%" if conns is not None else "  connections used:   unknown",
    "",
    "Backups",
]
for t in ("full", "diff", "incr"):
    if t in backups: lines.append(f"  newest {t:<5} backup: {age(backups[t])}")
lines += [
    f"  backup storage on this server: {size(repo)}",
    f"  off-server copy:    {'yes' if offsite == 1 else 'NOT SET UP'}",
    f"  WAL archive failures (24h): {int(wal_fail) if wal_fail is not None else 'unknown'}",
    "",
    "Recovery proof",
    f"  last successful restore test:        {age(drill)}" + (f" (took {int(drill_dur)} s to rebuild)" if drill_dur else ""),
    f"  last 'restore to a minute' test:     {age(pitr)}",
    "",
    "Server",
    f"  disk free: {disk:.0f}%" if disk is not None else "  disk free: unknown",
    "",
    "If this email stops arriving, the monitoring itself is down: see docs/DB_RECOVERY.md.",
]
body = "\n".join(lines)
subject = f"[Hearth & One {LABEL}] Daily database report: {verdict}"
print(body)
subprocess.run(["python3", os.path.join(HDB, "scripts", "send-alert.py"), subject], input=body, text=True, check=False)
