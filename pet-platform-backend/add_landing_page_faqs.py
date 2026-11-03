"""Adds the reviewed landing-page FAQs (Shop, Know Your Pet, Locate Your Vet) to this database.

Safe to run more than once: a question that already exists on a page is skipped.
Dry run by default; nothing is written unless you pass --apply.

Run inside the backend container (no secrets needed, it uses the app's own connection):
  docker exec -i pet_platform_backend python - --apply < add_landing_page_faqs.py

Source: the 20 FAQs on beta, with the wording changed where it made claims we cannot back up
(Shop #1 said "human-grade" and "no corn, wheat, soy or rendering byproducts"; Shop #2 promised
ingredient percentages on every recipe; Shop #4 simplified).
"""
import sys

from app.core.database import SessionLocal
from app.models.faq import FAQ

FAQS = {
    "shop": [
        ("What makes these recipes different?",
         "Our recipes are made in small batches, and each recipe lists its ingredients so you can see exactly what is in the bowl."),
        ("How do I know what is actually in a recipe?",
         "Open any recipe and you will find its ingredients listed, along with the description and the weight options available."),
        ("Do recipes come in different sizes?",
         "Where a recipe offers more than one weight, each size carries its own price and its own stock, so you can choose the one that suits your pet and your routine."),
        ("Are the ratings from real customers?",
         "Yes. Only customers who have purchased a recipe can review it, so the ratings and reviews shown come from real pet parents."),
        ("Can Shop Recipes replace advice from my vet?",
         "No. The catalogue helps you understand what is in the food you are buying. It does not replace advice, diagnosis, or treatment from a qualified veterinarian."),
    ],
    "pets": [
        ("What is Know Your Pet?",
         "Know Your Pet helps you create a profile for your pet and explore information about their characteristics and needs."),
        ("What information can I add to a pet profile?",
         "You can add the details supported by the app, such as your pet's name, species, breed, age, and other relevant information."),
        ("Can I create profiles for multiple pets?",
         "Yes — Know Your Pet supports multiple pet profiles, so you can keep every companion's details in one place."),
        ("Can I update my pet's information later?",
         "Yes — you can update your pet's profile at any time as new details come up."),
        ("Does Know Your Pet replace veterinary advice?",
         "No. Know Your Pet is intended to help you organise information and learn about your pet. It does not replace advice, diagnosis, or treatment from a qualified veterinarian."),
    ],
    "vet": [
        ("What is Locate Your Vet?",
         "Locate Your Vet helps pet parents discover veterinary clinics in their area. It is designed to make finding relevant clinic information and taking the next step towards veterinary care easier."),
        ("How can I find a veterinary clinic near me?",
         "Enter your city, area, or PIN code in the search field to explore available clinic listings. If location detection is supported, you may also be able to use your current location."),
        ("Can I search using my current location?",
         "Yes, if the app supports GPS-based search. You can allow location access when prompted to find clinics around you. Alternatively, use manual location search if available."),
        ("What information can I see about a veterinary clinic?",
         "Depending on the information available in each listing, you may be able to view details such as the clinic's address, contact information, services, and opening hours."),
        ("Can I contact a clinic directly through Locate Your Vet?",
         "You can use the contact details provided in a clinic's listing to get in touch, where available. Confirm the clinic's contact information and availability before visiting."),
        ("Can I book a veterinary appointment through the platform?",
         "Appointment booking depends on the features currently supported by Locate Your Vet. If online booking is unavailable, you may need to contact the clinic directly to arrange a visit."),
        ("Can I find a clinic that offers a specific service?",
         "That depends on the search and filtering options available in the platform and the information provided by each clinic. If service filters are not available, contact clinics directly to confirm whether they offer the care your pet needs."),
        ("How do I know whether a clinic is open?",
         "If opening hours are included in a clinic's listing, check them before visiting. We recommend contacting the clinic to confirm its current availability, especially on holidays or outside regular hours."),
        ("Can Locate Your Vet help me find emergency veterinary care?",
         "Locate Your Vet may help you identify clinics in your area, but you should confirm directly whether a clinic provides emergency services and is available to treat your pet. If your pet needs urgent attention, contact a veterinary clinic or local emergency veterinary service immediately."),
        ("Does Locate Your Vet replace advice from a veterinarian?",
         "No. Locate Your Vet helps you find veterinary clinics; it does not replace a professional examination, diagnosis, or treatment plan. Always consult a qualified veterinarian about your pet’s health concerns."),
    ],
}

apply = "--apply" in sys.argv
db = SessionLocal()
added = skipped = 0
try:
    for page, items in FAQS.items():
        existing = {q for (q,) in db.query(FAQ.question).filter(FAQ.page == page).all()}
        print(f"[{page}] already has {len(existing)} question(s)")
        for order, (question, answer) in enumerate(items, start=1):
            if question in existing:
                skipped += 1
                print(f"   skip (exists): {question}")
                continue
            added += 1
            print(f"   {'add' if apply else 'would add'}: {question}")
            if apply:
                db.add(FAQ(page=page, question=question, answer=answer, display_order=order, is_active=True))
    if apply:
        db.commit()
        # The public FAQ lists are cached per page for 24 hours (app/api/faq.py). Admin edits clear
        # that cache; a direct insert does not, so clear it here or the pages keep showing the old list.
        from app.core.cache import cache
        cache.clear_prefix("faqs:active")
        print("cleared the FAQ cache")
    else:
        db.rollback()
    print(f"\n{'APPLIED' if apply else 'DRY RUN (nothing written)'}: {added} to add, {skipped} skipped")
finally:
    db.close()
