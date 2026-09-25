from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.dependencies.auth import get_current_user, require_admin
from app.models.enums import SupportTicketStatus
from app.models.support_ticket import SupportTicket
from app.models.user import User
from app.schemas.support import (
    PaginatedSupportTicketResponse,
    SupportMessageCreate,
    SupportMessageResponse,
    SupportTicketCreate,
    SupportTicketDetailResponse,
    SupportTicketResponse,
    SupportTicketStatusUpdate,
    SupportUnreadCountResponse,
)
from app.services.support_service import (
    add_message,
    count_unread_for_admin,
    count_unread_for_customer,
    create_ticket,
    get_ticket,
    list_all_tickets,
    list_customer_tickets,
    mark_ticket_read,
    update_ticket_status,
)

router = APIRouter(prefix="/support", tags=["Support"])


def _paginate(items, total, skip: int, limit: int) -> dict:
    page = (skip // limit) + 1 if limit else 1
    total_pages = (total + limit - 1) // limit if limit else 0
    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total_items": total,
        "total_pages": total_pages,
        "has_next": skip + limit < total,
        "has_prev": skip > 0,
    }


@router.post("/tickets", response_model=SupportTicketDetailResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def create_my_ticket(
    request: Request,
    payload: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        ticket = create_ticket(db, current_user.id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return get_ticket(db, ticket.id)


@router.get("/tickets", response_model=PaginatedSupportTicketResponse)
def list_my_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = list_customer_tickets(db, current_user.id, skip=skip, limit=limit)
    return _paginate(items, total, skip, limit)


@router.get("/unread-count", response_model=SupportUnreadCountResponse)
def get_my_unread_ticket_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"count": count_unread_for_customer(db, current_user.id)}


def _get_owned_ticket(db: Session, ticket_id: int, customer_id: int) -> SupportTicket:
    ticket = get_ticket(db, ticket_id)
    # 404, not 403, for a ticket that exists but belongs to someone else —
    # confirming existence to a user who shouldn't see it is its own leak.
    if not ticket or ticket.customer_id != customer_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found.")
    return ticket


@router.get("/tickets/{ticket_id}", response_model=SupportTicketDetailResponse)
def get_my_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _get_owned_ticket(db, ticket_id, current_user.id)
    mark_ticket_read(db, ticket, is_staff=False)
    return ticket


@router.post("/tickets/{ticket_id}/messages", response_model=SupportMessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def reply_to_my_ticket(
    request: Request,
    ticket_id: int,
    payload: SupportMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _get_owned_ticket(db, ticket_id, current_user.id)
    return add_message(db, ticket, current_user.id, payload.body, is_staff_reply=False)


# --- Admin -----------------------------------------------------------------

@router.get("/admin/tickets", response_model=PaginatedSupportTicketResponse)
def admin_list_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: SupportTicketStatus | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    items, total = list_all_tickets(db, skip=skip, limit=limit, status_filter=status_filter)
    return _paginate(items, total, skip, limit)


@router.get("/admin/unread-count", response_model=SupportUnreadCountResponse)
def get_admin_unread_ticket_count(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return {"count": count_unread_for_admin(db)}


@router.get("/admin/tickets/{ticket_id}", response_model=SupportTicketDetailResponse)
def admin_get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    ticket = get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found.")
    mark_ticket_read(db, ticket, is_staff=True)
    return ticket


@router.post("/admin/tickets/{ticket_id}/messages", response_model=SupportMessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
def admin_reply_to_ticket(
    request: Request,
    ticket_id: int,
    payload: SupportMessageCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    ticket = get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found.")
    return add_message(db, ticket, admin.id, payload.body, is_staff_reply=True)


@router.patch("/admin/tickets/{ticket_id}/status", response_model=SupportTicketResponse)
def admin_update_ticket_status(
    ticket_id: int,
    payload: SupportTicketStatusUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    ticket = get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found.")
    return update_ticket_status(db, ticket, payload.status)
