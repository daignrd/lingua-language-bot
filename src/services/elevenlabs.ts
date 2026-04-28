import { config } from '../config.ts';

/**
 * Converts text to speech using ElevenLabs API
 * @param text The text to convert to speech
 * @returns A buffer containing the generated audio (MP3 by default)
 */
export async function textToSpeech(text: string): Promise<Buffer> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabs.voiceId}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': config.elevenLabs.apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            model_id: 'eleven_turbo_v2_5', // High quality, low latency conversational model
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs TTS Error: ${response.status} ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
