
"use strict";

// SMART IRRIGATION - VOICE ASSISTANT

let voiceRecognition = null;
let isListening = false;

function getVoiceElement(...ids) {
    for (const id of ids) {
        const element = document.getElementById(id);
        if (element) return element;
    }
    return null;
}

function setVoiceStatus(message) {
    const status = getVoiceElement(
        "voiceStatus",
        "voice-status",
        "assistantStatus"
    );

    if (status) status.textContent = message;
    console.log("[Voice Assistant]", message);
}

// Speak the answer
function speakVoiceAnswer(text) {
    if (!("speechSynthesis" in window)) {
        setVoiceStatus("Text-to-speech is not supported.");
        return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-IN";
    speech.rate = 0.92;
    speech.pitch = 0.8;
    speech.volume = 1;

    const voices = window.speechSynthesis.getVoices();

    const indianVoice = voices.find(
        voice => voice.lang.toLowerCase() === "en-in"
    );

    if (indianVoice) {
        speech.voice = indianVoice;
    }

    speech.onstart = () => setVoiceStatus("Speaking...");
    speech.onend = () => setVoiceStatus("Answer received");
    speech.onerror = (event) => {
        console.error("Speech error:", event.error);
        setVoiceStatus("Could not speak the answer.");
    };

    window.speechSynthesis.speak(speech);
}

// Send question to Flask
async function sendVoiceQuestion(question) {
    setVoiceStatus("Getting your answer...");

    try {
        const response = await fetch("/api/voice", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question: question })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status}`);
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

        setVoiceStatus("Error connecting to Flask. Check /api/voice.");

        const answerElement = getVoiceElement(
            "voiceAnswer",
            "voice-answer",
            "assistantResponse"
        );

        if (answerElement) {
            answerElement.textContent =
                "Could not connect to the assistant. Please check the server.";
        }

        return null;
    }
}

// Speak button: start microphone
function startVoiceAssistant() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        setVoiceStatus(
            "Speech recognition is unsupported in this browser. Try Chrome."
        );
        return;
    }

    if (isListening) {
        if (voiceRecognition) voiceRecognition.stop();
        return;
    }

    voiceRecognition = new SpeechRecognition();

    // Tamil voice input. For English input, change to "en-IN".
    voiceRecognition.lang = "ta-IN";
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;
    voiceRecognition.maxAlternatives = 1;

    voiceRecognition.onstart = () => {
        isListening = true;
        setVoiceStatus("Listening... Speak now.");
    };

    voiceRecognition.onresult = async (event) => {
        const question = event.results[0][0].transcript;

        const questionElement = getVoiceElement(
            "voiceQuestion",
            "voice-question",
            "userQuestion"
        );

        if (questionElement) {
            questionElement.textContent = question;
        }

        await sendVoiceQuestion(question);
    };

    voiceRecognition.onerror = (event) => {
        setVoiceStatus("Microphone error: " + event.error);
        console.error("Microphone error:", event.error);
    };

    voiceRecognition.onend = () => {
        isListening = false;
    };

    try {
        voiceRecognition.start();
    } catch (error) {
        isListening = false;
        console.error(error);
        setVoiceStatus("Could not start microphone. Try again.");
    }
}

// Typed question
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

// Stop listening and speaking

let audioRecorder = null;
let recordedChunks = [];
let audioStream = null;

async function startVoiceAssistant() {
    if (!navigator.mediaDevices?.getUserMedia ||
        !window.MediaRecorder) {
        setVoiceStatus(
            "Audio recording is not supported in this browser."
        );
        return;
    }

    try {
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        recordedChunks = [];

        let mimeType = "";

        if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
            mimeType = "audio/webm";
        }

        audioRecorder = mimeType
            ? new MediaRecorder(audioStream, { mimeType })
            : new MediaRecorder(audioStream);

        audioRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        audioRecorder.onstop = async () => {
            try {
                setVoiceStatus("Converting your speech to text...");

                const type = audioRecorder.mimeType || "audio/mp4";
                const extension = type.includes("webm")
                    ? "webm"
                    : "mp4";

                const audioBlob = new Blob(recordedChunks, {
                    type: type
                });

                if (audioBlob.size === 0) {
                    throw new Error("No audio was recorded.");
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
                        data.error || "Transcription request failed."
                    );
                }

                const question = (data.text || "").trim();

                if (!question) {
                    setVoiceStatus("No speech detected. Please try again.");
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

                await sendVoiceQuestion(question);

            } catch (error) {
                console.error("Voice recording error:", error);
                setVoiceStatus(error.message || "Voice input failed.");
            } finally {
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                    audioStream = null;
                }
                isListening = false;
            }
        };

        audioRecorder.onerror = (event) => {
            console.error("Recorder error:", event);
            setVoiceStatus("Recording failed. Please try again.");
        };

        audioRecorder.start();
        isListening = true;
        setVoiceStatus("Recording... Tap Speak again to finish.");

    } catch (error) {
        console.error("Microphone access error:", error);
        setVoiceStatus(
            "Cannot access microphone. Check browser permissions."
        );
    }
}

function stopVoiceAssistant() {
    if (audioRecorder && audioRecorder.state === "recording") {
        audioRecorder.stop();
        setVoiceStatus("Processing recording...");
    } else {
        isListening = false;

        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }

        setVoiceStatus("Stopped");
    }
}


// Connect buttons
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
        micButton.addEventListener("click", startVoiceAssistant);
    }

    if (askButton) {
        askButton.addEventListener("click", askVoiceAssistant);
    }

    if (stopButton) {
        stopButton.addEventListener("click", stopVoiceAssistant);
    }

    console.log("Voice assistant JavaScript loaded.");
});
