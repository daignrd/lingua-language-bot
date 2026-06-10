import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import { config } from '../config.ts';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Converts raw PCM audio buffer to compressed OGG Opus format using ffmpeg.
 * Gemini outputs raw 16-bit PCM little-endian, mono, 24kHz.
 */
async function convertPcmToOgg(pcmBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-f', 's16le',
            '-ar', '24000',
            '-ac', '1',
            '-i', 'pipe:0',
            '-c:a', 'libopus',
            '-b:a', '32k',
            '-f', 'ogg',
            'pipe:1'
        ]);

        const chunks: Buffer[] = [];
        const errs: string[] = [];

        ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
        ffmpeg.stderr.on('data', (data) => errs.push(data.toString()));

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve(Buffer.concat(chunks));
            } else {
                reject(new Error(`ffmpeg conversion failed with code ${code}. Error: ${errs.join('')}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
        });

        ffmpeg.stdin.write(pcmBuffer);
        ffmpeg.stdin.end();
    });
}

/** Pulls the raw PCM audio part out of a Gemini TTS response and returns OGG. */
async function extractAndConvert(result: any): Promise<Buffer> {
    const candidate = result.response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let pcmBuffer: Buffer | null = null;
    for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
            pcmBuffer = Buffer.from(part.inlineData.data, 'base64');
            break;
        }
    }

    if (!pcmBuffer) {
        throw new Error('[Gemini TTS] No audio part found in the Gemini response candidates.');
    }

    const oggBuffer = await convertPcmToOgg(pcmBuffer);
    return oggBuffer;
}

/**
 * Converts text to speech using Google's native Gemini TTS and returns an OGG buffer.
 */
export async function textToSpeech(text: string): Promise<Buffer> {
    const modelName = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';
    const voiceName = process.env.GEMINI_VOICE_NAME || 'Aoede'; // Puck, Charon, Kore, Fenrir, Aoede, etc.

    console.log(`[Gemini TTS] Generating audio with model ${modelName}, voice ${voiceName}...`);

    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            },
        } as any,
    });

    return extractAndConvert(result);
}

export interface DialogueTurn {
    speaker: 'A' | 'B';
    text: string;
}

/**
 * Two-speaker TTS for listening dialogues (two distinct voices). Gemini's
 * multi-speaker preview supports exactly two speakers — ideal for the /mock
 * listening drills. Voices are configurable via GEMINI_VOICE_A / GEMINI_VOICE_B.
 */
export async function textToSpeechDialogue(turns: DialogueTurn[]): Promise<Buffer> {
    const modelName = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';
    const voiceA = process.env.GEMINI_VOICE_A || 'Charon';
    const voiceB = process.env.GEMINI_VOICE_B || 'Aoede';

    // Speaker labels are read by the model only to switch voices — not spoken aloud.
    const script = turns
        .map(t => `${t.speaker === 'A' ? 'Speaker A' : 'Speaker B'}: ${t.text}`)
        .join('\n');
    const prompt = `TTS the following two-person conversation in clear, natural, neutral speech:\n${script}`;

    console.log(`[Gemini TTS] Generating multi-speaker dialogue (${turns.length} turns) with ${modelName}...`);

    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        { speaker: 'Speaker A', voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceA } } },
                        { speaker: 'Speaker B', voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceB } } },
                    ],
                },
            },
        } as any,
    });

    return extractAndConvert(result);
}
