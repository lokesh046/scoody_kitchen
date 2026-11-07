"""A printable vaccination card (self-contained HTML). The web opens it for printing / Save as PDF and the
mobile app turns it into a PDF to share. Every value is HTML-escaped; there is no script in the page."""
from datetime import date
from html import escape

STATUS_TEXT = {
    "overdue": "Overdue",
    "due_soon": "Due soon",
    "upcoming": "On track",
    "optional": "Optional",
    "not_started": "No record",
}


def _d(value: date | None) -> str:
    return value.strftime("%d %b %Y") if value else "—"


def _safe_url(url: str | None) -> str | None:
    return url if url and url.startswith(("http://", "https://")) else None


def build_card_html(pet, overview: dict, today: date | None = None) -> str:
    today = today or date.today()
    names = {i["code"]: i["name"] for i in overview["items"]}
    draft = any(not i["vet_reviewed"] for i in overview["items"])

    status_rows = "".join(
        f"<tr><td>{escape(i['name'])}</td><td class='st {escape(i['status'])}'>{escape(STATUS_TEXT.get(i['status'], i['status']))}</td>"
        f"<td>{_d(i['last_given_date'])}</td><td>{_d(i['next_due_date'])}</td></tr>"
        for i in overview["items"]
    )

    def dose_row(r) -> str:
        url = _safe_url(r.image_url)
        photo = f"<img src='{escape(url, quote=True)}' alt='Vaccine card' />" if url else ""
        return (
            f"<tr><td>{_d(r.date_given)}</td><td>{escape(names.get(r.vaccine_code, r.vaccine_code))}</td>"
            f"<td>{escape(r.clinic_name or '—')}</td><td>{escape(r.batch_number or '—')}</td><td class='ph'>{photo}</td></tr>"
        )

    dose_rows = "".join(dose_row(r) for r in overview["records"]) or "<tr><td colspan='5'>No doses recorded yet.</td></tr>"
    chip = escape(pet.microchip_number) if getattr(pet, "microchip_number", None) else "—"
    note = (
        "<p class='note'>Vaccine schedules follow general veterinary guidance (WSAVA) and are pending review by our vets. "
        "Confirm timings with your own vet.</p>" if draft else ""
    )

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vaccination card - {escape(pet.name)}</title>
<style>
@page {{ size: A4; margin: 14mm; }}
body {{ font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1c1917; margin: 0; padding: 16px; font-size: 13px; }}
h1 {{ font-size: 22px; margin: 0; }} h2 {{ font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .06em; }}
.brand {{ color: #8a6d1d; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }}
.head {{ border-bottom: 2px solid #8a6d1d; padding-bottom: 8px; margin-bottom: 10px; }}
.meta {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 18px; margin-top: 8px; }}
.meta b {{ display: inline-block; min-width: 92px; color: #57534e; font-weight: 600; }}
table {{ width: 100%; border-collapse: collapse; }} th, td {{ border: 1px solid #d6d3d1; padding: 6px 8px; text-align: left; vertical-align: middle; }}
th {{ background: #f5f5f4; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }}
.st {{ font-weight: 700; }} .st.overdue {{ color: #b91c1c; }} .st.due_soon {{ color: #b45309; }} .st.upcoming {{ color: #047857; }}
td.ph img {{ width: 54px; height: 54px; object-fit: cover; border: 1px solid #d6d3d1; }}
.note, .foot {{ color: #57534e; font-size: 11px; line-height: 1.5; }} .foot {{ margin-top: 18px; border-top: 1px solid #d6d3d1; padding-top: 8px; }}
</style></head><body>
<div class="head"><div class="brand">Hearth &amp; One</div><h1>Vaccination card</h1>
<div class="meta">
<div><b>Pet</b>{escape(pet.name)}</div><div><b>Species</b>{escape(pet.species or '—')}</div>
<div><b>Breed</b>{escape(pet.breed or '—')}</div><div><b>Date of birth</b>{_d(pet.date_of_birth)}</div>
<div><b>Gender</b>{escape(pet.gender or '—')}</div><div><b>Microchip</b>{chip}</div>
</div></div>
<h2>Vaccine status</h2>
<table><tr><th>Vaccine</th><th>Status</th><th>Last dose</th><th>Next due</th></tr>{status_rows}</table>
<h2>Recorded doses</h2>
<table><tr><th>Date</th><th>Vaccine</th><th>Clinic / vet</th><th>Batch</th><th>Card photo</th></tr>{dose_rows}</table>
{note}
<p class="foot">Generated on {_d(today)} from records entered by the pet owner. This is not a veterinary certificate; ask your vet for an official one when required.</p>
</body></html>"""
