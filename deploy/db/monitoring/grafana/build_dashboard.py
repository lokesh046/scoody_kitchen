#!/usr/bin/env python3
"""Generates dashboards/hearth-database.json. Run: python3 build_dashboard.py"""
import json, pathlib

DS = {"type": "prometheus", "uid": "prometheus"}
panels, pid = [], 0

def nid():
    global pid; pid += 1; return pid

def stat(title, expr, x, y, w=3, unit="none", thresholds=None, desc="", decimals=None, mappings=None):
    steps = thresholds or [{"color": "green", "value": None}]
    p = {"id": nid(), "type": "stat", "title": title, "description": desc, "datasource": DS,
         "gridPos": {"x": x, "y": y, "w": w, "h": 4},
         "targets": [{"expr": expr, "refId": "A", "datasource": DS, "instant": True}],
         "fieldConfig": {"defaults": {"unit": unit, "thresholds": {"mode": "absolute", "steps": steps},
                                      "mappings": mappings or [], "color": {"mode": "thresholds"}}, "overrides": []},
         "options": {"colorMode": "background", "graphMode": "none", "textMode": "value", "reduceOptions": {"calcs": ["lastNotNull"]}}}
    if decimals is not None: p["fieldConfig"]["defaults"]["decimals"] = decimals
    panels.append(p)

def ts(title, targets, x, y, w=12, h=7, unit="none", desc="", stack=False, minv=None, maxv=None):
    d = {"unit": unit, "custom": {"lineWidth": 1, "fillOpacity": 12, "showPoints": "never"}}
    if stack: d["custom"]["stacking"] = {"mode": "normal"}
    if minv is not None: d["min"] = minv
    if maxv is not None: d["max"] = maxv
    panels.append({"id": nid(), "type": "timeseries", "title": title, "description": desc, "datasource": DS,
                   "gridPos": {"x": x, "y": y, "w": w, "h": h},
                   "targets": [{"expr": e, "legendFormat": l, "refId": chr(65 + i), "datasource": DS} for i, (e, l) in enumerate(targets)],
                   "fieldConfig": {"defaults": d, "overrides": []},
                   "options": {"legend": {"displayMode": "list", "placement": "bottom"}, "tooltip": {"mode": "multi"}}})

def row(title, y):
    panels.append({"id": nid(), "type": "row", "title": title, "collapsed": False, "gridPos": {"x": 0, "y": y, "w": 24, "h": 1}, "panels": []})

G, Y, R = {"color": "green", "value": None}, {"color": "yellow", "value": None}, {"color": "red", "value": None}
def th(*pairs):  # (value, color) ascending
    out = [{"color": pairs[0][1], "value": None}]
    out += [{"color": c, "value": v} for v, c in pairs[1:]]
    return out

row("Is everything fine right now?", 0)
stat("Database", "pg_up", 0, 1, 3, mappings=[{"type": "value", "options": {"1": {"text": "UP", "color": "green"}, "0": {"text": "DOWN", "color": "red"}}}],
     thresholds=th((0, "red"), (1, "green")), desc="Can the monitoring reach Postgres?")
stat("Uptime", "time() - pg_postmaster_start_time_seconds", 3, 1, 3, unit="s", desc="Time since Postgres last started.")
stat("Connections used", "100 * sum(pg_stat_activity_count) / max(pg_settings_max_connections)", 6, 1, 3, unit="percent",
     thresholds=th((0, "green"), (60, "yellow"), (80, "red")), decimals=0)
stat("Database size", 'sum(pg_database_size_bytes{datname="hearth"})', 9, 1, 3, unit="bytes")
stat("Last backup", "time() - max(hearth_pgbackrest_last_backup_timestamp_seconds)", 12, 1, 3, unit="s",
     thresholds=th((0, "green"), (93600, "red")), desc="Age of the newest backup. Red after 26 hours.")
stat("Restore test", "time() - hearth_restore_drill_last_success_timestamp_seconds", 15, 1, 3, unit="s",
     thresholds=th((0, "green"), (777600, "red")), desc="Time since a backup was last restored and verified. Red after 9 days.")
stat("WAL archive failures (24h)", "increase(pg_stat_archiver_failed_count[24h])", 18, 1, 3, thresholds=th((0, "green"), (1, "red")), decimals=0,
     desc="Failures handing change logs to the backup system. Must be 0 for restore-to-any-minute.")
stat("Disk free", '100 * node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}', 21, 1, 3, unit="percent",
     thresholds=th((0, "red"), (15, "yellow"), (30, "green")), decimals=0)

row("Database activity", 5)
ts("Connections", [("sum by (state) (pg_stat_activity_count)", "{{state}}"), ("max(pg_settings_max_connections)", "limit")], 0, 6, 12, stack=False)
ts("Transactions per second", [('sum(rate(pg_stat_database_xact_commit[2m]))', "commits"), ('sum(rate(pg_stat_database_xact_rollback[2m]))', "rollbacks")], 12, 6, 12)
ts("Cache hit ratio", [('sum(rate(pg_stat_database_blks_hit[5m])) / (sum(rate(pg_stat_database_blks_hit[5m])) + sum(rate(pg_stat_database_blks_read[5m])) + 1)', "reads served from memory")],
   0, 13, 12, unit="percentunit", minv=0, maxv=1, desc="Close to 1 is good: nearly all reads come from memory.")
ts("Rows per second", [('sum(rate(pg_stat_database_tup_fetched[2m]))', "read"), ('sum(rate(pg_stat_database_tup_inserted[2m]))', "inserted"),
                       ('sum(rate(pg_stat_database_tup_updated[2m]))', "updated"), ('sum(rate(pg_stat_database_tup_deleted[2m]))', "deleted")], 12, 13, 12)
ts("Time spent in SQL statements (per second)", [("sum(rate(pg_stat_statements_seconds_total[5m]))", "all statements")], 0, 20, 12, unit="s",
   desc="Rises when queries get slower or more frequent.")
ts("Longest open transaction", [('max(pg_stat_activity_max_tx_duration{state!~"idle"})', "seconds")], 12, 20, 12, unit="s")

row("Backups and recovery", 27)
ts("Age of newest backup, by type", [("time() - hearth_pgbackrest_last_backup_timestamp_seconds", "{{type}}")], 0, 28, 12, unit="s",
   desc="Full runs Sunday, differential on the other days.")
ts("Backup repository size", [("hearth_pgbackrest_repo_size_bytes", "on this server")], 12, 28, 12, unit="bytes")
ts("WAL segments archived (per 5 min)", [("increase(pg_stat_archiver_archived_count[5m])", "archived"), ("increase(pg_stat_archiver_failed_count[5m])", "failed")], 0, 35, 12,
   desc="The continuous backup stream. Failed must stay at 0.")
ts("Restore test duration", [("hearth_restore_drill_duration_seconds", "last drill")], 12, 35, 12, unit="s",
   desc="How long it takes to rebuild the database from backup: your recovery time.")

row("Server", 42)
ts("CPU used", [('100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[2m])))', "cpu")], 0, 43, 8, unit="percent", minv=0, maxv=100)
ts("Memory available", [("node_memory_MemAvailable_bytes", "available"), ("node_memory_MemTotal_bytes", "total")], 8, 43, 8, unit="bytes")
ts("Disk used", [('node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_avail_bytes{mountpoint="/"}', "used"), ('node_filesystem_size_bytes{mountpoint="/"}', "size")], 16, 43, 8, unit="bytes")

dash = {"uid": "hearth-database", "title": "Hearth & One database", "tags": ["hearth", "postgres"], "timezone": "browser",
        "schemaVersion": 39, "version": 1, "refresh": "30s", "time": {"from": "now-6h", "to": "now"},
        "panels": panels, "templating": {"list": []}, "annotations": {"list": []}}
out = pathlib.Path(__file__).parent / "dashboards" / "hearth-database.json"
out.write_text(json.dumps(dash, indent=1) + "\n")
print("wrote", out, "-", len([p for p in panels if p["type"] != "row"]), "panels")
