import { WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { config } from '../config.ts';
import { getCoreFacts } from './supabase.ts';
import { listGrammarPoints } from './grammar.ts';
import { ALL_TOOLS, executeTool } from '../tools/index.ts';
import { executeCommitEpisode } from '../tools/episodic.ts';

const openai = new OpenAI({
    apiKey: config.openRouter.apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
});

/**
 * Surfaces the user's current grammar rotation so the tutor knows what they are
 * studying and can weave those patterns into the session.
 */
function buildStudyContext(): string {
    const points = listGrammarPoints(true);
    if (points.length === 0) return '';

    const recent = [...points]
        .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
        .slice(0, 15);

    const lines = recent
        .map(p => `- ${p.pattern} — ${p.meaning}${p.notes ? ` (${p.notes})` : ''}`)
        .join('\n');

    return `\n\nCURRENT STUDY FOCUS (the user's active grammar rotation — prioritise weaving these patterns into the conversation, drills, and corrections, and check whether they can produce them):\n${lines}`;
}

/**
 * Builds the system instruction from soul.md, core facts, study context, and language skills.
 */
async function buildLiveTutorSystemInstruction(): Promise<string> {
    const lang = config.bot.targetLanguage;
    const name = config.bot.name;

    const soulContent = fs.readFileSync(path.join(process.cwd(), 'soul.md'), 'utf-8');

    const coreFacts = await getCoreFacts();
    const factsContext = coreFacts.length > 0
        ? '\n\nCORE FACTS ABOUT THE USER:\n' + coreFacts.map(fact => `- ${fact.fact_key}: ${fact.fact_value}`).join('\n')
        : '';

    const studyContext = buildStudyContext();

    let liveTutorSkill = '';
    let shadowingSkill = '';
    try {
        liveTutorSkill = fs.readFileSync(path.join(process.cwd(), 'skills', 'live-tutor.md'), 'utf-8');
        shadowingSkill = fs.readFileSync(path.join(process.cwd(), 'skills', 'shadowing.md'), 'utf-8');
    } catch (err) {
        console.warn('[Live Tutor] Warning: Failed to load live-tutor or shadowing skills.', err);
    }

    return `You are ${name}, the user's private ${lang} tutor. You are interacting in a real-time, low-latency voice session.

Core Instructions:
1. Talk to the user in ${lang}, but seamlessly switch to the user's native language for grammar explanations, translations, or vocabulary hints whenever the user asks for help.
2. Keep your conversational turns short (1-3 sentences) so the dialogue stays fluid and interactive. Do not lecture.
3. Conduct pronunciation and shadowing drills: read a ${lang} sentence clearly, and ask the user to shadow (repeat) it back to you. Analyze their repetition.
4. Correct grammar mistakes politely and directly when they occur.
5. Switch to full conversational practice at the user's ${lang} level when ready.
6. PACING: Speak ${lang} at a calm, deliberate pace — noticeably slower than native speed, with clear enunciation and a brief pause between phrases — so the user can follow and shadow comfortably. It is fine to speak the user's native language at a normal pace. If the user keeps up easily, you may gradually speed up.

${soulContent}
${factsContext}${studyContext}

Live Tutor Guidelines:
${liveTutorSkill}

Shadowing Session Guidelines:
${shadowingSkill}`;
}

/**
 * Summarizes a session transcript into a memory-worthy episode via the LLM.
 */
async function summarizeSession(transcriptText: string): Promise<string> {
    const lang = config.bot.targetLanguage;
    const completion = await openai.chat.completions.create({
        model: 'google/gemini-3.1-flash-lite-preview',
        max_tokens: 600,
        messages: [
            {
                role: 'system',
                content: `You summarize a ${lang} tutoring voice session for the student's long-term memory. Write 4-8 specific, factual sentences covering: the topics discussed, the grammar and vocabulary practiced, the mistakes the student made along with the corrections given, and anything notable they mentioned about their life or studies. Write in the third person about the student.`,
            },
            { role: 'user', content: `Session transcript:\n\n${transcriptText}` },
        ],
    });
    return completion.choices[0]?.message?.content?.trim() || transcriptText;
}

/**
 * Maps the bot's OpenAI-formatted tools into Google Gemini Live API format.
 */
function getGeminiLiveTools() {
    const functionDeclarations = ALL_TOOLS.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
    }));

    return [{ functionDeclarations }];
}

/**
 * Handles WebSocket connections from the client (TMA frontend) and proxies a
 * relay to the Gemini Multimodal Live API.
 *
 * Resilience: context-window compression keeps long sessions alive instead of
 * terminating when the audio context fills, session resumption + a guarded
 * server-side reconnect transparently recover dropped upstream connections,
 * and the full session transcript is committed to episodic memory on close.
 */
export async function handleLiveTutorConnection(clientWs: WebSocket) {
    console.log('[Live Tutor] Client connected to live-tutor WebSocket.');

    const apiKey = config.gemini.apiKey;
    const model = process.env.GEMINI_LIVE_MODEL || 'models/gemini-3.1-flash-live-preview';
    const voiceName = process.env.GEMINI_VOICE_NAME || 'Aoede';
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    const MAX_RECONNECTS = 3;

    let geminiWs: WebSocket;
    let isGeminiReady = false;
    let pendingChunks: Buffer[] = [];
    let resumptionHandle: string | null = null;
    let reconnectCount = 0;
    let clientClosed = false;
    let sessionRecorded = false;

    const transcript: { role: 'user' | 'tutor'; text: string }[] = [];
    let lastRole: 'user' | 'tutor' | null = null;

    const systemInstruction = await buildLiveTutorSystemInstruction();
    const tools = getGeminiLiveTools();

    function appendTranscript(role: 'user' | 'tutor', text: string) {
        if (!text) return;
        if (lastRole === role && transcript.length > 0) {
            transcript[transcript.length - 1].text += text;
        } else {
            transcript.push({ role, text });
            lastRole = role;
        }
    }

    async function recordSession() {
        if (sessionRecorded) return;
        sessionRecorded = true;

        const text = transcript
            .map(t => `${t.role === 'user' ? 'Student' : 'Tutor'}: ${t.text.trim()}`)
            .filter(line => line.length > 8)
            .join('\n');

        if (text.trim().length < 60) {
            console.log('[Live Tutor] Session too short to record to memory.');
            return;
        }

        try {
            const summary = await summarizeSession(text);
            await executeCommitEpisode({ summary: `Live tutor voice session — ${summary}` });
            console.log('[Live Tutor] Session recorded to episodic memory.');
        } catch (err) {
            console.error('[Live Tutor] Summarize failed, committing raw transcript:', err);
            try {
                await executeCommitEpisode({ summary: `Live tutor voice session transcript:\n${text}`.slice(0, 4000) });
            } catch (_) { /* best effort */ }
        }
    }

    function sendAudioChunkToGemini(buffer: Buffer) {
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(JSON.stringify({
                realtimeInput: {
                    audio: { data: buffer.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
                },
            }));
        }
    }

    function connectToGemini() {
        console.log(`[Live Tutor] Connecting to Gemini Live API (model: ${model})${resumptionHandle ? ' with resumption handle' : ''}...`);
        geminiWs = new WebSocket(geminiUrl);
        isGeminiReady = false;

        geminiWs.on('open', () => {
            console.log('[Live Tutor] Connected to Gemini Live API WebSocket.');
            try {
                const setupMessage = {
                    setup: {
                        model: model,
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                            speechConfig: {
                                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
                            },
                        },
                        systemInstruction: { parts: [{ text: systemInstruction }] },
                        tools: tools,
                        // Keep long sessions alive by compressing context instead of
                        // terminating when the audio context window fills up.
                        contextWindowCompression: { slidingWindow: {} },
                        // Transcribe both sides so the session can be saved to memory.
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
                        // Enable resumption so a dropped upstream can be recovered.
                        sessionResumption: resumptionHandle ? { handle: resumptionHandle } : {},
                    },
                };
                geminiWs.send(JSON.stringify(setupMessage));
                console.log('[Live Tutor] Session setup sent. Waiting for setupComplete...');
            } catch (err) {
                console.error('[Live Tutor] Failed during Gemini session setup:', err);
                clientWs.close();
            }
        });

        geminiWs.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());

                if (message.setupComplete !== undefined) {
                    isGeminiReady = true;
                    reconnectCount = 0;
                    console.log('[Live Tutor] setupComplete — flushing pending audio...');
                    while (pendingChunks.length > 0) {
                        const chunk = pendingChunks.shift();
                        if (chunk) sendAudioChunkToGemini(chunk);
                    }
                    return;
                }

                if (message.sessionResumptionUpdate) {
                    const upd = message.sessionResumptionUpdate;
                    if (upd.resumable && upd.newHandle) resumptionHandle = upd.newHandle;
                    return;
                }

                if (message.goAway) {
                    console.warn(`[Live Tutor] Server goAway — timeLeft: ${message.goAway.timeLeft}`);
                    return;
                }

                if (message.serverContent) {
                    const sc = message.serverContent;

                    if (sc.inputTranscription?.text) appendTranscript('user', sc.inputTranscription.text);
                    if (sc.outputTranscription?.text) {
                        appendTranscript('tutor', sc.outputTranscription.text);
                        clientWs.send(JSON.stringify({ type: 'text', content: sc.outputTranscription.text }));
                    }

                    const modelTurn = sc.modelTurn;
                    if (modelTurn && modelTurn.parts) {
                        for (const part of modelTurn.parts) {
                            if (part.text) {
                                clientWs.send(JSON.stringify({ type: 'text', content: part.text }));
                            }
                            if (part.inlineData) {
                                clientWs.send(JSON.stringify({ type: 'audio', data: part.inlineData.data }));
                            }
                        }
                    }

                    if (sc.turnComplete) {
                        clientWs.send(JSON.stringify({ type: 'turnComplete' }));
                    }

                    if (sc.interrupted) {
                        clientWs.send(JSON.stringify({ type: 'interrupted' }));
                    }
                }

                if (message.toolCall && message.toolCall.functionCalls) {
                    for (const call of message.toolCall.functionCalls) {
                        const { name, id, args } = call;
                        console.log(`[Live Tutor] Tool Call Request: ${name} (ID: ${id})`);
                        try {
                            const result = await executeTool(name, args);
                            geminiWs.send(JSON.stringify({
                                toolResponse: { functionResponses: [{ name, id, response: { output: result } }] },
                            }));
                        } catch (toolErr) {
                            console.error(`[Live Tutor] Tool execution error for ${name}:`, toolErr);
                            geminiWs.send(JSON.stringify({
                                toolResponse: { functionResponses: [{ name, id, response: { error: toolErr instanceof Error ? toolErr.message : String(toolErr) } }] },
                            }));
                        }
                    }
                }
            } catch (err) {
                console.error('[Live Tutor] Error parsing Gemini message:', err);
            }
        });

        geminiWs.on('error', (err) => {
            console.error('[Live Tutor] Gemini Live API WebSocket error:', err);
        });

        geminiWs.on('close', (code, reason) => {
            console.log(`[Live Tutor] Gemini WebSocket closed: ${code} - ${reason}`);
            if (!clientClosed && reconnectCount < MAX_RECONNECTS) {
                reconnectCount++;
                console.warn(`[Live Tutor] Reconnecting to Gemini (${reconnectCount}/${MAX_RECONNECTS})...`);
                setTimeout(connectToGemini, 500);
            } else {
                try { clientWs.close(); } catch (_) { /* client may already be closed */ }
            }
        });
    }

    connectToGemini();

    clientWs.on('message', (message, isBinary) => {
        if (isBinary) {
            const buffer = message as Buffer;
            if (isGeminiReady) {
                sendAudioChunkToGemini(buffer);
            } else {
                pendingChunks.push(buffer);
                if (pendingChunks.length > 400) pendingChunks = pendingChunks.slice(-400);
            }
        } else {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'text') {
                    geminiWs.send(JSON.stringify({
                        clientContent: {
                            turns: [{ role: 'user', parts: [{ text: data.content }] }],
                            turnComplete: true,
                        },
                    }));
                }
            } catch (err) {
                console.error('[Live Tutor] Failed to process client text message:', err);
            }
        }
    });

    clientWs.on('close', async () => {
        console.log('[Live Tutor] Client disconnected. Closing Gemini WebSocket...');
        clientClosed = true;
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close();
        }
        await recordSession();
    });
}
