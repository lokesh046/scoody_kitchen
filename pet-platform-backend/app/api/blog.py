from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.cache import cache
from app.core.config import settings
from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.models.blog import BlogPost
from app.schemas.blog import BlogPostCreate, BlogPostUpdate, BlogPostResponse, BlogPostListItem
from app.services.storage_service import get_storage_provider, validate_image_file

router = APIRouter(prefix="/blog", tags=["Blog"])

CACHE_KEY_LIST = "blog:published"


def verify_automation_key(x_automation_key: str | None = Header(None)) -> None:
    """Gate for the n8n publishing pipeline — a plain shared-secret header,
    not a logged-in user. Fails closed: an unconfigured key never silently
    grants access, same philosophy as the internal service auth dependency.
    """
    if not settings.BLOG_AUTOMATION_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Blog automation is not configured.",
        )
    if x_automation_key != settings.BLOG_AUTOMATION_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid automation key")


@router.get("/", response_model=list[BlogPostListItem])
def get_published_posts(db: Session = Depends(get_db)):
    cached = cache.get(CACHE_KEY_LIST)
    if cached is not None:
        return cached

    stmt = select(BlogPost).where(BlogPost.status == "published").order_by(BlogPost.published_at.desc())
    posts = db.scalars(stmt).all()

    serialized = [BlogPostListItem.model_validate(p).model_dump(mode="json") for p in posts]
    cache.set(CACHE_KEY_LIST, serialized, ttl_seconds=86400)
    return posts


@router.get("/all", response_model=list[BlogPostResponse])
def get_all_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    stmt = select(BlogPost).order_by(BlogPost.created_at.desc())
    return db.scalars(stmt).all()


@router.get("/{slug}", response_model=BlogPostResponse)
def get_post_by_slug(slug: str, db: Session = Depends(get_db)):
    post = db.scalar(select(BlogPost).where(BlogPost.slug == slug, BlogPost.status == "published"))
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post


@router.post("/", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
def create_post_as_admin(
    payload: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    return _create_post(db, payload)


@router.post("/automation", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
def create_post_via_automation(
    payload: BlogPostCreate,
    db: Session = Depends(get_db),
    _: None = Depends(verify_automation_key),
):
    """What the n8n workflow's publish step calls — same effect as the
    admin endpoint above, just gated by the automation key instead of an
    admin login, since the pipeline runs unattended."""
    return _create_post(db, payload)


def _create_post(db: Session, payload: BlogPostCreate) -> BlogPost:
    existing = db.scalar(select(BlogPost).where(BlogPost.slug == payload.slug))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A post with this slug already exists")

    from datetime import datetime
    data = payload.model_dump()
    if data.get("status") == "published":
        data["published_at"] = datetime.utcnow()

    post = BlogPost(**data)
    db.add(post)
    db.commit()
    db.refresh(post)
    cache.delete(CACHE_KEY_LIST)
    return post


@router.patch("/{id}", response_model=BlogPostResponse)
def update_post(
    id: int,
    payload: BlogPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    post = db.get(BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    from datetime import datetime
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("status") == "published" and post.status != "published":
        updates["published_at"] = datetime.utcnow()

    for field, value in updates.items():
        setattr(post, field, value)

    db.commit()
    db.refresh(post)
    cache.delete(CACHE_KEY_LIST)
    return post


@router.post("/{id}/cover-image", response_model=BlogPostResponse)
async def upload_cover_image(
    id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    post = db.get(BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    file_bytes = await image.read()
    validate_image_file(image, file_bytes)

    storage_provider = get_storage_provider()
    if post.cover_image_url:
        try:
            storage_provider.delete_image(post.cover_image_url)
        except Exception:
            pass

    uploaded_url = storage_provider.upload_image(
        file_bytes=file_bytes,
        original_filename=image.filename or "blog-cover.jpg",
        content_type=image.content_type or "image/jpeg",
    )
    post.cover_image_url = uploaded_url

    db.commit()
    db.refresh(post)
    cache.delete(CACHE_KEY_LIST)
    return post


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    post = db.get(BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    if post.cover_image_url:
        try:
            get_storage_provider().delete_image(post.cover_image_url)
        except Exception:
            pass

    db.delete(post)
    db.commit()
    cache.delete(CACHE_KEY_LIST)
