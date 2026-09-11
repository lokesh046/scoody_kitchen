"""Fast in-process intent classifier — the cheap first pass in front of the
Gemini router call in agents/supervisor.py.

Deliberately NOT built on PyCaret: PyCaret is a training-time convenience
(it automates comparing algorithms — see train.py, which does the same
comparison by hand) but its own dependency chain (pmdarima, sktime, lightgbm,
catboost, and more, most irrelevant to a text classifier) is too heavy and,
on this project's Python version, outright fails to install. The artifact
train.py produces is a plain scikit-learn Pipeline, so this module only
needs scikit-learn + joblib at runtime — nothing else changes in the
request path.
"""

import pathlib
import threading

import joblib

MODEL_PATH = pathlib.Path(__file__).parent / "model" / "intent_classifier.joblib"

# Below this confidence, the classifier's own prediction isn't trusted —
# agents/supervisor.py falls through to the existing Gemini call instead.
# This is what makes swapping in a classifier trained on only ~100
# bootstrap examples safe: it only ever short-circuits the LLM call on
# queries it recognizes with high confidence, never gambles on unclear ones.
CONFIDENCE_THRESHOLD = 0.55

_lock = threading.Lock()
_pipeline = None


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        with _lock:
            if _pipeline is None:
                if not MODEL_PATH.exists():
                    raise FileNotFoundError(
                        f"No trained model at {MODEL_PATH}. Run "
                        "`python -m intent_classifier.train` from chatbot-service/ first."
                    )
                bundle = joblib.load(MODEL_PATH)
                _pipeline = bundle["pipeline"]
    return _pipeline


def classify(query: str) -> tuple[str | None, float]:
    """Return (predicted_label, confidence) or (None, 0.0) if the model
    isn't trained yet or the query is empty. Never raises for a missing
    model in a way that would break the caller — supervisor.py treats a
    None label exactly like a low-confidence prediction and falls back."""
    if not query or not query.strip():
        return None, 0.0

    try:
        pipeline = _get_pipeline()
    except FileNotFoundError:
        return None, 0.0

    probs = pipeline.predict_proba([query])[0]
    classes = pipeline.classes_
    best_idx = probs.argmax()
    return str(classes[best_idx]), float(probs[best_idx])
