"""
Load test for the guest-browsing path — the highest-volume, most
representative traffic on this app: everything HomeScreen.tsx's
loadHomeData() fires in parallel on every app open/focus (banners +
products + recent reviews), plus the product-detail and search flows a
browsing user naturally follows from there.

Deliberately does NOT cover authenticated flows (cart, orders, vet
consultations) — the app only supports magic-link/OTP/Google/Firebase-phone
login, none of which can be scripted here without a real inbox or phone.
The endpoints below are the ones FastAPI serves to anonymous users
(get_current_user_optional), so this measures real capacity for the
"how many people can browse the app at once" question, not writes.

Usage (from pet-platform-backend/, against the local dev server):
    uv run --python .venv/bin/python locust -f loadtest/locustfile.py \
        --host http://localhost:8000

Then open http://localhost:8089, set target user count + spawn rate, and
watch p95 latency / failure rate climb as concurrency increases — the
point where either turns bad is this config's real ceiling, not a guess.

For a first automated pass without the web UI:
    uv run --python .venv/bin/python locust -f loadtest/locustfile.py \
        --host http://localhost:8000 --headless -u 50 -r 5 -t 2m \
        --csv loadtest/results
"""

import random

from locust import HttpUser, task, between


# A handful of realistic search terms a pet-parent would actually type,
# so the search path doesn't just repeat one cached query.
SEARCH_TERMS = ["chicken", "sweet potato", "chews", "lamb", "grain free"]


class GuestBrowsingUser(HttpUser):
    # 1-4s between actions per simulated user — a human reading a screen
    # before tapping the next thing, not a tight request loop.
    wait_time = between(1, 4)

    def on_start(self):
        # Every real session starts on Home, which fires these three calls
        # concurrently (see HomeScreen.tsx loadHomeData / Promise.allSettled).
        # Locust runs tasks sequentially per user, but many simulated users
        # started a moment apart still produces the same concurrent load on
        # the server that Promise.allSettled does for one real user.
        self.open_home()

    def open_home(self):
        self.client.get("/banners/", name="/banners/ (home)")
        with self.client.get(
            "/product?limit=6", name="/product (home carousel)", catch_response=True
        ) as resp:
            self._remember_product_ids(resp)
        self.client.get("/reviews/recent?limit=100", name="/reviews/recent (home)")

    def _remember_product_ids(self, resp):
        self.known_product_ids = getattr(self, "known_product_ids", [])
        if resp.status_code == 200:
            try:
                items = resp.json().get("items", [])
                self.known_product_ids = [p["id"] for p in items if "id" in p] or self.known_product_ids
            except ValueError:
                pass

    @task(5)
    def revisit_home(self):
        # Re-focusing the Home tab — the app's useFocusEffect refetches
        # this same trio every time, so it's the single most common
        # request pattern in the real app, not a one-off.
        self.open_home()

    @task(3)
    def browse_shop_page(self):
        page = random.randint(1, 3)
        with self.client.get(
            f"/product?page={page}&limit=20", name="/product (shop list)", catch_response=True
        ) as resp:
            self._remember_product_ids(resp)

    @task(2)
    def search_products(self):
        term = random.choice(SEARCH_TERMS)
        self.client.get(f"/product?search={term}", name="/product (search)")

    @task(3)
    def view_product_detail(self):
        ids = getattr(self, "known_product_ids", [])
        product_id = random.choice(ids) if ids else 1
        self.client.get(f"/product/{product_id}", name="/product/:id (detail)")

    @task(1)
    def check_health(self):
        self.client.get("/health")
