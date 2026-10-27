
"use strict";

// ========================================
// SMART IRRIGATION - VOICE ASSISTANT
// Browser Speech Recognition + Flask + Voice Reply
// ========================================

let voiceRecognition = null;
let isListening = false;
let isProcessing = false;

// ========================================
// FIND HTML ELEMENTS
// ========================================

function getVoiceElement(...ids) {
    for (const id of ids) {
        const element = document.getElementById(id);
        if (element) return element;
    }
    return null;
}

// ========================================
// DISPLAY STATUS
// ========================================

function setVoiceStatus(message) {
    const status = getVoiceElement(
        "voiceStatus",
        "voice-status",
        "assistantStatus"
    );

    if (status) {
        status.textContent = message;
    }

    console.log("[Voice Assistant]", message);
}

// ========================================
// TEXT-TO-SPEECH
// ========================================

function speakVoiceAnswer(text) {
    if (!("speechSynthesis" in window)) {
        setVoiceStatus("Speech output is not supported.");
        return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-IN";
    speech.rate = 0.92;
    speech.pitch = 0.9;
    speech.volume = 1;

    const voices = window.speechSynthesis.getVoices();

    const indianVoice = voices.find(
        voice => voice.lang.toLowerCase() === "en-in"
    );

    if (indianVoice) {
        speech.voice = indianVoice;
    }

    speech.onstart = () => {
        setVoiceStatus("Speaking...");
    };

    speech.onend = () => {
        setVoiceStatus("Answer received");
    };

    speech.onerror = (event) => {
        console.error("Speech error:", event.error);
        setVoiceStatus("Could not speak the answer.");
    };

    window.speechSynthesis.speak(speech);
}

// ========================================
// SEND QUESTION TO FLASK
// ========================================

async function sendVoiceQuestion(question) {
    if (isProcessing) return null;

    isProcessing = true;
    setVoiceStatus("Getting your answer...");

    try {
        const response = await fetch("/api/voice", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question: question
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || `Server error: ${response.status}`
            );
        }

        const answer = data.answer || data.response;

        if (!answer) {
            throw new Error("No answer returned by Flask.");
        }

        const answerElement = getVoiceElement(
            "voiceAnswer",
            "voice-answer",
            "assistantResponse"
        );

        if (answerElement) {
            answerElement.textContent = answer;
        }

        speakVoiceAnswer(answer);
        return answer;

    } catch (error) {
        console.error("Voice assistant error:", error);

        setVoiceStatus(
            error.message || "Could not connect to Flask."
        );

        const answerElement = getVoiceElement(
            "voiceAnswer",
            "voice-answer",
            "assistantResponse"
        );

        if (answerElement) {
            answerElement.textContent =
                "Could not get an answer. Please check the server.";
        }

        return null;

    } finally {
        isProcessing = false;
    }
}

// ========================================
// START SPEAK-TO-SPEAK ASSISTANT
// ========================================

function startVoiceAssistant() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        setVoiceStatus(
            "Speech recognition is unavailable in this browser. Try a supported browser."
        );
        return;
    }

    if (isListening || isProcessing) {
        return;
    }

    // Stop any previous spoken answer
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    voiceRecognition = new SpeechRecognition();

    voiceRecognition.lang = "en-IN";
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;
    voiceRecognition.maxAlternatives = 1;

    voiceRecognition.onstart = () => {
        isListening = true;
        setVoiceStatus("Listening... Speak your question.");
    };

    voiceRecognition.onresult = async (event) => {
        const question =
            event.results[0][0].transcript.trim();

        if (!question) {
            setVoiceStatus("No speech detected. Try again.");
            return;
        }

        const questionElement = getVoiceElement(
            "voiceQuestion",
            "voice-question",
            "userQuestion"
        );

        if (questionElement) {
            questionElement.textContent = question;
        }

        setVoiceStatus("You asked: " + question);

        // Send recognized speech to your existing Flask API.
        // Flask returns the answer, and the browser speaks it.
        await sendVoiceQuestion(question);
    };

    voiceRecognition.onerror = (event) => {
        console.error(
            "Speech recognition error:",
            event.error
        );

        const messages = {
            "not-allowed":
                "Microphone permission denied. Allow microphone access.",
            "service-not-allowed":
                "This browser does not allow speech recognition for this site.",
            "no-speech":
                "No speech detected. Tap Speak and try again.",
            "network":
                "Speech recognition network error. Check your internet.",
            "audio-capture":
                "No microphone detected."
        };

        setVoiceStatus(
            messages[event.error] ||
            "Microphone error: " + event.error
        );
    };

    voiceRecognition.onend = () => {
        isListening = false;
        voiceRecognition = null;
    };

    try {
        voiceRecognition.start();
    } catch (error) {
        console.error(error);
        isListening = false;
        voiceRecognition = null;
        setVoiceStatus("Could not start the microphone. Try again.");
    }
}

// ========================================
// STOP LISTENING / STOP SPEAKING
// ========================================

function stopVoiceAssistant() {
    if (voiceRecognition && isListening) {
        voiceRecognition.stop();
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    setVoiceStatus("Stopped");
}

// ========================================
// ASK A TYPED QUESTION
// ========================================

function askVoiceAssistant() {
    const input = getVoiceElement(
        "voiceInput",
        "voice-input",
        "questionInput"
    );

    if (!input || !input.value.trim()) {
        setVoiceStatus("Please type a question first.");
        return;
    }

    sendVoiceQuestion(input.value.trim());
}

// ========================================
// CONNECT BUTTONS
// ========================================

document.addEventListener("DOMContentLoaded", () => {
    const micButton = getVoiceElement(
        "voiceButton",
        "voice-button",
        "startVoiceButton"
    );

    const askButton = getVoiceElement(
        "askVoiceButton",
        "ask-voice-button"
    );

    const stopButton = getVoiceElement(
        "stopVoiceButton",
        "stop-voice-button"
    );

    if (micButton) {
        micButton.addEventListener(
            "click",
            startVoiceAssistant
        );
    }

    if (askButton) {
        askButton.addEventListener(
            "click",
            askVoiceAssistant
        );
    }

    if (stopButton) {
        stopButton.addEventListener(
            "click",
            stopVoiceAssistant
        );
    }

    console.log("Smart Irrigation Voice Assistant loaded.");
});
