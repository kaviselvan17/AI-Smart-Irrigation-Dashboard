
from pathlib import Path
import pickle


# Model file location
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "irrigation_model.pkl"

_model = None


def load_model():
    """Load the trained irrigation model once."""
    global _model

    if _model is not None:
        return _model

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found: {MODEL_PATH}. "
            "Run train_model.py first."
        )

    with MODEL_PATH.open("rb") as model_file:
        _model = pickle.load(model_file)

    return _model


def predict_irrigation(
    soil1,
    soil2,
    rain,
    water_flow=0
):
    """
    Predict irrigation using the existing trained model.

    soil1: Soil sensor 1 moisture percentage.
    soil2: Soil sensor 2 moisture percentage.
    rain: Rain sensor reading.
    water_flow: Water flow reading, if required by the model.

    IMPORTANT:
    The feature order and number of inputs must match train_model.py.
    """

    model = load_model()

    features = [[
        float(soil1),
        float(soil2),
        float(rain),
        float(water_flow)
    ]]

    prediction = model.predict(features)[0]

    # Convert common prediction values into readable text.
    if isinstance(prediction, str):
        return prediction

    try:
        prediction_value = float(prediction)
    except (TypeError, ValueError):
        return str(prediction)

    if prediction_value == 1:
        return "Irrigation recommended"
    elif prediction_value == 0:
        return "Irrigation not recommended"

    return str(prediction_value)


def predict_from_sensor_data(sensor_data):
    """
    Make a prediction from a dictionary of sensor readings.
    """

    if not isinstance(sensor_data, dict):
        raise ValueError("Sensor data must be a dictionary.")

    soil1 = sensor_data.get(
        "soil1",
        sensor_data.get("soil1_value",
        sensor_data.get("soil_moisture"))
    )

    soil2 = sensor_data.get(
        "soil2",
        sensor_data.get("soil2_value",
        sensor_data.get("soil_moisture_2"))
    )

    rain = sensor_data.get("rain", sensor_data.get("rainfall"))

    water_flow = sensor_data.get(
        "water_flow",
        sensor_data.get("flow_rate",
        sensor_data.get("flow", 0))
    )

    missing = []

    if soil1 is None:
        missing.append("soil1")

    if soil2 is None:
        missing.append("soil2")

    if rain is None:
        missing.append("rain")

    if missing:
        raise ValueError(
            "Missing required sensor readings: " + ", ".join(missing)
        )

    return predict_irrigation(
        soil1=soil1,
        soil2=soil2,
        rain=rain,
        water_flow=water_flow
    )


if __name__ == "__main__":
    # Example test values only; replace them with actual sensor readings.
    sample_data = {
        "soil1": 35,
        "soil2": 40,
        "rain": 0,
        "water_flow": 0
    }

    try:
        result = predict_from_sensor_data(sample_data)
        print("Irrigation prediction:", result)
    except Exception as error:
        print("Prediction error:", error)
