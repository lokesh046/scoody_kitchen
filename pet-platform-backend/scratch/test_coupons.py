import socket
orig_getaddrinfo = socket.getaddrinfo
def forced_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if family in (socket.AF_UNSPEC, 0):
        family = socket.AF_INET
    return orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = forced_ipv4_getaddrinfo

from decimal import Decimal
from app.core.database import SessionLocal
from app.services.coupon_service import validate_coupon_code, get_all_coupons

def run_tests():
    db = SessionLocal()
    try:
        coupons = get_all_coupons(db)
        print(f"Total coupons in DB: {len(coupons)}")
        for c in coupons:
            print(f" - [{c.code}] {c.discount_type.value}: {c.discount_value} (Min Order: ₹{c.min_order_amount}, Max Cap: ₹{c.max_discount_amount})")

        # Test 1: Validate PUPPY10 (10% off, min order 499, max cap 200)
        # 1a. Order amount below 499 -> Should fail
        is_valid, coupon, disc, final_amt, msg = validate_coupon_code(db, "PUPPY10", Decimal("300.00"))
        print("\nTest 1a (PUPPY10 with ₹300 order):")
        print(f"  Valid: {is_valid}, Msg: {msg}")
        assert not is_valid, "Should be invalid due to min order"

        # 1b. Order amount ₹1000 -> 10% = ₹100 discount, final = ₹900
        is_valid, coupon, disc, final_amt, msg = validate_coupon_code(db, "PUPPY10", Decimal("1000.00"))
        print("\nTest 1b (PUPPY10 with ₹1000 order):")
        print(f"  Valid: {is_valid}, Discount: ₹{disc}, Final: ₹{final_amt}, Msg: {msg}")
        assert is_valid, "Should be valid"
        assert disc == Decimal("100.00"), f"Expected 100.00, got {disc}"
        assert final_amt == Decimal("900.00"), f"Expected 900.00, got {final_amt}"

        # 1c. Order amount ₹3000 -> 10% = ₹300, capped at ₹200 max discount -> final = ₹2800
        is_valid, coupon, disc, final_amt, msg = validate_coupon_code(db, "PUPPY10", Decimal("3000.00"))
        print("\nTest 1c (PUPPY10 with ₹3000 order - Cap test):")
        print(f"  Valid: {is_valid}, Discount: ₹{disc}, Final: ₹{final_amt}, Msg: {msg}")
        assert is_valid, "Should be valid"
        assert disc == Decimal("200.00"), f"Expected 200.00 cap, got {disc}"
        assert final_amt == Decimal("2800.00"), f"Expected 2800.00, got {final_amt}"

        # Test 2: Validate FIRSTFEAST (Flat ₹100 off, min order ₹599)
        # 2a. Order amount ₹800 -> Flat ₹100 discount -> final = ₹700
        is_valid, coupon, disc, final_amt, msg = validate_coupon_code(db, "FIRSTFEAST", Decimal("800.00"))
        print("\nTest 2a (FIRSTFEAST with ₹800 order):")
        print(f"  Valid: {is_valid}, Discount: ₹{disc}, Final: ₹{final_amt}, Msg: {msg}")
        assert is_valid, "Should be valid"
        assert disc == Decimal("100.00"), f"Expected 100.00, got {disc}"
        assert final_amt == Decimal("700.00"), f"Expected 700.00, got {final_amt}"

        print("\n All Coupon Verification Tests Passed Successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
