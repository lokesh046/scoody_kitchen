from datetime import datetime, timezone
import hmac
import hashlib
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.enums import UserRole
from app.models.order import Order, OrderStatus
from app.models.order_status_history import OrderStatusHistory
from app.models.shipment import Shipment
from app.models.user import User
from app.models.webhook_event import ProcessedWebhookEvent
from app.services.order_service import change_order_status, confirm_order, get_order_by_id, process_order, ship_order
from app.shipping.factory import get_shipping_provider
from app.shipping.providers.easypost import map_easypost_status_to_internal
from app.shipping.providers.shiprocket import map_shiprocket_status_to_internal


def verify_easypost_hmac_signature(payload_bytes: bytes, signature_header: str | None) -> bool:
    secret = settings.EASYPOST_WEBHOOK_SECRET
    if not secret:
        return True

    if not signature_header:
        return False

    expected_sig = signature_header.split("=")[-1].strip() if "=" in signature_header else signature_header.strip()
    computed_hex = hmac.new(
        secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(computed_hex, expected_sig)


async def create_shipment_for_order(
    db: Session,
    order_id: int,
    tracking_number: str,
    carrier: str | None = None,
) -> tuple[Shipment, Order]:
    order = get_order_by_id(db, order_id)
    if order is None:
        raise ValueError(f"Order {order_id} not found")

    provider_name = settings.SHIPPING_PROVIDER.strip().lower()
    default_carrier = "Shiprocket" if provider_name == "shiprocket" else "USPS"
    chosen_carrier = carrier or default_carrier

    shipping_provider = get_shipping_provider(provider_name)

    if provider_name == "shiprocket" and hasattr(shipping_provider, "create_order"):
        order_date_str = order.created_at.strftime("%Y-%m-%d %H:%M") if order.created_at else datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        customer_email = order.user.email if order.user else "customer@scooby.com"
        first_name = order.user.first_name if (order.user and order.user.first_name) else "Customer"
        last_name = order.user.last_name if (order.user and order.user.last_name) else f"#{order.id}"
        phone = getattr(order.user, "phone", None) or "8825812858"

        items = []
        if order.items:
            for item in order.items:
                items.append({
                    "name": item.product.name if item.product else f"Product #{item.product_id}",
                    "sku": item.product.sku if (item.product and item.product.sku) else f"SKU-{item.product_id}",
                    "units": item.quantity,
                    "selling_price": str(item.unit_price),
                })
        if not items:
            items = [{"name": "Pet Care Product", "sku": "PET-ITEM-001", "units": 1, "selling_price": str(order.total_amount)}]

        shiprocket_payload = {
            "order_id": f"SCOOBY_ORDER_{order.id}",
            "order_date": order_date_str,
            "pickup_location": "Home",
            "billing_customer_name": first_name,
            "billing_last_name": last_name,
            "billing_address": order.shipping_address or "6/68 North Silver Street, Thomas Mount",
            "billing_city": "Chennai",
            "billing_pincode": "600016",
            "billing_state": "Tamil Nadu",
            "billing_country": "India",
            "billing_email": customer_email,
            "billing_phone": phone,
            "shipping_is_billing": True,
            "order_items": items,
            "payment_method": "Prepaid",
            "sub_total": float(order.total_amount),
            "length": 10,
            "breadth": 10,
            "height": 10,
            "weight": 0.5,
        }
        sr_res = await shipping_provider.create_order(shiprocket_payload)
        if isinstance(sr_res, dict) and sr_res.get("awb_code"):
            tracking_number = sr_res["awb_code"]

    tracker = await shipping_provider.create_tracker(
        tracking_number=tracking_number,
        carrier=chosen_carrier,
    )

    provider_tracker_id = tracker.get("id")
    provider_shipment_id = tracker.get("shipment_id")
    raw_status = tracker.get("status", "pre_transit")

    if provider_name == "shiprocket":
        internal_shipment_status, target_order_status = map_shiprocket_status_to_internal(raw_status)
    else:
        internal_shipment_status, target_order_status = map_easypost_status_to_internal(raw_status)

    statement = select(Shipment).where(Shipment.order_id == order_id)
    shipment = db.scalar(statement)

    now = datetime.now(timezone.utc)
    if shipment is None:
        shipment = Shipment(
            order_id=order_id,
            provider=provider_name,
            provider_shipment_id=provider_shipment_id,
            provider_tracker_id=provider_tracker_id,
            tracking_number=tracking_number,
            carrier=chosen_carrier,
            status=internal_shipment_status,
            shipped_at=now,
        )
        db.add(shipment)
    else:
        shipment.provider = provider_name
        shipment.provider_shipment_id = provider_shipment_id
        shipment.provider_tracker_id = provider_tracker_id
        shipment.tracking_number = tracking_number
        shipment.carrier = chosen_carrier
        shipment.status = internal_shipment_status
        shipment.shipped_at = now

    db.commit()
    db.refresh(shipment)

    order_status_to_set = target_order_status or OrderStatus.SHIPPED

    # Walk order status cleanly to target status
    if order.status == OrderStatus.PENDING:
        confirm_order(db, order)
    if order.status == OrderStatus.CONFIRMED:
        process_order(db, order)
    if order.status == OrderStatus.PROCESSING and order_status_to_set != OrderStatus.SHIPPED:
        ship_order(db, order)

    if order.status != order_status_to_set:
        change_order_status(
            db,
            order,
            order_status_to_set,
            f"Shipment created via {provider_name.title()} with carrier {chosen_carrier} (Tracking: {tracking_number})",
        )

    return shipment, order


def get_tracking_details(
    db: Session,
    order_id: int,
    current_user: User,
) -> dict[str, Any]:
    statement = (
        select(Order)
        .options(
            joinedload(Order.shipment),
            joinedload(Order.status_history),
        )
        .where(Order.id == order_id)
    )
    order = db.scalars(statement).unique().one_or_none()

    if order is None:
        raise ValueError(f"Order {order_id} not found")

    if current_user.role != UserRole.ADMIN and order.user_id != current_user.id:
        raise ValueError(f"Access denied to order {order_id}")

    shipment_dict = None
    if order.shipment:
        shipment_dict = {
            "provider": order.shipment.provider,
            "tracking_number": order.shipment.tracking_number,
            "carrier": order.shipment.carrier,
            "status": order.shipment.status,
            "estimated_delivery": order.shipment.estimated_delivery,
            "shipped_at": order.shipment.shipped_at,
            "delivered_at": order.shipment.delivered_at,
        }

    history_items = sorted(order.status_history, key=lambda h: h.created_at)
    timeline = [
        {
            "status": h.status.value if hasattr(h.status, "value") else str(h.status),
            "description": h.description,
            "timestamp": h.created_at,
        }
        for h in history_items
    ]

    return {
        "order_id": order.id,
        "order_status": order.status.value if hasattr(order.status, "value") else str(order.status),
        "shipment": shipment_dict,
        "timeline": timeline,
    }


def process_easypost_webhook(
    db: Session,
    payload_bytes: bytes,
    signature_header: str | None,
    payload_json: dict[str, Any],
) -> dict[str, Any]:
    if settings.EASYPOST_WEBHOOK_SECRET:
        if not verify_easypost_hmac_signature(payload_bytes, signature_header):
            raise ValueError("Invalid EasyPost webhook HMAC signature")

    event_id = payload_json.get("id")
    event_type = payload_json.get("event", "tracker.updated")

    if not event_id:
        raise ValueError("Missing event ID in webhook payload")

    existing_event = db.scalar(
        select(ProcessedWebhookEvent).where(
            ProcessedWebhookEvent.provider_event_id == event_id
        )
    )
    if existing_event:
        return {"status": "already_processed", "event_id": event_id}

    result_obj = payload_json.get("result", {})
    tracker_obj = result_obj if isinstance(result_obj, dict) else payload_json.get("tracker", {})

    tracker_id = tracker_obj.get("id")
    tracking_code = tracker_obj.get("tracking_code")
    easypost_status = tracker_obj.get("status")

    if easypost_status:
        internal_shipment_status, target_order_status = map_easypost_status_to_internal(easypost_status)

        statement = select(Shipment).options(joinedload(Shipment.order)).where(
            (Shipment.provider_tracker_id == tracker_id) | (Shipment.tracking_number == tracking_code)
        )
        shipment = db.scalars(statement).first()

        if shipment and shipment.order:
            shipment.status = internal_shipment_status
            if internal_shipment_status == "delivered":
                shipment.delivered_at = datetime.now(timezone.utc)

            order = shipment.order
            if target_order_status and order.status != target_order_status:
                try:
                    change_order_status(
                        db,
                        order,
                        target_order_status,
                        f"Tracking status updated to '{internal_shipment_status}' via EasyPost webhook",
                    )
                except ValueError:
                    pass

    processed_event = ProcessedWebhookEvent(
        provider="easypost",
        provider_event_id=event_id,
        event_type=event_type,
    )
    db.add(processed_event)
    db.commit()

    return {"status": "processed", "event_id": event_id}


def process_shiprocket_webhook(
    db: Session,
    token_header: str | None,
    payload_json: dict[str, Any],
) -> dict[str, Any]:
    # 1. Token Verification
    if settings.SHIPROCKET_WEBHOOK_TOKEN:
        if token_header != settings.SHIPROCKET_WEBHOOK_TOKEN:
            raise ValueError("Invalid Shiprocket webhook verification token")

    # 2. Extract Event Info
    awb = payload_json.get("awb") or payload_json.get("awb_code") or payload_json.get("tracking_code")
    raw_status = payload_json.get("current_status") or payload_json.get("status") or payload_json.get("current_status_id")

    if not awb:
        raise ValueError("Missing AWB / tracking number in Shiprocket webhook payload")

    event_id = payload_json.get("event_id") or f"sr_evt_{awb}_{raw_status}"

    # 3. Idempotency Check
    existing_event = db.scalar(
        select(ProcessedWebhookEvent).where(
            ProcessedWebhookEvent.provider_event_id == event_id
        )
    )
    if existing_event:
        return {"status": "already_processed", "event_id": event_id}

    # 4. Process Status Update
    if raw_status:
        internal_shipment_status, target_order_status = map_shiprocket_status_to_internal(raw_status)

        statement = select(Shipment).options(joinedload(Shipment.order)).where(
            Shipment.tracking_number == awb
        )
        shipment = db.scalars(statement).first()

        if shipment and shipment.order:
            shipment.status = internal_shipment_status
            if internal_shipment_status == "delivered":
                shipment.delivered_at = datetime.now(timezone.utc)

            order = shipment.order
            if target_order_status and order.status != target_order_status:
                try:
                    change_order_status(
                        db,
                        order,
                        target_order_status,
                        f"Tracking status updated to '{internal_shipment_status}' via Shiprocket webhook",
                    )
                except ValueError:
                    pass

    # 5. Record Processed Event
    processed_event = ProcessedWebhookEvent(
        provider="shiprocket",
        provider_event_id=event_id,
        event_type="tracking.update",
    )
    db.add(processed_event)
    db.commit()

    return {"status": "processed", "event_id": event_id}
