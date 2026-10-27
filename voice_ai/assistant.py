
from .tools import format_sensor_status, get_irrigation_advice


def get_voice_response(question, sensor_data=None, ai_prediction=None):
    """
    Generate an English voice-assistant response.

    question: Recognized user speech in Tamil or English.
    sensor_data: Actual sensor readings from Firebase.
    ai_prediction: Prediction from the existing AI model.
    """

    if not isinstance(question, str) or not question.strip():
        return "Please ask me a question about your smart irrigation system."

    question = question.strip().lower()
    sensor_data = sensor_data if isinstance(sensor_data, dict) else {}

    # Greeting
    if any(word in question for word in [
        "hello", "hi", "hey", "வணக்கம்", "ஹலோ"
    ]):
        return (
            "Hello! I am your Smart Irrigation Assistant. "
            "You can ask me about sensor readings, soil moisture, "
            "temperature, rainfall, water flow, and irrigation predictions."
        )

    # Current sensor readings
    if any(word in question for word in [
        "sensor", "status", "reading", "data",
        "சென்சார்", "நிலை", "தகவல்"
    ]):
        return format_sensor_status(sensor_data)

    # Irrigation and AI prediction
    if any(word in question for word in [
        "irrigation", "prediction", "predict", "recommend",
        "water needed", "watering", "பாசனம்", "கணிப்பு"
    ]):
        return get_irrigation_advice(sensor_data, ai_prediction)

    # Soil moisture
    if any(word in question for word in [
        "soil", "moisture", "dry", "wet",
        "மண்", "ஈரப்பதம்", "ஈரம்"
    ]):
        moisture = sensor_data.get(
            "soil_moisture",
            sensor_data.get("soil1", sensor_data.get("soil1_value"))
        )

        if moisture is None:
            return "The soil moisture reading is unavailable. Please check Firebase."

        try:
            value = float(moisture)
        except (ValueError, TypeError):
            return f"The soil moisture reading is {moisture}."

        if value < 30:
            condition = "The soil appears dry based on the example threshold."
        elif value < 70:
            condition = "The soil moisture is moderate based on the example threshold."
        else:
            condition = "The soil moisture reading is high based on the example threshold."

        return (
            f"The current soil moisture reading is {value}. {condition} "
            "Please use your calibrated sensor thresholds before deciding to irrigate."
        )

    # Temperature
    if any(word in question for word in [
        "temperature", "hot", "வெப்பநிலை", "வெப்பம்"
    ]):
        temperature = sensor_data.get(
            "temperature", sensor_data.get("temp")
        )

        if temperature is None:
            return "The temperature reading is unavailable."

        return f"The current temperature reading is {temperature}."

    # Rainfall
    if any(word in question for word in ["rain", "rainfall", "மழை"]):
        rainfall = sensor_data.get(
            "rainfall", sensor_data.get("rain")
        )

        if rainfall is None:
            return "The rainfall sensor reading is unavailable."

        return f"The current rainfall sensor reading is {rainfall}."

    # Water flow
    if any(word in question for word in [
        "flow", "water flow", "நீர் ஓட்டம்", "தண்ணீர் ஓட்டம்"
    ]):
        flow = sensor_data.get("flow_rate", sensor_data.get("flow"))

        if flow is None:
            return "The water flow reading is unavailable."

        return f"The current water flow reading is {flow}."

    # Pump status only; no physical control
    if any(word in question for word in [
        "pump", "motor", "பம்ப்", "மோட்டார்"
    ]):
        pump = sensor_data.get("pump_status", sensor_data.get("pump"))

        if pump is None:
            return "The pump status is unavailable. I have not changed the pump."

        return f"The current pump status is {pump}. I have not changed the pump."

    return (
        "Sorry, I did not understand that question. "
        "You can ask about sensor readings, soil moisture, temperature, "
        "rainfall, water flow, pump status, or irrigation predictions."
    )
