import { config } from '../config.ts';

export async function transcribeAudio(audioBuffer: ArrayBuffer, filename: string = 'audio.ogg'): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'text');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.groq.apiKey}`
        },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq Transcription Error: ${response.status} ${errorText}`);
    }

    // Since we requested 'text', Groq returns a plain text string instead of a JSON object
    const text = await response.text();
    return text;
}
