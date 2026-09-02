from typing import Dict, Any
from app.schemas import CareInsights

DOG_BREED_METADATA: Dict[str, Dict[str, Any]] = {
    "golden_retriever": {
        "display_name": "Golden Retriever",
        "size": "Large (25 - 34 kg)",
        "temperament": "Gentle, intelligent, affectionate, playful",
        "nutrition": "High-quality lean protein, glucosamine & chondroitin for hip & joint resilience",
        "recipe": "Slow-Simmered Chicken & Pumpkin Joint Shield Bowl",
        "health": ["Hip & elbow dysplasia", "Heart health", "Skin sensitivity"],
    },
    "labrador_retriever": {
        "display_name": "Labrador Retriever",
        "size": "Large (25 - 36 kg)",
        "temperament": "Outgoing, even-tempered, athletic, friendly",
        "nutrition": "Controlled-calorie formula with high fiber to maintain optimal weight and vitality",
        "recipe": "Lean Country Beef & Garden Greens Vitality Bowl",
        "health": ["Weight management", "Joint flexibility", "Eye health"],
    },
    "german_shepherd": {
        "display_name": "German Shepherd",
        "size": "Large (30 - 40 kg)",
        "temperament": "Loyal, courageous, confident, highly trainable",
        "nutrition": "Digestive-friendly protein blend with prebiotic fibers for gastrointestinal support",
        "recipe": "Grass-Fed Mutton & Sweet Potato Active Feast",
        "health": ["Digestive sensitivity", "Hip dysplasia", "Spinal health"],
    },
    "french_bulldog": {
        "display_name": "French Bulldog",
        "size": "Small (9 - 13 kg)",
        "temperament": "Playful, adaptable, affectionate, lively",
        "nutrition": "Hypoallergenic, easy-to-digest recipes preventing flatulence and skin inflammation",
        "recipe": "Tender Turkey & Carrot Sensitive Digest Bowl",
        "health": ["Brachycephalic respiratory care", "Allergies", "Spinal disc care"],
    },
    "beagle": {
        "display_name": "Beagle",
        "size": "Medium (9 - 14 kg)",
        "temperament": "Amiable, curious, determined, energetic",
        "nutrition": "Satiety-boosting, lean nutrient density to prevent obesity from hearty appetites",
        "recipe": "Harvest Turkey & Quinoa Trim & Lean Bowl",
        "health": ["Obesity prevention", "Ear canal health", "Thyroid function"],
    },
    "poodle": {
        "display_name": "Poodle",
        "size": "Medium / Standard (15 - 28 kg)",
        "temperament": "Alert, intelligent, active, elegant",
        "nutrition": "Omega-rich fatty acids and biotin to nourish curly coats and support cognitive sharpness",
        "recipe": "Omega Wild Salmon & Organic Spinach Coat Glow",
        "health": ["Luxating patella", "Coat nourishment", "Dental hygiene"],
    },
    "pug": {
        "display_name": "Pug",
        "size": "Toy / Small (6 - 8 kg)",
        "temperament": "Charming, mischievous, loving, dociled",
        "nutrition": "Portion-controlled, antioxidant-rich meals supporting steady breathing and energy",
        "recipe": "Steamed Chicken & Carrot Small-Bite Medley",
        "health": ["Breathing airways", "Weight management", "Wrinkle skin fold care"],
    },
    "shih_tzu": {
        "display_name": "Shih Tzu",
        "size": "Toy (4 - 7.5 kg)",
        "temperament": "Playful, affectionate, outgoing, happy",
        "nutrition": "Zinc and essential fatty acids to maintain lustrous long coats and sensitive tummies",
        "recipe": "Delicate Chicken & Golden Pumpkin Puree",
        "health": ["Eye health", "Skin dryness", "Dental care"],
    },
    "rottweiler": {
        "display_name": "Rottweiler",
        "size": "Giant (40 - 55 kg)",
        "temperament": "Steadfast, confident, devoted, good-natured",
        "nutrition": "L-carnitine and taurine for cardiac muscle strength and robust bone density",
        "recipe": "Hearty Beef & Flaxseed Power Feast",
        "health": ["Cardiovascular health", "Joint cartilage", "Bone growth"],
    },
    "siberian_husky": {
        "display_name": "Siberian Husky",
        "size": "Medium / Large (20 - 27 kg)",
        "temperament": "Outgoing, loyal, mischievous, high-stamina",
        "nutrition": "Calorie-dense athletic formula rich in animal lipids for endurance and double coat insulation",
        "recipe": "Arctic Salmon & Sweet Potato High-Energy Bowl",
        "health": ["Hip soundness", "Eye health (cataracts)", "Skin zinc deficiency"],
    },
    "indie_pariah": {
        "display_name": "Indian Pariah / Indie",
        "size": "Medium (15 - 25 kg)",
        "temperament": "Hardy, highly intuitive, loyal, adaptable",
        "nutrition": "Naturally balanced ancestral proteins with anti-inflammatory turmeric and coconut oil",
        "recipe": "Scooby Heritage Chicken, Rice & Golden Turmeric Stew",
        "health": ["Robust immunity", "Natural resilience", "Tick prevention support"],
    },
    "cocker_spaniel": {
        "display_name": "Cocker Spaniel",
        "size": "Medium (12 - 16 kg)",
        "temperament": "Gentle, affectionate, lively, playful",
        "nutrition": "Vitamins A & E with Omega-6 for glossy ears, bright eyes, and supple skin",
        "recipe": "Fresh Salmon & Sweet Pea Vitality Medley",
        "health": ["Ear infections", "Heart health", "Eye soundness"],
    },
    "doberman_pinscher": {
        "display_name": "Doberman Pinscher",
        "size": "Large (32 - 45 kg)",
        "temperament": "Fearless, alert, loyal, energetic",
        "nutrition": "High bioavailability protein and taurine for athletic musculature and cardiac stamina",
        "recipe": "Prime Beef & Pumpkin Athletic Performance Bowl",
        "health": ["Dilated cardiomyopathy", "Cervical spine care", "Bloat prevention"],
    },
    "chihuahua": {
        "display_name": "Chihuahua",
        "size": "Toy (1.5 - 3 kg)",
        "temperament": "Graceful, quick-witted, devoted, sassy",
        "nutrition": "Micro-portioned, nutrient-dense fresh bites preventing hypoglycemia and supporting heart",
        "recipe": "Tender Turkey & Pumpkin Petite Nourish",
        "health": ["Hypoglycemia guard", "Dental health", "Patellar luxation"],
    },
    "pomeranian": {
        "display_name": "Pomeranian",
        "size": "Toy (2 - 3.5 kg)",
        "temperament": "Inquisitive, lively, bold, affectionate",
        "nutrition": "Skin-barrier fortifying EPA/DHA to maintain a dense, fluffy double coat",
        "recipe": "Fluffy Coat Salmon & Free-Range Chicken Cup",
        "health": ["Tracheal collapse prevention", "Coat alopecia", "Dental care"],
    },
}

CAT_BREED_METADATA: Dict[str, Dict[str, Any]] = {
    "persian": {
        "display_name": "Persian Cat",
        "size": "Medium (3.5 - 5.5 kg)",
        "temperament": "Quiet, gentle, sweet, calm",
        "nutrition": "Hairball control fiber blend and hydration-rich fresh meals to protect delicate kidneys",
        "recipe": "Gently Shredded Chicken & Bone Broth Hydration Bowl",
        "health": ["Polycystic kidney disease", "Brachycephalic airways", "Hairball management"],
    },
    "siamese": {
        "display_name": "Siamese Cat",
        "size": "Medium (3 - 5 kg)",
        "temperament": "Vocal, social, affectionate, active",
        "nutrition": "High protein, ultra-lean poultry diet to maintain slender, athletic muscular grace",
        "recipe": "Tender Turkey & Steamed Pumpkin Feline Delight",
        "health": ["Dental tartar", "Respiratory sensitivity", "Amyloidosis"],
    },
    "bengal": {
        "display_name": "Bengal Cat",
        "size": "Medium / Large (4 - 7 kg)",
        "temperament": "Athletic, confident, curious, energetic",
        "nutrition": "Carnivore-pure, grain-free animal protein with added taurine for high-octane energy",
        "recipe": "Wild Salmon & Farm-Fresh Quail High-Energy Feast",
        "health": ["Hypertrophic cardiomyopathy", "Progressive retinal atrophy", "Joint wear"],
    },
    "maine_coon": {
        "display_name": "Maine Coon",
        "size": "Large (6 - 9 kg)",
        "temperament": "Gentle giant, friendly, intelligent, patient",
        "nutrition": "Glucosamine-fortified large-breed feline nutrition for heavy bone structures and thick coat",
        "recipe": "Braised Mutton & Marine Collagen Giant Feline Bowl",
        "health": ["Hip dysplasia", "Cardiomyopathy", "Spinal muscular atrophy"],
    },
    "british_shorthair": {
        "display_name": "British Shorthair",
        "size": "Medium / Large (4 - 7 kg)",
        "temperament": "Easygoing, calm, loyal, quiet",
        "nutrition": "Controlled fat and mineral-balanced formula to guard against urinary struvite crystals",
        "recipe": "Pure Ocean Fish & Cranberry Urinary Shield",
        "health": ["Urinary tract health", "Weight control", "Hypertrophic cardiomyopathy"],
    },
    "ragdoll": {
        "display_name": "Ragdoll",
        "size": "Large (4.5 - 8 kg)",
        "temperament": "Docile, relaxed, affectionate, placid",
        "nutrition": "Slow-burn clean proteins and moisture-rich broth preventing bladder stone formation",
        "recipe": "Silky Chicken & Mackerel Broth Puree",
        "health": ["Bladder stones", "Hypertrophic cardiomyopathy", "Hairballs"],
    },
    "indie_cat": {
        "display_name": "Indian Billi / Domestic Shorthair",
        "size": "Medium (3.5 - 5 kg)",
        "temperament": "Agile, independent, affectionate, resilient",
        "nutrition": "Hydrating, high-taurine balanced fresh meat recipe tailored to local tropical climates",
        "recipe": "Coastal Sardine & Country Chicken Vitality Cup",
        "health": ["Hydration maintenance", "Dental hygiene", "Parasite resilience"],
    },
}


def get_breed_care_insights(breed_slug: str, species: str) -> CareInsights:
    """Lookup rich Scooby's Kitchen nutrition and health insights for any breed."""
    norm_slug = breed_slug.lower().strip().replace(" ", "_").replace("-", "_")
    
    if species.lower() == "cat":
        data = CAT_BREED_METADATA.get(norm_slug)
        if not data:
            # Check partial match
            for k, v in CAT_BREED_METADATA.items():
                if k in norm_slug or norm_slug in k:
                    data = v
                    break
        if not data:
            data = {
                "display_name": breed_slug.title(),
                "size": "Medium (3.5 - 5.5 kg)",
                "temperament": "Curious, agile, affectionate companion",
                "nutrition": "Complete amino acid profile rich in essential taurine and hydration broth",
                "recipe": "Gently Shredded Chicken & Bone Broth Hydration Bowl",
                "health": ["Urinary tract wellness", "Hairball prevention", "Dental tartar care"],
            }
    else:
        data = DOG_BREED_METADATA.get(norm_slug)
        if not data:
            for k, v in DOG_BREED_METADATA.items():
                if k in norm_slug or norm_slug in k:
                    data = v
                    break
        if not data:
            data = {
                "display_name": breed_slug.title(),
                "size": "Medium (12 - 22 kg)",
                "temperament": "Loving, loyal, active family companion",
                "nutrition": "Complete, biologically appropriate fresh cooked whole meat and vegetable blend",
                "recipe": "Slow-Simmered Chicken & Garden Vegetables Medley",
                "health": ["Joint flexibility", "Skin & coat shine", "Digestive balance"],
            }

    return CareInsights(
        temperament=data["temperament"],
        adult_size_category=data["size"],
        nutritional_focus=data["nutrition"],
        recommended_recipe=data["recipe"],
        health_watch=data["health"],
    )
