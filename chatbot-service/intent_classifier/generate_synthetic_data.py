"""Generates candidate training examples for the intent classifier using a
locally self-hosted Ollama model — free, unlimited generation with no
per-token API cost, unlike calling Gemini for the same task.

This is a DEV-TIME tool only. Nothing in the production request path
(supervisor.py, classifier.py, train.py) talks to Ollama — it must be
running locally only when you choose to run this script.

Requires Ollama running locally (see README section on setup) with the
model pulled: `ollama pull qwen2.5:14b`.

Output is NOT written directly into training_data.py. A loosely-prompted
generation run produces unusable conversational chit-chat ("How's your
furry friend doing today?") instead of direct customer messages — proven
empirically before this script was written. So this always writes to a
separate review file first; a human (or Claude, on request) reads that
file, discards anything bad, and manually merges the good lines into
training_data.py's category lists. Never automate away that review step.

Usage (from chatbot-service/):
    python -m intent_classifier.generate_synthetic_data
    python -m intent_classifier.generate_synthetic_data --count 20 --model qwen2.5:14b
"""

import argparse
import pathlib
import re

import httpx

OLLAMA_URL = "http://localhost:11434/api/generate"
REVIEW_FILE = pathlib.Path(__file__).parent / "generated_candidates_review.txt"

# One prompt per category, deliberately narrow per the lesson learned
# above: explicit about first-person, direct, non-conversational, one
# message per line. Each includes a few style angles (casual, urgent,
# typo-laden, formal) baked into the instruction so one call yields
# varied phrasing rather than N near-duplicates of the same sentence shape.
CATEGORY_PROMPTS = {
    "health_agent": (
        "You are generating training examples for a pet-care company's support "
        "chatbot intent classifier. Write {count} short, direct messages a pet "
        "owner would actually TYPE into a chat box to describe a health concern, "
        "symptom, or worry about their dog or cat (vomiting, limping, not eating, "
        "skin issues, behavior changes, etc).\n"
        "Mix styles across the list: some casual/typo-laden, some worried and "
        "urgent, some calm and matter-of-fact, some with typos or lowercase.\n"
        "Rules: first person, direct, like a real customer message. NOT a "
        "question to a friend, NOT conversational filler, NOT giving advice. "
        "No numbering, no bullets, no quotes — one message per line, nothing else."
    ),
    "commerce_agent": (
        "You are generating training examples for a pet-care company's support "
        "chatbot intent classifier. Write {count} short, direct messages a "
        "customer would actually TYPE into a chat box about orders, deliveries, "
        "product/recipe availability, vet appointment booking or cancellation, "
        "doctor availability, or managing their pet profiles.\n"
        "Mix styles across the list: some casual/informal ('wheres my stuff'), "
        "some formal, some short and blunt, some longer and explanatory.\n"
        "Rules: first person, direct, like a real customer message. NOT a "
        "question to a friend, NOT conversational filler. No numbering, no "
        "bullets, no quotes — one message per line, nothing else."
    ),
    "knowledge_agent": (
        "You are generating training examples for a pet-care company's support "
        "chatbot intent classifier. Write {count} short, direct messages a "
        "customer would actually TYPE into a chat box asking about store "
        "policies, refund/return rules, shipping, ingredients, food storage, "
        "subscriptions, or general pet-care advice articles (training tips, "
        "diet transitions, etc) — NOT about their own specific order or pet.\n"
        "Mix styles across the list: some casual, some formal, some short "
        "and blunt, some longer and explanatory.\n"
        "Rules: first person, direct, like a real customer message. NOT a "
        "question to a friend, NOT conversational filler. No numbering, no "
        "bullets, no quotes — one message per line, nothing else."
    ),
}


def generate_for_category(category: str, count: int, model: str) -> list[str]:
    prompt = CATEGORY_PROMPTS[category].format(count=count)
    try:
        resp = httpx.post(
            OLLAMA_URL,
            json={"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.9}},
            timeout=120.0,
        )
        resp.raise_for_status()
    except httpx.ConnectError as exc:
        raise RuntimeError(
            "Could not reach Ollama at http://localhost:11434 — is it running? "
            "Start it with `brew services start ollama`."
        ) from exc

    raw = resp.json().get("response", "")
    lines = [line.strip() for line in raw.splitlines()]
    # Drop empties and strip any numbering/bullet/quote formatting the model
    # adds despite being told not to — cheap normalization, not a quality filter.
    cleaned = []
    for line in lines:
        if not line:
            continue
        line = re.sub(r'^[\d]+[\.\)]\s*', '', line)
        line = re.sub(r'^[-*•]\s*', '', line)
        line = line.strip('"\'')
        if line:
            cleaned.append(line)
    return cleaned


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=20, help="Examples to request per category")
    parser.add_argument("--model", default="qwen2.5:14b", help="Ollama model tag to use")
    args = parser.parse_args()

    all_lines = []
    for category in CATEGORY_PROMPTS:
        print(f"Generating {args.count} candidates for {category}...")
        try:
            candidates = generate_for_category(category, args.count, args.model)
        except RuntimeError as exc:
            print(f"  ERROR: {exc}")
            return
        print(f"  got {len(candidates)} lines")
        all_lines.append(f"\n# ===== {category} ({len(candidates)} candidates) =====")
        all_lines.extend(candidates)

    REVIEW_FILE.write_text("\n".join(all_lines) + "\n")
    print(
        f"\nWrote {sum(1 for l in all_lines if l and not l.startswith('#'))} "
        f"candidate lines to {REVIEW_FILE}\n"
        "Review this file by hand (or ask Claude to review it), delete anything "
        "unusable, then manually add the good ones to the matching category "
        "list in training_data.py before running `python -m intent_classifier.train` again."
    )


if __name__ == "__main__":
    main()
