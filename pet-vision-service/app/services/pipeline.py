import os
import io
import time
import json
import base64
import httpx
import numpy as np
import onnxruntime as ort
from PIL import Image
from dotenv import load_dotenv

from app.schemas import ClassificationResponse, BreedMatch, CareInsights
from app.services.imagenet_labels import PET_CLASSES
from app.services.metadata import get_breed_care_insights, get_breed_heritage

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "pet_classifier.onnx")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")


class PetVisionPipeline:
    def __init__(self, model_path: str = MODEL_PATH):
        self.session = None
        self.input_name = None
        self.output_name = None
        self.model_path = model_path
        self._load_onnx_session()

    def _load_onnx_session(self):
        """Pre-warm local ONNX model as an offline fallback."""
        if os.path.exists(self.model_path):
            try:
                opts = ort.SessionOptions()
                opts.intra_op_num_threads = 2
                opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session = ort.InferenceSession(self.model_path, opts, providers=["CPUExecutionProvider"])
                self.input_name = self.session.get_inputs()[0].name
                self.output_name = self.session.get_outputs()[0].name
                print("🐾 Local ONNX fallback model loaded successfully.")
            except Exception as e:
                print(f"⚠️ Warning: Could not initialize ONNX fallback session: {e}")

    def _preprocess_for_onnx(self, pil_image: Image.Image) -> np.ndarray:
        img = pil_image.convert("RGB")
        img = img.resize((224, 224), Image.Resampling.BILINEAR)
        arr = np.array(img, dtype=np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
        arr = arr.transpose(2, 0, 1)
        return np.expand_dims(arr, axis=0).astype(np.float32)

    def _predict_with_gemini(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> ClassificationResponse | None:
        """Query Gemini Vision API with tailored Indian & Western breed understanding."""
        if not GEMINI_API_KEY:
            return None

        start_time = time.perf_counter()
        b64_img = base64.b64encode(image_bytes).decode("utf-8")

        prompt = (
            "You are an expert veterinary companion animal specialist for Scooby's Kitchen, an honest small-batch pet wellness and fresh meal company in India.\n\n"
            "Analyze the uploaded image and determine:\n"
            "1. Is this a pet dog or cat? (is_pet: boolean). If it is a human, furniture, car, object, or other non-dog/non-cat subject, set is_pet: false.\n"
            "2. Species: 'Dog' or 'Cat'\n"
            "3. Primary Breed: Identify the breed accurately.\n"
            "   IMPORTANT FOR INDIAN COMPANIONS:\n"
            "   - Accurately recognize native and regional Indian breeds:\n"
            "     * 'Indian Pariah Dog (Indie / Desi Dog)' - triangular erect ears, slender athletic build, curved sickle tail, short coat (fawn, brown, white, piebald, or black).\n"
            "     * 'Indian Spitz' - fluffy white coat, pointed erect ears, curled tail (popular in Indian households).\n"
            "     * 'Rajapalayam' - milky-white muscular sighthound with pink nose and golden/amber eyes.\n"
            "     * 'Mudhol Hound / Caravan Hound' - lean, deep-chested aerodynamic sighthound.\n"
            "     * 'Chippiparai' - slender silver-grey/fawn hound from Tamil Nadu.\n"
            "     * 'Combai' - reddish-brown/tan compact bear hound with dark muzzle.\n"
            "     * 'Indian Domestic Shorthair (Indie Cat / Billi)' - agile, expressive native Indian cat.\n"
            "   - Also accurately recognize all international/Western breeds: Golden Retriever, Labrador Retriever, German Shepherd, Beagle, French Bulldog, Shih Tzu, Pug, Siberian Husky, Rottweiler, Doberman, Persian Cat, Siamese Cat, Bengal Cat, Maine Coon, British Shorthair, etc.\n"
            "   - If it is a mixed breed (e.g. Indie-Lab mix), state the primary visual breed and include secondary mix in top_matches.\n"
            "4. Confidence: Float between 0.10 and 1.00.\n"
            "5. Top Matches: List up to 3 likely breed matches with confidence scores.\n"
            "6. Adult Size Category: e.g. 'Toy (2 - 4 kg)', 'Small (5 - 10 kg)', 'Medium (12 - 22 kg)', 'Large (25 - 38 kg)', 'Giant (40+ kg)'.\n"
            "7. Temperament: Short 3-5 word description of personality.\n"
            "8. Nutritional Focus: Specific nutritional needs for this breed.\n"
            "9. Recommended Recipe: Recommended Scooby's Kitchen fresh food recipe.\n"
            "10. Health Watch: 2 to 3 key health watchpoints for this breed.\n\n"
            "Return strictly JSON adhering to this structure:\n"
            "{\n"
            '  "is_pet": true,\n'
            '  "species": "Dog",\n'
            '  "primary_breed": "Indian Pariah Dog (Indie)",\n'
            '  "confidence": 0.95,\n'
            '  "top_matches": [\n'
            '    { "breed": "Indian Pariah Dog (Indie)", "confidence": 0.95, "species": "Dog" }\n'
            "  ],\n"
            '  "care_insights": {\n'
            '    "temperament": "Alert, loyal, intuitive, highly adaptable",\n'
            '    "adult_size_category": "Medium (15 - 25 kg)",\n'
            '    "nutritional_focus": "Balanced ancestral lean poultry proteins, golden turmeric anti-inflammatory stew, and omega-3s",\n'
            '    "recommended_recipe": "Scooby Heritage Chicken, Rice & Golden Turmeric Stew",\n'
            '    "health_watch": ["Tick & seasonal parasite resilience", "Skin barrier nourishment", "Joint agility"]\n'
            "  },\n"
            '  "error_message": null\n'
            "}"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": b64_img}}
                ]
            }],
            "generationConfig": {
                "response_mime_type": "application/json"
            }
        }

        try:
            with httpx.Client(timeout=12.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    data = json.loads(raw_text)

                    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

                    if not data.get("is_pet", False):
                        return ClassificationResponse(
                            success=True,
                            is_pet=False,
                            error_message="No companion dog or cat detected. Please take a clear photo of your pet.",
                            processing_time_ms=elapsed_ms,
                        )

                    # Parse top matches
                    matches = []
                    for m in data.get("top_matches", []):
                        matches.append(
                            BreedMatch(
                                breed=m.get("breed", data.get("primary_breed", "Companion")),
                                confidence=float(m.get("confidence", 0.9)),
                                species=m.get("species", data.get("species", "Dog")),
                            )
                        )

                    care_data = data.get("care_insights", {})
                    care = CareInsights(
                        temperament=care_data.get("temperament", "Loving, loyal companion"),
                        adult_size_category=care_data.get("adult_size_category", "Medium (12 - 22 kg)"),
                        nutritional_focus=care_data.get("nutritional_focus", "Complete balanced fresh meals"),
                        recommended_recipe=care_data.get("recommended_recipe", "Slow-Simmered Chicken & Garden Vegetables Medley"),
                        health_watch=care_data.get("health_watch", ["Coat shine", "Joint agility"]),
                    )

                    primary_breed = data.get("primary_breed", "Companion")
                    species = data.get("species", "Dog")
                    heritage = get_breed_heritage(primary_breed, species)

                    return ClassificationResponse(
                        success=True,
                        is_pet=True,
                        species=species,
                        primary_breed=primary_breed,
                        confidence=float(data.get("confidence", 0.95)),
                        top_matches=matches,
                        care_insights=care,
                        heritage=heritage,
                        processing_time_ms=elapsed_ms,
                    )
        except Exception as e:
            print(f"⚠️ Gemini Vision request failed, falling back to local ONNX: {e}")
            return None

        return None

    def _predict_with_onnx(self, image_bytes: bytes) -> ClassificationResponse:
        """Local offline fallback inference."""
        start_time = time.perf_counter()

        try:
            with Image.open(io.BytesIO(image_bytes)) as pil_img:
                tensor = self._preprocess_for_onnx(pil_img)
        except Exception as e:
            return ClassificationResponse(
                success=False,
                is_pet=False,
                error_message=f"Unable to decode image file: {str(e)}",
                processing_time_ms=round((time.perf_counter() - start_time) * 1000, 2),
            )

        if not self.session:
            return ClassificationResponse(
                success=False,
                is_pet=False,
                error_message="Model session not available.",
                processing_time_ms=round((time.perf_counter() - start_time) * 1000, 2),
            )

        outputs = self.session.run([self.output_name], {self.input_name: tensor})
        logits = outputs[0][0]

        exp_logits = np.exp(logits - np.max(logits))
        probabilities = exp_logits / np.sum(exp_logits)

        pet_probs = [(idx, float(probabilities[idx])) for idx in PET_CLASSES.keys()]
        pet_probs.sort(key=lambda x: x[1], reverse=True)

        top_1000_idx = int(np.argmax(probabilities))
        total_pet_confidence = sum(p for _, p in pet_probs)
        best_pet_idx, best_pet_prob = pet_probs[0]

        is_in_pet_classes = top_1000_idx in PET_CLASSES
        if not is_in_pet_classes and (best_pet_prob < 0.15 and total_pet_confidence < 0.30):
            return ClassificationResponse(
                success=True,
                is_pet=False,
                error_message="No dog or cat detected. Please ensure your companion is clearly visible in good lighting.",
                processing_time_ms=round((time.perf_counter() - start_time) * 1000, 2),
            )

        top_3_pets = pet_probs[:3]
        top_sum = sum(p for _, p in top_3_pets) or 1.0

        matches = []
        for idx, prob in top_3_pets:
            spec, breed_name, _ = PET_CLASSES[idx]
            calibrated_prob = round(prob / top_sum, 2)
            matches.append(
                BreedMatch(
                    breed=breed_name,
                    confidence=max(0.1, min(1.0, calibrated_prob)),
                    species=spec,
                )
            )

        best_spec, best_breed, best_slug = PET_CLASSES[best_pet_idx]
        primary_confidence = matches[0].confidence if matches else 0.85
        care_insights = get_breed_care_insights(best_slug, best_spec)
        heritage = get_breed_heritage(best_slug, best_spec)

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return ClassificationResponse(
            success=True,
            is_pet=True,
            species=best_spec,
            primary_breed=best_breed,
            confidence=primary_confidence,
            top_matches=matches,
            care_insights=care_insights,
            heritage=heritage,
            processing_time_ms=elapsed_ms,
        )

    def predict_from_bytes(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> ClassificationResponse:
        """Hybrid prediction: Gemini Flash for Indian & Western accuracy, ONNX for offline fallback."""
        # 1. Try Gemini Vision First (Highest accuracy on Indian & Western breeds)
        res = self._predict_with_gemini(image_bytes, mime_type)
        if res is not None:
            return res

        # 2. Fallback to local ONNX model if offline or API error
        return self._predict_with_onnx(image_bytes)


_pipeline_instance = None


def get_pipeline() -> PetVisionPipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = PetVisionPipeline()
    return _pipeline_instance
