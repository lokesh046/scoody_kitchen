from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db
from app.dependencies.auth import get_current_user, get_current_user_optional, require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryTreeResponse,
    CategoryUpdate,
)
from app.services.category_service import (
    InvalidParentCategoryError,
    create_category,
    delete_category,
    get_categories,
    get_category_by_id,
    get_category_tree,
    update_category,
)
from app.services.storage_service import get_storage_provider, validate_image_file


router = APIRouter(
    prefix="/categories",
    tags=["Categories"],
)


@router.get(
    "",
    response_model=list[CategoryResponse],
)
def list_categories(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    cached = cache.get("categories:all")
    if cached is not None:
        return cached
    result = get_categories(db)
    serialized = [CategoryResponse.model_validate(c).model_dump(mode="json") for c in result]
    cache.set("categories:all", serialized, ttl_seconds=86400)
    return serialized


@router.get(
    "/tree",
    response_model=list[CategoryTreeResponse],
)
def list_category_tree(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    cached = cache.get("categories:tree")
    if cached is not None:
        return cached
    result = get_category_tree(db)
    serialized = [CategoryTreeResponse.model_validate(c).model_dump(mode="json") for c in result]
    cache.set("categories:tree", serialized, ttl_seconds=86400)
    return serialized


@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
)
def api_get_category_by_id(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_category(
    name: str = Form(...),
    description: str | None = Form(None),
    parent_category_id: str | None = Form(None),
    image_url: str | None = Form(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    category_data = CategoryCreate(
        name=name,
        description=description,
        parent_category_id=int(parent_category_id) if parent_category_id else None,
    )

    final_image_url = image_url
    storage_provider = None

    if image is not None and image.filename:
        file_bytes = await image.read()
        validate_image_file(image, file_bytes)
        storage_provider = get_storage_provider()
        final_image_url = storage_provider.upload_image(
            file_bytes=file_bytes,
            original_filename=image.filename,
            content_type=image.content_type or "image/jpeg",
        )

    try:
        created = create_category(
            db,
            category_data,
            image_url=final_image_url,
        )
        cache.delete("categories:all")
        cache.delete("categories:tree")
        return created
    except IntegrityError:
        db.rollback()
        if final_image_url and storage_provider:
            try:
                storage_provider.delete_image(final_image_url)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category already exists",
        )
    except InvalidParentCategoryError as exc:
        db.rollback()
        if final_image_url and storage_provider:
            try:
                storage_provider.delete_image(final_image_url)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.patch(
    "/{category_id}",
    response_model=CategoryResponse,
)
async def update_existing_category(
    category_id: int,
    name: str | None = Form(None),
    description: str | None = Form(None),
    # Sentinel convention: field absent entirely = leave unchanged; sent as
    # an empty string = explicitly clear to top-level; a digit string = set
    # that parent. Lets a standalone image-only upload omit this field
    # without accidentally clearing an existing parent.
    parent_category_id: str | None = Form(None),
    image_url: str | None = Form(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    category = get_category_by_id(
        db,
        category_id,
    )

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    update_dict = {}
    if name is not None:
        update_dict["name"] = name
    if description is not None:
        update_dict["description"] = description
    if parent_category_id is not None:
        update_dict["parent_category_id"] = int(parent_category_id) if parent_category_id else None

    category_data = CategoryUpdate(**update_dict)

    old_image_url = category.image_url
    final_image_url = image_url
    storage_provider = None

    if image is not None and image.filename:
        file_bytes = await image.read()
        validate_image_file(image, file_bytes)
        storage_provider = get_storage_provider()
        final_image_url = storage_provider.upload_image(
            file_bytes=file_bytes,
            original_filename=image.filename,
            content_type=image.content_type or "image/jpeg",
        )

    try:
        updated = update_category(
            db,
            category,
            category_data,
            image_url=final_image_url,
        )
        cache.delete("categories:all")
        cache.delete("categories:tree")

        if final_image_url and old_image_url and final_image_url != old_image_url and storage_provider:
            try:
                storage_provider.delete_image(old_image_url)
            except Exception:
                pass

        return updated

    except IntegrityError:
        db.rollback()
        if final_image_url and final_image_url != old_image_url and storage_provider:
            try:
                storage_provider.delete_image(final_image_url)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category already exists",
        )
    except InvalidParentCategoryError as exc:
        db.rollback()
        if final_image_url and final_image_url != old_image_url and storage_provider:
            try:
                storage_provider.delete_image(final_image_url)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_existing_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    ),
):
    category = get_category_by_id(
        db,
        category_id,
    )

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    try:
        delete_category(
            db,
            category,
        )
        cache.delete("categories:all")
        cache.delete("categories:tree")

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete category because products are associated with it",
        )

    return None
