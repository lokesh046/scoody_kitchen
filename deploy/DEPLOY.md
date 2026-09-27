# Deploying scoobys-kitchen.com to Hostinger

Two separate systems are involved, connected by one setting: **GoDaddy**
owns the domain and its DNS records; **Hostinger** runs the actual VPS the
app lives on. Nothing needs to move between them — you keep the domain
registered at GoDaddy and just point its DNS at Hostinger's server IP.

## 1. Point the domain at your VPS (GoDaddy)

1. In Hostinger's hPanel, open your KVM 2 VPS → **Overview**, and copy its
   public IPv4 address.
2. In GoDaddy: **My Products → scoobys-kitchen.com → DNS → Manage DNS**.
3. Add/edit these records:
   | Type | Name | Value | TTL |
   |---|---|---|---|
   | A | `@` | `<VPS IP>` | 600s (1 hour if 600 isn't offered) |
   | A | `www` | `<VPS IP>` | 600s |
   | A | `api` | `<VPS IP>` | 600s |
4. If GoDaddy's "Forwarding" is turned on for this domain, turn it off —
   forwarding and A records fight each other.
5. Wait for propagation. A low TTL usually resolves in 15-60 minutes, but
   can take a few hours; check with `dig scoobys-kitchen.com` or
   https://dnschecker.org before moving to the certbot step below (it will
   fail if DNS hasn't caught up yet).

You do **not** need to change nameservers at GoDaddy — that would hand all
DNS management to Hostinger. Keeping DNS at GoDaddy and just pointing A
records at the VPS is simpler and keeps you in one place for future record
changes.

## 2. Prepare the VPS

SSH into the VPS, then:

```bash
sudo apt update && sudo apt install -y nginx git python3.13 certbot python3-certbot-nginx
curl -LsSf https://astral.sh/uv/install.sh | sh   # same tool this repo already uses locally

sudo mkdir -p /var/www/scoobys-kitchen
sudo chown $USER:$USER /var/www/scoobys-kitchen
cd /var/www/scoobys-kitchen
git clone <your repo URL> .
```

Backend setup:

```bash
cd pet-platform-backend
uv venv
uv pip install -r requirements.txt   # or `uv sync` if you're on the uv.lock workflow
cp .env.example .env                 # then fill in real values — see below
```

Fill in `.env` with production values: `DATABASE_URL` (your Neon connection
string — see the pooled-connections note in the systemd unit's comments),
`GOOGLE_PLACES_API_KEY`, mail/SMS credentials, etc. — whatever
`app/core/config.py` currently reads from environment.

Frontend build (build locally or in CI, not necessarily on the VPS itself —
either works, this just assumes you build on the VPS for simplicity):

```bash
cd /var/www/scoobys-kitchen/frontend
npm install
npm run build   # outputs to dist/ — this is what nginx serves
```

## 3. Run the backend as a service

```bash
sudo cp /var/www/scoobys-kitchen/deploy/scooby-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now scooby-backend
sudo systemctl status scooby-backend   # should say "active (running)"
```

This runs `gunicorn` with `uvicorn` worker processes bound to
`127.0.0.1:8000` — not exposed to the internet directly. Only nginx talks
to it. See the comments in `deploy/scooby-backend.service` for why 3
workers, and how that number relates to your Neon connection limit.

## 4. Nginx + HTTPS

```bash
sudo cp /var/www/scoobys-kitchen/deploy/nginx-scoobys-kitchen.conf /etc/nginx/sites-available/scoobys-kitchen.com
sudo ln -s /etc/nginx/sites-available/scoobys-kitchen.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Once `scoobys-kitchen.com`, `www.scoobys-kitchen.com`, and
`api.scoobys-kitchen.com` all resolve to this VPS (check with `dig`), issue
real certificates:

```bash
sudo certbot --nginx -d scoobys-kitchen.com -d www.scoobys-kitchen.com -d api.scoobys-kitchen.com
```

Certbot rewrites the nginx config in place to add the HTTPS server blocks
and an HTTP→HTTPS redirect, and sets up auto-renewal (`certbot renew` via a
systemd timer it installs itself — nothing further to do).

## 5. Point the apps at the live API

- **Web frontend**: wherever it currently builds against a local/ngrok API
  URL, set that to `https://api.scoobys-kitchen.com` and rebuild
  (`npm run build`) before deploying.
- **Mobile app**: set `EXPO_PUBLIC_API_URL=https://api.scoobys-kitchen.com`
  for production builds (`mobile/src/api/client.ts` already reads this from
  the environment — no code change needed, just the build-time env var).

CORS is already set up for this: `app/main.py`'s `allow_origins` already
lists `https://scoobys-kitchen.com` and `https://www.scoobys-kitchen.com`
as allowed origins for the API, which is what matters for a browser calling
`api.scoobys-kitchen.com` from `scoobys-kitchen.com` — no change needed
there.

## 6. Verify

```bash
curl -I https://scoobys-kitchen.com          # frontend, should be 200
curl https://api.scoobys-kitchen.com/health  # backend, should be {"Status":"healthy",...}
```

Then open the site in a real browser and the mobile app pointed at the
prod API, and walk through sign-in → browse → cart once end to end before
calling it live.

## Redeploying after a code change

```bash
# backend
cd /var/www/scoobys-kitchen/pet-platform-backend && git pull
sudo systemctl restart scooby-backend

# frontend
cd /var/www/scoobys-kitchen/frontend && git pull && npm run build
# nginx serves dist/ directly — no restart needed, just a fresh build
```
