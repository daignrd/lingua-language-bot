export {};

// Lingua — Live Tutor Telegram Mini App frontend

// Telegram WebApp interface type helper
interface TelegramWebApp {
    ready: () => void;
    expand: () => void;
    close: () => void;
    MainButton: {
        text: string;
        show: () => void;
        hide: () => void;
        onClick: (cb: () => void) => void;
    };
}

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp;
        };
    }
}

// DOM Elements
const connectionStatus = document.getElementById('connection-status') as HTMLDivElement;
const tutorAvatar = document.getElementById('tutor-avatar') as HTMLDivElement;
const tutorStatusText = document.getElementById('tutor-status-text') as HTMLParagraphElement;
const transcriptBox = document.getElementById('transcript-box') as HTMLDivElement;
const shadowingSection = document.getElementById('shadowing-section') as HTMLElement;
const drillJa = document.getElementById('drill-ja') as HTMLDivElement;
const drillFuri = document.getElementById('drill-furi') as HTMLDivElement;
const drillEn = document.getElementById('drill-en') as HTMLDivElement;
const drillFeedback = document.getElementById('drill-feedback') as HTMLDivElement;
const btnToggleSession = document.getElementById('btn-toggle-session') as HTMLButtonElement;
const btnMute = document.getElementById('btn-mute') as HTMLButtonElement;
const waveCanvas = document.getElementById('wave-canvas') as HTMLCanvasElement;
const canvasCtx = waveCanvas.getContext('2d') as CanvasRenderingContext2D;

// Application State
let socket: WebSocket | null = null;
let isConnected = false;
let isMuted = false;
let isSessionActive = false; // True from click until explicit disconnect

// Web Audio State
let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let micSource: MediaStreamAudioSourceNode | null = null;
let recorderNode: ScriptProcessorNode | null = null;
let nextPlayTime = 0;
let activeSources: AudioBufferSourceNode[] = [];
let audioAnalyser: AnalyserNode | null = null;

// Initialize Telegram WebApp if available
if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
}

// Draw Waveform Animation
function drawIdleWave() {
    if (!canvasCtx) return;
    canvasCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    
    // Draw a subtle, flat line in the center when idle
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, waveCanvas.height / 2);
    canvasCtx.lineTo(waveCanvas.width, waveCanvas.height / 2);
    canvasCtx.stroke();
}
drawIdleWave();

// Animate Wave when speaking/listening
function drawVisualizer() {
    if (!isSessionActive || !audioAnalyser || !canvasCtx) {
        drawIdleWave();
        return;
    }

    requestAnimationFrame(drawVisualizer);

    const bufferLength = audioAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    // BUG FIX: was getByteTimeData (doesn't exist), correct method is getByteTimeDomainData
    audioAnalyser.getByteTimeDomainData(dataArray);

    canvasCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    
    // Gradient line styling matching the theme
    const gradient = canvasCtx.createLinearGradient(0, 0, waveCanvas.width, 0);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(0.5, '#8b5cf6');
    gradient.addColorStop(1, '#10b981');
    
    canvasCtx.strokeStyle = gradient;
    canvasCtx.lineWidth = 3;
    canvasCtx.beginPath();

    const sliceWidth = waveCanvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * waveCanvas.height) / 2;

        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    canvasCtx.lineTo(waveCanvas.width, waveCanvas.height / 2);
    canvasCtx.stroke();
}

// Convert Base64 to ArrayBuffer helper
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Play received PCM audio chunk from Gemini (24kHz Int16)
function playAudioChunk(base64Data: string) {
    if (!audioContext) return;

    try {
        // Decode base64 bytes to ArrayBuffer
        const arrayBuffer = base64ToArrayBuffer(base64Data);
        const int16Array = new Int16Array(arrayBuffer);

        if (int16Array.length === 0) return;

        // Convert Int16 PCM samples to Float32 samples
        const float32Data = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Data[i] = int16Array[i] / 32768; // Normalized range [-1.0, 1.0]
        }

        // Gemini voice output is mono at 24kHz
        const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
        audioBuffer.copyToChannel(float32Data, 0);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Connect source to speakers
        source.connect(audioContext.destination);

        // Schedule playback sequentially without overlap to prevent audio popping
        const startTime = Math.max(audioContext.currentTime, nextPlayTime);
        source.start(startTime);
        nextPlayTime = startTime + audioBuffer.duration;

        // Track active source nodes to allow cutting off playback immediately (barge-in)
        activeSources.push(source);
        source.onended = () => {
            activeSources = activeSources.filter(src => src !== source);
        };

        // Update UI status to "Speaking"
        tutorAvatar.className = 'tutor-avatar speaking';
        tutorStatusText.innerText = 'Tutor is speaking...';
    } catch (err) {
        console.error('[Audio] Error playing audio chunk:', err);
    }
}

// Immediately stop all playing/scheduled audio chunks (Barge-in / Interruption)
function stopAllAudioPlayback() {
    activeSources.forEach(source => {
        try {
            source.stop();
        } catch (e) {
            // Node might have already finished playing
        }
    });
    activeSources = [];
    nextPlayTime = 0;
    
    tutorAvatar.className = 'tutor-avatar idle';
    tutorStatusText.innerText = 'Tutor interrupted. Listening...';
}

// Linear downsampler: Float32 (mic sample rate) to Int16 PCM (16000Hz)
function downsampleAndConvert(buffer: Float32Array, inputSampleRate: number): Int16Array {
    const targetSampleRate = 16000;
    if (inputSampleRate === targetSampleRate) {
        // Just convert Float32 to Int16 directly
        const int16Result = new Int16Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            const sample = Math.max(-1, Math.min(1, buffer[i]));
            int16Result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return int16Result;
    }

    const sampleRateRatio = inputSampleRate / targetSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    
    let offsetResult = 0;
    let offsetBuffer = 0;
    
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0;
        let count = 0;
        
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        
        let sample = count > 0 ? accum / count : 0;
        // Clamp sample to [-1, 1] range
        sample = Math.max(-1, Math.min(1, sample));
        result[offsetResult] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    
    return result.subarray(0, offsetResult);
}

// Initialize Audio Context and request mic stream on user click gesture
async function initializeAudio(): Promise<boolean> {
    try {
        // Create AudioContext synchronously inside user gesture
        if (!audioContext) {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        console.log('[Audio] AudioContext state:', audioContext.state, 'sampleRate:', audioContext.sampleRate);
        console.log('[Audio] Requesting microphone permission...');
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        console.log('[Audio] Microphone permission approved. Tracks:', mediaStream.getAudioTracks().length);
        return true;
    } catch (err: any) {
        console.error('[Audio] Failed to acquire microphone:', err);
        appendSystemMessage(`Microphone Error: ${err.name || 'Unknown'} — ${err.message || err}`);
        return false;
    }
}

// Start capturing microphone and stream PCM audio to the WebSocket
function startMicStreaming() {
    try {
        if (!audioContext || !mediaStream) {
            throw new Error('Audio not initialized');
        }

        // Create visualizer analyser
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 256;

        micSource = audioContext.createMediaStreamSource(mediaStream);
        micSource.connect(audioAnalyser);

        const inputSampleRate = audioContext.sampleRate;
        console.log(`[Audio] Mic sample rate: ${inputSampleRate}Hz → downsampling to 16000Hz`);

        // ScriptProcessorNode with buffer size 2048 for cross-platform compatibility
        recorderNode = audioContext.createScriptProcessor(2048, 1, 1);
        
        recorderNode.onaudioprocess = (e) => {
            // Only send audio when we have an open, connected socket
            if (!isSessionActive || isMuted || !socket || socket.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const pcmInt16Data = downsampleAndConvert(inputData, inputSampleRate);

            // Stream raw PCM bytes directly as a binary frame
            socket.send(pcmInt16Data.buffer);
        };

        micSource.connect(recorderNode);
        recorderNode.connect(audioContext.destination);

        tutorAvatar.className = 'tutor-avatar listening';
        tutorStatusText.innerText = 'Listening...';
        
        // Start drawing the visualizer wave
        drawVisualizer();

        console.log('[Audio] Mic streaming pipeline active.');
    } catch (err: any) {
        console.error('[Audio] Failed to start mic streaming:', err);
        appendSystemMessage(`Mic Streaming Error: ${err.name || 'Unknown'} — ${err.message || err}`);
        throw err;
    }
}

// Clean up recording nodes
function stopMicrophoneRecording() {
    if (recorderNode) {
        recorderNode.disconnect();
        recorderNode = null;
    }
    if (micSource) {
        micSource.disconnect();
        micSource = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    audioAnalyser = null;
    tutorAvatar.className = 'tutor-avatar idle';
}

// Append messages to transcript DOM
function appendMessage(speaker: 'user' | 'tutor', text: string) {
    const isPlaceholder = transcriptBox.querySelector('.placeholder-text');
    if (isPlaceholder) {
        transcriptBox.innerHTML = '';
    }

    // Scroll to bottom
    const wasAtBottom = transcriptBox.scrollHeight - transcriptBox.clientHeight <= transcriptBox.scrollTop + 20;

    const msgElement = document.createElement('p');
    if (speaker === 'user') {
        msgElement.innerHTML = `<span class="speaker-user">You:</span> ${text}`;
    } else {
        msgElement.innerHTML = `<span class="speaker-tutor">Tutor:</span> ${text}`;
    }

    transcriptBox.appendChild(msgElement);

    if (wasAtBottom) {
        transcriptBox.scrollTop = transcriptBox.scrollHeight;
    }
}

function appendSystemMessage(text: string) {
    const msgElement = document.createElement('p');
    msgElement.style.color = '#ef4444';
    msgElement.style.fontStyle = 'italic';
    msgElement.innerText = text;
    transcriptBox.appendChild(msgElement);
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

// Parse the tutor's marked shadowing-drill block and show it as a drill card.
function parseTutorInstructions(text: string) {
    const textSection = text.match(/--- Text ---([\s\S]*?)---/i);
    const readingSection = text.match(/--- Reading ---([\s\S]*?)---/i) || text.match(/--- Readings ---([\s\S]*?)---/i) || text.match(/--- Furigana ---([\s\S]*?)---/i);
    const translationSection = text.match(/--- Translation ---([\s\S]*?)---/i) || text.match(/--- Meaning ---([\s\S]*?)---/i) || text.match(/--- English ---([\s\S]*?)---/i);

    if (textSection) {
        shadowingSection.classList.remove('hidden');
        drillJa.innerText = textSection[1].trim();
        drillFuri.innerText = readingSection ? readingSection[1].trim() : '';
        drillEn.innerText = translationSection ? translationSection[1].trim() : '';
        drillFeedback.innerText = 'Drill active! Listen to the pronunciation and repeat.';
    }
}

// Connect Session WebSocket
function connectSession() {
    connectionStatus.className = 'status connecting';
    connectionStatus.innerText = 'Connecting...';
    btnToggleSession.innerText = 'Connecting...';
    btnToggleSession.disabled = true;

    // Derive server WebSocket URL dynamically (supports local dev and Railway production domains)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const socketUrl = `${protocol}//${host}/live-tutor`;

    console.log(`[Socket] Connecting to: ${socketUrl}`);
    socket = new WebSocket(socketUrl);

    socket.onopen = () => {
        console.log('[Socket] Connected to server relay.');
        isConnected = true;
        
        connectionStatus.className = 'status connected';
        connectionStatus.innerText = 'Connected';
        btnToggleSession.innerText = 'End Session';
        btnToggleSession.disabled = false;
        btnMute.classList.remove('hidden');

        // Clear placeholder text
        transcriptBox.innerHTML = '';

        // NOW start mic streaming — the socket is open and ready to receive audio
        try {
            startMicStreaming();
        } catch (err) {
            console.error('[Session] Failed to start mic after WS connect:', err);
            disconnectSession();
        }
    };

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);

            if (message.type === 'text') {
                appendMessage('tutor', message.content);
                parseTutorInstructions(message.content);
            } else if (message.type === 'audio') {
                playAudioChunk(message.data);
            } else if (message.type === 'interrupted') {
                stopAllAudioPlayback();
            } else if (message.type === 'turnComplete') {
                tutorAvatar.className = 'tutor-avatar idle';
                tutorStatusText.innerText = 'Listening...';
            } else if (message.type === 'error') {
                appendSystemMessage(`Tutor Error: ${message.message}`);
            }
        } catch (err) {
            console.error('[Socket] Failed to parse socket frame:', err);
        }
    };

    socket.onerror = (err) => {
        console.error('[Socket] WebSocket connection error:', err);
        appendSystemMessage('Connection Error: Failed to reach tutor server.');
        disconnectSession();
    };

    socket.onclose = (event) => {
        console.log(`[Socket] Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        if (isSessionActive) {
            // Unexpected closure
            appendSystemMessage(`Session disconnected unexpectedly (code: ${event.code}).`);
        }
        disconnectSession();
    };
}

// Disconnect Session
function disconnectSession() {
    isConnected = false;
    isSessionActive = false;
    stopMicrophoneRecording();
    stopAllAudioPlayback();

    if (socket) {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
        }
        socket = null;
    }

    connectionStatus.className = 'status disconnected';
    connectionStatus.innerText = 'Disconnected';
    btnToggleSession.innerText = 'Start Session';
    btnToggleSession.disabled = false;
    btnMute.classList.add('hidden');
    btnMute.innerText = 'Mute Mic';
    btnMute.className = 'btn btn-secondary';
    isMuted = false;

    shadowingSection.classList.add('hidden');
    tutorStatusText.innerText = 'Session ended';
    drawIdleWave();
}

// Toggle Session Handler
btnToggleSession.addEventListener('click', async () => {
    if (isSessionActive || isConnected || socket) {
        disconnectSession();
    } else {
        btnToggleSession.innerText = 'Initializing...';
        btnToggleSession.disabled = true;
        isSessionActive = true;

        // Step 1: Request mic permissions (must happen in user gesture)
        const hasMic = await initializeAudio();
        if (!hasMic) {
            isSessionActive = false;
            btnToggleSession.innerText = 'Start Session';
            btnToggleSession.disabled = false;
            return;
        }

        // Step 2: Connect WebSocket (mic streaming starts inside onopen callback)
        connectSession();
    }
});

// Toggle Mute Handler
btnMute.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
        btnMute.innerText = 'Unmute Mic';
        btnMute.className = 'btn btn-secondary muted';
        tutorStatusText.innerText = 'Microphone muted';
        tutorAvatar.className = 'tutor-avatar idle';
    } else {
        btnMute.innerText = 'Mute Mic';
        btnMute.className = 'btn btn-secondary';
        tutorStatusText.innerText = 'Listening...';
        if (isConnected) {
            tutorAvatar.className = 'tutor-avatar listening';
        }
    }
});
