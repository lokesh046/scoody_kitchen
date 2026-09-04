import socket
orig_getaddrinfo = socket.getaddrinfo
def forced_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if family in (socket.AF_UNSPEC, 0):
        family = socket.AF_INET
    return orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = forced_ipv4_getaddrinfo

from sqlalchemy import text
from app.core.database import engine

def migrate():
    with engine.connect() as conn:
        print("Checking/creating coupon_discount_type ENUM...")
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_discount_type') THEN
                    CREATE TYPE coupon_discount_type AS ENUM ('PERCENTAGE', 'FLAT');
                END IF;
            END$$;
        """))
        conn.commit()

        print("Checking/creating 'coupons' table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS coupons (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                description VARCHAR(255),
                discount_type coupon_discount_type NOT NULL DEFAULT 'PERCENTAGE',
                discount_value NUMERIC(10, 2) NOT NULL,
                min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                max_discount_amount NUMERIC(10, 2),
                valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                valid_until TIMESTAMP WITH TIME ZONE,
                usage_limit INTEGER,
                used_count INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS ix_coupons_code ON coupons(code);
            CREATE INDEX IF NOT EXISTS ix_coupons_is_active ON coupons(is_active);
        """))
        conn.commit()

        print("Checking/adding 'coupon_code' and 'discount_amount' to 'orders' table...")
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'orders' AND column_name = 'coupon_code'
                ) THEN
                    ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'orders' AND column_name = 'discount_amount'
                ) THEN
                    ALTER TABLE orders ADD COLUMN discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
                END IF;
            END$$;
        """))
        conn.commit()

        print("Seeding starter coupons if table is empty...")
        count = conn.execute(text("SELECT COUNT(*) FROM coupons")).scalar()
        if count == 0:
            conn.execute(text("""
                INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, is_active)
                VALUES 
                ('PUPPY10', '10% off on all fresh food orders above ₹499', 'PERCENTAGE', 10.00, 499.00, 200.00, TRUE),
                ('FIRSTFEAST', 'Flat ₹100 off on your first fresh meal bowl', 'FLAT', 100.00, 599.00, NULL, TRUE);
            """))
            conn.commit()
            print("Successfully seeded PUPPY10 and FIRSTFEAST coupons.")

        print("Coupon migration completed successfully!")

if __name__ == "__main__":
    migrate()
