from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.consultation import Consultation
from app.models.doctor import Doctor
from app.models.enums import SupportTicketStatus
from app.models.order import Order
from app.models.support_message import SupportMessage
from app.models.support_ticket import SupportTicket
from app.schemas.support import SupportTicketCreate
from app.services.notification_service import create_notification


def _touch(ticket: SupportTicket) -> None:
    ticket.updated_at = datetime.now(timezone.utc)


def validate_order_ownership(db: Session, order_id: int, customer_id: int) -> None:
    order = db.get(Order, order_id)
    if not order or order.user_id != customer_id:
        raise ValueError("Order not found for this customer.")


def validate_consultation_ownership(db: Session, consultation_id: int, customer_id: int) -> None:
    consultation = db.get(Consultation, consultation_id)
    if not consultation or consultation.customer_id != customer_id:
        raise ValueError("Consultation not found for this customer.")


def create_ticket(db: Session, customer_id: int, payload: SupportTicketCreate) -> SupportTicket:
    if payload.order_id is not None and payload.consultation_id is not None:
        raise ValueError("A ticket can reference an order or a consultation, not both.")

    if payload.order_id is not None:
        validate_order_ownership(db, payload.order_id, customer_id)

    if payload.consultation_id is not None:
        validate_consultation_ownership(db, payload.consultation_id, customer_id)

    ticket = SupportTicket(
        customer_id=customer_id,
        order_id=payload.order_id,
        consultation_id=payload.consultation_id,
        subject=payload.subject,
        category=payload.category,
        status=SupportTicketStatus.OPEN,
        # The customer is the one creating this, so it's already "read" on
        # their side — otherwise their own brand-new ticket would show as
        # unread to themselves the moment they created it.
        customer_last_read_at=datetime.now(timezone.utc),
    )
    db.add(ticket)
    db.flush()

    message = SupportMessage(
        ticket_id=ticket.id,
        sender_id=customer_id,
        is_staff_reply=False,
        body=payload.message,
    )
    db.add(message)
    db.commit()
    db.refresh(ticket)
    return ticket


def get_ticket(db: Session, ticket_id: int) -> SupportTicket | None:
    statement = (
        select(SupportTicket)
        .where(SupportTicket.id == ticket_id)
        .options(
            selectinload(SupportTicket.messages).selectinload(SupportMessage.sender),
            selectinload(SupportTicket.order).selectinload(Order.items),
            selectinload(SupportTicket.order).selectinload(Order.user),
            selectinload(SupportTicket.consultation).selectinload(Consultation.pet),
            selectinload(SupportTicket.consultation).selectinload(Consultation.customer),
            selectinload(SupportTicket.consultation)
            .selectinload(Consultation.doctor)
            .selectinload(Doctor.user),
            selectinload(SupportTicket.consultation)
            .selectinload(Consultation.doctor)
            .selectinload(Doctor.clinic),
        )
    )
    return db.scalar(statement)


def mark_ticket_read(db: Session, ticket: SupportTicket, is_staff: bool) -> None:
    now = datetime.now(timezone.utc)
    if is_staff:
        ticket.admin_last_read_at = now
    else:
        ticket.customer_last_read_at = now
    db.commit()


def _unread_where_clause(is_staff: bool):
    """Rows are 'unread' when the other side's latest message is newer than
    this participant's last-read timestamp (or they've never read it)."""
    last_message_side = SupportMessage.is_staff_reply == (not is_staff)
    read_column = SupportTicket.admin_last_read_at if is_staff else SupportTicket.customer_last_read_at
    return (
        select(func.count(func.distinct(SupportTicket.id)))
        .select_from(SupportTicket)
        .join(SupportMessage, SupportMessage.ticket_id == SupportTicket.id)
        .where(
            last_message_side,
            (read_column.is_(None)) | (SupportMessage.created_at > read_column),
        )
    )


def count_unread_for_customer(db: Session, customer_id: int) -> int:
    statement = _unread_where_clause(is_staff=False).where(SupportTicket.customer_id == customer_id)
    return db.scalar(statement) or 0


def count_unread_for_admin(db: Session) -> int:
    return db.scalar(_unread_where_clause(is_staff=True)) or 0


def list_customer_tickets(
    db: Session, customer_id: int, skip: int = 0, limit: int = 20
) -> tuple[list[SupportTicket], int]:
    base = select(SupportTicket).where(SupportTicket.customer_id == customer_id)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = list(
        db.scalars(
            base.order_by(SupportTicket.created_at.desc()).offset(skip).limit(limit)
        ).all()
    )
    return items, total


def list_all_tickets(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status_filter: SupportTicketStatus | None = None,
) -> tuple[list[SupportTicket], int]:
    base = select(SupportTicket)
    if status_filter is not None:
        base = base.where(SupportTicket.status == status_filter)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    # Open/in-progress tickets surface first so an admin's queue leads with
    # what actually needs attention, then newest-first within each group.
    items = list(
        db.scalars(
            base.order_by(
                (SupportTicket.status == SupportTicketStatus.CLOSED).asc(),
                (SupportTicket.status == SupportTicketStatus.RESOLVED).asc(),
                SupportTicket.created_at.asc(),
            )
            .offset(skip)
            .limit(limit)
        ).all()
    )
    return items, total


def add_message(
    db: Session,
    ticket: SupportTicket,
    sender_id: int,
    body: str,
    is_staff_reply: bool,
) -> SupportMessage:
    message = SupportMessage(
        ticket_id=ticket.id,
        sender_id=sender_id,
        is_staff_reply=is_staff_reply,
        body=body,
    )
    db.add(message)

    if is_staff_reply:
        # First reply implicitly claims the ticket and moves it out of the
        # unworked queue — mirrors how the doctor consultation queue treats
        # a doctor's first action on a booking.
        if ticket.assigned_admin_id is None:
            ticket.assigned_admin_id = sender_id
        if ticket.status == SupportTicketStatus.OPEN:
            ticket.status = SupportTicketStatus.IN_PROGRESS
    else:
        # A customer replying to a ticket staff had already resolved/closed
        # means the issue isn't actually settled — reopen it rather than
        # silently accepting a message onto a "done" ticket no one is
        # watching.
        if ticket.status in (SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED):
            ticket.status = SupportTicketStatus.OPEN

    _touch(ticket)
    db.commit()
    db.refresh(message)

    notify_user_id = ticket.customer_id if is_staff_reply else ticket.assigned_admin_id
    if notify_user_id is not None:
        create_notification(
            db,
            user_id=notify_user_id,
            title="New reply on your support ticket" if is_staff_reply else "New customer reply",
            message=body[:200],
            type="SUPPORT",
            link="/support" if is_staff_reply else "/admin/support",
        )

    return message


def update_ticket_status(db: Session, ticket: SupportTicket, new_status: SupportTicketStatus) -> SupportTicket:
    ticket.status = new_status
    _touch(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket
