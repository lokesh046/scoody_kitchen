#!/usr/bin/env python3
"""Writes backup-health metrics for Prometheus (node_exporter textfile collector). Run every minute."""
import json, os, subprocess, sys, time

HDB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(HDB, ".env")):
    if "=" in line and not line.startswith("#"):
        k, _, v = line.strip().partition("="); env[k] = v
pg = env.get("PG_CONTAINER", "hearth_pg")
out = os.path.join(env.get("DATA_DIR", "/var/lib/hearth-db"), "textfile", "pgbackrest.prom")
os.makedirs(os.path.dirname(out), exist_ok=True)

res = subprocess.run(["docker", "exec", "-u", "postgres", pg, "pgbackrest", "--stanza=hearth", "info", "--output=json"],
                     capture_output=True, text=True, timeout=45)
if res.returncode != 0 or not res.stdout.strip():
    sys.exit(0)            # database container is down: pg_up alerts; keep the previous file
info = json.loads(res.stdout)
st = info[0] if info else {}
lines = []
code = st.get("status", {}).get("code", 99)
lines.append(f"hearth_pgbackrest_status_ok {1 if code == 0 else 0}")
for r in st.get("repo", []):
    lines.append(f'hearth_pgbackrest_repo_status_ok{{repo="{r.get("key", 0)}"}} {1 if r.get("status", {}).get("code") == 0 else 0}')
last = {}
for b in st.get("backup", []):
    t = b.get("type", "unknown")
    last[t] = max(last.get(t, 0), b["timestamp"]["stop"])
for t in ("full", "diff", "incr"):
    if t in last:
        lines.append(f'hearth_pgbackrest_last_backup_timestamp_seconds{{type="{t}"}} {last[t]}')
lines.append(f"hearth_pgbackrest_backup_count {len(st.get('backup', []))}")
repo_size = sum(b.get("info", {}).get("repository", {}).get("size", 0) for b in st.get("backup", []))
lines.append(f"hearth_pgbackrest_repo_size_bytes {repo_size}")
repos = {b.get("database", {}).get("repo-key", 1) for b in st.get("backup", [])}
offsite = 1 if any(r != 1 for r in repos) or os.path.exists(os.path.join(HDB, "offsite.env")) else 0
lines.append(f"hearth_pgbackrest_offsite_configured {offsite}")
lines.append(f"hearth_pgbackrest_metrics_timestamp_seconds {int(time.time())}")
tmp = out + ".tmp"
open(tmp, "w").write("\n".join(lines) + "\n")
os.replace(tmp, out)
