"""
Train the poultry disease model. Run once before using the API.
Saves model to server/poultry_model.keras
"""
import os
import sys

# Ensure server dir is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.version_info >= (3, 14):
    raise RuntimeError(
        "Training requires Python 3.11, 3.12, or 3.13. TensorFlow is not available for "
        f"Python {sys.version_info.major}.{sys.version_info.minor} in this setup."
    )

try:
    import tensorflow as tf
except ImportError as exc:
    raise RuntimeError(
        "TensorFlow is not installed. Use Python 3.11, 3.12, or 3.13 and run "
        "`python -m pip install -r requirements.txt` inside `server/`."
    ) from exc

DATASET_PATH = r"C:\Users\USER\Pictures\Final Project\poultry_diseases"
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "poultry_model.keras")
img_size = 224
batch_size = 16

if not os.path.exists(DATASET_PATH):
    print(f"Dataset not found: {DATASET_PATH}")
    sys.exit(1)

class_names = sorted([d for d in os.listdir(DATASET_PATH)
                     if os.path.isdir(os.path.join(DATASET_PATH, d))])
print("Classes:", class_names)

# Build model
model = tf.keras.Sequential([
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
model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])

# Load datasets
train_ds = tf.keras.preprocessing.image_dataset_from_directory(
    DATASET_PATH, validation_split=0.2, subset="training",
    seed=123, image_size=(img_size, img_size), batch_size=batch_size, label_mode="int")
val_ds = tf.keras.preprocessing.image_dataset_from_directory(
    DATASET_PATH, validation_split=0.2, subset="validation",
    seed=123, image_size=(img_size, img_size), batch_size=batch_size, label_mode="int")

def aug(img, lbl):
    img = tf.image.random_flip_left_right(img)
    img = tf.image.random_brightness(img, 0.2)
    img = tf.image.random_contrast(img, 0.8, 1.2)
    return tf.clip_by_value(img, 0, 1), lbl

train_ds = train_ds.map(lambda x, y: (x / 255.0, y))
train_ds = train_ds.map(aug, num_parallel_calls=tf.data.AUTOTUNE)
train_ds = train_ds.shuffle(500).prefetch(tf.data.AUTOTUNE)
val_ds = val_ds.map(lambda x, y: (x / 255.0, y)).prefetch(tf.data.AUTOTUNE)

# Class weights
counts = {}
for c in class_names:
    p = os.path.join(DATASET_PATH, c)
    counts[c] = len([f for f in os.listdir(p) if f.lower().endswith((".png", ".jpg", ".jpeg"))])
total = sum(counts.values())
class_weights = {class_names.index(n): total / (len(class_names) * max(cnt, 1)) for n, cnt in counts.items()}

print("Training... (20-40 min)")
cb = [
    tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=10, restore_best_weights=True),
    tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=4, min_lr=1e-6),
]
model.fit(train_ds, validation_data=val_ds, epochs=60, callbacks=cb, class_weight=class_weights, verbose=1)
model.save(MODEL_PATH)
print(f"Model saved to {MODEL_PATH}")
