import { bot } from './bot/index.ts';
import './server.ts';
import { config } from './config.ts';
import { pingDatabase } from './services/supabase.ts';
import { initMorningScheduler, stopScheduler } from './services/scheduler.ts';

async function start() {
    console.log(`Starting ${config.bot.name} (target: ${config.bot.targetLanguage})...`);

    const lang = config.bot.targetLanguage;

    await bot.api.setMyCommands([
        { command: 'status',      description: 'Check if the bot is online' },
        { command: 'tutor',       description: 'Open the real-time live tutoring classroom' },
        { command: 'call',        description: `Start ${lang}-only voice call session [min] [topic]` },
        { command: 'endcall',     description: 'End voice call session and get report' },
        { command: 'mission',     description: `Get today's ${lang} learning mission` },
        { command: 'cheatsheet',  description: `Get contextual ${lang} for a situation` },
        { command: 'shadow',      description: 'Start shadowing practice [level] [topic]' },
        { command: 'news',        description: 'Daily news reading drill in the target language' },
        { command: 'mock',        description: 'Timed listening mock set (scored)' },
        { command: 'endmock',     description: 'Abort an in-progress mock set' },
        { command: 'mockstats',   description: 'Show recent mock listening scores' },
        { command: 'new',         description: 'Clear working memory and start fresh' },
        { command: 'compact',     description: 'Run memory decay and deduplication' },
        { command: 'model',       description: 'Show current LLM model' },
        { command: 'usage',       description: 'Show session token and latency stats' },
        { command: 'morning',     description: 'Get your daily morning briefing' },
        { command: 'grammar',     description: 'Manage grammar drill points [add|remove|list]' },
        { command: 'setup',       description: 'Run initial setup to gather core facts' },
    ]);

    bot.start({
        onStart: (botInfo) => {
            console.log(`Bot initialized as @${botInfo.username}`);
            console.log('Listening for messages (Long Polling)...');

            pingDatabase();
            setInterval(pingDatabase, 12 * 60 * 60 * 1000);

            initMorningScheduler(bot);
        },
    });

    process.on('SIGINT', () => {
        console.log('Stopping bot...');
        stopScheduler();
        bot.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('Stopping bot...');
        stopScheduler();
        bot.stop();
        process.exit(0);
    });
}

start().catch(console.error);
