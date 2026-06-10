import { WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config.ts';
import { getCoreFacts } from './supabase.ts';
import { ALL_TOOLS, executeTool } from '../tools/index.ts';

/**
 * Builds the system instruction prompt using soul.md, core facts, and language skills.
 */
async function buildLiveTutorSystemInstruction(): Promise<string> {
    const lang = config.bot.targetLanguage;
    const name = config.bot.name;

    const soulContent = fs.readFileSync(path.join(process.cwd(), 'soul.md'), 'utf-8');

    const coreFacts = await getCoreFacts();
    const factsContext = coreFacts.length > 0
        ? '\n\nCORE FACTS ABOUT THE USER:\n' + coreFacts.map(fact => `- ${fact.fact_key}: ${fact.fact_value}`).join('\n')
        : '';

    // Load relevant behavioral skills (best-effort).
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

${soulContent}
${factsContext}

Live Tutor Guidelines:
${liveTutorSkill}

Shadowing Session Guidelines:
${shadowingSkill}`;
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
 * Handles WebSocket connections from the client (Telegram Mini App frontend)
 * and proxies a relay to the Gemini Multimodal Live API.
 */
export async function handleLiveTutorConnection(clientWs: WebSocket) {
    console.log('[Live Tutor] Client connected to live-tutor WebSocket.');

    const apiKey = config.gemini.apiKey;
    const model = process.env.GEMINI_LIVE_MODEL || 'models/gemini-3.1-flash-live-preview';
    const voiceName = process.env.GEMINI_VOICE_NAME || 'Aoede';

    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    console.log(`[Live Tutor] Connecting to Gemini Live API using model: ${model}...`);
    const geminiWs = new WebSocket(geminiUrl);

    // Track state: do NOT send audio until Gemini sends setupComplete
    let isGeminiReady = false;
    const pendingChunks: Buffer[] = [];

    geminiWs.on('open', async () => {
        console.log('[Live Tutor] Connected to Gemini Live API WebSocket.');

        try {
            const systemInstruction = await buildLiveTutorSystemInstruction();
            const tools = getGeminiLiveTools();

            const setupMessage = {
                setup: {
                    model: model,
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: voiceName,
                                },
                            },
                        },
                    },
                    systemInstruction: {
                        parts: [{ text: systemInstruction }],
                    },
                    tools: tools,
                },
            };

            geminiWs.send(JSON.stringify(setupMessage));
            console.log('[Live Tutor] Session setup message sent. Waiting for setupComplete...');
        } catch (err) {
            console.error('[Live Tutor] Failed during Gemini session setup:', err);
            clientWs.close();
        }
    });

    geminiWs.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());

            // 0. setupComplete — the gate that allows audio streaming
            if (message.setupComplete !== undefined) {
                isGeminiReady = true;
                console.log('[Live Tutor] Received setupComplete — flushing pending audio...');
                while (pendingChunks.length > 0) {
                    const chunk = pendingChunks.shift();
                    if (chunk) sendAudioChunkToGemini(chunk);
                }
                return;
            }

            // 1. Assistant audio/text output
            if (message.serverContent) {
                const modelTurn = message.serverContent.modelTurn;
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

                if (message.serverContent.turnComplete) {
                    clientWs.send(JSON.stringify({ type: 'turnComplete' }));
                }

                if (message.serverContent.interrupted) {
                    console.log('[Live Tutor] Interrupted: user speaking, telling client to cut audio.');
                    clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }
            }

            // 2. Tool calls
            if (message.toolCall && message.toolCall.functionCalls) {
                for (const call of message.toolCall.functionCalls) {
                    const { name, id, args } = call;
                    console.log(`[Live Tutor] Tool Call Request: ${name} (ID: ${id})`);

                    try {
                        const result = await executeTool(name, args);
                        geminiWs.send(JSON.stringify({
                            toolResponse: {
                                functionResponses: [{ name, id, response: { output: result } }],
                            },
                        }));
                    } catch (toolErr) {
                        console.error(`[Live Tutor] Tool execution error for ${name}:`, toolErr);
                        geminiWs.send(JSON.stringify({
                            toolResponse: {
                                functionResponses: [{ name, id, response: { error: toolErr instanceof Error ? toolErr.message : String(toolErr) } }],
                            },
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
        try {
            clientWs.send(JSON.stringify({ type: 'error', message: 'Tutor connection error occurred.' }));
        } catch (_) { /* client may already be closed */ }
    });

    geminiWs.on('close', (code, reason) => {
        console.log(`[Live Tutor] Gemini WebSocket closed: ${code} - ${reason}`);
        try {
            clientWs.close();
        } catch (_) { /* client may already be closed */ }
    });

    // Incoming messages from the client (TMA frontend)
    clientWs.on('message', (message, isBinary) => {
        if (isBinary) {
            const buffer = message as Buffer;
            if (isGeminiReady) {
                sendAudioChunkToGemini(buffer);
            } else {
                pendingChunks.push(buffer);
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

    clientWs.on('close', () => {
        console.log('[Live Tutor] Client disconnected. Closing Gemini WebSocket...');
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close();
        }
    });

    function sendAudioChunkToGemini(buffer: Buffer) {
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(JSON.stringify({
                realtimeInput: {
                    audio: {
                        data: buffer.toString('base64'),
                        mimeType: 'audio/pcm;rate=16000',
                    },
                },
            }));
        }
    }
}
