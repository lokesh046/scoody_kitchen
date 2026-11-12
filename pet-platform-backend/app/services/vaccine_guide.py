"""The vaccine guide shown beside a pet's records: the full schedule, a timeline, the rules, and a
due-date planner worked out from the pet's birth date.

The text lives in app/data/vaccine_guide/<species>.json (written from the vet-reference spreadsheets).
build_planner() is pure (no database) so it can be tested on its own.
"""
import json
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from app.services.vaccination_service import DUE_SOON_DAYS, add_months

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "vaccine_guide"


# Buffalo follow the cattle schedule (the spreadsheet covers both).
SPECIES_ALIAS = {"buffalo": "cattle"}


@lru_cache(maxsize=8)
def load_guide(species: str) -> dict | None:
    """The guide content for a species, or None when we have none (only letters are allowed in the name)."""
    if not species.isalpha():
        return None
    path = DATA_DIR / f"{SPECIES_ALIAS.get(species, species)}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _due_date(dob: date, unit: str, value: int) -> date:
    return dob + timedelta(weeks=value) if unit == "weeks" else add_months(dob, value)


def _match_doses(rows: list[dict], records_by_code: dict[str, list[date]]) -> dict[tuple[int, str], date]:
    """Pairs every recorded dose with the planner row (for its vaccine) whose due date is nearest.
    One dose fills one row. Optional rows are never filled, except those marked "fillable" (a vaccine only some
    animals need, such as anthrax, which has its own row and is shown Done once the owner records it)."""
    matched: dict[tuple[int, str], date] = {}
    for code, dates in records_by_code.items():
        free = [i for i, r in enumerate(rows) if code in r["codes"] and (not r["optional"] or r.get("fillable"))]
        for given in sorted(dates):
            if not free:
                break
            best = min(free, key=lambda i: abs((rows[i]["due_date"] - given).days))
            matched[(best, code)] = given
            free.remove(best)
    return matched


def build_planner(guide: dict, dob: date | None, records_by_code: dict[str, list[date]], today: date) -> list[dict]:
    """One line per planned dose with a due date and a status:
    done | overdue | due_soon | upcoming | not_recorded (an earlier dose the owner has not entered, but a
    later one is on record) | optional. Empty when the birth date is unknown."""
    if dob is None:
        return []
    rows = [dict(p, due_date=_due_date(dob, p["offset_unit"], p["offset_value"])) for p in guide["planner"]]
    matched = _match_doses(rows, records_by_code)
    out = []
    for i, row in enumerate(rows):
        codes = row["codes"]
        given_dates = [matched[(i, c)] for c in codes if (i, c) in matched]
        done = bool(codes) and (not row["optional"] or row.get("fillable", False)) and len(given_dates) == len(codes)
        if done:
            status = "done"
        elif row["optional"]:
            status = "optional"
        else:
            unmatched = [c for c in codes if (i, c) not in matched]
            later_given = any((j, c) in matched for j in range(i + 1, len(rows)) for c in unmatched)
            due = row["due_date"]
            if due < today and later_given:
                status = "not_recorded"
            elif due < today:
                status = "overdue"
            elif (due - today).days <= DUE_SOON_DAYS:
                status = "due_soon"
            else:
                status = "upcoming"
        out.append({
            "dose": row["dose"],
            "vaccine": row["vaccine"],
            "vaccine_codes": list(codes),
            "planned_age": row["planned_age"],
            "due_date": row["due_date"],
            "date_given": max(given_dates) if done else None,
            "status": status,
            "note": row["note"],
        })
    return out


_PENDING_ORDER = ("overdue", "due_soon", "upcoming")


def build_schedule(guide: dict, planner: list[dict]) -> list[dict]:
    """The schedule table with a colour status, last dose and next due for each line, taken from the
    planner rows it covers. A line covering several yearly doses shows the next one still to give."""
    out = []
    for n, row in enumerate(guide["schedule"], start=1):
        item = {"sno": n, "age": row["age"], "vaccine": row["vaccine"], "protects": row.get("protects"),
                "notes": row.get("notes"), "status": None, "last_dose": None, "next_due": None}
        item["vaccine_codes"] = list(dict.fromkeys(
            row.get("codes", []) + [
                code for ref in row.get("planner_refs", [])
                for code in guide["planner"][ref]["codes"]
            ]
        ))
        if planner:
            refs = [planner[i] for i in row.get("planner_refs", []) if i < len(planner)]
            real = [r for r in refs if r["status"] != "optional"]
            given = [r["date_given"] for r in real if r["date_given"]]
            pending = [r for r in real if r["status"] in _PENDING_ORDER]
            if not refs:
                item["status"] = "optional" if "optional" in row["age"].lower() else "info"
            elif not real:
                item["status"] = "optional"
            else:
                item["last_dose"] = max(given) if given else None
                if pending:
                    nxt = min(pending, key=lambda r: r["due_date"])
                    item["status"], item["next_due"] = nxt["status"], nxt["due_date"]
                else:
                    item["status"] = "done" if given else "not_recorded"
        out.append(item)
    return out


def build_guide(species: str, dob: date | None, records_by_code: dict[str, list[date]], today: date | None = None) -> dict:
    today = today or date.today()
    guide = load_guide((species or "").strip().lower())
    if guide is None:
        return {"supported": False, "species": (species or "").strip().lower()}
    planner = build_planner(guide, dob, records_by_code, today)
    return {
        "supported": True,
        "species": guide["species"],
        "title": guide["title"],
        "rules_title": guide.get("rules_title", "Rules"),
        "subtitle": guide["subtitle"],
        "date_of_birth_known": dob is not None,
        "planner": planner,
        "planner_note": guide["planner_note"],
        "schedule": build_schedule(guide, planner),
        "timeline": guide["timeline"],
        "rules": guide["rules"],
        "about": guide["about"],
        "sources": guide["sources"],
        "disclaimer": guide["disclaimer"],
    }
