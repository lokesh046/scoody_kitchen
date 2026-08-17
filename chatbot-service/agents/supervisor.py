"""Supervisor Router Node - Multi-agent Intent Classification Engine."""

import os
from typing import Any

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def route_intent(query: str) -> str:
    """Classify customer intent to route to health_agent, commerce_agent, or knowledge_agent."""
    clean = query.lower().strip()

    # 1. Urgent Health & Symptom Indicators
    health_terms = ["sick", "vomit", "bleeding", "diarrhea", "lethargic", "fever", "cough", "health", "symptom", "seizure", "poison", "pain", "limping", "rash"]
    if any(term in clean for term in health_terms):
        return "health_agent"

    # 2. Commerce, Product & Booking Indicators
    commerce_terms = ["order", "track", "status", "cancel", "product", "stock", "vet", "slot", "book", "buy", "price", "cart"]
    if any(term in clean for term in commerce_terms):
        return "commerce_agent"

    # 3. LLM Intent Classifier for ambiguous cases
    if GEMINI_API_KEY:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GEMINI_API_KEY, temperature=0.0)
            prompt = (
                "Classify the following customer question into exactly one of three categories:\n"
                "1. 'health_agent' (pet medical symptoms, illness, health concerns)\n"
                "2. 'commerce_agent' (order status, product inventory, vet booking, cancellations)\n"
                "3. 'knowledge_agent' (general store policies, FAQs, pet care articles)\n\n"
                f"Customer Query: {query}\n"
                "Return ONLY the category name."
            )
            res = llm.invoke(prompt)
            cat = res.content.strip().lower() if hasattr(res, "content") else str(res).strip().lower()
            if cat in ["health_agent", "commerce_agent", "knowledge_agent"]:
                return cat
        except Exception:
            pass

    # 4. Default Fallback
    return "knowledge_agent"
