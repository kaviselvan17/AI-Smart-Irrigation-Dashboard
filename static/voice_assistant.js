
"use strict";

// ========================================
// SMART IRRIGATION - VOICE ASSISTANT
// ========================================

let audioRecorder = null;
let recordedChunks = [];
let audioStream = null;
let isListening = false;
let isProcessing = false;

// Find an HTML element using alternative IDs
function getVoiceElement(...ids) {
    for (const id of ids) {
        const element = document.getElementById(id);
        if (element) return element;
    }
    return null;
}

// Display status messages
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
        setVoiceStatus("Text-to-speech is not supported.");
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

        setVoiceStatus(error.message || "Could not connect to Flask.");

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
    }
}

// ========================================
// START MICROPHONE RECORDING
// ========================================

async function startVoiceAssistant() {
    if (isListening || isProcessing) {
        return;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia ||
        !window.MediaRecorder
    ) {
        setVoiceStatus(
            "Audio recording is not supported. Use HTTPS in your browser."
        );
        return;
    }

    try {
        setVoiceStatus("Requesting microphone access...");

        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        recordedChunks = [];

        let mimeType = "";

        // Prefer a format supported by the browser
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
            mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            mimeType = "audio/webm;codecs=opus";
        }

        audioRecorder = mimeType
            ? new MediaRecorder(audioStream, { mimeType })
            : new MediaRecorder(audioStream);

        audioRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        audioRecorder.onerror = (event) => {
            console.error("Recorder error:", event);
            setVoiceStatus("Recording failed. Please try again.");
        };

        audioRecorder.onstop = async () => {
            isListening = false;
            isProcessing = true;

            try {
                setVoiceStatus("Converting speech to text...");

                const actualType =
                    audioRecorder.mimeType || "audio/webm";

                const extension = actualType.includes("mp4")
                    ? "mp4"
                    : "webm";

                const audioBlob = new Blob(recordedChunks, {
                    type: actualType
                });

                if (audioBlob.size === 0) {
                    throw new Error(
                        "No audio recorded. Please try again."
                    );
                }

                const formData = new FormData();

                formData.append(
                    "audio",
                    audioBlob,
                    `recording.${extension}`
                );

                const response = await fetch("/api/transcribe", {
                    method: "POST",
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error || "Speech transcription failed."
                    );
                }

                const question = (data.text || "").trim();

                if (!question) {
                    throw new Error(
                        "No speech detected. Please speak clearly."
                    );
                }

                const questionElement = getVoiceElement(
                    "voiceQuestion",
                    "voice-question",
                    "userQuestion"
                );

                if (questionElement) {
                    questionElement.textContent = question;
                }

                setVoiceStatus("Question detected: " + question);

                await sendVoiceQuestion(question);

            } catch (error) {
                console.error("Audio processing error:", error);

                setVoiceStatus(
                    error.message || "Could not process the recording."
                );

            } finally {
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                    audioStream = null;
                }

                audioRecorder = null;
                recordedChunks = [];
                isProcessing = false;
            }
        };

        audioRecorder.start();

        isListening = true;
        setVoiceStatus("Recording... Tap Speak again to finish.");

    } catch (error) {
        console.error("Microphone access error:", error);

        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }

        audioRecorder = null;
        isListening = false;

        if (error.name === "NotAllowedError") {
            setVoiceStatus(
                "Microphone permission denied. Allow microphone access."
            );
        } else {
            setVoiceStatus(
                error.message || "Cannot access microphone."
            );
        }
    }
}

// ========================================
// STOP RECORDING / SPEECH
// ========================================

function stopVoiceAssistant() {
    if (audioRecorder && audioRecorder.state === "recording") {
        setVoiceStatus("Processing recording...");
        audioRecorder.stop();
        return;
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }

    isListening = false;
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
        micButton.addEventListener("click", () => {
            if (
                audioRecorder &&
                audioRecorder.state === "recording"
            ) {
                stopVoiceAssistant();
            } else {
                startVoiceAssistant();
            }
        });
    }

    if (askButton) {
        askButton.addEventListener("click", askVoiceAssistant);
    }

    if (stopButton) {
        stopButton.addEventListener("click", stopVoiceAssistant);
    }

    console.log("Smart Irrigation Voice Assistant loaded.");
});
