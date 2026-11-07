"""Starter vaccine rules (DRAFT -- vet_reviewed stays False until a platform vet signs each off).

Drawn from the WSAVA global vaccination guidelines, with rabies yearly as Indian clinics practise it.
(species, code, name, category, description, first_dose_weeks, series_doses, series_interval_weeks,
 booster_months, repeat_months)
"""

SEED_RULES = [
    ("dog", "dhppi", "DHPPi (distemper, hepatitis, parvo, parainfluenza)", "core",
     "Protects against the most serious puppy diseases. Usually given as a combined shot.", 6, 3, 3, 12, 36),
    ("dog", "rabies", "Rabies", "core",
     "Required by law in India and protects people too. Given yearly.", 12, 1, 0, 12, 12),
    ("dog", "leptospirosis", "Leptospirosis", "non_core",
     "Spread through rat urine and flood water; common in India. Two starter doses, then yearly.", 12, 2, 3, 12, 12),
    ("dog", "bordetella", "Kennel cough (Bordetella)", "non_core",
     "Worth having if your dog boards, goes to daycare or meets many dogs. Yearly.", 8, 1, 0, 12, 12),
    ("cat", "fvrcp", "FVRCP (panleukopenia, herpesvirus, calicivirus)", "core",
     "Protects against the main serious kitten illnesses. Usually one combined shot.", 8, 3, 4, 12, 36),
    ("cat", "rabies", "Rabies", "core",
     "Required by law in India and protects people too. Given yearly.", 12, 1, 0, 12, 12),
    ("cat", "felv", "Feline leukaemia (FeLV)", "non_core",
     "Recommended for kittens and for cats that go outdoors. Two starter doses, then yearly.", 8, 2, 4, 12, 12),
]
