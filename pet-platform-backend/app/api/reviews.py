from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, Form, File, UploadFile
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func

from app.core.cache import cache
from app.core.database import get_db
from app.core.limiter import limiter
from app.dependencies.auth import require_roles, get_current_user
from app.models.enums import UserRole, ConsultationStatus
from app.models.user import User
from app.models.consultation import Consultation
from app.models.doctor_review import DoctorReview
from app.models.product import Product
from app.models.product_review import ProductReview
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.services.storage_service import get_storage_provider, validate_image_file
from app.core.pagination import paginate_query
from app.schemas.reviews import (
    DoctorReviewCreate,
    DoctorReviewResponse,
    PaginatedDoctorReviewResponse,
    ProductReviewResponse,
    PaginatedProductReviewResponse,
)

router = APIRouter(
    prefix="/reviews",
    tags=["Reviews & Feedback"],
)

VALID_PURCHASE_STATUSES = [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.PACKED,
    OrderStatus.SHIPPED,
    OrderStatus.IN_TRANSIT,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
]


@router.post(
    "/consultations/{consultation_id}",
    response_model=DoctorReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
def create_doctor_review(
    request: Request,
    consultation_id: int,
    review_data: DoctorReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Fetch consultation
    consultation = db.get(Consultation, consultation_id)
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation not found",
        )

    # 2. Check ownership
    if consultation.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to review this consultation",
        )

    # 3. Check status is COMPLETED
    if consultation.status != ConsultationStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only review completed consultations",
        )

    # 4. Check duplicate review
    existing_review = db.scalar(
        select(DoctorReview).where(DoctorReview.consultation_id == consultation_id)
    )
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This consultation has already been reviewed",
        )

    # 5. Create review
    review = DoctorReview(
        consultation_id=consultation_id,
        doctor_id=consultation.doctor_id,
        customer_id=current_user.id,
        rating=review_data.rating,
        comment=review_data.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    cache.clear_prefix(f"reviews:doctor:{consultation.doctor_id}:")
    cache.clear_prefix("reviews:recent:")
    return review


@router.get(
    "/doctors/{doctor_id}",
    response_model=PaginatedDoctorReviewResponse,
)
def get_doctor_reviews(
    doctor_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    cache_key = f"reviews:doctor:{doctor_id}:{page}_{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    query = (
        select(DoctorReview)
        .options(joinedload(DoctorReview.customer))
        .where(DoctorReview.doctor_id == doctor_id)
        .order_by(DoctorReview.created_at.desc())
    )
    result = paginate_query(db, query, page=page, limit=limit)
    serialized_items = [
        DoctorReviewResponse.model_validate(item).model_dump(mode="json")
        for item in result.get("items", [])
    ]
    cached_data = {**result, "items": serialized_items}
    cache.set(cache_key, cached_data, ttl_seconds=300)
    return cached_data


@router.post(
    "/products/{product_id}",
    response_model=ProductReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def create_product_review(
    request: Request,
    product_id: int,
    rating: int = Form(..., ge=1, le=5),
    comment: str | None = Form(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Verify product exists
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    # 2. Check eligibility (must have purchased and not reviewed it more times than purchased)
    purchase_count = db.scalar(
        select(func.count(Order.id))
        .join(OrderItem)
        .where(
            Order.user_id == current_user.id,
            OrderItem.product_id == product_id,
            Order.status.in_(VALID_PURCHASE_STATUSES),
        )
    ) or 0

    review_count = db.scalar(
        select(func.count(ProductReview.id))
        .where(
            ProductReview.user_id == current_user.id,
            ProductReview.product_id == product_id,
        )
    ) or 0

    if purchase_count <= review_count:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not eligible to review this product. Only verified buyers can submit reviews.",
        )

    # 3. Upload image if provided
    image_url = None
    if image:
        provider = get_storage_provider()
        file_bytes = await image.read()
        validate_image_file(image, file_bytes)
        image_url = provider.upload_image(
            file_bytes,
            image.filename or "review.jpg",
            image.content_type or "image/jpeg",
        )

    # 4. Create review
    review = ProductReview(
        product_id=product_id,
        user_id=current_user.id,
        rating=rating,
        comment=comment,
        image_url=image_url,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # 5. Check if verified buyer
    is_verified = db.scalar(
        select(Order)
        .join(OrderItem)
        .where(
            Order.user_id == current_user.id,
            OrderItem.product_id == product_id,
            Order.status.in_(VALID_PURCHASE_STATUSES),
        )
    ) is not None

    response = ProductReviewResponse.model_validate(review)
    response.is_verified_buyer = is_verified
    cache.clear_prefix(f"reviews:product:{product_id}:")
    cache.clear_prefix("reviews:recent:")
    return response


@router.get(
    "/products/{product_id}",
    response_model=PaginatedProductReviewResponse,
)
def get_product_reviews(
    product_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    cache_key = f"reviews:product:{product_id}:{page}_{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    query = (
        select(ProductReview)
        .options(joinedload(ProductReview.user))
        .where(ProductReview.product_id == product_id)
        .order_by(ProductReview.created_at.desc())
    )
    paginated_data = paginate_query(db, query, page=page, limit=limit)
    reviews_list = paginated_data.get("items", [])

    if not reviews_list:
        cache.set(cache_key, paginated_data, ttl_seconds=300)
        return paginated_data

    # Perform bulk lookup for verified buyers to avoid N+1 queries
    user_ids = [r.user_id for r in reviews_list]
    verified_user_ids = set(
        db.scalars(
            select(Order.user_id)
            .join(OrderItem)
            .where(
                Order.user_id.in_(user_ids),
                OrderItem.product_id == product_id,
                Order.status.in_(VALID_PURCHASE_STATUSES),
            )
        ).all()
    )

    # Map verified status to items
    items_response = []
    for r in reviews_list:
        resp = ProductReviewResponse.model_validate(r)
        resp.is_verified_buyer = r.user_id in verified_user_ids
        items_response.append(resp.model_dump(mode="json"))

    paginated_data["items"] = items_response
    cache.set(cache_key, paginated_data, ttl_seconds=300)
    return paginated_data


@router.get(
    "/products/{product_id}/eligibility",
    response_model=dict,
)
def check_product_review_eligibility(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Count completed/delivered orders for this product
    purchase_count = db.scalar(
        select(func.count(Order.id))
        .join(OrderItem)
        .where(
            Order.user_id == current_user.id,
            OrderItem.product_id == product_id,
            Order.status.in_(VALID_PURCHASE_STATUSES),
        )
    ) or 0

    # 2. Count reviews written by this user for this product
    review_count = db.scalar(
        select(func.count(ProductReview.id))
        .where(
            ProductReview.user_id == current_user.id,
            ProductReview.product_id == product_id,
        )
    ) or 0

    eligible = purchase_count > review_count
    
    reason = "eligible"
    if purchase_count == 0:
        reason = "no_purchase"
    elif purchase_count <= review_count:
        reason = "already_reviewed"

    return {
        "eligible": eligible,
        "purchase_count": purchase_count,
        "review_count": review_count,
        "reason": reason,
    }


@router.get(
    "/recent",
    response_model=dict,
)
def get_recent_reviews(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    cache_key = f"reviews:recent:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    from app.models.doctor import Doctor
    # 1. Fetch recent product reviews
    product_reviews = db.scalars(
        select(ProductReview)
        .options(joinedload(ProductReview.user), joinedload(ProductReview.product))
        .order_by(ProductReview.created_at.desc())
        .limit(limit)
    ).all()

    # 2. Fetch recent doctor reviews
    doctor_reviews = db.scalars(
        select(DoctorReview)
        .options(
            joinedload(DoctorReview.customer),
            joinedload(DoctorReview.doctor).joinedload(Doctor.user)
        )
        .order_by(DoctorReview.created_at.desc())
        .limit(limit)
    ).all()

    # 3. Format into a unified response
    unified = []
    for r in product_reviews:
        p_author = "Anonymous"
        if r.user:
            u_first = r.user.first_name or ""
            u_last = r.user.last_name or ""
            p_author = f"{u_first} {u_last}".strip() or "Anonymous"
        unified.append({
            "id": r.id,
            "type": "product",
            "rating": r.rating,
            "comment": r.comment,
            "image_url": r.image_url,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "author_name": p_author,
            "reviewed_item_name": r.product.name if r.product else "Unknown Product",
            "reviewed_item_id": r.product_id,
            "is_verified_buyer": True,
        })
    for r in doctor_reviews:
        doc_name = "Unknown Doctor"
        if r.doctor and r.doctor.user:
            d_first = r.doctor.user.first_name or ""
            d_last = r.doctor.user.last_name or ""
            doc_name = f"Dr. {d_first} {d_last}".strip() or "Doctor"
        c_author = "Anonymous"
        if r.customer:
            c_first = r.customer.first_name or ""
            c_last = r.customer.last_name or ""
            c_author = f"{c_first} {c_last}".strip() or "Anonymous"
        unified.append({
            "id": r.id,
            "type": "doctor",
            "rating": r.rating,
            "comment": r.comment,
            "image_url": r.doctor.profile_image_url if r.doctor else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "author_name": c_author,
            "reviewed_item_name": doc_name,
            "reviewed_item_id": r.doctor_id,
            "is_verified_buyer": True,
        })

    # Sort unified list by created_at desc
    unified.sort(key=lambda x: x["created_at"] or "", reverse=True)
    result = {"reviews": unified[:limit]}
    cache.set(cache_key, result, ttl_seconds=300)
    return result


@router.delete(
    "/products/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_product_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    review = db.get(ProductReview, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product review not found",
        )
    p_id = review.product_id
    db.delete(review)
    db.commit()
    cache.clear_prefix(f"reviews:product:{p_id}:")
    cache.clear_prefix("reviews:recent:")
    return None


@router.delete(
    "/doctors/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_doctor_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    review = db.get(DoctorReview, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor review not found",
        )
    d_id = review.doctor_id
    db.delete(review)
    db.commit()
    cache.clear_prefix(f"reviews:doctor:{d_id}:")
    cache.clear_prefix("reviews:recent:")
    return None
