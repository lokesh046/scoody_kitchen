"""
Internal-only API — for pet-platform-mcp-server ONLY.

Every route here is protected by verify_internal_service (a shared secret
between this backend and the MCP server), never a customer JWT. Because the
caller is a trusted service rather than a verified end user, every route that
touches a specific customer's data ALSO takes an explicit acting_user_id and
re-checks ownership itself — the backend remains the final authority on who
owns what, it never just trusts the caller's word for it.

This router should never be reachable from the public internet. It exists
purely for container-to-container traffic on the internal Docker network.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

import json
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.core.database import get_db
from app.dependencies.auth import verify_internal_service
from app.models.idempotency_key import IdempotencyKey
from app.models.consultation import Consultation
from app.models.doctor_availability import DoctorAvailability
from app.models.enums import ConsultationStatus
from app.models.user import User, UserRole
from app.schemas.consultation import ConsultationCreate
from app.services.consultation_service import (
    create_consultation,
    get_consultation_by_id,
    update_consultation_status,
)
from app.services.inventory_service import (
    get_available_stock,
    get_product_inventory,
    is_low_stock,
)
from app.services.order_service import cancel_order as service_cancel_order
from app.services.order_service import get_order_by_id
from app.services.product_service import get_product, get_products_paginated
from app.services.shipping_service import get_tracking_details
from sqlalchemy import select

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(verify_internal_service)],
)


# ---- Orders (read) -------------------------------------------------------

@router.get("/orders")
def internal_get_my_orders(
    acting_user_id: int = Query(..., description="The customer this call is being made on behalf of"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    from app.services.order_service import get_user_orders
    orders = get_user_orders(db, acting_user_id, skip=skip, limit=limit)
    return [
        {
            "order_id": order.id,
            "status": order.status.value if hasattr(order.status, "value") else str(order.status),
            "total_amount": float(order.total_amount) if order.total_amount is not None else 0.0,
            "created_at": str(order.created_at) if order.created_at else None,
        }
        for order in orders
    ]


@router.get("/orders/{order_id}")
def internal_get_order(
    order_id: int,
    acting_user_id: int = Query(..., description="The customer this call is being made on behalf of"),
    db: Session = Depends(get_db),
):
    order = get_order_by_id(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order #{order_id} not found.")
    if order.user_id != acting_user_id:
        raise HTTPException(status_code=403, detail="This order does not belong to the acting user.")

    return {
        "order_id": order.id,
        "status": order.status.value if hasattr(order.status, "value") else str(order.status),
        "total_amount": float(order.total_amount) if order.total_amount is not None else 0.0,
        "created_at": str(order.created_at) if order.created_at else None,
        "items": [
            {
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price) if item.unit_price is not None else 0.0,
            }
            for item in getattr(order, "items", [])
        ],
    }


@router.get("/orders/{order_id}/tracking")
def internal_get_order_tracking(
    order_id: int,
    acting_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    dummy_user = User(id=acting_user_id, role=UserRole.CUSTOMER)
    try:
        return get_tracking_details(db, order_id=order_id, current_user=dummy_user)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ---- Orders (action) ------------------------------------------------------

@router.post("/orders/{order_id}/cancel")
def internal_cancel_order(
    order_id: int,
    acting_user_id: int = Query(...),
    idempotency_key: str | None = Query(None),
    db: Session = Depends(get_db),
):
    order = get_order_by_id(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order #{order_id} not found.")
    if order.user_id != acting_user_id:
        raise HTTPException(status_code=403, detail="This order does not belong to the acting user.")

    claimed_key: IdempotencyKey | None = None
    if idempotency_key:
        try:
            with db.begin_nested():
                claimed_key = IdempotencyKey(
                    key=idempotency_key,
                    user_id=acting_user_id,
                    response="PENDING",
                )
                db.add(claimed_key)
                db.flush()
        except IntegrityError:
            # Key already exists: either completed in the past or currently running in parallel
            stmt = select(IdempotencyKey).where(
                IdempotencyKey.user_id == acting_user_id,
                IdempotencyKey.key == idempotency_key
            )
            existing = db.scalar(stmt)
            if existing:
                if existing.response == "PENDING":
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Cancellation request is currently being processed for this order."
                    )
                return json.loads(existing.response)

    try:
        cancelled = service_cancel_order(db, order)
    except ValueError as exc:
        if claimed_key:
            try:
                db.delete(claimed_key)
                db.commit()
            except Exception:
                db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        if claimed_key:
            try:
                db.delete(claimed_key)
                db.commit()
            except Exception:
                db.rollback()
        raise

    status_val = cancelled.status.value if hasattr(cancelled.status, "value") else str(cancelled.status)
    response_data = {"order_id": cancelled.id, "status": status_val}

    if claimed_key:
        claimed_key.response = json.dumps(response_data)
        db.commit()

    return response_data


# ---- Products (read) -------------------------------------------------------

@router.get("/products/search")
def internal_search_products(
    search: str | None = None,
    category_id: int | None = None,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    paginated = get_products_paginated(
        db=db, search=search, category_id=category_id, limit=limit, include_inactive=False,
    )
    return {
        "total": paginated["total"],
        "page": paginated["page"],
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "price": float(p.price) if p.price is not None else 0.0,
                "category_id": p.category_id,
                "in_stock": getattr(p, "is_in_stock", True),
                "image_url": p.image_url or (p.images[0].image_url if p.images else None),
            }
            for p in paginated["items"]
        ],
    }


@router.get("/products/{product_id}/stock")
def internal_get_product_stock(product_id: int, db: Session = Depends(get_db)):
    product = get_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product #{product_id} not found.")

    inv = get_product_inventory(db, product_id)
    if inv is None:
        return {"product_id": product_id, "name": product.name, "available_stock": 0, "is_in_stock": False}

    avail = get_available_stock(inv)
    return {
        "product_id": product_id,
        "name": product.name,
        "stock_quantity": inv.stock_quantity,
        "available_stock": avail,
        "low_stock": is_low_stock(inv),
        "is_in_stock": avail > 0,
    }


# ---- Bookings (read) -------------------------------------------------------

@router.get("/bookings/available-slots")
def internal_get_available_slots(doctor_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(DoctorAvailability).where(DoctorAvailability.is_available == True)  # noqa: E712
    if doctor_id is not None:
        stmt = stmt.where(DoctorAvailability.doctor_id == doctor_id)
    slots = db.scalars(stmt).all()
    return [
        {
            "slot_id": s.id,
            "doctor_id": s.doctor_id,
            "doctor_name": f"{s.doctor.user.first_name} {s.doctor.user.last_name}".strip() if s.doctor and s.doctor.user else None,
            "day_of_week": s.day_of_week.value if hasattr(s.day_of_week, "value") else str(s.day_of_week),
            "start_time": str(s.start_time),
            "end_time": str(s.end_time),
        }
        for s in slots
    ]


@router.get("/bookings/my-consultations")
def internal_get_my_consultations(acting_user_id: int = Query(...), db: Session = Depends(get_db)):
    stmt = select(Consultation).where(Consultation.customer_id == acting_user_id)
    consultations = db.scalars(stmt).all()
    return [
        {
            "consultation_id": c.id,
            "doctor_id": c.doctor_id,
            "pet_id": c.pet_id,
            "status": c.status.value if hasattr(c.status, "value") else str(c.status),
            "scheduled_at": str(c.scheduled_at) if c.scheduled_at else None,
        }
        for c in consultations
    ]


# ---- Bookings (action) -----------------------------------------------------

@router.post("/bookings/consultations")
def internal_book_consultation(
    acting_user_id: int = Query(...),
    doctor_id: int = Query(...),
    pet_id: int = Query(...),
    scheduled_at_iso: str = Query(...),
    reason: str = Query(...),
    customer_notes: str | None = Query(None),
    idempotency_key: str | None = Query(None),
    db: Session = Depends(get_db),
):
    if idempotency_key:
        stmt = select(IdempotencyKey).where(
            IdempotencyKey.user_id == acting_user_id,
            IdempotencyKey.key == idempotency_key
        )
        existing = db.scalar(stmt)
        if existing:
            return json.loads(existing.response)

    dt = datetime.fromisoformat(scheduled_at_iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    create_data = ConsultationCreate(
        doctor_id=doctor_id, pet_id=pet_id, scheduled_at=dt, reason=reason, customer_notes=customer_notes,
    )
    try:
        consultation = create_consultation(db, customer_id=acting_user_id, create_data=create_data)
    except (ValueError, KeyError, MemoryError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    status_val = consultation.status.value if hasattr(consultation.status, "value") else str(consultation.status)
    response_data = {"consultation_id": consultation.id, "status": status_val}

    if idempotency_key:
        try:
            with db.begin_nested():
                db.add(IdempotencyKey(
                    key=idempotency_key,
                    user_id=acting_user_id,
                    response=json.dumps(response_data)
                ))
            db.commit()
        except IntegrityError:
            db.rollback()
            stmt = select(IdempotencyKey).where(
                IdempotencyKey.user_id == acting_user_id,
                IdempotencyKey.key == idempotency_key
            )
            existing = db.scalar(stmt)
            if existing:
                return json.loads(existing.response)

    return response_data


@router.post("/bookings/consultations/{consultation_id}/cancel")
def internal_cancel_consultation(
    consultation_id: int,
    acting_user_id: int = Query(...),
    idempotency_key: str | None = Query(None),
    db: Session = Depends(get_db),
):
    if idempotency_key:
        stmt = select(IdempotencyKey).where(
            IdempotencyKey.user_id == acting_user_id,
            IdempotencyKey.key == idempotency_key
        )
        existing = db.scalar(stmt)
        if existing:
            return json.loads(existing.response)

    consultation = get_consultation_by_id(db, consultation_id)
    if consultation is None:
        raise HTTPException(status_code=404, detail=f"Consultation #{consultation_id} not found.")
    if consultation.customer_id != acting_user_id:
        raise HTTPException(status_code=403, detail="This consultation does not belong to the acting user.")

    updated = update_consultation_status(db, consultation, ConsultationStatus.CANCELLED)
    status_val = updated.status.value if hasattr(updated.status, "value") else str(updated.status)
    response_data = {"consultation_id": updated.id, "status": status_val}

    if idempotency_key:
        try:
            with db.begin_nested():
                db.add(IdempotencyKey(
                    key=idempotency_key,
                    user_id=acting_user_id,
                    response=json.dumps(response_data)
                ))
            db.commit()
        except IntegrityError:
            db.rollback()
            stmt = select(IdempotencyKey).where(
                IdempotencyKey.user_id == acting_user_id,
                IdempotencyKey.key == idempotency_key
            )
            existing = db.scalar(stmt)
            if existing:
                return json.loads(existing.response)

    return response_data


@router.get("/pets")
def internal_get_my_pets(
    acting_user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    from app.services.pet_service import get_pet_by_user_id
    pets = get_pet_by_user_id(db, acting_user_id)
    return [
        {
            "pet_id": p.id,
            "name": p.name,
            "species": p.species,
            "breed": p.breed,
            "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
        }
        for p in pets
    ]
