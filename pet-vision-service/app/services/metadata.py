from typing import Dict, Any
from app.schemas import CareInsights, BreedHeritage, SuperpowerSkills

DOG_BREED_METADATA: Dict[str, Dict[str, Any]] = {
    "golden_retriever": {
        "display_name": "Golden Retriever",
        "size": "Large (25 - 34 kg)",
        "temperament": "Gentle, intelligent, affectionate, playful",
        "nutrition": "High-quality lean protein, glucosamine & chondroitin for hip & joint resilience",
        "recipe": "Slow-Simmered Chicken & Pumpkin Joint Shield Bowl",
        "health": ["Hip & elbow dysplasia", "Heart health", "Skin sensitivity"],
        "heritage": {
            "origin_country": "Scotland, United Kingdom",
            "origin_flag": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
            "origin_era": "Mid-19th Century (1868)",
            "historical_homeland": "Guisachan Estate, Scottish Highlands",
            "mutation_story": "Lord Tweedmouth selectively bred a rare yellow Wavy-Coated Retriever with a Tweed Water Spaniel. Through generations of selective mutations, they developed water-repellent dense double coats and delicate 'soft mouths' designed to retrieve waterfowl from freezing Scottish marshlands without leaving a single tooth mark.",
            "fun_facts": [
                "They possess a gentle 'soft mouth' so controlled they can carry a raw egg across a room without cracking the shell.",
                "Consistently ranked the #1 most beloved family dog globally due to unusually high oxytocin bonding receptors.",
                "They love water so instinctively that their webbed paws act like natural underwater flippers."
            ],
            "famous_icons": ["Shadow (Homeward Bound)", "Liberty (President Gerald Ford's White House Golden)", "Buddy (Air Bud)"],
            "superpowers": {
                "scent_radar": 8.5,
                "stamina_speed": 8.0,
                "cuddle_index": 10.0,
                "watchdog_instinct": 4.5,
                "swimming_affinity": 9.5
            }
        }
    },
    "labrador_retriever": {
        "display_name": "Labrador Retriever",
        "size": "Large (25 - 36 kg)",
        "temperament": "Outgoing, even-tempered, athletic, friendly",
        "nutrition": "Controlled-calorie formula with high fiber to maintain optimal weight and vitality",
        "recipe": "Lean Country Beef & Garden Greens Vitality Bowl",
        "health": ["Weight management", "Joint flexibility", "Eye health"],
        "heritage": {
            "origin_country": "Newfoundland, Canada",
            "origin_flag": "🇨🇦",
            "origin_era": "Early 18th Century",
            "historical_homeland": "St. John's Island, North Atlantic Coast",
            "mutation_story": "Originally called the St. John's Water Dog, these hardy companions worked alongside Atlantic cod fishermen. Nature and breeders selected for an 'otter tail' that works like a marine rudder, thick waterproof fur, and webbed paws for pulling fishing nets out of icy Atlantic swells.",
            "fun_facts": [
                "Their thick, rounded 'otter tail' acts as a powerful steering rudder when navigating ocean waves.",
                "They carry a natural genetic variation in the POMC gene that gives them an endlessly enthusiastic appetite for food.",
                "They are the world's most widely utilized guide and search-and-rescue dogs thanks to their extraordinary emotional intelligence."
            ],
            "famous_icons": ["Marley (Marley & Me)", "Sully (President George H.W. Bush's Service Dog)", "Endal (Hero Assistance Dog)"],
            "superpowers": {
                "scent_radar": 9.0,
                "stamina_speed": 8.5,
                "cuddle_index": 9.5,
                "watchdog_instinct": 5.0,
                "swimming_affinity": 10.0
            }
        }
    },
    "german_shepherd": {
        "display_name": "German Shepherd",
        "size": "Large (30 - 40 kg)",
        "temperament": "Loyal, courageous, confident, highly trainable",
        "nutrition": "Digestive-friendly protein blend with prebiotic fibers for gastrointestinal support",
        "recipe": "Grass-Fed Mutton & Sweet Potato Active Feast",
        "health": ["Digestive sensitivity", "Hip dysplasia", "Spinal health"],
        "heritage": {
            "origin_country": "Germany",
            "origin_flag": "🇩🇪",
            "origin_era": "Late 19th Century (1899)",
            "historical_homeland": "Karlsruhe, Baden-Württemberg",
            "mutation_story": "Captain Max von Stephanitz standardized the breed from traditional German herding dogs to engineer the ultimate working companion. Breeders selected for sharp acoustic ear cartilage, a wolf-like athletic frame, and laser cognitive focus capable of guarding flocks and navigating complex police and military duties.",
            "fun_facts": [
                "Their bite force exceeds 238 pounds per square inch, yet they can be trained to pick up a newborn kitten gently.",
                "They can learn a completely new command in as few as 5 repetitions, ranking in the top 3 smartest dogs on Earth.",
                "During World War I, their bravery as courier and rescue dogs earned them international military honors."
            ],
            "famous_icons": ["Rin Tin Tin (Hollywood Silent Film Legend)", "Strongheart", "Commander (White House Shepherd)"],
            "superpowers": {
                "scent_radar": 9.5,
                "stamina_speed": 9.0,
                "cuddle_index": 7.5,
                "watchdog_instinct": 10.0,
                "swimming_affinity": 7.0
            }
        }
    },
    "french_bulldog": {
        "display_name": "French Bulldog",
        "size": "Small (9 - 13 kg)",
        "temperament": "Playful, adaptable, affectionate, lively",
        "nutrition": "Hypoallergenic, easy-to-digest recipes preventing flatulence and skin inflammation",
        "recipe": "Tender Turkey & Carrot Sensitive Digest Bowl",
        "health": ["Brachycephalic respiratory care", "Allergies", "Spinal disc care"],
        "heritage": {
            "origin_country": "France / England",
            "origin_flag": "🇫🇷",
            "origin_era": "Mid-19th Century (1850s)",
            "historical_homeland": "Nottingham Lace-Workers to Montmartre, Paris",
            "mutation_story": "Created when British lace makers moved to Normandy during the Industrial Revolution, taking miniature Toy Bulldogs with them. Parisian breeders fell in love with their quirky naturally erect 'bat ears'—a genetic mutation they deliberately stabilized to create the premier cafe companion of the Belle Époque.",
            "fun_facts": [
                "Their signature 'bat ears' are completely unique to the breed and never require cropping.",
                "Because of their dense, front-heavy bone structure and compact snouts, they cannot swim naturally and always need life jackets near deep water.",
                "They rarely bark, preferring to communicate through a comical range of expressive yips, yawns, and gurgles."
            ],
            "famous_icons": ["Gavroche (Titanic Passenger Dog)", "Asia (Lady Gaga's Companion)", "Manny the Frenchie"],
            "superpowers": {
                "scent_radar": 5.0,
                "stamina_speed": 4.0,
                "cuddle_index": 9.5,
                "watchdog_instinct": 6.0,
                "swimming_affinity": 2.0
            }
        }
    },
    "beagle": {
        "display_name": "Beagle",
        "size": "Medium (9 - 14 kg)",
        "temperament": "Amiable, curious, determined, energetic",
        "nutrition": "Satiety-boosting, lean nutrient density to prevent obesity from hearty appetites",
        "recipe": "Harvest Turkey & Quinoa Trim & Lean Bowl",
        "health": ["Obesity prevention", "Ear canal health", "Thyroid function"],
        "heritage": {
            "origin_country": "Great Britain",
            "origin_flag": "🇬🇧",
            "origin_era": "11th Century / Medieval Era",
            "historical_homeland": "English Countryside Estates",
            "mutation_story": "Bred as miniature scent hounds capable of following hare tracks on foot ('beagling'). Breeders selected for long pendulous hound ears that stir up ground scent molecules directly into their nasal cavities, and a white-tipped tail (the 'flag') so hunters could spot them in tall grass.",
            "fun_facts": [
                "Their noses possess over 220 million olfactory scent receptors (compared to just 5 million in humans).",
                "Their tails almost always have a white tip, selectively bred so they could be seen above tall autumn grass.",
                "They possess 3 distinct vocalizations: a standard bark, an operatic hunting bay, and a plaintive howl."
            ],
            "famous_icons": ["Snoopy (Peanuts Comics)", "Gromit (Wallace & Gromit)", "Porthos (Star Trek: Enterprise)"],
            "superpowers": {
                "scent_radar": 10.0,
                "stamina_speed": 8.0,
                "cuddle_index": 8.5,
                "watchdog_instinct": 6.5,
                "swimming_affinity": 5.0
            }
        }
    },
    "poodle": {
        "display_name": "Poodle",
        "size": "Medium / Standard (15 - 28 kg)",
        "temperament": "Alert, intelligent, active, elegant",
        "nutrition": "Omega-rich fatty acids and biotin to nourish curly coats and support cognitive sharpness",
        "recipe": "Omega Wild Salmon & Organic Spinach Coat Glow",
        "health": ["Luxating patella", "Coat nourishment", "Dental hygiene"],
        "heritage": {
            "origin_country": "Germany / France",
            "origin_flag": "🇩🇪",
            "origin_era": "15th Century",
            "historical_homeland": "Central European Waterways",
            "mutation_story": "Despite French luxury associations, the Poodle was bred as a German duck water retriever ('Pudelhund' meaning 'to splash'). Their iconic show haircut was originally a practical mutation: fur was shaved to lighten swimming weight, while protective puffs were left over joints and vital chest organs to guard against hypothermia in freezing rivers.",
            "fun_facts": [
                "Their hair is single-layered and continuously grows without seasonal shedding, making them naturally hypoallergenic.",
                "Ranked the #2 most intelligent dog breed in the world—capable of understanding up to 300 words.",
                "The pompons on their hips and ankles were originally functional insulation to protect their joints in ice water."
            ],
            "famous_icons": ["Charley (John Steinbeck's Travels with Charley)", "Georgette (Oliver & Company)", "Rumpel (Elvis Presley's Poodle)"],
            "superpowers": {
                "scent_radar": 8.0,
                "stamina_speed": 8.5,
                "cuddle_index": 9.0,
                "watchdog_instinct": 7.5,
                "swimming_affinity": 9.0
            }
        }
    },
    "pug": {
        "display_name": "Pug",
        "size": "Toy / Small (6 - 8 kg)",
        "temperament": "Charming, mischievous, loving, docile",
        "nutrition": "Portion-controlled, antioxidant-rich meals supporting steady breathing and energy",
        "recipe": "Steamed Chicken & Carrot Small-Bite Medley",
        "health": ["Breathing airways", "Weight management", "Wrinkle skin fold care"],
        "heritage": {
            "origin_country": "Ancient China",
            "origin_flag": "🇨🇳",
            "origin_era": "Han Dynasty (400 B.C.)",
            "historical_homeland": "Imperial Palaces of China",
            "mutation_story": "Revered as sacred royal lap warmers for Chinese Emperors. Imperial breeders prized forehead skin folds that resembled the Chinese character for 'Prince' (王). They were guarded by soldiers and only gifted to foreign nobility through royal decrees.",
            "fun_facts": [
                "A group of pugs is officially called a 'Grumble'—referencing their endearing rhythmic snoring and grunts.",
                "In 1572, a Pug named Pompey saved Prince William of Orange's life by alerting him to approaching Spanish assassins.",
                "Their curled tail was bred to curl as tightly as possible; a double-curl is considered the pinnacle of pug nobility."
            ],
            "famous_icons": ["Frank the Pug (Men in Black)", "Percy (Pocahontas)", "Doug the Pug (Social Media Star)"],
            "superpowers": {
                "scent_radar": 4.5,
                "stamina_speed": 3.0,
                "cuddle_index": 10.0,
                "watchdog_instinct": 5.0,
                "swimming_affinity": 1.5
            }
        }
    },
    "siberian_husky": {
        "display_name": "Siberian Husky",
        "size": "Medium / Large (20 - 27 kg)",
        "temperament": "Outgoing, loyal, mischievous, high-stamina",
        "nutrition": "Calorie-dense athletic formula rich in animal lipids for endurance and double coat insulation",
        "recipe": "Arctic Salmon & Sweet Potato High-Energy Bowl",
        "health": ["Hip soundness", "Eye health (cataracts)", "Skin zinc deficiency"],
        "heritage": {
            "origin_country": "Siberia, Russia",
            "origin_flag": "🇷🇺",
            "origin_era": "Over 3,000 Years Ago",
            "historical_homeland": "Siberian Arctic Peninsula (Chukchi Tribe)",
            "mutation_story": "Developed by the nomadic Chukchi people of northeastern Asia. Millennia of arctic adaptation created an astonishing metabolic mutation: Huskies can alter their own cellular metabolism to run hundreds of miles without depleting glycogen stores or suffering muscle fatigue in temperatures down to -50°C.",
            "fun_facts": [
                "They can survive in temperatures as low as -50°C by wrapping their bushy tails over their noses to warm the inhaled air.",
                "They have heterochromia (bi-colored eyes) more frequently than almost any other canine breed.",
                "They rarely bark; instead, they communicate through elaborate, expressive, and dramatic operatic howls."
            ],
            "famous_icons": ["Balto & Togo (1925 Serum Run Heroes)", "Keno", "Diesel (Eight Below)"],
            "superpowers": {
                "scent_radar": 7.5,
                "stamina_speed": 10.0,
                "cuddle_index": 8.0,
                "watchdog_instinct": 3.0,
                "swimming_affinity": 4.0
            }
        }
    },
    "rottweiler": {
        "display_name": "Rottweiler",
        "size": "Giant (40 - 55 kg)",
        "temperament": "Steadfast, confident, devoted, good-natured",
        "nutrition": "L-carnitine and taurine for cardiac muscle strength and robust bone density",
        "recipe": "Hearty Beef & Flaxseed Power Feast",
        "health": ["Cardiovascular health", "Joint cartilage", "Bone growth"],
        "heritage": {
            "origin_country": "Germany / Ancient Rome",
            "origin_flag": "🇩🇪",
            "origin_era": "1st Century A.D.",
            "historical_homeland": "Rottweil, Swabia, Germany",
            "mutation_story": "Descended from ancient Roman cattle drover mastiffs that marched with Roman legions across the Alps. In the medieval trading town of Rottweil, butcher guilds bred them with heavy bone density and muscular necks to pull meat carts and protect money pouches tied around their necks.",
            "fun_facts": [
                "In medieval Germany, butchers tied their daily earnings around their Rottweiler's neck because no thief dared to reach for it.",
                "Despite their intimidating guardian appearance, they are known to 'lean' affectionately against their human's legs to show deep loyalty.",
                "They served as one of the first official emergency rescue and messenger dogs in European police forces."
            ],
            "famous_icons": ["Triumph the Insult Comic Dog", "Carl (Good Dog, Carl Books)", "Max (The Omen)"],
            "superpowers": {
                "scent_radar": 7.0,
                "stamina_speed": 7.5,
                "cuddle_index": 8.0,
                "watchdog_instinct": 10.0,
                "swimming_affinity": 6.5
            }
        }
    },
    "indie_pariah": {
        "display_name": "Indian Pariah / Indie",
        "size": "Medium (15 - 25 kg)",
        "temperament": "Hardy, highly intuitive, loyal, adaptable",
        "nutrition": "Naturally balanced ancestral proteins with anti-inflammatory turmeric and coconut oil",
        "recipe": "Scooby Heritage Chicken, Rice & Golden Turmeric Stew",
        "health": ["Robust immunity", "Natural resilience", "Tick prevention support"],
        "heritage": {
            "origin_country": "Indian Subcontinent",
            "origin_flag": "🇮🇳",
            "origin_era": "Ancient Vedic Era (15,000+ Years Ago)",
            "historical_homeland": "Indus Valley Civilization & Indian Countryside",
            "mutation_story": "One of the oldest primitive canine landraces in human history, depicted in prehistoric Bhimbetka rock art. Shaped entirely through natural selection rather than artificial kennel mutations, they possess an extraordinary immune system, self-cleaning short coat, and extreme resilience against tropical pathogens and heat.",
            "fun_facts": [
                "They are an aboriginal primitive breed whose lineage predates modern European pedigree breeds by thousands of years.",
                "They have almost zero genetic breed-specific diseases and naturally clean, low-odor coats that repel dirt.",
                "A loyal Indie named 'Yudhishthira's Dog' famously accompanied the Pandava king to the gates of heaven in the Mahabharata."
            ],
            "famous_icons": ["Yudhishthira's Faithful Companion (Mahabharata)", "Chotu (ISRO Guard Dog)", "Hero Indie 'Tuffy'"],
            "superpowers": {
                "scent_radar": 9.0,
                "stamina_speed": 9.0,
                "cuddle_index": 9.0,
                "watchdog_instinct": 9.5,
                "swimming_affinity": 7.0
            }
        }
    },
    "cocker_spaniel": {
        "display_name": "Cocker Spaniel",
        "size": "Medium (12 - 16 kg)",
        "temperament": "Gentle, affectionate, lively, playful",
        "nutrition": "Vitamins A & E with Omega-6 for glossy ears, bright eyes, and supple skin",
        "recipe": "Fresh Salmon & Sweet Pea Vitality Medley",
        "health": ["Ear infections", "Heart health", "Eye soundness"],
        "heritage": {
            "origin_country": "England / Spain",
            "origin_flag": "🇬🇧",
            "origin_era": "14th Century",
            "historical_homeland": "English Woodlands & Hedgerows",
            "mutation_story": "Named 'Cocker' for their unmatched ability to flush out woodcock birds from dense brambles. Selected for silky, feather-lined coats, wide soulful expressive eyes, and long drooping ears that funnel subtle woodland scent trails directly into the nostrils.",
            "fun_facts": [
                "They were the inspiration for Disney's iconic film 'Lady and the Tramp' (Lady was an English Cocker Spaniel).",
                "Their long soulful eyelashes are natural adaptations designed to protect their eyes from woodland briars and thorns.",
                "They hold the record for winning the prestigious 'Best in Show' at the Crufts dog show more times than any other breed."
            ],
            "famous_icons": ["Lady (Lady and the Tramp)", "Checkers (Richard Nixon's Cocker)", "Lupo (Prince William & Kate's Companion)"],
            "superpowers": {
                "scent_radar": 8.5,
                "stamina_speed": 7.5,
                "cuddle_index": 9.5,
                "watchdog_instinct": 6.0,
                "swimming_affinity": 7.5
            }
        }
    },
    "doberman_pinscher": {
        "display_name": "Doberman Pinscher",
        "size": "Large (32 - 45 kg)",
        "temperament": "Fearless, alert, loyal, energetic",
        "nutrition": "High bioavailability protein and taurine for athletic musculature and cardiac stamina",
        "recipe": "Prime Beef & Pumpkin Athletic Performance Bowl",
        "health": ["Dilated cardiomyopathy", "Cervical spine care", "Bloat prevention"],
        "heritage": {
            "origin_country": "Germany",
            "origin_flag": "🇩🇪",
            "origin_era": "Late 19th Century (1890)",
            "historical_homeland": "Apolda, Thuringia, Germany",
            "mutation_story": "Created by Karl Friedrich Louis Dobermann, a German tax collector who needed a courageous, sleek protector on dangerous collection routes. He cross-bred Rottweilers, German Pinschers, and Greyhounds to combine raw muscular power with greyhound-like acceleration.",
            "fun_facts": [
                "They are nicknamed 'Velcro Dogs' because, despite their fierce reputation, they crave constant physical contact with their human family.",
                "They are one of the fastest accelerating canine breeds on the planet, capable of reaching 32 mph in seconds.",
                "During WWII in the Pacific, Dobermans served as the official 'Devil Dogs' of the US Marine Corps, saving hundreds of soldiers' lives."
            ],
            "famous_icons": ["Kurt (First WWII War Dog Hero on Guam)", "Zeus & Apollo (Magnum P.I.)", "Alpha (Pixar's Up)"],
            "superpowers": {
                "scent_radar": 8.5,
                "stamina_speed": 10.0,
                "cuddle_index": 8.0,
                "watchdog_instinct": 10.0,
                "swimming_affinity": 6.0
            }
        }
    },
    "chihuahua": {
        "display_name": "Chihuahua",
        "size": "Toy (1.5 - 3 kg)",
        "temperament": "Graceful, quick-witted, devoted, sassy",
        "nutrition": "Micro-portioned, nutrient-dense fresh bites preventing hypoglycemia and supporting heart",
        "recipe": "Tender Turkey & Pumpkin Petite Nourish",
        "health": ["Hypoglycemia guard", "Dental health", "Patellar luxation"],
        "heritage": {
            "origin_country": "Mexico",
            "origin_flag": "🇲🇽",
            "origin_era": "9th Century A.D. (Toltec Civilization)",
            "historical_homeland": "State of Chihuahua, Mexico",
            "mutation_story": "Descendants of the ancient 'Techichi' companion dog of the Toltec and Aztec empires. Revered as sacred spiritual guides who accompanied souls through the afterlife. Over centuries in desert climates, they evolved into the smallest canine breed in the world with dome-shaped 'apple' skulls.",
            "fun_facts": [
                "They are officially the smallest canine breed in the world, yet have the largest brain-to-body size ratio of any dog.",
                "Aztec archaeological digs reveal Chihuahuas were buried with royalty to guide their spirits across the nine rivers of the underworld.",
                "They can live up to 18-20 years, having one of the longest lifespans in the entire animal kingdom."
            ],
            "famous_icons": ["Bruiser Woods (Legally Blonde)", "Gidget (Taco Bell Chihuahua)", "Tinkerbell (Paris Hilton's Chihuahua)"],
            "superpowers": {
                "scent_radar": 6.0,
                "stamina_speed": 6.5,
                "cuddle_index": 9.5,
                "watchdog_instinct": 8.5,
                "swimming_affinity": 3.0
            }
        }
    },
    "pomeranian": {
        "display_name": "Pomeranian",
        "size": "Toy (2 - 3.5 kg)",
        "temperament": "Inquisitive, lively, bold, affectionate",
        "nutrition": "Skin-barrier fortifying EPA/DHA to maintain a dense, fluffy double coat",
        "recipe": "Fluffy Coat Salmon & Free-Range Chicken Cup",
        "health": ["Tracheal collapse prevention", "Coat alopecia", "Dental care"],
        "heritage": {
            "origin_country": "Pomerania (Poland / Germany)",
            "origin_flag": "🇩🇪",
            "origin_era": "18th Century",
            "historical_homeland": "Baltic Coast of Central Europe",
            "mutation_story": "Descended from giant Arctic sled-pulling Spitz dogs. Queen Victoria of the United Kingdom established her own royal breeding kennel and selectively bred them down from 14 kg working dogs to 2.5 kg royal lap companions while preserving their lion-mane coats and foxy alert expressions.",
            "fun_facts": [
                "Queen Victoria loved Pomeranians so deeply that she had her favorite dog 'Turi' lying by her side at her royal bedside.",
                "Two Pomeranians survived the sinking of the Titanic in 1912 by escaping with their owners in first-class lifeboats.",
                "Their dense double coat contains an astonishing 40,000 hairs per square inch to trap warm air."
            ],
            "famous_icons": ["Boo (The World's Cutest Dog)", "Jiffpom (Guinness Record Holder)", "Turi (Queen Victoria's Royal Dog)"],
            "superpowers": {
                "scent_radar": 5.5,
                "stamina_speed": 6.0,
                "cuddle_index": 9.5,
                "watchdog_instinct": 7.5,
                "swimming_affinity": 2.5
            }
        }
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
        "heritage": {
            "origin_country": "Persia (Modern Iran)",
            "origin_flag": "🇮🇷",
            "origin_era": "Ancient 17th Century",
            "historical_homeland": "Persian Caravans to European Royal Courts",
            "mutation_story": "Carried out of Persia by Italian nobleman Pietro della Valle in 1620. Prized by French and British royalty, breeders selectively stabilized their flowing silk coats, round pansy-like faces, and sweet serene demeanor.",
            "fun_facts": [
                "Queen Victoria owned multiple blue Persians, making them the ultimate status symbol of Victorian high society.",
                "Their thick plush fur can measure up to 8 inches in length across their royal chest ruff.",
                "They are famously quiet and vocalize using gentle, melodious trills rather than loud meows."
            ],
            "famous_icons": ["Mr. Bigglesworth (Austin Powers)", "Crookshanks (Harry Potter)", "Duchess (The Aristocats)"],
            "superpowers": {
                "scent_radar": 6.0,
                "stamina_speed": 3.5,
                "cuddle_index": 9.5,
                "watchdog_instinct": 4.0,
                "swimming_affinity": 1.0
            }
        }
    },
    "siamese": {
        "display_name": "Siamese Cat",
        "size": "Medium (3 - 5 kg)",
        "temperament": "Vocal, social, affectionate, active",
        "nutrition": "High protein, ultra-lean poultry diet to maintain slender, athletic muscular grace",
        "recipe": "Tender Turkey & Steamed Pumpkin Feline Delight",
        "health": ["Dental tartar", "Respiratory sensitivity", "Amyloidosis"],
        "heritage": {
            "origin_country": "Siam (Modern Thailand)",
            "origin_flag": "🇹🇭",
            "origin_era": "14th Century (Ayutthaya Kingdom)",
            "historical_homeland": "Royal Palaces and Sacred Temples of Siam",
            "mutation_story": "Known in ancient Thai manuscripts as 'Wichienmaat' (Moon Diamond). They carry a natural temperature-sensitive albino mutation where pigment only develops on cooler parts of their body (ears, paws, tail, and face mask).",
            "fun_facts": [
                "Their color points are heat-sensitive: newborn Siamese kittens are born completely pure white because the mother's womb is warm.",
                "They are famous for holding full two-way 'conversations' with their owners using a distinctive baby-like cry.",
                "In ancient Siam, royal families believed when a monarch died, their soul would temporarily reside in a sacred Siamese cat."
            ],
            "famous_icons": ["Si & Am (Lady and the Tramp)", "DC (That Darn Cat!)", "Tao (The Incredible Journey)"],
            "superpowers": {
                "scent_radar": 7.5,
                "stamina_speed": 9.0,
                "cuddle_index": 9.5,
                "watchdog_instinct": 7.0,
                "swimming_affinity": 4.0
            }
        }
    },
    "bengal": {
        "display_name": "Bengal Cat",
        "size": "Medium / Large (4 - 7 kg)",
        "temperament": "Athletic, confident, curious, energetic",
        "nutrition": "Carnivore-pure, grain-free animal protein with added taurine for high-octane energy",
        "recipe": "Wild Salmon & Farm-Fresh Quail High-Energy Feast",
        "health": ["Hypertrophic cardiomyopathy", "Progressive retinal atrophy", "Joint wear"],
        "heritage": {
            "origin_country": "United States",
            "origin_flag": "🇺🇸",
            "origin_era": "1960s - 1980s",
            "historical_homeland": "California (Jean Mill Breeding Project)",
            "mutation_story": "Created by geneticist Jean Mill by crossing the wild Asian Leopard Cat (Prionailurus bengalensis) with domestic shorthairs. The result is a magnificent domestic cat with iridescent glitter coats, leopard rosettes, and an intense love for water.",
            "fun_facts": [
                "They are one of the only domestic cat breeds in the world that actively loves jumping into bathtubs and swimming pools.",
                "Their coats feature an effect called 'glitter'—hollow crystalline hair tips that reflect golden light in the sunshine.",
                "They can jump up to 3 times their own body height from a complete standstill."
            ],
            "famous_icons": ["Kotaro the Explorer", "Thor the Bengal", "Suki Cat (World Traveling Instagram Feline)"],
            "superpowers": {
                "scent_radar": 9.0,
                "stamina_speed": 10.0,
                "cuddle_index": 7.5,
                "watchdog_instinct": 8.5,
                "swimming_affinity": 9.0
            }
        }
    },
    "maine_coon": {
        "display_name": "Maine Coon",
        "size": "Large (6 - 9 kg)",
        "temperament": "Gentle giant, friendly, intelligent, patient",
        "nutrition": "Glucosamine-fortified large-breed feline nutrition for heavy bone structures and thick coat",
        "recipe": "Braised Mutton & Marine Collagen Giant Feline Bowl",
        "health": ["Hip dysplasia", "Cardiomyopathy", "Spinal muscular atrophy"],
        "heritage": {
            "origin_country": "United States (Maine)",
            "origin_flag": "🇺🇸",
            "origin_era": "19th Century",
            "historical_homeland": "State of Maine, New England",
            "mutation_story": "Nature's masterpiece of cold-weather survival. Native to harsh New England winters, they evolved water-repellent thick multi-layer fur, giant tufted snowshoe paws for walking over deep snow, and long bushy tails to wrap around their faces while sleeping.",
            "fun_facts": [
                "They are the largest domesticated cat breed on Earth, with some males measuring over 48 inches (1.2 meters) from nose to tail.",
                "Their giant paws have extra fur tufts between the toes that act like built-in snowshoes.",
                "They don't meow like ordinary cats—they produce gentle musical chirps, trills, and purrs."
            ],
            "famous_icons": ["Mrs. Norris (Harry Potter)", "Barivel (Guinness Record Longest Cat)", "Stewie the Gentle Giant"],
            "superpowers": {
                "scent_radar": 8.0,
                "stamina_speed": 8.0,
                "cuddle_index": 9.0,
                "watchdog_instinct": 7.0,
                "swimming_affinity": 7.5
            }
        }
    },
    "indie_cat": {
        "display_name": "Indian Billi / Domestic Shorthair",
        "size": "Medium (3.5 - 5 kg)",
        "temperament": "Agile, independent, affectionate, resilient",
        "nutrition": "Hydrating, high-taurine balanced fresh meat recipe tailored to local tropical climates",
        "recipe": "Coastal Sardine & Country Chicken Vitality Cup",
        "health": ["Hydration maintenance", "Dental hygiene", "Parasite resilience"],
        "heritage": {
            "origin_country": "Indian Subcontinent",
            "origin_flag": "🇮🇳",
            "origin_era": "Ancient Civilizations (Over 8,000 Years)",
            "historical_homeland": "Ancient Indian Villages & River Deltas",
            "mutation_story": "Naturally evolved from ancestral African and Asian wildcats (Felis lybica). Shaped by millennia of natural tropical resilience, they developed sharp predatory instincts, natural pest control acumen, and sleek temperature-regulating coats.",
            "fun_facts": [
                "They have lightning-fast reflexes that can track and catch pests moving at over 15 feet per second.",
                "Naturally self-grooming with high tropical heat tolerance and robust ancestral immunity.",
                "Known for forming deep, lifelong one-on-one bonds with their chosen human family members."
            ],
            "famous_icons": ["Temple Cats of Varanasi", "Billi (Folk Lore Companions)", "Panchatantra Wisdom Felines"],
            "superpowers": {
                "scent_radar": 8.5,
                "stamina_speed": 9.0,
                "cuddle_index": 8.5,
                "watchdog_instinct": 8.0,
                "swimming_affinity": 3.0
            }
        }
    }
}


def get_breed_care_insights(breed_slug: str, species: str) -> CareInsights:
    """Lookup rich Scooby's Kitchen nutrition and health insights for any breed."""
    norm_slug = breed_slug.lower().strip().replace(" ", "_").replace("-", "_")
    
    if species.lower() == "cat":
        data = CAT_BREED_METADATA.get(norm_slug)
        if not data:
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


def get_breed_heritage(breed_slug: str, species: str) -> BreedHeritage:
    """Lookup rich evolutionary mutation lore, superpowers, and fun facts for any breed."""
    norm_slug = breed_slug.lower().strip().replace(" ", "_").replace("-", "_")
    
    data_dict = CAT_BREED_METADATA if species.lower() == "cat" else DOG_BREED_METADATA
    
    breed_entry = data_dict.get(norm_slug)
    if not breed_entry:
        for k, v in data_dict.items():
            if k in norm_slug or norm_slug in k:
                breed_entry = v
                break
    
    if breed_entry and "heritage" in breed_entry:
        h = breed_entry["heritage"]
        sp = h["superpowers"]
        return BreedHeritage(
            origin_country=h["origin_country"],
            origin_flag=h["origin_flag"],
            origin_era=h["origin_era"],
            historical_homeland=h["historical_homeland"],
            mutation_story=h["mutation_story"],
            fun_facts=h["fun_facts"],
            famous_icons=h.get("famous_icons", []),
            superpowers=SuperpowerSkills(
                scent_radar=sp["scent_radar"],
                stamina_speed=sp["stamina_speed"],
                cuddle_index=sp["cuddle_index"],
                watchdog_instinct=sp["watchdog_instinct"],
                swimming_affinity=sp["swimming_affinity"],
            )
        )
    
    # Generic Dynamic Fallback for Mixed / Unique Breeds
    if species.lower() == "cat":
        return BreedHeritage(
            origin_country="Global Ancestral Heritage",
            origin_flag="🌍",
            origin_era="Ancient Millennia",
            historical_homeland="Mediterranean & Asian Domestic Lines",
            mutation_story=f"The {breed_slug.title()} carries rich multi-generational genetic traits adapted for nocturnal agility, whisker spatial radar, and incredible speed.",
            fun_facts=[
                "Cats can rotate their ears 180 degrees using 32 separate ear muscles.",
                "They spend roughly 70% of their lives sleeping and grooming to stay scentless to predators.",
                "Every cat's nose print has a unique pattern of ridges, just like a human fingerprint."
            ],
            famous_icons=["Historical Feline Royal Companions"],
            superpowers=SuperpowerSkills(
                scent_radar=7.5,
                stamina_speed=8.5,
                cuddle_index=8.5,
                watchdog_instinct=6.5,
                swimming_affinity=3.5,
            )
        )
    else:
        return BreedHeritage(
            origin_country="Global Canine Heritage",
            origin_flag="🌍",
            origin_era="Historical Lineage",
            historical_homeland="Ancestral Companion Working Lines",
            mutation_story=f"The {breed_slug.title()} represents centuries of dedicated canine evolution, shaped for loyalty, acute senses, and deep emotional companionship with humans.",
            fun_facts=[
                "A dog's sense of smell is between 10,000 to 100,000 times more acute than a human's.",
                "Dogs are capable of recognizing over 150 human words and emotional tone variations.",
                "Their whiskers (vibrissae) are loaded with nerve endings to detect minute air currents."
            ],
            famous_icons=["Man's Best Friend Heritage Lineage"],
            superpowers=SuperpowerSkills(
                scent_radar=8.0,
                stamina_speed=8.0,
                cuddle_index=9.0,
                watchdog_instinct=7.5,
                swimming_affinity=6.5,
            )
        )
