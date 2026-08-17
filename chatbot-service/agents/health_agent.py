"""Health Triage Agent Node - Evaluates pet health symptoms with emergency classification & disclaimers."""

import os
from typing import Any

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

EMERGENCY_KEYWORDS = [
    "severe bleeding",
    "unconscious",
    "seizure",
    "choking",
    "poison",
    "chocolate",
    "grapes",
    "raisins",
    "onion",
    "garlic",
    "cannot breathe",
    "difficulty breathing",
    "collapsed",
    "pale gums",
    "snake bite",
]

MEDICAL_DISCLAIMER = (
    "\n\nMedical Disclaimer: This AI guidance is for informational purposes only and does not "
    "replace professional veterinary examination, diagnosis, or treatment."
)


def health_agent_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node for pet health triage & symptom evaluation."""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""
    query_lower = user_query.lower()

    # 1. Emergency Symptom Classification Check
    is_emergency = any(kw in query_lower for kw in EMERGENCY_KEYWORDS)
    if is_emergency:
        emergency_reply = (
            "🚨 EMERGENCY VETERINARY ALERT: Your pet appears to be experiencing a critical medical emergency! "
            "Please bring your pet to the nearest emergency veterinary clinic or animal hospital immediately. "
            "Do NOT delay seeking in-person emergency veterinary care!" + MEDICAL_DISCLAIMER
        )
        return {
            "messages": messages + [{"role": "assistant", "content": emergency_reply}],
            "is_emergency": True,
            "sources": ["Scooby Emergency Vet Protocol"],
        }

    # 2. Non-Emergency Health Guidance Synthesis
    if GEMINI_API_KEY:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GEMINI_API_KEY, temperature=0.2)
            prompt = (
                "You are Scooby Kitchen's AI Veterinary Health Advisor. Provide safe, empathetic, "
                "and helpful general pet health guidance for the user's inquiry.\n\n"
                f"User Question: {user_query}"
            )
            response = llm.invoke(prompt)
            base_reply = response.content if hasattr(response, "content") else str(response)
        except Exception:
            base_reply = (
                "For mild symptoms like minor skin dryness or occasional sneezing, ensure your pet remains "
                "hydrated and rested. If symptoms persist for more than 24 hours, consider booking a vet consultation."
            )
    else:
        base_reply = (
            "For mild symptoms like minor skin dryness or occasional sneezing, ensure your pet remains "
            "hydrated and rested. If symptoms persist for more than 24 hours, consider booking a vet consultation."
        )

    full_reply = base_reply + MEDICAL_DISCLAIMER
    return {
        "messages": messages + [{"role": "assistant", "content": full_reply}],
        "is_emergency": False,
        "sources": ["Scooby Veterinary Guidance"],
    }
