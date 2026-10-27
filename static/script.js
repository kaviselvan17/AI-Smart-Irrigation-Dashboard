
const $ = (id) => document.getElementById(id);

let moistureChart = null;
let historyLabels = [];
let soil1History = [];
let soil2History = [];

function setConnection(online) {
    $("connectionText").textContent = online
        ? "ESP32 connected"
        : "ESP32 offline";

    $("sidebarConnection").textContent = online
        ? "Device Online"
        : "Device Offline";

    $("connectionDot").className =
        "status-dot " + (online ? "online" : "offline");

    $("sidebarDot").className =
        "status-dot " + (online ? "online" : "offline");
}

function moistureLabel(value) {
    if (value < 35) return "Dry soil";
    if (value < 80) return "Moderate moisture";
    return "Wet soil";
}

function updateMoisture(sensor, value, raw) {
    const percentage = Math.max(0, Math.min(100, Number(value) || 0));

    $(`${sensor}Value`).textContent = percentage;
    $(`${sensor}Raw`).textContent = raw;
    $(`${sensor}Bar`).style.width = `${percentage}%`;
    $(`${sensor}Label`).textContent = moistureLabel(percentage);
    $(`${sensor}Detail`).textContent = `${percentage}%`;
    $(`${sensor}Condition`).textContent = moistureLabel(percentage);

    const bar = $(`${sensor}Bar`);
    bar.style.background =
        percentage < 35 ? "var(--yellow)" :
        percentage >= 80 ? "var(--blue)" :
        "var(--green)";
}

function updateMode(mode) {
    const isAuto = mode === "AUTO";

    $("modeBadge").textContent = isAuto ? "AUTO MODE" : "MANUAL MODE";
    $("currentMode").textContent = mode;

    $("autoModeBtn").classList.toggle("auto-button", isAuto);
    $("manualModeBtn").classList.toggle("auto-button", !isAuto);

    $("pumpOnBtn").disabled = isAuto;
    $("pumpOffBtn").disabled = isAuto;

    $("controlDescription").textContent = isAuto
        ? "ESP32 controls watering based on soil moisture."
        : "Use the pump buttons to control irrigation manually.";
}

function updatePump(isOn) {
    $("pumpValue").textContent = isOn ? "ON" : "OFF";
    $("controlPumpStatus").textContent =
        isOn ? "Pump ON" : "Pump OFF";

    $("pumpDescription").textContent =
        isOn ? "Water pump is running" : "Pump is stopped";

    $("pumpBadge").textContent = isOn ? "RUNNING" : "STANDBY";
    $("pumpBadge").className = isOn
        ? "pill"
        : "pill neutral";

    $("pumpValue").style.color =
        isOn ? "var(--green)" : "var(--muted)";
}

function updateRain(raining) {
    $("rainStatus").textContent = raining ? "Rain detected" : "No rain";
    $("rainDescription").textContent = raining
        ? "Irrigation is stopped for rain."
        : "No rain detected by the sensor.";
    $("rainIcon").textContent = raining ? "🌧️" : "☀️";
}

function addHistory(data) {
    const now = new Date();
    const label = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    historyLabels.push(label);
    soil1History.push(Number(data.soil1_moisture));
    soil2History.push(Number(data.soil2_moisture));

    // Keep only the latest 20 readings.
    if (historyLabels.length > 20) {
        historyLabels.shift();
        soil1History.shift();
        soil2History.shift();
    }

    if (moistureChart) {
        moistureChart.data.labels = historyLabels;
        moistureChart.data.datasets[0].data = soil1History;
        moistureChart.data.datasets[1].data = soil2History;
        moistureChart.update("none");
    }
}

function initializeChart() {
    const canvas = $("moistureChart");

    if (!canvas || typeof Chart === "undefined") {
        $("moistureChart").parentElement.innerHTML =
            "<p class='empty-state'>Chart library unavailable. Check your internet connection.</p>";
        return;
    }

    moistureChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: historyLabels,
            datasets: [
                {
                    label: "Soil Sensor 1 (%)",
                    data: soil1History,
                    borderColor: "#37d49a",
                    backgroundColor: "#37d49a22",
                    borderWidth: 2,
                    pointRadius: 2,
                    tension: 0.3
                },
                {
                    label: "Soil Sensor 2 (%)",
                    data: soil2History,
                    borderColor: "#65a8ff",
                    backgroundColor: "#65a8ff22",
                    borderWidth: 2,
                    pointRadius: 2,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: { color: "#91a2b9" },
                    grid: { color: "#26364c" }
                },
                x: {
                    ticks: { color: "#91a2b9", maxTicksLimit: 6 },
                    grid: { color: "#26364c" }
                }
            },
            plugins: {
                legend: {
                    labels: { color: "#eef4fc" }
                }
            }
        }
    });
}

function renderAlerts(data) {
    const alerts = [];

    if (!data.device_online) {
        alerts.push({
            type: "error",
            title: "ESP32 offline",
            message: "Check the ESP32 Wi-Fi connection and Flask server."
        });
    }

    if (data.rain_detected) {
        alerts.push({
            type: "warning",
            title: "Rain detected",
            message: "The pump should remain OFF while rain is detected."
        });
    }

    if (data.soil1_moisture < 35 || data.soil2_moisture < 35) {
        alerts.push({
            type: "warning",
            title: "Dry soil detected",
            message: "At least one soil sensor is below the 35% threshold."
        });
    }

    if (data.flow_fault) {
        alerts.push({
            type: "error",
            title: "Water-flow fault",
            message: "The ESP32 detected no water flow and stopped the pump."
        });
    }

    if (data.runtime_fault) {
        alerts.push({
            type: "error",
            title: "Maximum runtime exceeded",
            message: "The pump was stopped by the runtime safety limit. Restart and inspect the system before use."
        });
    }

    if (alerts.length === 0) {
        alerts.push({
            type: "",
            title: "System operating normally",
            message: "No active warnings reported by the available readings."
        });
    }

    $("alertsList").innerHTML = alerts.map((alert) => `
        <div class="alert-item ${alert.type}">
            <div>
                <strong>${alert.title}</strong>
                <p>${alert.message}</p>
            </div>
        </div>
    `).join("");
}

async function fetchSensorData() {
    try {
        const response = await fetch("/api/sensors", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Unable to fetch sensor data");
        }

        const data = await response.json();

        setConnection(Boolean(data.device_online));

        updateMoisture(
            "soil1",
            data.soil1_moisture,
            data.soil1_raw
        );

        updateMoisture(
            "soil2",
            data.soil2_moisture,
            data.soil2_raw
        );

        $("waterValue").textContent =
            Number(data.water_liters || 0).toFixed(2);

        $("flowPulses").textContent =
            Number(data.flow_pulses || 0);

        $("rainRaw").textContent = data.rain_raw;
        $("deviceStatus").textContent =
            data.device_online ? "Online" : "Offline";

        updateRain(Boolean(data.rain_detected));
        updatePump(Boolean(data.pump_status));
        updateMode(data.mode || (data.automatic_mode ? "AUTO" : "MANUAL"));

        if (data.last_update) {
            $("lastUpdate").textContent =
                new Date(data.last_update).toLocaleTimeString();
        } else {
            $("lastUpdate").textContent = "Waiting for data";
        }

        addHistory(data);
        renderAlerts(data);
    } catch (error) {
        setConnection(false);
        $("deviceStatus").textContent = "Offline";
        $("lastUpdate").textContent = "No connection";
        $("alertsList").innerHTML = `
            <div class="alert-item error">
                <div>
                    <strong>Dashboard connection error</strong>
                    <p>Make sure Flask is running and then refresh this page.</p>
                </div>
            </div>
        `;
    }
}


async function fetchAiPrediction() {
    const status = document.getElementById("aiStatus");
    const recommendation = document.getElementById("aiRecommendation");
    const reason = document.getElementById("aiReason");
    const confidence = document.getElementById("aiConfidence");

    try {
        const response = await fetch("/api/ai-prediction", {
            cache: "no-store"
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Prediction unavailable");
        }

        status.textContent = result.irrigation_needed
            ? "Irrigation may be needed"
            : "Irrigation not recommended";

        recommendation.textContent = result.recommendation || "--";
        reason.textContent = "Reason: " + (result.reason || "--");

        confidence.textContent =
            result.confidence == null
                ? "Not available"
                : result.confidence + "%";

    } catch (error) {
        status.textContent = "Waiting / unavailable";
        recommendation.textContent = error.message;
        reason.textContent = "Reason: Check sensor data and AI model.";
        confidence.textContent = "--";
    }
}

async function sendControl(mode, pump) {
    const buttons = [
        $("autoModeBtn"),
        $("manualModeBtn"),
        $("pumpOnBtn"),
        $("pumpOffBtn")
    ];

    buttons.forEach((button) => {
        button.disabled = true;
    });

    $("controlMessage").textContent = "Sending command to the server...";

    try {
        const response = await fetch("/api/control", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ mode, pump })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || "Command rejected");
        }

        updateMode(result.command.mode);

        $("controlMessage").textContent =
            mode === "AUTO"
                ? "AUTO mode command sent. The ESP32 decides pump operation."
                : pump === 1
                    ? "Manual pump ON command sent. Check live status and safety conditions."
                    : "Manual pump OFF command sent.";

        // The ESP32 polls for commands separately.
        // Actual pump status is shown only after new sensor data arrives.
        await fetchSensorData();
    } catch (error) {
        $("controlMessage").textContent =
            "Command failed: " + error.message;
    } finally {
        buttons.forEach((button) => {
            button.disabled = false;
        });

        // Restore the correct button availability for the current mode.
        const currentMode = $("currentMode").textContent;
        $("pumpOnBtn").disabled = currentMode === "AUTO";
        $("pumpOffBtn").disabled = currentMode === "AUTO";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initializeChart();

    $("autoModeBtn").addEventListener("click", () => {
        sendControl("AUTO", 0);
    });

    $("manualModeBtn").addEventListener("click", () => {
        sendControl("MANUAL", 0);
    });

    $("pumpOnBtn").addEventListener("click", () => {
        sendControl("MANUAL", 1);
    });

    $("pumpOffBtn").addEventListener("click", () => {
        sendControl("MANUAL", 0);
    });

    fetchSensorData();
    setInterval(fetchSensorData, 2000);

    $("refreshAiBtn").addEventListener("click", fetchAiPrediction);

    fetchAiPrediction();
    setInterval(fetchAiPrediction, 5000);
});
