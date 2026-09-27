# Deploying hearthandone.com to Hostinger

Two separate systems are connected by your DNS settings:
- **Domain Registrar (e.g. Hostinger or GoDaddy)**: owns the domain `hearthandone.com` and its DNS records.
- **Hostinger VPS**: runs Ubuntu, Nginx, and the Scooby's Kitchen backend + frontend.

---

## 1. Point the domain at your VPS

1. In Hostinger's hPanel, open your VPS → **Overview**, and copy its public IPv4 address.
2. Go to your domain DNS management (in Hostinger: **Domains → hearthandone.com → DNS / Nameservers**).
3. Add / update these **A records**:

| Type | Name / Host | Value | TTL | Purpose |
|---|---|---|---|---|
| **A** | `@` | `<VPS IP>` | 600s / 300s | Main website (`https://hearthandone.com`) |
| **A** | `www` | `<VPS IP>` | 600s / 300s | Web redirect (`https://www.hearthandone.com`) |
| **A** | `api` | `<VPS IP>` | 600s / 300s | Backend REST API & Mobile App (`https://api.hearthandone.com`) |

4. Check propagation using `dig hearthandone.com` or https://dnschecker.org.

---

## 2. Prepare the VPS

SSH into your Hostinger VPS as `root`:

```bash
# Update Ubuntu and install Nginx, Git, Python, and Certbot
sudo apt update && sudo apt install -y nginx git python3.13 certbot python3-certbot-nginx
curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone project code
sudo mkdir -p /var/www/scoobys-kitchen
sudo chown $USER:$USER /var/www/scoobys-kitchen
git clone -b feature/my-new-frontend-task https://github.com/lokesh046/scoody_kitchen.git /var/www/scoobys-kitchen
cd /var/www/scoobys-kitchen
```

### Backend setup:
```bash
cd /var/www/scoobys-kitchen/pet-platform-backend
uv venv
uv pip install -r requirements.txt
cp .env.example .env
```
Fill in `.env` with production values: `DATABASE_URL` (Neon Postgres pooled string), Razorpay keys, Firebase credentials, etc.

### Frontend build:
```bash
cd /var/www/scoobys-kitchen/frontend
npm install
npm run build   # builds into dist/ against https://api.hearthandone.com
```

---

## 3. Run the Backend as a Service

```bash
sudo cp /var/www/scoobys-kitchen/deploy/scooby-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now scooby-backend
sudo systemctl status scooby-backend   # verify "active (running)"
```

---

## 4. Activate Nginx & Automatic SSL

```bash
sudo cp /var/www/scoobys-kitchen/deploy/nginx-hearthandone.conf /etc/nginx/sites-available/hearthandone.com
sudo ln -s /etc/nginx/sites-available/hearthandone.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Once DNS resolves to your VPS:
```bash
sudo certbot --nginx -d hearthandone.com -d www.hearthandone.com -d api.hearthandone.com
```

Certbot automatically configures HTTPS and enables 90-day auto-renewal.

---

## 5. Verify the Live Deployment

```bash
curl -I https://hearthandone.com          # frontend: 200 OK
curl https://api.hearthandone.com/health  # backend: {"Status":"healthy",...}
```

---

## Redeploying Updates

```bash
# Update backend
cd /var/www/scoobys-kitchen/pet-platform-backend && git pull
sudo systemctl restart scooby-backend

# Update frontend
cd /var/www/scoobys-kitchen/frontend && git pull && npm run build
```
