"""Supervisor Router Node - Multi-agent Intent Classification Engine powered by ChatLiteLLM."""

import os
from typing import Any
from intent_classifier.classifier import CONFIDENCE_THRESHOLD, classify as classify_locally
from intent_classifier.logging_ import log_routing_decision
from utils.llm_gateway import get_llm_with_fallback

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def route_intent(query: str) -> str:
    """Classify customer intent to route to health_agent, commerce_agent, or knowledge_agent.

    Three tiers, cheapest first: a local scikit-learn classifier (no
    network call, sub-millisecond) handles the common, clearly-worded
    cases; only a low-confidence result pays for a Gemini classification
    call; a plain keyword match is the last-resort fallback if that call
    also fails. This is what actually removes the "extra Gemini call on
    every single message" cost the graph used to always pay — see
    graph/workflow.py's router_node timer.
    """
    if not query or not query.strip():
        return "knowledge_agent"

    local_label, local_confidence = classify_locally(query)
    if local_label and local_confidence >= CONFIDENCE_THRESHOLD:
        log_routing_decision(query, local_label, tier="local_classifier", confidence=local_confidence)
        return local_label

    if GEMINI_API_KEY:
        try:
            llm = get_llm_with_fallback(model_name="gemini/gemini-3.1-flash-lite", temperature=0.0)
            prompt = (
                "Classify the following customer query into exactly ONE of three category names:\n"
                "1. 'health_agent' (for pet medical symptoms, illness, fever, bleeding, or health concerns)\n"
                "2. 'commerce_agent' (for order status, shipment tracking, product inventory, vet booking, doctor schedules, doctor availability, pet profiles, cancellations, active consultations, or booked appointments)\n"
                "3. 'knowledge_agent' (for store policies, FAQs, return rules, and pet care articles)\n\n"
                f"Customer Query: {query}\n"
                "Return ONLY the category name string ('health_agent', 'commerce_agent', or 'knowledge_agent')."
            )
            response = llm.invoke(prompt)
            raw = response.content if hasattr(response, "content") else str(response)
            clean = raw.strip().lower().replace("'", "").replace('"', "")
            if clean in ["health_agent", "commerce_agent", "knowledge_agent"]:
                log_routing_decision(query, clean, tier="gemini")
                return clean
        except Exception:
            pass

    # Basic fallback string check if LLM API is unavailable
    clean_q = query.lower()
    if any(k in clean_q for k in ["sick", "vomit", "bleeding", "health", "symptom", "rash"]):
        log_routing_decision(query, "health_agent", tier="keyword")
        return "health_agent"
    if any(k in clean_q for k in ["order", "track", "status", "cancel", "product", "vet", "book", "slot", "yes", "confirm", "proceed", "pet", "pets", "doctor", "doctors", "availability", "appointment", "appointments", "consultation", "consultations"]):
        log_routing_decision(query, "commerce_agent", tier="keyword")
        return "commerce_agent"
    log_routing_decision(query, "knowledge_agent", tier="keyword")
    return "knowledge_agent"
