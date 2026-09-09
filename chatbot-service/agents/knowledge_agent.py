"""Knowledge Agent Node - Executes RAG Retrieval & Grounded Answer Synthesis."""

import asyncio
import os
from typing import Any
from langchain_core.runnables import RunnableConfig
from rag.vector_store import vector_store
from memory.knowledge_cache import knowledge_cache

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


async def knowledge_agent_node(state: dict[str, Any], config: RunnableConfig | None = None) -> dict[str, Any]:
    """LangGraph node for static domain knowledge queries (pet care, FAQs, policies)."""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    # 0. FAQ-style knowledge answers are the same for every user, unlike
    # orders/bookings — so a repeat question can skip RAG + the LLM call
    # entirely and return straight from Redis.
    cached = await knowledge_cache.aget(user_query)
    if cached:
        return {
            "messages": messages + [{"role": "assistant", "content": cached["reply"]}],
            "context_found": True,
            "sources": cached.get("sources", []),
        }

    # 1. Retrieve Grounding Docs from Vector Store
    # search_knowledge() is a synchronous, network-bound call (embed the
    # query, then query Pinecone) — running it inline would block the whole
    # event loop for its duration, stalling every other concurrent request.
    # Offload it to a thread so this coroutine actually yields while it waits.
    docs = await asyncio.to_thread(vector_store.search_knowledge, user_query, top_k=3)

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
            llm = get_llm_with_fallback(model_name="gemini/gemini-3.5-flash-lite", temperature=0.2)

            prompt = (
                f"You are Scooby Kitchen's AI Pet Assistant. Answer the customer's question strictly "
                f"using the provided reference context below. Do NOT hallucinate or guess instructions.\n"
                f"CRITICAL: Keep your response short, concise, and direct (maximum 4 sentences or a few short bullet points).\n\n"
                f"Reference Context:\n{context_str}\n\n"
                f"Customer Question: {user_query}"
            )
            # Stream instead of a single blocking ainvoke() call so the graph's
            # astream_events() picks up on_chat_model_stream events and the
            # client sees tokens as they're generated, not one final dump.
            # Merge in the ambient callbacks (e.g. the per-request token
            # cost tracker) explicitly rather than relying on .with_config()
            # to inherit them — verified directly that it doesn't reliably
            # propagate callbacks from the parent graph invocation, which
            # silently undercounted token usage.
            stream_config = {"tags": ["agent_response"], "callbacks": (config or {}).get("callbacks")}
            reply_parts: list[str] = []
            async for chunk in llm.astream(prompt, config=stream_config):
                # `.text` extracts plain text whether Gemini streams a plain
                # string or (as it does today) a list of content blocks —
                # `chunk.content` being a list here was silently crashing
                # this join() on every call, always falling back to a raw
                # reference-doc dump instead of an actual written answer.
                piece = chunk.text if hasattr(chunk, "text") else str(chunk)
                if piece:
                    reply_parts.append(piece)
            reply = "".join(reply_parts)
        except Exception as e:
            print(f"❌ [Agent Exception] knowledge_agent failed: {e}", flush=True)
            import traceback
            traceback.print_exc()
            reply = f"Based on our official reference ({sources[0]}):\n{docs[0]['content']}"
    else:
        reply = f"Based on our official reference ({sources[0]}):\n{docs[0]['content']}"

    await knowledge_cache.aset(user_query, reply, sources)

    return {
        "messages": messages + [{"role": "assistant", "content": reply}],
        "context_found": True,
        "sources": sources,
    }
