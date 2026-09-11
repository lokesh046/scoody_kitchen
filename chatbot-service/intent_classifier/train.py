"""Train the intent-routing classifier and save it as a deployable artifact.

Does by hand what PyCaret's compare_models() automates: fit a handful of
classical text-classification algorithms on TF-IDF features, cross-validate
each, keep the best one, refit it on the full dataset, and save it. PyCaret
itself is deliberately not a runtime dependency here — see the comment in
classifier.py for why — this script produces a plain scikit-learn Pipeline
that classifier.py loads with nothing heavier than scikit-learn + joblib.

Run from chatbot-service/: python -m intent_classifier.train
"""

import pathlib

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from intent_classifier.training_data import load_training_examples

MODEL_PATH = pathlib.Path(__file__).parent / "model" / "intent_classifier.joblib"

# Every candidate must support predict_proba — the router needs a confidence
# score to decide whether to trust the classifier or fall back to the
# existing Gemini call (see agents/supervisor.py), not just a bare label.
CANDIDATES = {
    "logistic_regression": LogisticRegression(max_iter=1000, C=3.0),
    "multinomial_nb": MultinomialNB(),
    "sgd_log_loss": SGDClassifier(loss="log_loss", max_iter=2000, random_state=42),
    "calibrated_linear_svc": CalibratedClassifierCV(LinearSVC(), cv=3),
}


def build_pipeline(classifier) -> Pipeline:
    return Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                lowercase=True,
                ngram_range=(1, 2),
                min_df=1,
                sublinear_tf=True,
            ),
        ),
        ("clf", classifier),
    ])


def main() -> None:
    examples = load_training_examples()
    texts = [t for t, _ in examples]
    labels = [l for _, l in examples]

    print(f"Training on {len(texts)} labeled examples across {len(set(labels))} classes.\n")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores: dict[str, float] = {}
    for name, clf in CANDIDATES.items():
        pipeline = build_pipeline(clf)
        fold_scores = cross_val_score(pipeline, texts, labels, cv=cv, scoring="accuracy")
        scores[name] = float(np.mean(fold_scores))
        print(f"  {name:24s} mean accuracy = {scores[name]:.3f}  (folds: {[round(s, 3) for s in fold_scores]})")

    best_name = max(scores, key=lambda k: scores[k])
    print(f"\nBest candidate: {best_name} ({scores[best_name]:.3f} mean CV accuracy)")

    final_pipeline = build_pipeline(CANDIDATES[best_name])
    final_pipeline.fit(texts, labels)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"pipeline": final_pipeline, "classes": list(final_pipeline.classes_), "model_name": best_name},
        MODEL_PATH,
    )
    print(f"Saved trained pipeline to {MODEL_PATH}")


if __name__ == "__main__":
    main()
