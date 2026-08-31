import pytest
from decimal import Decimal
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models.enums import UserRole, ConsultationStatus
from app.models.user import User
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.pet import Pet
from app.models.consultation import Consultation
from app.models.doctor_review import DoctorReview
from app.models.product import Product
from app.models.product_review import ProductReview
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.dependencies.auth import get_current_user
from app.core.database import SessionLocal

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_reviews_system_lifecycle(db_session):
    # 1. Setup mock records
    # Unique emails
    cust_email = "reviewcustomer@example.com"
    doc_email = "reviewdoctor@example.com"

    # Clean up test users and their related test data if left over from previous runs
    for email in [cust_email, doc_email, "adminreview@example.com"]:
        u = db_session.scalar(select(User).where(User.email == email))
        if u:
            user_orders = db_session.scalars(select(Order).where(Order.user_id == u.id)).all()
            for o in user_orders:
                db_session.execute(OrderItem.__table__.delete().where(OrderItem.order_id == o.id))
                db_session.delete(o)
            user_consultations = db_session.scalars(select(Consultation).where(Consultation.customer_id == u.id)).all()
            for c in user_consultations:
                db_session.execute(DoctorReview.__table__.delete().where(DoctorReview.consultation_id == c.id))
                db_session.delete(c)
            user_pets = db_session.scalars(select(Pet).where(Pet.user_id == u.id)).all()
            for p in user_pets:
                db_session.delete(p)
            doc = db_session.scalar(select(Doctor).where(Doctor.user_id == u.id))
            if doc:
                db_session.execute(DoctorReview.__table__.delete().where(DoctorReview.doctor_id == doc.id))
                db_session.delete(doc)
            db_session.delete(u)
    prod = db_session.scalar(select(Product).where(Product.sku == "SKU-CHICKEN-MEAL"))
    if prod:
        db_session.execute(ProductReview.__table__.delete().where(ProductReview.product_id == prod.id))
        db_session.delete(prod)
    cl = db_session.scalar(select(Clinic).where(Clinic.name == "Review Clinic"))
    if cl:
        db_session.delete(cl)
    db_session.commit()

    # Create users
    customer = User(
        email=cust_email,
        first_name="John",
        last_name="Doe",
        phone="+919999999991",
        role=UserRole.CUSTOMER,
        is_email_verified=True,
        is_active=True,
    )
    doc_user = User(
        email=doc_email,
        first_name="Dr. Jane",
        last_name="Smith",
        phone="+919999999992",
        role=UserRole.DOCTOR,
        is_email_verified=True,
        is_active=True,
    )
    db_session.add_all([customer, doc_user])
    db_session.commit()
    db_session.refresh(customer)
    db_session.refresh(doc_user)

    # Create Clinic & Doctor
    clinic = Clinic(
        name="Review Clinic",
        address="123 Vet Street",
        city="Mumbai",
        state="Maharashtra",
        postal_code="400001",
        phone="+912211111111",
        is_active=True,
    )
    db_session.add(clinic)
    db_session.commit()
    db_session.refresh(clinic)

    doctor = Doctor(
        user_id=doc_user.id,
        clinic_id=clinic.id,
        specialization="General Vet",
        qualification="B.V.Sc",
        experience_years=5,
        consultation_fee=Decimal("500.00"),
        license_number="LIC-REV-101",
        is_available=True,
        is_verified=True,
        is_active=True,
    )
    db_session.add(doctor)
    db_session.commit()
    db_session.refresh(doctor)

    # Create Pet
    pet = Pet(
        user_id=customer.id,
        name="Bruno",
        species="dog",
        breed="Labrador",
        weight=25.0,
    )
    db_session.add(pet)
    db_session.commit()
    db_session.refresh(pet)

    # Create Consultation (PENDING)
    consultation = Consultation(
        customer_id=customer.id,
        pet_id=pet.id,
        doctor_id=doctor.id,
        scheduled_at=datetime.now(timezone.utc),
        duration_minutes=30,
        status=ConsultationStatus.PENDING,
        reason="Checkup",
    )
    db_session.add(consultation)
    db_session.commit()
    db_session.refresh(consultation)

    # Create Product
    # Note: Product table name is 'product' (singular), model is Product
    product = Product(
        category_id=1,  # Assuming category ID 1 exists, or just any int for constraints
        name="Scooby Fresh Chicken Meal",
        sku="SKU-CHICKEN-MEAL",
        price=Decimal("499.00"),
        is_active=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    try:
        # ==================================================
        # PART 1: TEST DOCTOR REVIEWS & GATING
        # ==================================================
        
        # Override current user to customer
        app.dependency_overrides[get_current_user] = lambda: customer

        # Test: Can't review a PENDING consultation
        res_review_pending = client.post(
            f"/reviews/consultations/{consultation.id}",
            json={"rating": 5, "comment": "Great vet!"},
        )
        assert res_review_pending.status_code == 400
        assert "only review completed" in res_review_pending.json()["detail"].lower()

        # Update consultation to COMPLETED
        consultation.status = ConsultationStatus.COMPLETED
        db_session.commit()

        # Test: Success review COMPLETED consultation
        res_review_ok = client.post(
            f"/reviews/consultations/{consultation.id}",
            json={"rating": 5, "comment": "Amazing session, Dr. Jane was wonderful!"},
        )
        assert res_review_ok.status_code == 201
        review_data = res_review_ok.json()
        assert review_data["rating"] == 5
        assert review_data["comment"] == "Amazing session, Dr. Jane was wonderful!"
        assert review_data["doctor_id"] == doctor.id

        # Test: Duplicate review blocked
        res_review_dup = client.post(
            f"/reviews/consultations/{consultation.id}",
            json={"rating": 4, "comment": "Another comment"},
        )
        assert res_review_dup.status_code == 400
        assert "already been reviewed" in res_review_dup.json()["detail"].lower()

        # Test: Get doctor reviews list
        res_doc_reviews = client.get(f"/reviews/doctors/{doctor.id}")
        assert res_doc_reviews.status_code == 200
        reviews_page = res_doc_reviews.json()
        assert reviews_page["total_items"] == 1
        assert reviews_page["items"][0]["comment"] == "Amazing session, Dr. Jane was wonderful!"

        # Test: Gating - Try to review with unauthorized user
        unauthorized_user = User(
            email="unauth@example.com",
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        app.dependency_overrides[get_current_user] = lambda: unauthorized_user
        res_unauth = client.post(
            f"/reviews/consultations/{consultation.id}",
            json={"rating": 4, "comment": "Nice"},
        )
        assert res_unauth.status_code == 403

        # ==================================================
        # PART 2: TEST PRODUCT REVIEWS & VERIFIED BUYER TAG
        # ==================================================
        
        # Reset user back to customer
        app.dependency_overrides[get_current_user] = lambda: customer

        # Test: Post product review (Without buying it first) -> should fail with 403
        res_prod_rev_unverified = client.post(
            f"/reviews/products/{product.id}",
            data={"rating": 4, "comment": "Good food!"},
        )
        assert res_prod_rev_unverified.status_code == 403

        # Create a completed order for this product
        order = Order(
            user_id=customer.id,
            total_amount=Decimal("499.00"),
            status=OrderStatus.CONFIRMED,
            shipping_address="123 Dog Street, Mumbai",
        )
        db_session.add(order)
        db_session.commit()
        db_session.refresh(order)

        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=1,
            unit_price=Decimal("499.00"),
            subtotal=Decimal("499.00"),
        )
        db_session.add(order_item)
        db_session.commit()

        # Test: Post a new review after buying -> should be marked verified buyer
        # We need to delete the old product review first (or just check the list query verified buyer lookup)
        db_session.execute(ProductReview.__table__.delete())
        db_session.commit()

        res_prod_rev_verified = client.post(
            f"/reviews/products/{product.id}",
            data={"rating": 5, "comment": "Dog loves it. Highly recommend!"},
        )
        assert res_prod_rev_verified.status_code == 201
        assert res_prod_rev_verified.json()["is_verified_buyer"] is True

        # Test: Get product reviews list -> verifies bulk query optimization
        res_prod_list = client.get(f"/reviews/products/{product.id}")
        assert res_prod_list.status_code == 200
        prod_list_data = res_prod_list.json()
        assert prod_list_data["total_items"] == 1
        assert prod_list_data["items"][0]["is_verified_buyer"] is True
        # Test: Get eligibility (Should be False / already_reviewed now since they have 1 purchase and 1 review)
        res_elig_1 = client.get(f"/reviews/products/{product.id}/eligibility")
        assert res_elig_1.status_code == 200
        elig_1_data = res_elig_1.json()
        assert elig_1_data["eligible"] is False
        assert elig_1_data["reason"] == "already_reviewed"

        # Create another completed order for this product (N=2, M=1) -> should become eligible again!
        order_2 = Order(
            user_id=customer.id,
            total_amount=Decimal("499.00"),
            status=OrderStatus.PROCESSING,
            shipping_address="123 Dog Street, Mumbai",
        )
        db_session.add(order_2)
        db_session.commit()
        db_session.refresh(order_2)

        order_item_2 = OrderItem(
            order_id=order_2.id,
            product_id=product.id,
            quantity=1,
            unit_price=Decimal("499.00"),
            subtotal=Decimal("499.00"),
        )
        db_session.add(order_item_2)
        db_session.commit()

        # Test: Check eligibility again -> should be True (N=2, M=1)
        res_elig_2 = client.get(f"/reviews/products/{product.id}/eligibility")
        assert res_elig_2.status_code == 200
        elig_2_data = res_elig_2.json()
        assert elig_2_data["eligible"] is True
        assert elig_2_data["reason"] == "eligible"

        # Cleanup extra order so original cleanup succeeds cleanly
        db_session.delete(order_item_2)
        db_session.delete(order_2)
        db_session.commit()

        # ==================================================
        # PART 3: TEST ADMIN DELETION OF REVIEWS
        # ==================================================
        
        # Test: Non-admin deletion fails (403)
        app.dependency_overrides[get_current_user] = lambda: customer
        res_del_cust = client.delete(f"/reviews/products/{res_prod_rev_verified.json()['id']}")
        assert res_del_cust.status_code == 403

        # Create admin user
        admin_user = User(
            email="adminreview@example.com",
            first_name="Admin",
            last_name="Owner",
            phone="+919999999993",
            role=UserRole.ADMIN,
            is_email_verified=True,
            is_active=True,
        )
        db_session.add(admin_user)
        db_session.commit()
        db_session.refresh(admin_user)

        # Test: Admin deletion of product review succeeds (204)
        app.dependency_overrides[get_current_user] = lambda: admin_user
        res_del_prod_ok = client.delete(f"/reviews/products/{res_prod_rev_verified.json()['id']}")
        assert res_del_prod_ok.status_code == 204

        # Test: Admin deletion of doctor review succeeds (204)
        res_del_doc_ok = client.delete(f"/reviews/doctors/{res_review_ok.json()['id']}")
        assert res_del_doc_ok.status_code == 204

        # Cleanup admin
        db_session.delete(admin_user)
        db_session.commit()

    finally:
        app.dependency_overrides.clear()
        
        try:
            db_session.rollback()
            for email in [cust_email, doc_email, "adminreview@example.com"]:
                u = db_session.scalar(select(User).where(User.email == email))
                if u:
                    user_orders = db_session.scalars(select(Order).where(Order.user_id == u.id)).all()
                    for o in user_orders:
                        db_session.execute(OrderItem.__table__.delete().where(OrderItem.order_id == o.id))
                        db_session.delete(o)
                    user_consultations = db_session.scalars(select(Consultation).where(Consultation.customer_id == u.id)).all()
                    for c in user_consultations:
                        db_session.execute(DoctorReview.__table__.delete().where(DoctorReview.consultation_id == c.id))
                        db_session.delete(c)
                    user_pets = db_session.scalars(select(Pet).where(Pet.user_id == u.id)).all()
                    for p in user_pets:
                        db_session.delete(p)
                    doc = db_session.scalar(select(Doctor).where(Doctor.user_id == u.id))
                    if doc:
                        db_session.execute(DoctorReview.__table__.delete().where(DoctorReview.doctor_id == doc.id))
                        db_session.delete(doc)
                    db_session.delete(u)
            prod = db_session.scalar(select(Product).where(Product.sku == "SKU-CHICKEN-MEAL"))
            if prod:
                db_session.execute(ProductReview.__table__.delete().where(ProductReview.product_id == prod.id))
                db_session.delete(prod)
            cl = db_session.scalar(select(Clinic).where(Clinic.name == "Review Clinic"))
            if cl:
                db_session.delete(cl)
            db_session.commit()
        except Exception:
            db_session.rollback()

