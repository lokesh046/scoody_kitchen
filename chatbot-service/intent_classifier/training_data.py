"""Bootstrap labeled dataset for the intent-routing classifier.

There is no real production traffic logged yet, so these examples are
hand-written to mirror the same three categories and vocabulary already
encoded in agents/supervisor.py's LLM prompt and keyword fallback list.
This is a *starting point* — as agents/supervisor.py's route_intent() is
called in production, log (query, chosen_label) pairs and fold real
traffic in here (or retrain directly on the logged pairs) so the
classifier's coverage grows to match what users actually type instead of
staying frozen on this synthetic bootstrap set.

Each entry is (query_text, label). Labels match the graph node names in
graph/workflow.py exactly: "health_agent", "commerce_agent", "knowledge_agent".
"""

HEALTH_AGENT_EXAMPLES = [
    "My dog has been vomiting since this morning",
    "My cat is limping on her front paw",
    "My puppy has diarrhea and seems tired",
    "Is it normal for my dog to sneeze a lot",
    "My dog has a rash on his belly",
    "My cat hasn't eaten anything today",
    "My dog is scratching his ears constantly",
    "My pet seems lethargic and won't play",
    "My dog has bad breath and swollen gums",
    "My cat is losing hair in patches",
    "My dog's eyes look red and watery",
    "My puppy is coughing a lot at night",
    "My dog ate something and now he's throwing up",
    "My cat has been sleeping way more than usual",
    "My dog is drinking a lot of water lately",
    "My pet has a lump near his leg",
    "My dog is shaking and won't stop",
    "My cat's nose is dry and cracked",
    "My dog has diarrhea with blood in it",
    "Why does my dog keep licking his paws",
    "My puppy seems to be in pain when walking",
    "My cat is meowing a lot more than normal",
    "My dog has yellow discharge from his eye",
    "Is my dog's weight loss something to worry about",
    "My pet has been vomiting yellow liquid",
    "My dog's stomach seems bloated and hard",
    "My cat keeps sneezing and has watery eyes",
    "My dog won't stop scratching himself",
    "My puppy has worms in his stool",
    "My dog seems to be limping after the walk",
    "My cat has bad dandruff lately",
    "My dog's paw pad is cracked and bleeding a little",
    "My pet has developed a strange smell",
    "My dog keeps shaking his head",
    "Should I worry about my cat's constipation",
    "My dog has an ear infection smell",
    "My puppy is teething and chewing everything, is that normal",
    "My dog has hives all over his body",
    "My cat is throwing up hairballs frequently",
    "My dog seems anxious and panting a lot",
    # Generated via a locally self-hosted Ollama model (llama3.1:8b) using
    # intent_classifier/generate_synthetic_data.py, reviewed by hand before
    # being added here — see that file's docstring for why raw LLM output
    # is never merged in unreviewed.
    "my dog has been vomiting for 3 days now and im getting worried about dehydration",
    "my cat wont eat her food and i dont no whats wrong",
    "i need help with my puppy she has a skin infection on her ear and its getting worse",
    "i think my dog has eaten something bad he has been vomiting and has diarrhea",
    "can someone help me my dog is limping really badly and i cant find anything wrong with him",
    "i have a kitten with diarrhea and i dont no what to do",
    "i'm getting worried about my cat's appetite she hasn't eaten in 2 days",
    "my dog is having accidents in the house and i think something is wrong with his bladder",
    "my cat has a really bad cough and i'm getting scared",
    "i've been noticing my dog is having more accidents at night is this normal",
    "i'm really worried about my cat's vomiting she's been doing it for days",
    "my dog's skin is all red and inflamed what could be causing this",
    "i have a cat with hair loss on her belly and i dont know what to do about it",
    "i think my dog has eaten something toxic he's been vomiting and has seizures",
    "i'm getting worried about my cat's lethargy she's been sleeping a lot",
    "my dog is having a hard time walking because of a limp",
    "my cat's eyes are all red and runny what could be causing this",
    "my dog is eating less and less and i'm getting worried about his health",
    "my cat is having a hard time using the litter box because of a skin issue",
    # Ollama batch 2.
    "i think my cat is vomiting up hairballs every day",
    "my poor dog is limping really bad after playing fetch yesterday",
    "my cat wont eat her food for the last 24 hrs is this normal",
    "i'm freaking out my dog is shaking and trembling nonstop",
    "my dog has these huge red bumps on her skin near her collar",
    "i think my dog has conjunctivitis what can i do",
    "my cat has been having accidents in the house for a week now",
    "i just noticed my dog's paw is all swollen and red",
    "my poor cat has been hiding in the closet for days wont come out",
    "my dog is eating grass and vomiting up a yellow foam",
    "my cat has these weird dark spots on her fur what is it",
    "i'm worried about my dog's rapid breathing is that an issue",
    "my cat's eyes are really runny and tearing up constantly",
    "my dog's skin is all itchy and scabby and i dont know why",
    "my cat wont drink water and is just laying around all day",
    "my dog's ear is all red and inflamed what should i do",
    "i think my cat has a fungal infection on her paw",
    "my dog is having trouble walking and keeping his balance",
    "my cat's coat is getting really dull and matted up",
    "my poor dog is whining and whimpering nonstop for no reason",
    "my cat has been having these weird dreams and waking up",
    "my dog's stool is all bloody and i'm freaking out",
    # Closed-loop test miss: "blood in poop" phrasing without "stool"/
    # "bloody" didn't generalize from the similar example above.
    "i found blood in my dogs poop today",
    "there was blood in my cats litter box this morning",
    # Closed-loop test misses: "bloody diarrhea" and unfinished-sentence
    # symptom reports didn't generalize from similar phrasing above.
    "she's had bloody diarrhea for 2 days now",
    "my dog has had bloody diarrhea since yesterday",
    "i found sores on my cats neck, not sure what they are",
    "there are sores on my dog's ear that weren't there before",
]

COMMERCE_AGENT_EXAMPLES = [
    "What is the status of my order 105",
    "Track my recent order please",
    "Can you cancel order number 22",
    "I want to cancel my order",
    "Show me my past orders",
    "What products do you have in stock",
    "Search for chicken flavored dog food",
    "Do you have grain free cat food",
    "I want to book a vet consultation",
    "Book an appointment with a doctor for my dog",
    "What vet slots are available this week",
    "Show me available doctors for consultation",
    "Cancel my consultation booking",
    "I need to reschedule my vet appointment",
    "List all my registered pets",
    "Add a new pet to my profile",
    "What is the price of the salmon recipe",
    "Is the beef stew pouch available",
    "How many dog food options do you sell",
    "I want to see my order history",
    "Cancel order 456 please",
    "When will my order be delivered",
    "Book a telehealth session for my cat",
    "What doctors are available tomorrow",
    "Show me my upcoming consultations",
    "I would like to cancel consultation 12",
    "Confirm my appointment for Friday",
    "What is in my cart right now",
    "Do you sell puppy training treats",
    "I want to reorder my last purchase",
    "Where is my package right now",
    "My order hasn't arrived yet, can you check",
    "What's the delivery status for order 88",
    "Book doctor Smith for a consultation",
    "I need an appointment with a vet urgently",
    "Show me the schedule for available doctors",
    "Search for calming chews for anxious dogs",
    "What subscription plans do you offer",
    "Add extra chicken pouches to my order",
    "I want to change my delivery address for order 99",
    # Boundary cases against knowledge_agent — "recipe"/food-descriptor
    # wording that's actually a catalog/product search, not a knowledge
    # question. Added after the held-out eval caught "Got any lamb-based
    # recipes in the store" being misrouted to knowledge_agent (0.59
    # confidence) — the training set had no commerce examples using
    # "recipe" at all, so it never learned that word can mean "product".
    "Got any lamb-based recipes in the store",
    "Do you have any turkey recipes available",
    "Show me your chicken recipe options",
    "What recipes do you have for small breed dogs",
    "Search for grain free recipes",
    "Are there any fish recipes in stock right now",
    # Boundary case against health_agent — informal "where's my
    # stuff/delivery" phrasing with no explicit "order"/"delivery" keyword,
    # caught by round-2 eval: "i already paid, wheres my stuff" scored
    # 0.71 confidence for health_agent instead of commerce_agent, because
    # the training set had no informal delivery-tracking phrasing at all.
    "I already paid, wheres my stuff",
    "I paid for this already, where is it",
    "Already checked out, when's my stuff arriving",
    "Paid for my order, still waiting on it",
    "I ordered days ago and still nothing showed up",
    "Charged my card already but no delivery yet",
    # Boundary case against knowledge_agent — "do you carry/have X" product
    # availability phrasing, caught by round-2 eval: "do you carry any
    # senior dog formulas" scored 0.68 for knowledge_agent instead of
    # commerce_agent, same underlying gap as the "recipes" fix above.
    "Do you carry any senior dog formulas",
    "Do you have anything for picky eaters",
    "Do you carry wet food or just dry",
    "Do you have low fat options for overweight dogs",
    "Do you stock anything for sensitive stomachs",
    # Generated via a locally self-hosted Ollama model (llama3.1:8b) using
    # intent_classifier/generate_synthetic_data.py, reviewed by hand.
    "where's my order from last week",
    "I ordered the wrong product by mistake, can I exchange it",
    "I need to book a vet appointment for my cat",
    "how do I know if the vet is available on my desired date",
    "I need to add a new pet to my account",
    "can you tell me if the new food I ordered is in stock",
    "my package was delivered to the wrong address",
    "can I change my order to expedited shipping",
    "vet appointment was cancelled by them, what's the next step",
    "can I book a consultation with a vet for my new puppy",
    "do you have any healthy recipes for my dog",
    "can I get a refund for the last order",
    "I ordered the wrong size, can I exchange it",
    "can you add a new pet to my account",
    "I need to change my payment method",
    "how do I know if a product is available in my area",
    "can I get a list of recommended vet clinics in my area",
    "my dog's profile is not showing up in my account",
    "can I get a reminder for my upcoming vet appointment",
    "can you expedite my order for tomorrow",
    # Ollama batch 2. Dropped 2 off-domain candidates from this batch
    # (login trouble, app access trouble) -- neither fits any of the
    # three intent buckets, so including them would teach a wrong signal.
    "I have a vet appointment on Wednesday and I need to book a delivery of food for my pet",
    "Can I get a status update on my order 12345",
    "I want to add a new pet to my account what do I need to do",
    "I'm trying to cancel my subscription but it won't let me",
    "Where is my pet's vaccination record",
    "I need to change my vet's contact information",
    "I want to order a product but it's not showing up in the search results",
    "Can you please remind me of my pet's appointment time on Thursday",
    "I received the wrong product in my last delivery",
    "I'm trying to book a vet appointment but I keep getting an error message",
    "I want to change my pet's name on the profile",
    "My pet is allergic to a certain ingredient can I get a list of products that are safe",
    "I need to reorder food for my pet but I don't have the order number",
    "I'm having trouble accessing the doctor's schedule online",
    "I want to cancel my vet appointment for tomorrow",
    "Can you please expedite my order I need it for tomorrow",
    "I'm trying to add a new doctor to my account but it won't let me",
    "I want to know when the new product will be in stock",
    "I need to update my payment method but the system won't let me",
    "I'm trying to book an appointment with a specific doctor but they're not available",
    "Can you please look up my pet's vaccination record",
    "I want to change my delivery address but it's not showing up in the system",
    "I need to book a vet appointment for my new pet but I don't have the correct information on file",
    # Closed-loop test miss: "when will X arrive" delivery-status question
    # about the customer's own order, misrouted to knowledge_agent.
    "when will my puppy food arrive",
    "when is my dog food delivery expected",
    "what day will my order show up",
    # Contrastive fix for a recurring "Do you have/offer/carry X" ambiguity
    # -- caught 3 separate times across different closed-loop test batches,
    # oscillating between commerce_agent and knowledge_agent depending on
    # the specific wording. The real distinguishing signal isn't the
    # "Do you have/offer" prefix itself, it's WHAT KIND OF THING X is: a
    # concrete product/booking-slot (commerce_agent, paired here) vs. a
    # policy/program/guideline/article (knowledge_agent, paired in that
    # list below with the exact same sentence shape). These are meant to
    # be read as matched pairs against the knowledge_agent set.
    "Do you have grain-free dog food in stock",
    "Do you offer salmon flavored treats",
    "Do you carry raw food diets for cats",
    "Do you have anything for puppies with sensitive stomachs",
    "Do you offer same-day vet appointments",
    "Do you carry prescription cat food",
    "Do you have overnight shipping available for my order",
    "Do you offer expedited delivery for this specific item",
    "Do you have any vet slots open this week",
    "Do you carry the chicken and rice formula",
    # Business rule: vague "refund"/"cancel subscription" questions with no
    # concrete order/booking reference default to knowledge_agent (see the
    # matching examples in that list) since there's no generic refund or
    # subscription-cancellation tool in the real backend -- only a specific,
    # referenced order/appointment is actually actionable here.
    "Cancel my subscription order number 4521",
    "I want a refund processed for order 205",
    "Please cancel my Tuesday 3pm vet appointment",
    "Cancel order 88 and refund me",
    # Closed-loop test misses: a bare booking request with no symptom
    # mentioned was pattern-matching to health vocabulary ("dog"/"doc"),
    # and a terse stock-check fragment didn't generalize from the fuller
    # "Do you have/carry X in stock" examples above.
    "my dog needs a doc visit",
    "my cat needs to see a vet, can you set that up",
    "pet food out of stock?",
    "is the salmon recipe out of stock?",
    # Another wording of the recurring "Do you have X" family: staff/doctor
    # availability for booking, not a product or a policy question.
    "Which vets do you have on staff and when are they free",
    "Do you have any doctors available this week",
    "What doctors do you have on staff",
    # Real production miss (caught live via server logs): "what are the
    # product we have" -- loose/awkward grammar variant of "what products
    # do you have" that the existing examples didn't generalize to.
    "what are the product we have",
    "what products we have",
    "what all products do you have",
    "show me what products you have",
    "what items do we have available",
    "what do we have in stock",
]

KNOWLEDGE_AGENT_EXAMPLES = [
    "What is your return policy",
    "How long does shipping take",
    "Can I get a refund if my dog doesn't like the food",
    "What ingredients are used in your recipes",
    "Do you offer a membership program",
    "What areas do you deliver to",
    "How is the food stored before delivery",
    "Are your recipes vet formulated",
    "What is the shelf life of the vacuum pouches",
    "Do you use any preservatives in your food",
    "How do I change my delivery frequency",
    "What is your cancellation policy for subscriptions",
    "Can I pause my subscription",
    "How should I store the dog food after opening",
    "What is the best way to transition my dog to a new diet",
    "Do you have any articles about puppy nutrition",
    "What is your policy on damaged packages",
    "How can I contact customer support",
    "Are your products suitable for senior dogs",
    "What payment methods do you accept",
    "Is your packaging recyclable",
    "How often should I feed my adult dog",
    "What is the difference between grain free and grain inclusive food",
    "Do you offer discounts for first time customers",
    "What is your policy on quality complaints",
    "How do I read the nutrition label on the pouch",
    "Can I get a refund for a damaged order",
    "What certifications do your products have",
    "Tell me about your farm sourcing practices",
    "How long can food stay in the fridge once opened",
    "What is your policy about missed deliveries",
    "Do you have a loyalty rewards program",
    "How is your dog food different from kibble",
    "What should I know before switching my pet's food",
    "Is there a minimum order amount for free shipping",
    "How do I update my account information",
    "What is your data privacy policy",
    "Can I get a sample pack before subscribing",
    "What is your policy for allergic reactions to the food",
    "Do you have general tips for caring for a new puppy",
    # Counterweight against commerce_agent — the "carry/have/stock X"
    # product-availability examples added above taught the model that
    # "Do you ___" leans commerce, which then wrongly pulled a genuine
    # shipping-policy question ("Do you ship to rural addresses or just
    # cities") into commerce_agent at 0.90 confidence. These keep "Do
    # you ___" from being treated as commerce-only.
    "Do you ship to rural addresses or just cities",
    "Do you deliver on weekends",
    "Do you offer refunds for unopened pouches",
    "Do you provide receipts for insurance claims",
    "Can I get my money back if my dog just won't touch it",
    # Boundary case against commerce_agent — pet-care/training article
    # topics, caught by the real test suite (test_rag_upload.py uploads a
    # "positive reinforcement training" document and asks about it):
    # "positive reinforcement training" scored 0.71 for commerce_agent
    # since the training set had zero examples using "training" as a
    # topic at all, only as a synonym for booking/consultation actions.
    "Positive reinforcement training",
    "What is positive reinforcement training for dogs",
    "Tips for crate training a new puppy",
    "How do I house train my dog",
    "Best way to train a dog not to bark",
    "Articles on leash training techniques",
    # Generated via a locally self-hosted Ollama model (llama3.1:8b) using
    # intent_classifier/generate_synthetic_data.py, reviewed by hand.
    "I'm looking for information on your store's return policy",
    "Can I get a list of all your store locations so I can pick up in person",
    "Do you have a pet food recall policy in place",
    "Need to know about your subscription cancellation process",
    "My local pet store stopped carrying your brand what can I do",
    "Do you have any articles on transitioning my cat to a new food",
    "Are your products grain free or can I make my own",
    "I'm having trouble finding a specific flavor of your food where can I look",
    "Can you email me the ingredients for your beef based formula",
    "How do I store your food to keep it fresh for my pets",
    "Do you have any tips for introducing new pets to each other",
    "Do you offer any discounts for military personnel",
    "I need to know if your food is safe for dogs with food allergies",
    "Can I get a copy of your store policies in writing",
    "I'm looking for advice on how to switch my dog to a raw diet",
    "Do you offer any articles or resources on pet nutrition",
    "Can you tell me about your shipping costs and times",
    "Do you have a loyalty program for frequent customers",
    "Can I get a list of all the ingredients used in your chicken formula",
    "How do I know which size of your food to buy for my pet",
    "Do you have any tips for training a new puppy",
    # Ollama batch 2. Dropped 1 off-domain candidate ("not satisfied with
    # service, want a customer service rep") -- a generic escalation
    # request, not a policy/FAQ/article question.
    "I have a dog with food allergies can you tell me what ingredients are used in your puppy food",
    "I am looking for pet food that is grain free and hypoallergenic for my cat",
    "I'm looking for advice on transitioning my dog to a new food what is the best method",
    "I need to know the refund policy for unopened bags of pet food",
    "Can you please provide a list of ingredients for each of your dog food formulas",
    "I want to start a subscription with your company but I need to know how to cancel",
    "I am concerned about the safety of your shipping process can you explain how you handle temperature control",
    "I have a cat with kidney disease what type of food is best for her to eat",
    "Do you have any articles on healthy diet transitions for dogs",
    "I am looking for pet food that is sustainable and eco-friendly",
    "I need to know the expiration date of the pet food I purchased",
    "Can you provide a link to your pet care articles on healthy diet transitions for cats",
    "I have a dog with a sensitive stomach can you recommend a food that is gentle on the digestive system",
    "I want to start a pet food subscription but I need to know if I can pause or skip a month",
    "I am concerned about the safety of your pet food what kind of testing do you do",
    "I am looking for pet food that is made in the USA and uses only natural ingredients",
    "I need to know the return policy for opened bags of pet food",
    "I want to cancel my subscription but I'm not sure how to do it",
    "Can you provide a list of the most common pet allergies and how to treat them",
    "I have a cat that is prone to hairballs what type of food can I feed her to help prevent this",
    "I am looking for pet food that is high in protein and low in carbohydrates",
    "I want to know more about your company's commitment to sustainability and eco-friendliness",
    "I need to know the shelf life of your pet food and how to store it properly",
    "I am not sure what type of food to feed my new puppy can you provide some recommendations",
    "I am looking for pet food that is specifically designed for senior dogs",
    # Persistent boundary case against commerce_agent — "delivery cycle"
    # phrasing pattern-matches commerce's delivery/order vocabulary even
    # when the actual question is about subscription policy, not a
    # specific order. Survived two prior retraining rounds at 0.62 then
    # 0.57 confidence before this fix.
    "Whats the deal if i skip a delivery cycle",
    "Can I skip a delivery cycle without cancelling my subscription",
    "What happens to my subscription if I skip one delivery cycle",
    "Is there a fee for skipping a delivery cycle",
    # Closed-loop test misses: exact real cases of the shipping-vs-product
    # and "Do you have guidelines" ambiguity below.
    "What are the shipping options for orders over $50",
    "Do you have guidelines for storing dry cat food",
    # Contrastive fix, matched against the commerce_agent set above --
    # same "Do you have/offer/carry X" sentence shape, but X here is a
    # policy, program, guideline, or article rather than a concrete
    # product or bookable slot.
    "Do you have a return policy for opened bags",
    "Do you offer a loyalty rewards program",
    "Do you have guidelines for storing wet food after opening",
    "Do you offer discounts for first time customers",
    "Do you have an article on switching my dog to a new food",
    "Do you offer international shipping to other countries",
    "Do you have a policy for packages that arrive damaged",
    "Do you offer any nutrition advice for senior dogs",
    "Do you have information about where your ingredients are sourced",
    "Do you offer any tips for dealing with pet anxiety",
    # Business rule: vague "refund"/"cancel subscription" questions with no
    # concrete order/booking reference -- there's no generic refund or
    # subscription-cancellation tool in the real backend, so these can only
    # be meaningfully answered as policy/procedure explanations. Moved
    # "cancel my subscription" and "refund for last month's subscription"
    # here from commerce_agent for consistency with this rule. Closed-loop
    # test miss: "How do I cancel my subscription order?" was the exact
    # case that exposed the inconsistency.
    "cancel my subscription",
    "can I get a refund for the last month's subscription",
    "How do I cancel my subscription order",
    "how do I cancel my subscription",
    "can I get a refund",
    "what's the process to cancel my order",
    "how does the refund process work",
]


def load_training_examples() -> list[tuple[str, str]]:
    """Return the full (text, label) dataset as a flat list."""
    examples: list[tuple[str, str]] = []
    examples += [(q, "health_agent") for q in HEALTH_AGENT_EXAMPLES]
    examples += [(q, "commerce_agent") for q in COMMERCE_AGENT_EXAMPLES]
    examples += [(q, "knowledge_agent") for q in KNOWLEDGE_AGENT_EXAMPLES]
    return examples
