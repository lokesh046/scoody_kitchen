#!/usr/bin/env python3
"""
Standalone Jitsi self-hosted JWT diagnostic.

Mints a token using EXACTLY the same logic as
pet-platform-backend/app/core/jitsi.py::generate_jaas_token()
(self-hosted HS256 branch), then decodes + re-verifies it locally,
and prints every claim so you can diff it against what your Prosody
/ jitsi-meet server is configured to expect.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import jwt
except ImportError:
    print("Missing dependency. Install with: pip install pyjwt --break-system-packages")
    sys.exit(1)


def load_env_file(path: Path) -> dict:
    """Minimal .env parser (KEY=VALUE per line, '#' comments, optional quotes)."""
    values = {}
    if not path.exists():
        return values
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        values[key] = val
    return values


def mint_token(domain: str, app_id: str, app_secret: str, room_name: str,
                user_id: str, user_name: str, user_email: str, is_moderator: bool,
                early_minutes: int, duration_minutes: int, grace_minutes: int) -> tuple[str, dict]:
    now = datetime.now(timezone.utc)
    earliest_join_dt = now - timedelta(minutes=early_minutes)
    latest_join_dt = now + timedelta(minutes=duration_minutes) + timedelta(minutes=grace_minutes)

    payload = {
        "aud": "jitsi",
        "iss": app_id,
        "sub": domain,
        "room": room_name,
        "iat": int(now.timestamp()),
        "nbf": int(earliest_join_dt.timestamp()),
        "exp": int(latest_join_dt.timestamp()),
        "context": {
            "features": {
                "livestreaming": is_moderator,
                "recording": is_moderator,
                "transcription": is_moderator,
                "outbound-call": False,
            },
            "user": {
                "id": user_id,
                "name": user_name,
                "email": user_email,
                "avatar": "",
                "moderator": is_moderator,
            },
        },
    }
    token = jwt.encode(payload, app_secret, algorithm="HS256")
    return token, payload


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--env-file", default=".env", help="Path to .env file (default: ./.env)")
    parser.add_argument("--room", default="scooby-consultation-TEST", help="Room name to bind the token to")
    parser.add_argument("--user-id", default="999", help="Fake user id for the context.user claim")
    parser.add_argument("--user-name", default="Diagnostic User", help="Fake display name")
    parser.add_argument("--user-email", default="diagnostic@example.com", help="Fake email")
    parser.add_argument("--moderator", action="store_true", help="Mint as moderator (doctor/admin) instead of participant")
    parser.add_argument("--early-minutes", type=int, default=15, help="nbf offset before now (matches JOIN_WINDOW in jitsi.py)")
    parser.add_argument("--duration-minutes", type=int, default=30, help="Consultation duration used for exp calc")
    parser.add_argument("--grace-minutes", type=int, default=15, help="Grace period added after duration for exp calc")
    args = parser.parse_args()

    env_path = Path(args.env_file)
    file_env = load_env_file(env_path)
    merged_env = {**os.environ, **file_env}

    domain = merged_env.get("JITSI_DOMAIN", "meet.jit.si")
    app_id = merged_env.get("JITSI_APP_ID", "scooby_kitchen")
    app_secret = merged_env.get("JITSI_APP_SECRET")

    print("=" * 70)
    print("Loaded configuration")
    print("=" * 70)
    print(f"  env file checked : {env_path.resolve()} ({'found' if env_path.exists() else 'NOT FOUND — using process env / defaults'})")
    print(f"  JITSI_DOMAIN      = {domain!r}")
    print(f"  JITSI_APP_ID      = {app_id!r}")
    print(f"  JITSI_APP_SECRET  = {'<set, ' + str(len(app_secret)) + ' chars>' if app_secret else None!r}")
    print()

    if not app_secret:
        print("!! JITSI_APP_SECRET is not set. generate_jaas_token() would fall through")
        print("   to the JaaS (8x8) branch, or return (None, None) if that's unset too —")
        print("   which is exactly the 'Unable to issue meeting credentials' 500 case.")
        sys.exit(1)

    token, payload = mint_token(
        domain=domain,
        app_id=app_id,
        app_secret=app_secret,
        room_name=args.room,
        user_id=args.user_id,
        user_name=args.user_name,
        user_email=args.user_email,
        is_moderator=args.moderator,
        early_minutes=args.early_minutes,
        duration_minutes=args.duration_minutes,
        grace_minutes=args.grace_minutes,
    )

    print("=" * 70)
    print("Minted token (paste into jwt.io if you want to eyeball it)")
    print("=" * 70)
    print(token)
    print()

    print("=" * 70)
    print("Decoded payload (as your backend would have sent it to Jitsi)")
    print("=" * 70)
    print(json.dumps(payload, indent=2))
    print()

    # Round-trip verify: decode WITH signature verification using the same secret.
    print("=" * 70)
    print("Local signature self-check")
    print("=" * 70)
    try:
        decoded = jwt.decode(
            token,
            app_secret,
            algorithms=["HS256"],
            audience="jitsi",
            issuer=app_id,
        )
        print("OK: token verifies against JITSI_APP_SECRET with HS256.")
        print("    This proves the *signing code* and *this secret* are internally")
        print("    consistent.")
    except jwt.InvalidSignatureError:
        print("FAIL: signature did not verify.")
    except jwt.ExpiredSignatureError:
        print("FAIL: token expired before we could verify it (check system clock).")
    except Exception as e:
        print(f"FAIL: unexpected error during verification: {e}")

    print()


if __name__ == "__main__":
    main()
