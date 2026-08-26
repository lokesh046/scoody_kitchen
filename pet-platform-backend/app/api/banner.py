from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.models.banner import Banner
from app.schemas.banner import BannerResponse
from app.services.storage_service import get_storage_provider, validate_image_file

router = APIRouter(prefix="/banners", tags=["Banners"])

@router.get("/", response_model=list[BannerResponse])
def get_active_banners(db: Session = Depends(get_db)):
    stmt = select(Banner).where(Banner.is_active == True).order_by(Banner.display_order.asc())
    return db.scalars(stmt).all()

@router.get("/all", response_model=list[BannerResponse])
def get_all_banners(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    stmt = select(Banner).order_by(Banner.display_order.asc())
    return db.scalars(stmt).all()

@router.post("/", response_model=BannerResponse, status_code=status.HTTP_201_CREATED)
async def create_banner(
    title: str | None = Form(None),
    subtitle: str | None = Form(None),
    link_url: str | None = Form(None),
    display_order: int = Form(0),
    is_active: bool = Form(True),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    # Read and validate image file
    file_bytes = await image.read()
    validate_image_file(image, file_bytes)

    # Upload file
    storage_provider = get_storage_provider()
    uploaded_url = storage_provider.upload_image(
        file_bytes=file_bytes,
        original_filename=image.filename,
        content_type=image.content_type or "image/jpeg"
    )

    new_banner = Banner(
        title=title,
        subtitle=subtitle,
        image_url=uploaded_url,
        link_url=link_url,
        display_order=display_order,
        is_active=is_active
    )
    db.add(new_banner)
    db.commit()
    db.refresh(new_banner)
    return new_banner

@router.patch("/{id}", response_model=BannerResponse)
async def update_banner(
    id: int,
    title: str | None = Form(None),
    subtitle: str | None = Form(None),
    link_url: str | None = Form(None),
    display_order: int | None = Form(None),
    is_active: bool | None = Form(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    # Find existing banner
    banner = db.get(Banner, id)
    if not banner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banner not found"
        )

    # If new image file is uploaded
    if image is not None:
        file_bytes = await image.read()
        validate_image_file(image, file_bytes)
        storage_provider = get_storage_provider()
        
        # Delete old image if applicable
        if banner.image_url:
            try:
                storage_provider.delete_image(banner.image_url)
            except Exception:
                pass
        
        # Upload new image
        uploaded_url = storage_provider.upload_image(
            file_bytes=file_bytes,
            original_filename=image.filename,
            content_type=image.content_type or "image/jpeg"
        )
        banner.image_url = uploaded_url

    if title is not None:
        banner.title = title if title != "" else None
    if subtitle is not None:
        banner.subtitle = subtitle if subtitle != "" else None
    if link_url is not None:
        banner.link_url = link_url if link_url != "" else None
    if display_order is not None:
        banner.display_order = display_order
    if is_active is not None:
        banner.is_active = is_active

    db.commit()
    db.refresh(banner)
    return banner

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_banner(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    banner = db.get(Banner, id)
    if not banner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banner not found"
        )

    # Delete image asset
    if banner.image_url:
        try:
            storage_provider = get_storage_provider()
            storage_provider.delete_image(banner.image_url)
        except Exception:
            pass

    db.delete(banner)
    db.commit()
