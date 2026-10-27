
import os
import joblib
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "dataset.csv")
MODEL_PATH = os.path.join(BASE_DIR, "irrigation_model.pkl")

FEATURES = [
    "soil1_moisture",
    "soil2_moisture",
    "rain_detected"
]

TARGET = "irrigation_needed"


def create_demo_dataset():
    data = {
        "soil1_moisture": [
            15, 20, 25, 30, 34, 40, 50, 65, 75, 85,
            20, 30, 40, 50, 15, 80, 45, 60, 90, 95,
            18, 28, 38, 55, 70, 22, 35, 45, 82, 92,
            10, 32, 48, 72, 25, 90
        ],
        "soil2_moisture": [
            20, 25, 30, 32, 28, 45, 55, 70, 80, 90,
            25, 32, 45, 45, 85, 20, 30, 25, 85, 95,
            22, 33, 42, 60, 75, 24, 40, 50, 88, 90,
            15, 29, 55, 68, 90, 20
        ],
        "rain_detected": [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            1, 1, 1, 1, 0, 0, 0, 0, 1, 0,
            0, 0, 0, 0, 0, 1, 1, 1, 0, 0,
            0, 0, 0, 0, 1, 1
        ],
        "irrigation_needed": [
            1, 1, 1, 1, 1, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 1, 1, 1, 1, 0, 0,
            1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
            1, 1, 0, 0, 0, 0
        ]
    }

    pd.DataFrame(data).to_csv(DATASET_PATH, index=False)
    print("Demo dataset created.")


def train_model():
    if not os.path.exists(DATASET_PATH):
        create_demo_dataset()

    df = pd.read_csv(DATASET_PATH)

    required_columns = FEATURES + [TARGET]
    missing = [c for c in required_columns if c not in df.columns]

    if missing:
        raise ValueError(f"Missing dataset columns: {missing}")

    df = df[required_columns].dropna()

    if not df[TARGET].isin([0, 1]).all():
        raise ValueError("irrigation_needed must contain only 0 or 1.")

    if not df["rain_detected"].isin([0, 1]).all():
        raise ValueError("rain_detected must contain only 0 or 1.")

    for column in ["soil1_moisture", "soil2_moisture"]:
        if not df[column].between(0, 100).all():
            raise ValueError(f"{column} must be between 0 and 100.")

    if df[TARGET].nunique() < 2:
        raise ValueError("Dataset must contain both target labels 0 and 1.")

    X = df[FEATURES]
    y = df[TARGET].astype(int)

    # Split the data for evaluation when possible.
    counts = y.value_counts()

    if len(df) >= 10 and counts.min() >= 2:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.25,
            random_state=42,
            stratify=y
        )
    else:
        X_train, y_train = X, y
        X_test, y_test = None, None

    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=8,
        class_weight="balanced",
        random_state=42
    )

    model.fit(X_train, y_train)

    if X_test is not None:
        predictions = model.predict(X_test)

        print(
            "Test accuracy:",
            f"{accuracy_score(y_test, predictions):.2%}"
        )

        print("\nClassification report:")
        print(
            classification_report(
                y_test,
                predictions,
                zero_division=0
            )
        )
    else:
        print("Not enough data for a useful test evaluation.")

    # Save the trained model and its feature names.
    joblib.dump(
        {
            "model": model,
            "features": FEATURES
        },
        MODEL_PATH
    )

    print("\nAI model saved successfully!")
    print(MODEL_PATH)
    print("Note: demo-data accuracy does not prove real-world performance.")


if __name__ == "__main__":
    train_model()
