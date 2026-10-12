from app.core.database import engine
from sqlalchemy import text

check_query = "SELECT COUNT(*) FROM faqs;"
insert_query = """
INSERT INTO faqs (question, answer, display_order, is_active)
VALUES
(
    'What''s in Hearth & One''s dog food?',
    'Human-grade, small-batch recipes made with real whole-food ingredients — real meat, vegetables, and healthy fats, with zero wheat, soy, corn byproducts, or synthetic fillers. Every recipe is formulated under veterinary supervision.',
    1,
    TRUE
),
(
    'Is the food fresh or frozen?',
    'Each batch is cooked once, then flash-frozen to lock in nutrition and freshness — it isn''t made fresh per individual order. Store it frozen and follow the thawing instructions on the pack before serving.',
    2,
    TRUE
),
(
    'Do you offer vet consultations?',
    'Yes — you can book video consultations with verified veterinarians directly through the app for diet planning and general pet health questions. These telehealth consultations are meant to supplement, not replace, in-person veterinary care, and aren''t appropriate for emergencies.',
    3,
    TRUE
),
(
    'How do I know how much to feed my dog?',
    'Use our Meal Planner tool — tell us your dog''s breed, weight, and activity level, and it generates a personalized feeding recommendation and diet plan.',
    4,
    TRUE
),
(
    'What payment methods do you accept?',
    'All major cards, UPI, and net banking through Razorpay''s secure checkout.',
    5,
    TRUE
),
(
    'What''s your order cancellation policy?',
    'Orders can be cancelled within 1 hour of placing them for a full refund. After that window, cancellation requests are reviewed case-by-case — contact support for help.',
    6,
    TRUE
),
(
    'Where do you ship?',
    'We ship across India with cold-chain handling to keep frozen meals properly preserved in transit. Check delivery availability for your pincode at checkout.',
    7,
    TRUE
);
"""

print("Checking faqs table content...")
with engine.connect() as conn:
    count = conn.execute(text(check_query)).scalar()
    if count == 0:
        print("FAQs table is empty. Inserting starter FAQs...")
        conn.execute(text(insert_query))
        conn.commit()
        print("Starter FAQs seeded successfully!")
    else:
        print(f"FAQs table already has {count} entries. Skipping seeding.")
