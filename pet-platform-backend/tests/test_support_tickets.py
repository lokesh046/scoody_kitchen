from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.dependencies.auth import get_current_user
from app.main import app
from app.models.consultation import Consultation
from app.models.doctor import Doctor
from app.models.enums import SupportTicketStatus, UserRole
from app.models.pet import Pet
from app.models.support_message import SupportMessage
from app.models.support_ticket import SupportTicket
from app.models.user import User

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _make_user(db_session, email: str, role: UserRole) -> User:
    existing = db_session.scalar(select(User).where(User.email == email))
    if existing:
        ticket_ids = [
            t.id for t in db_session.scalars(
                select(SupportTicket).where(SupportTicket.customer_id == existing.id)
            ).all()
        ]
        for tid in ticket_ids:
            db_session.execute(SupportMessage.__table__.delete().where(SupportMessage.ticket_id == tid))
        db_session.execute(SupportTicket.__table__.delete().where(SupportTicket.customer_id == existing.id))
        db_session.delete(existing)
        db_session.commit()

    user = User(
        email=email,
        first_name="Test",
        last_name=role.value.capitalize(),
        phone=f"+9198765{hash(email) % 100000:05d}",
        role=role,
        auth_provider="magic_link",
        is_email_verified=True,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _cleanup(db_session, *users: User) -> None:
    for user in users:
        ticket_ids = [
            t.id for t in db_session.scalars(
                select(SupportTicket).where(SupportTicket.customer_id == user.id)
            ).all()
        ]
        for tid in ticket_ids:
            db_session.execute(SupportMessage.__table__.delete().where(SupportMessage.ticket_id == tid))
        db_session.execute(SupportTicket.__table__.delete().where(SupportTicket.customer_id == user.id))
        db_session.delete(user)
    db_session.commit()


def test_support_ticket_lifecycle(db_session):
    customer = _make_user(db_session, "support-test-customer@example.com", UserRole.CUSTOMER)
    other_customer = _make_user(db_session, "support-test-other@example.com", UserRole.CUSTOMER)
    admin = _make_user(db_session, "support-test-admin@example.com", UserRole.ADMIN)

    try:
        # 1. Customer creates a ticket
        app.dependency_overrides[get_current_user] = lambda: customer
        create_res = client.post(
            "/support/tickets",
            json={
                "subject": "My order arrived damaged",
                "category": "order_issue",
                "message": "The salmon pouch was leaking when it arrived.",
            },
        )
        assert create_res.status_code == 201
        ticket = create_res.json()
        assert ticket["status"] == "open"
        assert ticket["category"] == "order_issue"
        assert len(ticket["messages"]) == 1
        assert ticket["messages"][0]["is_staff_reply"] is False
        ticket_id = ticket["id"]

        # 2. Customer sees it in their own list
        list_res = client.get("/support/tickets")
        assert list_res.status_code == 200
        assert any(t["id"] == ticket_id for t in list_res.json()["items"])

        # 3. A different customer cannot see it (404, not 403 — no leak)
        app.dependency_overrides[get_current_user] = lambda: other_customer
        forbidden_res = client.get(f"/support/tickets/{ticket_id}")
        assert forbidden_res.status_code == 404

        # 4. Admin sees it in the admin queue
        app.dependency_overrides[get_current_user] = lambda: admin
        admin_list_res = client.get("/support/admin/tickets")
        assert admin_list_res.status_code == 200
        assert any(t["id"] == ticket_id for t in admin_list_res.json()["items"])

        # 5. Admin replies — auto-assigns and moves to in_progress
        reply_res = client.post(
            f"/support/admin/tickets/{ticket_id}/messages",
            json={"body": "Sorry about that — we're sending a replacement."},
        )
        assert reply_res.status_code == 201
        assert reply_res.json()["is_staff_reply"] is True

        admin_detail_res = client.get(f"/support/admin/tickets/{ticket_id}")
        detail = admin_detail_res.json()
        assert detail["status"] == "in_progress"
        assert detail["assigned_admin_id"] == admin.id
        assert len(detail["messages"]) == 2

        # 6. Admin marks it resolved
        status_res = client.patch(
            f"/support/admin/tickets/{ticket_id}/status",
            json={"status": "resolved"},
        )
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "resolved"

        # 7. Customer replying to a resolved ticket reopens it
        app.dependency_overrides[get_current_user] = lambda: customer
        reopen_res = client.post(
            f"/support/tickets/{ticket_id}/messages",
            json={"body": "The replacement never arrived either."},
        )
        assert reopen_res.status_code == 201

        final_res = client.get(f"/support/tickets/{ticket_id}")
        assert final_res.json()["status"] == "open"
        assert len(final_res.json()["messages"]) == 3

    finally:
        app.dependency_overrides.clear()
        _cleanup(db_session, customer, other_customer, admin)


def test_create_ticket_rejects_order_not_owned_by_customer(db_session):
    customer = _make_user(db_session, "support-test-order-owner@example.com", UserRole.CUSTOMER)

    try:
        app.dependency_overrides[get_current_user] = lambda: customer
        res = client.post(
            "/support/tickets",
            json={
                "subject": "Wrong item in my order",
                "category": "order_issue",
                "order_id": 999999999,
                "message": "This order isn't mine.",
            },
        )
        assert res.status_code == 400
    finally:
        app.dependency_overrides.clear()
        _cleanup(db_session, customer)


def test_create_ticket_rejects_both_order_and_consultation(db_session):
    customer = _make_user(db_session, "support-test-mutual-exclusive@example.com", UserRole.CUSTOMER)

    try:
        app.dependency_overrides[get_current_user] = lambda: customer
        res = client.post(
            "/support/tickets",
            json={
                "subject": "Confused ticket",
                "category": "other",
                "order_id": 1,
                "consultation_id": 1,
                "message": "Which one is this even about.",
            },
        )
        assert res.status_code == 400
    finally:
        app.dependency_overrides.clear()
        _cleanup(db_session, customer)


def test_consultation_linked_ticket_embeds_summary_and_tracks_unread(db_session):
    customer = _make_user(db_session, "support-test-consult-customer@example.com", UserRole.CUSTOMER)
    doctor_user = _make_user(db_session, "support-test-consult-doctor@example.com", UserRole.DOCTOR)
    admin = _make_user(db_session, "support-test-consult-admin@example.com", UserRole.ADMIN)

    pet = Pet(user_id=customer.id, name="Biscuit", species="dog", breed="Beagle")
    db_session.add(pet)
    doctor = Doctor(
        user_id=doctor_user.id,
        specialization="Dermatology",
        qualification="B.V.Sc",
        experience_years=5,
        consultation_fee=500,
        license_number=f"TEST-LIC-{doctor_user.id}",
    )
    db_session.add(doctor)
    db_session.commit()
    db_session.refresh(pet)
    db_session.refresh(doctor)

    consultation = Consultation(
        customer_id=customer.id,
        pet_id=pet.id,
        doctor_id=doctor.id,
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=1),
        reason="Skin rash follow-up",
    )
    db_session.add(consultation)
    db_session.commit()
    db_session.refresh(consultation)

    try:
        # Customer creates a ticket linked to the consultation.
        app.dependency_overrides[get_current_user] = lambda: customer
        create_res = client.post(
            "/support/tickets",
            json={
                "subject": "Doctor never joined the call",
                "category": "consultation_issue",
                "consultation_id": consultation.id,
                "message": "Waited 20 minutes, nobody joined.",
            },
        )
        assert create_res.status_code == 201
        ticket = create_res.json()
        assert ticket["consultation_id"] == consultation.id
        assert ticket["consultation"] is not None
        assert ticket["consultation"]["reason"] == "Skin rash follow-up"
        assert ticket["consultation"]["doctor"]["specialization"] == "Dermatology"
        ticket_id = ticket["id"]

        # Customer just created it, so it's already "read" on their side.
        unread_res = client.get("/support/unread-count")
        assert unread_res.json()["count"] == 0

        # Admin hasn't opened it yet, so it should count as unread for admin.
        app.dependency_overrides[get_current_user] = lambda: admin
        admin_unread_res = client.get("/support/admin/unread-count")
        assert admin_unread_res.json()["count"] >= 1

        # Admin opens it — should now be marked read on the admin side, and
        # a reply should flip it back to unread for the customer.
        client.get(f"/support/admin/tickets/{ticket_id}")
        client.post(f"/support/admin/tickets/{ticket_id}/messages", json={"body": "We're so sorry — rebooking you now."})

        app.dependency_overrides[get_current_user] = lambda: customer
        customer_unread_res = client.get("/support/unread-count")
        assert customer_unread_res.json()["count"] == 1

        # Customer opens the ticket — unread count should clear.
        client.get(f"/support/tickets/{ticket_id}")
        customer_unread_after_res = client.get("/support/unread-count")
        assert customer_unread_after_res.json()["count"] == 0

    finally:
        app.dependency_overrides.clear()
        db_session.execute(SupportMessage.__table__.delete().where(SupportMessage.ticket_id.in_(
            select(SupportTicket.id).where(SupportTicket.customer_id == customer.id)
        )))
        db_session.execute(SupportTicket.__table__.delete().where(SupportTicket.customer_id == customer.id))
        db_session.execute(Consultation.__table__.delete().where(Consultation.id == consultation.id))
        db_session.execute(Doctor.__table__.delete().where(Doctor.id == doctor.id))
        db_session.execute(Pet.__table__.delete().where(Pet.id == pet.id))
        db_session.commit()
        _cleanup(db_session, customer, doctor_user, admin)
