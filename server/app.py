"""
Poultry Disease Classifier - FastAPI Backend
Run: uvicorn app:app --reload --port 8000
"""
import os
import sys
from io import BytesIO

import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

if sys.version_info >= (3, 14):
    raise RuntimeError(
        "This backend requires Python 3.11, 3.12, or 3.13. TensorFlow is not available for "
        f"Python {sys.version_info.major}.{sys.version_info.minor} in this setup."
    )

try:
    import tensorflow as tf
except ImportError as exc:
    raise RuntimeError(
        "TensorFlow is not installed. Use Python 3.11, 3.12, or 3.13 and run "
        "`python -m pip install -r requirements.txt` inside `server/`."
    ) from exc

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = r"C:\Users\USER\Pictures\Final Project\poultry_diseases"
MODEL_PATH = os.path.join(BASE_DIR, "poultry_model.keras")
# Fallback: check parent folder if model was trained from old Gradio script
MODEL_PATH_FALLBACK = os.path.join(os.path.dirname(BASE_DIR), "poultry_model.keras")
CONFIDENCE_THRESHOLD = 0.65

app = FastAPI(title="Poultry Disease Classifier API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model state
model = None
model_ready = False
class_names = ["cocci", "healthy", "ncd", "salmo"]  # alphabetical
img_size = 224


def build_model():
    m = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(img_size, img_size, 3)),
        tf.keras.layers.Conv2D(32, 3, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.MaxPooling2D(),
        tf.keras.layers.Conv2D(64, 3, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.25),
        tf.keras.layers.MaxPooling2D(),
        tf.keras.layers.Conv2D(128, 3, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.MaxPooling2D(),
        tf.keras.layers.Conv2D(256, 3, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.MaxPooling2D(),
        tf.keras.layers.GlobalAveragePooling2D(),
        tf.keras.layers.Dense(256, activation="relu"),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(len(class_names), activation="softmax"),
    ])
    m.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return m


def load_model():
    global model, model_ready
    model = build_model()
    path = MODEL_PATH if os.path.exists(MODEL_PATH) else (MODEL_PATH_FALLBACK if os.path.exists(MODEL_PATH_FALLBACK) else None)
    if path:
        try:
            model.load_weights(path)
            model_ready = True
            print(f"Model loaded from {path}")
        except Exception as e:
            print(f"Could not load model: {e}")
            model_ready = False
    else:
        print("Model not found. Run `python train.py` inside `server/`.")
        model_ready = False


@app.on_event("startup")
def startup():
    load_model()


@app.get("/")
def root():
    return {"message": "Poultry Disease Classifier API", "model_ready": model_ready}


@app.get("/status")
def status():
    return {"model_ready": model_ready, "classes": class_names}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not model_ready or model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train.py first.")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (PNG, JPG, JPEG)")

    try:
        contents = await file.read()
        img = Image.open(BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    arr = tf.keras.preprocessing.image.img_to_array(img)
    arr = tf.image.resize(arr, (img_size, img_size))
    arr = np.expand_dims(arr.numpy() if hasattr(arr, "numpy") else arr, 0) / 255.0

    preds = model.predict(arr, verbose=0)[0]
    idx = int(np.argmax(preds))
    conf = float(preds[idx])

    probabilities = {class_names[i]: round(float(preds[i]) * 100, 1) for i in range(len(class_names))}

    if conf < CONFIDENCE_THRESHOLD:
        return {
            "disease": "Unable to classify",
            "confidence": round(conf * 100, 1),
            "low_confidence": True,
            "message": "This image does not appear to be poultry-related or the model is uncertain. Please upload a clear poultry image.",
            "probabilities": probabilities,
        }

    return {
        "disease": class_names[idx],
        "confidence": round(conf * 100, 1),
        "low_confidence": False,
        "message": None,
        "probabilities": probabilities,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
