
from typing import Any





def get_sensor_value(sensor_data: dict, *keys: str) -> Any:
    """Return the first available sensor value."""
    for key in keys:
        value = sensor_data.get(key)
        if value is not None:
            return value
    return None


def format_sensor_status(sensor_data: dict) -> str:
    """Convert sensor readings into a readable status."""
    if not isinstance(sensor_data, dict) or not sensor_data:
        return (
            "Sensor data is unavailable. "
            "Please check the Firebase connection."
        )

    fields = {
        "Soil moisture 1": ("soil_moisture", "soil1", "soil1_value"),
        "Soil moisture 2": ("soil_moisture_2", "soil2", "soil2_value"),
        "Temperature": ("temperature", "temp"),
        "Rainfall": ("rainfall", "rain"),
        "Water flow": ("flow_rate", "flow"),
        "Pump status": ("pump_status", "pump"),
    }

    readings = []

    for label, keys in fields.items():
        value = get_sensor_value(sensor_data, *keys)
        if value is not None:
            unit = " degrees" if label == "Temperature" else ""
            readings.append(f"{label}: {value}{unit}")

    if not readings:
        return "No recognized sensor fields were found in the sensor data."

    return "Current sensor readings: " + ". ".join(readings) + "."


def get_irrigation_advice(
    sensor_data: dict,
    ai_prediction: Any = None
) -> str:
    """Provide advice using the existing model prediction when available."""
    if ai_prediction is not None:
     if isinstance(ai_prediction, dict):
         return ai_prediction.get(
            "recommendation",
            "The AI prediction is available."
        )

     return f"The AI model prediction is: {ai_prediction}."
    
    soil_moisture = get_sensor_value(
        sensor_data or {},
        "soil_moisture",
        "soil1",
        "soil1_value",
    )

    if soil_moisture is None:
        return (
            "I cannot provide irrigation advice because "
            "the soil moisture reading is unavailable."
        )

    try:
        moisture = float(soil_moisture)
    except (TypeError, ValueError):
        return "The soil moisture reading is not a valid number."

    # These are example thresholds; calibrate them for your sensor.
    if moisture < 30:
        return (
            "The soil moisture reading is low. "
            "Check the field and your calibrated irrigation threshold."
        )
    elif moisture < 70:
        return (
            "The soil moisture reading is moderate. "
            "Continue monitoring the soil."
        )
    else:
        return (
            "The soil moisture reading is high. "
            "Check whether irrigation is necessary before watering."
        )
