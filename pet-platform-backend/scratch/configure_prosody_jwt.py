import sys
import re

CONFIG_PATH = "/etc/prosody/conf.avail/scoobykitchen.duckdns.org.cfg.lua"
APP_ID = "scooby_kitchen"
APP_SECRET = "ScoobyPetSecureToken2026!AuthKey"

try:
    with open(CONFIG_PATH, "r") as f:
        content = f.read()

    # 1. Update authentication method in VirtualHost "scoobykitchen.duckdns.org"
    # Replace authentication = "..." with authentication = "token" and add app_id / app_secret
    if 'authentication = "token"' not in content:
        content = re.sub(
            r'(VirtualHost\s+"scoobykitchen\.duckdns\.org"[^\{]*?)(authentication\s*=\s*"[^"]*")',
            rf'\1authentication = "token"\n    app_id = "{APP_ID}"\n    app_secret = "{APP_SECRET}"\n    allow_empty_token = false',
            content,
            count=1
        )

    # 2. Ensure token_verification is enabled in the MUC component
    if '"token_verification"' not in content:
        content = re.sub(
            r'(Component\s+"conference\.scoobykitchen\.duckdns\.org"\s+"muc"[^\}]*?modules_enabled\s*=\s*\{)',
            r'\1\n        "token_verification";\n        "token_affiliation";',
            content,
            count=1
        )

    with open(CONFIG_PATH, "w") as f:
        f.write(content)

    print("✅ Successfully updated Prosody configuration for JWT authentication.")
except Exception as e:
    print(f"❌ Error updating config: {e}")
    sys.exit(1)
