"""Closed-loop test harness: Ollama generates test questions with a KNOWN
correct department, the real ML router decides where each one goes, and
Ollama then plays whichever agent got picked and produces the actual
answer -- so this checks two things per question, not just one:

  1. Did the router pick the department we already know is correct?
  2. Does the resulting answer actually make sense for that question?
     (a right-label-wrong-answer case would slip past check #1 alone)

This is a TEST/dev-time tool, same as generate_synthetic_data.py -- it
does not touch production. It uses simplified stand-ins for the real
agents (real RAG retrieval, but a couple of representative read-only
tools instead of the full HITL-gated tool set commerce_agent.py has) --
enough to exercise real tool-calling, not a production-fidelity copy of
commerce_agent.py's confirmation flow, idempotency keys, etc.

Any real router mismatch gets written to a review file, exactly like
generate_synthetic_data.py -- never auto-merged into training_data.py
without a human reading it first.

Usage (from chatbot-service/, with Ollama running and qwen2.5:14b pulled):
    python -m intent_classifier.closed_loop_test --count 10
"""

import argparse
import asyncio
import pathlib
import time

from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain_ollama import ChatOllama

from agents.supervisor import route_intent
from intent_classifier.generate_synthetic_data import CATEGORY_PROMPTS, generate_for_category

REVIEW_FILE = pathlib.Path(__file__).parent / "closed_loop_misroutes_review.txt"


# --- Simplified stand-in tools for the commerce test loop -----------------
# Not the real MCP tools (no auth, no DB, no HITL) -- just enough shape for
# Ollama to demonstrate genuine tool selection + argument extraction, which
# is what this harness is actually checking.
@tool
def get_order_status(order_id: int) -> str:
    """Get the current status of an order by its ID."""
    return f"Order {order_id} is currently shipped and out for delivery, arriving in 2 days."


@tool
def search_products(search: str) -> str:
    """Search the product catalog by keyword."""
    return f"Found 2 products matching '{search}': Hearth & Hound Chicken Recipe ($24.99), Hearth & Hound Beef Recipe ($26.99)."


@tool
def get_available_slots() -> str:
    """Get available vet consultation time slots."""
    return "Available slots: Dr. Patel Tue 10am, Dr. Singh Wed 2pm, Dr. Lee Thu 4pm."


COMMERCE_TOOLS = [get_order_status, search_products, get_available_slots]


def run_commerce_agent_ollama(query: str, llm: ChatOllama) -> str:
    llm_with_tools = llm.bind_tools(COMMERCE_TOOLS)
    messages = [HumanMessage(content=query)]
    ai_msg = llm_with_tools.invoke(messages)
    messages.append(ai_msg)

    tools_by_name = {t.name: t for t in COMMERCE_TOOLS}
    for call in ai_msg.tool_calls:
        tool_fn = tools_by_name.get(call["name"])
        if tool_fn:
            result = tool_fn.invoke(call["args"])
            messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))

    if ai_msg.tool_calls:
        final = llm_with_tools.invoke(messages)
        return final.content
    return ai_msg.content


def run_knowledge_or_health_agent_ollama(query: str, llm: ChatOllama) -> str:
    from rag.vector_store import vector_store

    docs = vector_store.search_knowledge(query, top_k=3)
    if not docs:
        return "[no RAG context found -- would hit the anti-hallucination fallback in production]"
    context = "\n\n".join(f"--- [{d['title']}] ---\n{d['content']}" for d in docs)
    prompt = (
        f"Answer the customer's question using only this reference context. "
        f"Keep it short (2-3 sentences).\n\nContext:\n{context}\n\nQuestion: {query}"
    )
    return llm.invoke(prompt).content


def run_agent(label: str, query: str, llm: ChatOllama) -> str:
    if label == "commerce_agent":
        return run_commerce_agent_ollama(query, llm)
    return run_knowledge_or_health_agent_ollama(query, llm)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=10, help="Test questions per category")
    parser.add_argument("--model", default="qwen2.5:14b", help="Ollama model tag")
    args = parser.parse_args()

    llm = ChatOllama(model=args.model, temperature=0.2)

    total = 0
    correct = 0
    misroutes = []
    route_times: list[float] = []
    agent_times: list[float] = []

    for expected_label in CATEGORY_PROMPTS:
        print(f"\n{'=' * 70}\nCategory: {expected_label}\n{'=' * 70}")
        questions = generate_for_category(expected_label, args.count, args.model)
        for q in questions:
            total += 1
            t0 = time.perf_counter()
            routed_label = route_intent(q)
            route_ms = (time.perf_counter() - t0) * 1000.0
            route_times.append(route_ms)

            match = routed_label == expected_label
            correct += int(match)
            marker = "OK" if match else "XX"
            print(f"\n[{marker}] expected={expected_label} routed={routed_label} (routing: {route_ms:.1f}ms)\n  Q: {q}")

            if not match:
                misroutes.append((q, expected_label, routed_label))
                continue  # don't bother executing the wrong agent's answer

            try:
                t1 = time.perf_counter()
                answer = run_agent(routed_label, q, llm)
                agent_ms = (time.perf_counter() - t1) * 1000.0
                agent_times.append(agent_ms)
                print(f"  A ({agent_ms:.0f}ms): {answer[:200]}")
            except Exception as exc:
                print(f"  A: [agent execution failed: {exc}]")

    print(f"\n{'=' * 70}\nRouting accuracy: {correct}/{total} = {correct/total:.1%}")
    if route_times:
        print(
            f"Routing time: avg {sum(route_times)/len(route_times):.1f}ms, "
            f"min {min(route_times):.1f}ms, max {max(route_times):.1f}ms"
        )
    if agent_times:
        print(
            f"Ollama agent execution time: avg {sum(agent_times)/len(agent_times):.0f}ms, "
            f"min {min(agent_times):.0f}ms, max {max(agent_times):.0f}ms"
        )
    print("=" * 70)

    if misroutes:
        lines = [f"# {len(misroutes)} routing mismatches found -- review before adding to training_data.py\n"]
        for q, expected, got in misroutes:
            lines.append(f"# expected={expected} got={got}")
            lines.append(q)
            lines.append("")
        REVIEW_FILE.write_text("\n".join(lines))
        print(f"Wrote {len(misroutes)} misroutes to {REVIEW_FILE} for review.")
    else:
        print("No misroutes found this run.")


if __name__ == "__main__":
    main()
