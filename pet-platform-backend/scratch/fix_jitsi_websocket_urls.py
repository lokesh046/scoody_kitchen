import sys

CONFIG_PATH = "/etc/jitsi/meet/scoobykitchen.duckdns.org-config.js"

try:
    with open(CONFIG_PATH, "r") as f:
        content = f.read()

    # Make BOSH and WebSocket URLs dynamic based on whichever domain loads it (DuckDNS or Ngrok)
    old_bosh = "bosh: 'https://scoobykitchen.duckdns.org/' + subdir + 'http-bind'"
    new_bosh = "bosh: '//' + window.location.host + '/' + subdir + 'http-bind'"
    
    old_ws = "websocket: 'wss://scoobykitchen.duckdns.org/' + subdir + 'xmpp-websocket'"
    new_ws = "websocket: 'wss://' + window.location.host + '/' + subdir + 'xmpp-websocket'"

    content = content.replace(old_bosh, new_bosh)
    content = content.replace(old_ws, new_ws)

    with open(CONFIG_PATH, "w") as f:
        f.write(content)

    print("✅ Successfully updated Jitsi BOSH & WebSocket URLs to be dynamic across all domains/tunnels.")
except Exception as e:
    print(f"❌ Error updating config: {e}")
    sys.exit(1)
