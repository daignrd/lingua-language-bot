import * as dotenv from 'dotenv';
import { env } from 'process';

dotenv.config();

function getEnv(key: string): string {
    const value = env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function getEnvOrDefault(key: string, fallback: string): string {
    return env[key] || fallback;
}

export const config = {
    bot: {
        name: getEnvOrDefault('BOT_NAME', 'Lingua'),
        targetLanguage: getEnv('TARGET_LANGUAGE'),
        userLocation: getEnvOrDefault('USER_LOCATION', ''),
        levelSystem: getEnvOrDefault('LEVEL_SYSTEM', 'intermediate'),
    },
    schedule: {
        morningHour: parseInt(getEnvOrDefault('MORNING_HOUR', '9'), 10),
        timezoneOffsetHours: parseInt(getEnvOrDefault('MORNING_TIMEZONE_OFFSET', '0'), 10),
    },
    telegram: {
        botToken: getEnv('TELEGRAM_BOT_TOKEN'),
        allowedUserId: parseInt(getEnv('TELEGRAM_ALLOWED_USER_ID'), 10),
    },
    openRouter: {
        apiKey: getEnv('OPENROUTER_API_KEY'),
    },
    gemini: {
        apiKey: getEnv('GEMINI_API_KEY'),
    },
    groq: {
        apiKey: getEnv('GROQ_API_KEY'),
    },
    elevenLabs: {
        apiKey: getEnv('ELEVENLABS_API_KEY'),
        voiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', // Rachel
    },
    supabase: {
        url: getEnv('SUPABASE_URL'),
        serviceKey: getEnv('SUPABASE_SERVICE_KEY'),
    },
};
