/**
 * Scheduler for automated daily routines.
 * Calculates time until the next configured morning hour in the user's
 * configured timezone offset and fires the morning briefing.
 */

import { Bot } from 'grammy';
import { config } from '../config.ts';
import { runMorningRoutine } from '../bot/index.ts';
import { textToSpeech } from './elevenlabs.ts';
import { InputFile } from 'grammy';

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

function offsetMs(): number {
    return config.schedule.timezoneOffsetHours * 60 * 60 * 1000;
}

function msUntilNextMorning(): number {
    const now = new Date();
    const offset = offsetMs();
    const nowLocal = new Date(now.getTime() + offset + now.getTimezoneOffset() * 60000);

    const target = new Date(nowLocal);
    target.setHours(config.schedule.morningHour, 0, 0, 0);

    if (nowLocal >= target) {
        target.setDate(target.getDate() + 1);
    }

    const targetUTC = new Date(target.getTime() - offset - now.getTimezoneOffset() * 60000);
    return targetUTC.getTime() - now.getTime();
}

async function sendMorningBriefing(bot: Bot): Promise<void> {
    const chatId = config.telegram.allowedUserId;
    console.log('[Scheduler] Sending morning briefing...');

    try {
        await bot.api.sendMessage(chatId, '☀️ Good morning! Generating your daily briefing...');

        const response = await runMorningRoutine();

        if (response.length > 4000) {
            const mid = response.lastIndexOf('\n', 2000);
            await bot.api.sendMessage(chatId, response.slice(0, mid));
            await bot.api.sendMessage(chatId, response.slice(mid));
        } else {
            await bot.api.sendMessage(chatId, response);
        }

        try {
            const { processMessage } = await import('../agent/index.ts');
            const ttsPrompt = `Read ONLY the ${config.bot.targetLanguage} shadowing passage from the morning briefing you just generated. Nothing else — just the raw ${config.bot.targetLanguage} text, naturally and clearly.`;
            const ttsResponse = await processMessage(ttsPrompt);
            const voiceBuffer = await textToSpeech(ttsResponse);
            await bot.api.sendVoice(chatId, new InputFile(voiceBuffer, 'morning-shadow.mp3'));
        } catch (ttsError) {
            console.error('[Scheduler] TTS failed for morning briefing:', ttsError);
        }

        console.log('[Scheduler] Morning briefing sent successfully.');
    } catch (error) {
        console.error('[Scheduler] Failed to send morning briefing:', error);
        try {
            await bot.api.sendMessage(chatId, '❌ Morning briefing failed to generate. Use /morning to try manually.');
        } catch { /* ignore send failure */ }
    }
}

function scheduleNext(bot: Bot): void {
    const ms = msUntilNextMorning();
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    console.log(`[Scheduler] Next morning briefing in ${hours}h ${minutes}m`);

    schedulerTimer = setTimeout(async () => {
        await sendMorningBriefing(bot);
        scheduleNext(bot);
    }, ms);
}

export function initMorningScheduler(bot: Bot): void {
    const offsetSign = config.schedule.timezoneOffsetHours >= 0 ? '+' : '';
    console.log(`[Scheduler] Initializing ${config.schedule.morningHour}:00 (UTC${offsetSign}${config.schedule.timezoneOffsetHours}) morning briefing scheduler...`);
    scheduleNext(bot);
}

export function stopScheduler(): void {
    if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
        console.log('[Scheduler] Stopped.');
    }
}
