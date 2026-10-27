"""Clear the product caches whenever the data behind them changes.

The product list and product pages are cached for a day (api/product.py) because they are
read constantly and change rarely. What they show -- name, price, images, stock, ratings --
only changes when a Product, its Inventory, its images or a ProductReview is saved. Hooking
the session means that holds for every path that does it: admin edits, checkout (stock
reserved), payment (stock finalized), cancellation (stock released), webhooks and background
tasks, without each of them having to remember to clear the cache.

The cache is cleared only after the transaction commits, so a reader can never refill it
from data that is about to be replaced, and never when a transaction rolls back.
"""
import logging

from sqlalchemy import event
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

WATCHED_MODELS = {"Product", "ProductImage", "Inventory", "ProductReview"}
_DIRTY = "product_cache_dirty"


def _touches_watched(session: Session) -> bool:
    for collection in (session.new, session.dirty, session.deleted):
        for obj in collection:
            if type(obj).__name__ in WATCHED_MODELS:
                return True
    return False


@event.listens_for(Session, "after_flush")
def _mark_dirty(session: Session, flush_context) -> None:
    if _touches_watched(session):
        session.info[_DIRTY] = True


@event.listens_for(Session, "after_commit")
def _clear_after_commit(session: Session) -> None:
    if not session.info.pop(_DIRTY, False):
        return
    try:
        from app.core.cache import cache

        cache.clear_prefix("products:")
        cache.clear_prefix("product:detail:")
    except Exception as exc:  # never let cache trouble fail a committed write
        logger.warning("Could not clear product caches after commit: %s", exc)


@event.listens_for(Session, "after_rollback")
def _forget_on_rollback(session: Session) -> None:
    session.info.pop(_DIRTY, None)
