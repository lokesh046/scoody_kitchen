"""Knowledge Agent Node - Executes RAG Retrieval & Grounded Answer Synthesis."""

import os
from typing import Any
from rag.vector_store import vector_store

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


async def knowledge_agent_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node for static domain knowledge queries (pet care, FAQs, policies)."""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    # 1. Retrieve Grounding Docs from Vector Store
    docs = vector_store.search_knowledge(user_query, top_k=3)

    # 2. Edge Case Fix #12: Anti-Hallucination Check
    if not docs:
        fallback_reply = (
            "I am Scooby Kitchen's AI Assistant. I don't have specific official information "
            "on that topic in my knowledge base. For safety reasons, please consult our support "
            "team or a licensed veterinarian for specialized guidance."
        )
        return {
            "messages": messages + [{"role": "assistant", "content": fallback_reply}],
            "context_found": False,
            "sources": [],
        }

    # 3. Assemble Context & Generate Grounded Answer
    context_str = "\n\n".join([f"--- [{d['title']}] ---\n{d['content']}" for d in docs])
    sources = [d["title"] for d in docs]

    if GEMINI_API_KEY:
        try:
            from utils.llm_gateway import get_llm_with_fallback
            llm = get_llm_with_fallback(model_name="gemini/gemini-2.5-flash", temperature=0.2)
            
            prompt = (
                f"You are Scooby Kitchen's AI Pet Assistant. Answer the customer's question strictly "
                f"using the provided reference context below. Do NOT hallucinate or guess instructions.\n\n"
                f"Reference Context:\n{context_str}\n\n"
                f"Customer Question: {user_query}"
            )
            response = await llm.ainvoke(prompt)
            reply = response.content if hasattr(response, "content") else str(response)
        except Exception:
            reply = f"Based on our official reference ({sources[0]}):\n{docs[0]['content']}"
    else:
        reply = f"Based on our official reference ({sources[0]}):\n{docs[0]['content']}"

    return {
        "messages": messages + [{"role": "assistant", "content": reply}],
        "context_found": True,
        "sources": sources,
    }
