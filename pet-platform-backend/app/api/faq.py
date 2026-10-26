from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.cache import cache
from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.models.faq import FAQ
from app.schemas.faq import FAQCreate, FAQUpdate, FAQResponse, FAQPage

router = APIRouter(prefix="/faqs", tags=["FAQs"])

CACHE_KEY_ACTIVE = "faqs:active"  # prefix; one cached list per page


def _cache_key(page: str) -> str:
    return f"{CACHE_KEY_ACTIVE}:{page}"


@router.get("/", response_model=list[FAQResponse])
def get_active_faqs(page: FAQPage = "home", db: Session = Depends(get_db)):
    # No page given means the home page, which is how this endpoint always behaved.
    cached = cache.get(_cache_key(page))
    if cached is not None:
        return cached

    stmt = select(FAQ).where(FAQ.is_active == True, FAQ.page == page).order_by(FAQ.display_order.asc())
    faqs = db.scalars(stmt).all()

    serialized = [FAQResponse.model_validate(f).model_dump(mode="json") for f in faqs]
    cache.set(_cache_key(page), serialized, ttl_seconds=600)
    return faqs


@router.get("/all", response_model=list[FAQResponse])
def get_all_faqs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    stmt = select(FAQ).order_by(FAQ.display_order.asc())
    return db.scalars(stmt).all()


@router.post("/", response_model=FAQResponse, status_code=status.HTTP_201_CREATED)
def create_faq(
    payload: FAQCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    faq = FAQ(**payload.model_dump())
    db.add(faq)
    db.commit()
    db.refresh(faq)
    cache.clear_prefix(CACHE_KEY_ACTIVE)
    return faq


@router.patch("/{id}", response_model=FAQResponse)
def update_faq(
    id: int,
    payload: FAQUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    faq = db.get(FAQ, id)
    if not faq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(faq, field, value)

    db.commit()
    db.refresh(faq)
    cache.clear_prefix(CACHE_KEY_ACTIVE)
    return faq


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faq(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    faq = db.get(FAQ, id)
    if not faq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ not found")

    db.delete(faq)
    db.commit()
    cache.clear_prefix(CACHE_KEY_ACTIVE)
