"""Account deletion.

Lifecycle of a customer account:
  1. request_deletion   -> signed out everywhere, flagged with a purge date (now + grace days).
                            Signing in again before that date cancels it (cancel_pending_deletion).
  2. purge_due_accounts -> daily job. For each account past its date: write an encrypted archive of
                            what is about to be removed, delete the personal data, anonymize the rest.
  3. prune_archives     -> daily job. Keeps only the newest N archives and none older than M days.

Orders and payments stay (tax and accounting law) but lose the name/phone/address on them. The user
row stays too, anonymized, because orders point at it.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.consultation import Consultation
from app.models.deleted_account_archive import DeletedAccountArchive
from app.models.enums import ConsultationStatus, UserRole
from app.models.order import Order, OrderStatus
from app.models.refresh_token import RefreshToken
from app.models.user import User

logger = logging.getLogger(__name__)

_OPEN_ORDER_STATUSES = [
    OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED,
    OrderStatus.SHIPPED, OrderStatus.IN_TRANSIT, OrderStatus.OUT_FOR_DELIVERY,
]
_OPEN_CONSULTATION_STATUSES = [
    ConsultationStatus.PENDING, ConsultationStatus.CONFIRMED, ConsultationStatus.IN_PROGRESS,
]

# Tables holding the user's own data: (table, column that points at the user). Their child rows
# (cart items, health records, ...) go with them through the database's ON DELETE CASCADE.
_USER_OWNED = [
    ("support_messages", "sender_id"),
    ("support_tickets", "customer_id"),
    ("product_reviews", "user_id"),
    ("doctor_reviews", "customer_id"),
    ("consultation_participants", "user_id"),
    ("consultations", "customer_id"),
    ("pets", "user_id"),
    ("carts", "user_id"),
    ("notifications", "user_id"),
    ("push_tokens", "user_id"),
    ("idempotency_keys", "user_id"),
    ("magic_link_tokens", "user_id"),
    ("refresh_tokens", "user_id"),
]
# Rows that are only useful to the account's security or delivery, so they are deleted but not archived.
_NOT_ARCHIVED = {"push_tokens", "magic_link_tokens", "refresh_tokens", "idempotency_keys", "notifications"}

_REMOVED = "[removed]"


class DeletionNotAllowed(Exception):
    """The account cannot be deleted right now; the message is safe to show the user."""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- request / cancel

def deletion_blockers(db: Session, user: User) -> list[str]:
    """Reasons this account cannot be deleted right now (empty list means it can)."""
    reasons = []
    if user.role != UserRole.CUSTOMER:
        reasons.append("Doctor and admin accounts are closed through support: email support@hearthandone.com.")
        return reasons
    open_orders = db.query(Order).filter(Order.user_id == user.id, Order.status.in_(_OPEN_ORDER_STATUSES)).count()
    if open_orders:
        reasons.append("You have an order that is not delivered yet. Delete your account after it arrives or is cancelled.")
    open_consults = db.query(Consultation).filter(
        Consultation.customer_id == user.id, Consultation.status.in_(_OPEN_CONSULTATION_STATUSES)).count()
    if open_consults:
        reasons.append("You have a vet consultation that is not finished. Delete your account after it is completed or cancelled.")
    return reasons


def request_deletion(db: Session, user: User) -> datetime:
    """Schedules deletion, signs the user out everywhere. Returns the date the data will be purged."""
    blockers = deletion_blockers(db, user)
    if blockers:
        raise DeletionNotAllowed(" ".join(blockers))

    now = _utcnow()
    purge_on = now + timedelta(days=settings.ACCOUNT_DELETION_GRACE_DAYS)
    user.deletion_requested_at = now
    user.deletion_scheduled_for = purge_on
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete(synchronize_session=False)
    db.execute(text("DELETE FROM push_tokens WHERE user_id = :uid"), {"uid": user.id})
    db.commit()
    logger.info("ACCOUNT_DELETION_REQUESTED user_id=%s purge_on=%s", user.id, purge_on.date())
    return purge_on


def cancel_pending_deletion(db: Session, user: User) -> bool:
    """Called when the user signs in again during the grace period. True if a deletion was cancelled."""
    if user.deletion_scheduled_for is None or user.deleted_at is not None:
        return False
    user.deletion_requested_at = None
    user.deletion_scheduled_for = None
    db.commit()
    logger.info("ACCOUNT_DELETION_CANCELLED user_id=%s", user.id)
    return True


# --------------------------------------------------------------------------- archive

def _fernet():
    if not settings.ACCOUNT_ARCHIVE_KEY:
        raise RuntimeError("ACCOUNT_ARCHIVE_KEY is not set: refusing to delete data without an archive.")
    from cryptography.fernet import Fernet
    return Fernet(settings.ACCOUNT_ARCHIVE_KEY.encode())


def _rows(db: Session, sql: str, params: dict) -> list[dict]:
    return [dict(r._mapping) for r in db.execute(text(sql), params)]


def build_snapshot(db: Session, user: User) -> dict:
    """Everything that is about to be removed, as plain data. Never includes the password hash."""
    uid = {"uid": user.id}
    snap: dict = {
        "user": {
            "id": user.id, "email": user.email, "first_name": user.first_name, "last_name": user.last_name,
            "phone": user.phone, "profile_image_url": user.profile_image_url, "auth_provider": user.auth_provider,
            "role": getattr(user.role, "value", str(user.role)), "created_at": user.created_at,
            "deletion_requested_at": user.deletion_requested_at,
        },
        "orders_shipping_addresses": _rows(db, "SELECT id, shipping_address FROM orders WHERE user_id = :uid", uid),
    }
    for table, column in _USER_OWNED:
        if table in _NOT_ARCHIVED:
            continue
        snap[table] = _rows(db, f"SELECT * FROM {table} WHERE {column} = :uid", uid)
    snap["health_records"] = _rows(
        db, "SELECT * FROM health_records WHERE pet_id IN (SELECT id FROM pets WHERE user_id = :uid)", uid)
    snap["cart_items"] = _rows(
        db, "SELECT * FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = :uid)", uid)
    snap["support_messages_in_own_tickets"] = _rows(
        db, "SELECT * FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE customer_id = :uid)", uid)
    return snap


def _write_archive(db: Session, user: User) -> None:
    payload = _fernet().encrypt(json.dumps(build_snapshot(db, user), default=str).encode())
    db.add(DeletedAccountArchive(
        former_user_id=user.id,
        expires_at=_utcnow() + timedelta(days=settings.ACCOUNT_ARCHIVE_MAX_DAYS),
        payload=payload,
    ))
    db.commit()  # the archive must exist before anything is deleted


def read_archive(archive: DeletedAccountArchive) -> dict:
    """Decrypts one archive (support/legal use only: for example to undo a mistaken deletion)."""
    return json.loads(_fernet().decrypt(archive.payload))


# --------------------------------------------------------------------------- purge

def _delete_external_data(db: Session, user: User) -> None:
    """Best effort: photos at the storage provider, and the phone login at Firebase."""
    urls = [user.profile_image_url]
    urls += [r[0] for r in db.execute(text("SELECT profile_image_url FROM pets WHERE user_id = :uid"), {"uid": user.id})]
    urls += [r[0] for r in db.execute(text("SELECT image_url FROM product_reviews WHERE user_id = :uid"), {"uid": user.id})]
    try:
        from app.services.storage_service import get_storage_provider
        provider = get_storage_provider()
        for url in filter(None, urls):
            try:
                provider.delete_image(url)
            except Exception as exc:
                logger.warning("Could not delete image for user %s: %s", user.id, exc)
    except Exception as exc:
        logger.warning("Image cleanup skipped for user %s: %s", user.id, exc)

    if user.phone:
        try:
            from firebase_admin import auth as firebase_auth
            firebase_auth.delete_user(firebase_auth.get_user_by_phone_number(user.phone).uid)
        except Exception as exc:  # no Firebase login for this phone, or Firebase not configured
            logger.info("No Firebase login removed for user %s: %s", user.id, exc)


def purge_user(db: Session, user: User, *, write_archive: bool = True) -> None:
    """Removes the user's personal data and anonymizes what must stay. Idempotent."""
    if write_archive:
        _write_archive(db, user)
    _delete_external_data(db, user)

    uid = {"uid": user.id}
    for table, column in _USER_OWNED:
        db.execute(text(f"DELETE FROM {table} WHERE {column} = :uid"), uid)
    db.execute(text("UPDATE orders SET shipping_address = :r WHERE user_id = :uid"), {"r": _REMOVED, "uid": user.id})

    user.email = f"deleted-{user.id}@deleted.invalid"
    user.password_hash = None
    user.first_name = None
    user.last_name = None
    user.phone = None
    user.profile_image_url = None
    user.oauth_sub = None
    user.is_active = False
    user.is_email_verified = False
    user.is_phone_verified = False
    user.deletion_scheduled_for = None
    user.deleted_at = user.deleted_at or _utcnow()
    db.commit()
    logger.info("ACCOUNT_PURGED user_id=%s", user.id)


def purge_due_accounts(db: Session) -> int:
    """Daily job: purge every account whose grace period is over. Returns how many were purged."""
    if not settings.ACCOUNT_ARCHIVE_KEY:
        logger.error("ACCOUNT_ARCHIVE_KEY is not set: account purge skipped (nothing was deleted).")
        return 0
    due = db.query(User).filter(
        User.deletion_scheduled_for.isnot(None),
        User.deletion_scheduled_for <= _utcnow(),
        User.deleted_at.is_(None),
    ).all()
    purged = 0
    for user in due:
        try:
            purge_user(db, user)
            purged += 1
        except Exception:
            db.rollback()
            logger.exception("Purge failed for user %s; it will be retried tomorrow.", user.id)
    return purged


def reapply_deletions(db: Session, user_ids: list[int]) -> int:
    """After restoring an old database backup: remove again anyone who had already been purged
    (their ids are in the ACCOUNT_PURGED lines of the backend log). No new archive is written."""
    done = 0
    for uid in user_ids:
        user = db.get(User, uid)
        if user is not None:
            purge_user(db, user, write_archive=False)
            done += 1
    return done


def prune_archives(db: Session) -> int:
    """Daily job: delete expired archives, then keep only the newest ACCOUNT_ARCHIVE_KEEP_LAST."""
    removed = db.execute(text("DELETE FROM deleted_account_archive WHERE expires_at < now()")).rowcount
    removed += db.execute(
        text("DELETE FROM deleted_account_archive WHERE id NOT IN "
             "(SELECT id FROM deleted_account_archive ORDER BY archived_at DESC, id DESC LIMIT :n)"),
        {"n": settings.ACCOUNT_ARCHIVE_KEEP_LAST},
    ).rowcount
    db.commit()
    return removed
