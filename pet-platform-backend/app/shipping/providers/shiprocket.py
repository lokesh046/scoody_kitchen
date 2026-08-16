from typing import Any
import requests
from app.core.config import settings
from app.models.order import OrderStatus

SHIPROCKET_STATUS_MAP: dict[str, tuple[str, OrderStatus | None]] = {
    "1": ("pre_transit", OrderStatus.SHIPPED),
    "awb assigned": ("pre_transit", OrderStatus.SHIPPED),
    "pickup scheduled": ("pre_transit", OrderStatus.SHIPPED),
    "ready to ship": ("pre_transit", OrderStatus.SHIPPED),

    "6": ("in_transit", OrderStatus.IN_TRANSIT),
    "shipped": ("in_transit", OrderStatus.IN_TRANSIT),
    "in transit": ("in_transit", OrderStatus.IN_TRANSIT),
    "dispatched": ("in_transit", OrderStatus.IN_TRANSIT),

    "7": ("out_for_delivery", OrderStatus.OUT_FOR_DELIVERY),
    "out for delivery": ("out_for_delivery", OrderStatus.OUT_FOR_DELIVERY),

    "8": ("delivered", OrderStatus.DELIVERED),
    "delivered": ("delivered", OrderStatus.DELIVERED),

    "9": ("returned", OrderStatus.RETURNED),
    "rto in transit": ("returned", OrderStatus.RETURNED),
    "rto delivered": ("returned", OrderStatus.RETURNED),
    "returned": ("returned", OrderStatus.RETURNED),

    "10": ("failure", OrderStatus.DELIVERY_FAILED),
    "failed": ("failure", OrderStatus.DELIVERY_FAILED),
    "undelivered": ("failure", OrderStatus.DELIVERY_FAILED),
    "unreachable": ("failure", OrderStatus.DELIVERY_FAILED),

    "17": ("canceled", OrderStatus.CANCELLED),
    "canceled": ("canceled", OrderStatus.CANCELLED),
    "cancelled": ("canceled", OrderStatus.CANCELLED),
}


def map_shiprocket_status_to_internal(shiprocket_status: str | int) -> tuple[str, OrderStatus | None]:
    clean_status = str(shiprocket_status).strip().lower()
    return SHIPROCKET_STATUS_MAP.get(clean_status, (clean_status, None))


class ShiprocketProvider:
    _cached_token: str | None = None

    def __init__(
        self,
        email: str | None = None,
        password: str | None = None,
    ) -> None:
        self.email = email or settings.SHIPROCKET_EMAIL
        self.password = password or settings.SHIPROCKET_PASSWORD
        self.enabled = settings.SHIPROCKET_ENABLED and bool(self.email) and bool(self.password)

    def _get_auth_token(self) -> str | None:
        if not ShiprocketProvider._cached_token and self.enabled:
            try:
                res = requests.post(
                    "https://apiv2.shiprocket.in/v1/external/auth/login",
                    json={"email": self.email, "password": self.password},
                    timeout=5,
                )
                if res.status_code == 200:
                    ShiprocketProvider._cached_token = res.json().get("token")
            except Exception:
                pass
        return ShiprocketProvider._cached_token

    async def create_tracker(
        self,
        tracking_number: str,
        carrier: str | None = "Shiprocket",
    ) -> dict[str, Any]:
        token = self._get_auth_token()
        if token and not tracking_number.startswith("SR"):
            try:
                headers = {"Authorization": f"Bearer {token}"}
                res = requests.get(
                    f"https://apiv2.shiprocket.in/v1/external/courier/track/awb/{tracking_number}",
                    headers=headers,
                    timeout=5,
                )
                if res.status_code == 200:
                    data = res.json()
                    tracking_data = data.get("tracking_data", {})
                    track_status = tracking_data.get("track_status", "IN TRANSIT")
                    est_delivery = tracking_data.get("etd")
                    return {
                        "id": f"sr_trk_{tracking_number}",
                        "shipment_id": f"sr_shp_{tracking_number}",
                        "tracking_code": tracking_number,
                        "carrier": carrier or "Shiprocket",
                        "status": str(track_status),
                        "est_delivery_date": est_delivery,
                    }
            except Exception:
                pass

        return self._simulate_test_tracker(tracking_number, carrier)

    async def get_tracker(
        self,
        tracker_id: str,
    ) -> dict[str, Any]:
        awb = tracker_id.replace("sr_trk_", "")
        token = self._get_auth_token()
        if token:
            try:
                headers = {"Authorization": f"Bearer {token}"}
                res = requests.get(
                    f"https://apiv2.shiprocket.in/v1/external/courier/track/awb/{awb}",
                    headers=headers,
                    timeout=5,
                )
                if res.status_code == 200:
                    data = res.json()
                    tracking_data = data.get("tracking_data", {})
                    track_status = tracking_data.get("track_status", "IN TRANSIT")
                    return {
                        "id": tracker_id,
                        "tracking_code": awb,
                        "carrier": "Shiprocket",
                        "status": str(track_status),
                        "est_delivery_date": tracking_data.get("etd"),
                    }
            except Exception:
                pass

        return {
            "id": tracker_id,
            "tracking_code": awb,
            "carrier": "Shiprocket",
            "status": "IN TRANSIT",
            "est_delivery_date": None,
        }

    def _simulate_test_tracker(
        self,
        tracking_number: str,
        carrier: str | None = "Shiprocket",
    ) -> dict[str, Any]:
        # Shiprocket Test Tracking Codes
        code_status_map = {
            "SR1000000001": "awb assigned",
            "SR2000000002": "in transit",
            "SR3000000003": "out for delivery",
            "SR4000000004": "delivered",
            "SR5000000005": "returned",
            "SR6000000006": "failed",
        }
        status = code_status_map.get(tracking_number, "in transit")
        return {
            "id": f"sr_trk_{tracking_number}",
            "shipment_id": f"sr_shp_{tracking_number}",
            "tracking_code": tracking_number,
            "carrier": carrier or "Shiprocket",
            "status": status,
            "est_delivery_date": None,
        }

    async def create_order(self, order_payload: dict[str, Any]) -> dict[str, Any]:
        token = self._get_auth_token()
        if token:
            try:
                headers = {
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                }
                res = requests.post(
                    "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
                    headers=headers,
                    json=order_payload,
                    timeout=10,
                )
                if res.status_code in (200, 201):
                    return res.json()
                else:
                    return {"error": res.text, "status_code": res.status_code}
            except Exception as exc:
                return {"error": str(exc)}

        return {
            "order_id": f"sr_ord_{order_payload.get('order_id', 'test')}",
            "shipment_id": f"sr_shp_{order_payload.get('order_id', 'test')}",
            "status": "NEW",
            "status_code": 1,
            "awb_code": f"SR_AWB_{order_payload.get('order_id', 'test')}",
        }
