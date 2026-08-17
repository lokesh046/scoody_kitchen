"""Supervisor Router Node - Multi-agent Intent Classification Engine powered by ChatLiteLLM."""

import os
from typing import Any
from utils.llm_gateway import get_llm_with_fallback

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def route_intent(query: str) -> str:
    """Classify customer intent dynamically using ChatLiteLLM to route to health_agent, commerce_agent, or knowledge_agent."""
    if not query or not query.strip():
        return "knowledge_agent"

    if GEMINI_API_KEY:
        try:
            llm = get_llm_with_fallback(model_name="gemini/gemini-2.5-flash", temperature=0.0)
            prompt = (
                "Classify the following customer query into exactly ONE of three category names:\n"
                "1. 'health_agent' (for pet medical symptoms, illness, fever, bleeding, or health concerns)\n"
                "2. 'commerce_agent' (for order status, shipment tracking, product inventory, vet booking, or cancellations)\n"
                "3. 'knowledge_agent' (for store policies, FAQs, return rules, and pet care articles)\n\n"
                f"Customer Query: {query}\n"
                "Return ONLY the category name string ('health_agent', 'commerce_agent', or 'knowledge_agent')."
            )
            response = llm.invoke(prompt)
            raw = response.content if hasattr(response, "content") else str(response)
            clean = raw.strip().lower().replace("'", "").replace('"', "")
            if clean in ["health_agent", "commerce_agent", "knowledge_agent"]:
                return clean
        except Exception:
            pass

    # Basic fallback string check if LLM API is unavailable
    clean_q = query.lower()
    if any(k in clean_q for k in ["sick", "vomit", "bleeding", "health", "symptom", "rash"]):
        return "health_agent"
    if any(k in clean_q for k in ["order", "track", "status", "cancel", "product", "vet", "book", "slot", "yes", "confirm", "proceed"]):
        return "commerce_agent"
    return "knowledge_agent"
