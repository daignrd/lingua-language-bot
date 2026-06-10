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
    news: {
        // RSS 2.0 / Atom feed in the target language (e.g. Tagesschau for
        // German, ANSA for Italian, NHK for Japanese). Optional.
        rssUrl: getEnvOrDefault('NEWS_RSS_URL', ''),
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
        // Native Gemini TTS (voice replies, shadowing, news) + Live API (the /tutor mini app).
        ttsModel: getEnvOrDefault('GEMINI_TTS_MODEL', 'gemini-3.1-flash-tts-preview'),
        liveModel: getEnvOrDefault('GEMINI_LIVE_MODEL', 'models/gemini-3.1-flash-live-preview'),
        voiceName: getEnvOrDefault('GEMINI_VOICE_NAME', 'Aoede'),
    },
    groq: {
        apiKey: getEnv('GROQ_API_KEY'),
    },
    webApp: {
        // Public URL of the deployed Live Tutor mini app (Telegram WebApp button in /tutor).
        url: getEnvOrDefault('WEBAPP_URL', ''),
    },
    supabase: {
        url: getEnv('SUPABASE_URL'),
        serviceKey: getEnv('SUPABASE_SERVICE_KEY'),
    },
};
