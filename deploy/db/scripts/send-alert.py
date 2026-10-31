#!/usr/bin/env python3
"""Sends an email through the same SMTP account the app and fail2ban use.
Usage: send-alert.py "<subject>" < body.txt        Reads /opt/hearth-db/smtp.env (written by deploy.sh)."""
import smtplib, sys
from email.mime.text import MIMEText
from pathlib import Path

def load(path):
    out = {}
    for line in Path(path).read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out

def main():
    subject = sys.argv[1] if len(sys.argv) > 1 else "Hearth & One database alert"
    body = sys.stdin.read()
    env = load(Path(__file__).resolve().parent.parent / "smtp.env")
    host, user, password = env.get("SMTP_HOST"), env.get("SMTP_USER"), env.get("SMTP_PASSWORD")
    sender = env.get("EMAILS_FROM") or user
    to = [a.strip() for a in env.get("ALERT_TO", "").split(",") if a.strip()]
    if not (host and user and password and to):
        print("SMTP or ALERT_TO not configured; alert not sent", file=sys.stderr)
        return 1
    msg = MIMEText(body)
    msg["Subject"], msg["From"], msg["To"] = subject, sender, ", ".join(to)
    try:
        with smtplib.SMTP(host, int(env.get("SMTP_PORT", "587")), timeout=20) as s:
            s.starttls()
            s.login(user, password)
            s.sendmail(sender, to, msg.as_string())
    except Exception as exc:
        print(f"could not send alert email: {exc}", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
