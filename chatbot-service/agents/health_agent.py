"""Health Triage Agent Node - Evaluates pet health symptoms with emergency classification & disclaimers."""

import asyncio
import os
from typing import Any
from langchain_core.runnables import RunnableConfig
from utils.llm_gateway import get_llm_with_fallback
from rag.vector_store import vector_store

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


async def health_agent_node(state: dict[str, Any], config: RunnableConfig | None = None) -> dict[str, Any]:
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

    # 2. Retrieve Grounding Docs from Vector Store (RAG)
    # Offloaded to a thread — see knowledge_agent.py for why (this is the
    # same synchronous, network-bound embed+Pinecone-query call).
    docs = await asyncio.to_thread(vector_store.search_knowledge, user_query, top_k=2)

    # 3. Non-Emergency Health Guidance Synthesis via ChatLiteLLM
    if GEMINI_API_KEY:
        try:
            llm = get_llm_with_fallback(model_name="gemini/gemini-3.5-flash-lite", temperature=0.2)
            
            context_str = ""
            if docs:
                context_str = "\n\nReference Context:\n" + "\n\n".join([f"--- [{d['title']}] ---\n{d['content']}" for d in docs])
            
            prompt = (
                "You are Scooby Kitchen's AI Veterinary Health Advisor. Provide safe, empathetic, "
                "and helpful general pet health guidance for the user's inquiry.\n"
                "CRITICAL: Keep your response short, concise, and direct (maximum 4 sentences or a few short bullet points).\n"
                f"{context_str}\n\n"
                f"User Question: {user_query}"
            )
            # Stream instead of a single blocking ainvoke() call so the graph's
            # astream_events() picks up on_chat_model_stream events and the
            # client sees tokens as they're generated, not one final dump.
            # Merge in the ambient callbacks explicitly rather than relying
            # on .with_config() to inherit them — verified it doesn't
            # reliably propagate callbacks from the parent graph invocation.
            stream_config = {"tags": ["agent_response"], "callbacks": (config or {}).get("callbacks")}
            reply_parts: list[str] = []
            async for chunk in llm.astream(prompt, config=stream_config):
                # `.text` extracts plain text whether Gemini streams a plain
                # string or (as it does today) a list of content blocks —
                # `chunk.content` being a list here was silently crashing
                # this join() on every call, falling back to a canned
                # message instead of an actual written answer.
                piece = chunk.text if hasattr(chunk, "text") else str(chunk)
                if piece:
                    reply_parts.append(piece)
            base_reply = "".join(reply_parts)
        except Exception as e:
            print(f"❌ [Agent Exception] health_agent failed: {e}", flush=True)
            import traceback
            traceback.print_exc()
            base_reply = (
                "For mild symptoms like minor skin dryness or occasional sneezing, ensure your pet remains "
                "hydrated and rested. If symptoms persist for more than 24 hours, consider booking a vet consultation."
            )
    else:
        base_reply = (
            "For mild symptoms like minor skin dryness or occasional sneezing, ensure your pet remains "
            "hydrated and rested. If symptoms persist for more than 24 hours, consider booking a vet consultation."
        )

    if isinstance(base_reply, list):
        parts = []
        for block in base_reply:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
            else:
                parts.append(str(block))
        base_reply = "".join(parts)
    else:
        base_reply = str(base_reply)

    full_reply = base_reply + MEDICAL_DISCLAIMER
    sources = [d["title"] for d in docs] if docs else ["Scooby Veterinary Guidance"]
    
    return {
        "messages": messages + [{"role": "assistant", "content": full_reply}],
        "is_emergency": False,
        "sources": sources,
    }
