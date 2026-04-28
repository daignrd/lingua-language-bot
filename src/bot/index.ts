import { Bot, InputFile } from 'grammy';
import { config } from '../config.ts';
import { processMessage, getUsageStats } from '../agent/index.ts';
import { transcribeAudio } from '../services/groq.ts';
import { textToSpeech } from '../services/elevenlabs.ts';
import { analyzeImage, analyzeDocument } from '../services/gemini.ts';
import { executeCommitEpisode } from '../tools/episodic.ts';
import { clearWorkingMemory } from '../services/supabase.ts';
import { executeOptimizeMemory } from '../tools/memory_manager.ts';
import { startCallSession, endCallSession, isInCallSession, getCallTimeRemaining } from '../services/session.ts';
import { addGrammarPoint, listGrammarPoints, removeGrammarPoint } from '../services/grammar.ts';

const LANG = config.bot.targetLanguage;
const LEVEL = config.bot.levelSystem;
const LOC = config.bot.userLocation || 'your city';
const NAME = config.bot.name;

export const bot = new Bot(config.telegram.botToken);

bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId !== config.telegram.allowedUserId) {
        if (userId) {
            console.log(`Unauthorized access attempt from user ID: ${userId}`);
        }
        return;
    }
    await next();
});

bot.command('setup', async (ctx) => {
    console.log(`Received /setup command from user ID: ${ctx.from?.id}`);
    await ctx.replyWithChatAction('typing');

    try {
        const setupMessage = "I would like to start the setup process. Please ask me these 8 initial questions one by one to save as core facts: 1. Name, 2. What I do, 3. Where I'm based, 4. Current Goals/Projects, 5. Topics I'm into, 6. How I like to communicate, 7. Tools I use daily, 8. Important people to know about. Expand on these as relevant. Ask the first question now.";
        const response = await processMessage(setupMessage);
        await ctx.reply(response);
    } catch (error) {
        console.error('Error processing setup command:', error);
        await ctx.reply('An error occurred while starting the setup process.');
    }
});

bot.command('status', async (ctx) => {
    await ctx.reply(`🟢 ${NAME} is online and ready.`);
});

bot.command('new', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    const success = await clearWorkingMemory();
    await ctx.reply(success ? '🧹 Working memory cleared. Starting fresh!' : '❌ Failed to clear memory.');
});

bot.command('compact', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    await ctx.reply('⚙️ Starting memory compaction (decay and deduplication)...');
    const result = await executeOptimizeMemory();
    await ctx.reply(result);
});

bot.command('model', async (ctx) => {
    await ctx.reply('🧠 Currently using: _google/gemini-3.1-flash-lite-preview_', { parse_mode: 'Markdown' });
});

bot.command('usage', async (ctx) => {
    await ctx.reply(getUsageStats());
});

// ─── Language Learning Commands ──────────────────────────────────────────────

// /call [minutes] [topic] — Start a target-language-only voice call session
bot.command('call', async (ctx) => {
    if (isInCallSession()) {
        const remaining = Math.ceil(getCallTimeRemaining() / 60000);
        await ctx.reply(`📞 You're already in a call session. ${remaining} minute(s) remaining.\nUse /endcall to end early.`);
        return;
    }

    const args = (ctx.match as string)?.trim();
    let duration = 5;
    let topic: string | undefined;

    if (args) {
        const parts = args.split(/\s+/);
        const firstNum = parseInt(parts[0], 10);
        if (!isNaN(firstNum)) {
            duration = Math.min(Math.max(firstNum, 1), 30);
            topic = parts.slice(1).join(' ') || undefined;
        } else {
            topic = args;
        }
    }

    startCallSession(duration, topic);

    const topicLine = topic ? `\nTopic: ${topic}` : '';
    await ctx.reply(`📞 Voice call session started! ${duration} minutes, ${LANG} only.${topicLine}\n\nSend voice messages to talk. Use /endcall to end early.`);

    await ctx.replyWithChatAction('typing');
    const opener = topic
        ? `A ${LANG}-only voice call session just started. The topic is: "${topic}". Greet the user in ${LANG} and start the conversation about this topic. Remember: ${LANG} ONLY, keep it short and conversational.`
        : `A ${LANG}-only voice call session just started. Greet the user in ${LANG} and start a casual conversation. Ask them about their day or what they're working on. Remember: ${LANG} ONLY, keep it short and conversational.`;
    const response = await processMessage(opener);

    try {
        await ctx.replyWithChatAction('record_voice');
        const voiceBuffer = await textToSpeech(response);
        await ctx.replyWithVoice(new InputFile(voiceBuffer, 'call-opener.mp3'));
        await ctx.reply(`🔊 _${response}_`, { parse_mode: 'Markdown' });
    } catch {
        await ctx.reply(response);
    }
});

bot.command('endcall', async (ctx) => {
    if (!isInCallSession()) {
        await ctx.reply('No active call session to end.');
        return;
    }

    const { duration, errors } = endCallSession();
    const durationMin = Math.round(duration / 60000);

    await ctx.replyWithChatAction('typing');

    const errorSummary = errors.length > 0
        ? `Grammar errors noted during the session:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
        : 'No grammar errors were noted during the session.';

    const prompt = `The ${LANG} voice call session just ended after ${durationMin} minute(s). ${errorSummary}\n\nNow provide the Session Report in the user's native language: summarize the topics covered, list grammar errors with corrections, suggest 3 vocabulary words to review, and give an overall fluency assessment for this session.`;
    const response = await processMessage(prompt);
    await ctx.reply(`📞 Call session ended.\n\n${response}`);
});

// /mission — Generate today's contextual learning mission
bot.command('mission', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    try {
        const prompt = `Generate today's Morning Mission for ${LANG} learning. Use the morning-mission skill format. Pick a useful ${LEVEL} word relevant to tech, daily life in ${LOC}, or the user's interests. Make the mission specific to my actual life and projects.`;
        const response = await processMessage(prompt);
        await ctx.reply(response);
    } catch (error) {
        console.error('Error in /mission:', error);
        await ctx.reply("Failed to generate today's mission.");
    }
});

// /cheatsheet [situation] — Get contextual target-language for a specific situation
bot.command('cheatsheet', async (ctx) => {
    const situation = (ctx.match as string)?.trim();
    if (!situation) {
        await ctx.reply(`Usage: /cheatsheet [where you're going or what you're doing]\n\nExamples:\n• /cheatsheet coffee shop in ${LOC}\n• /cheatsheet business meeting\n• /cheatsheet doctor appointment`);
        return;
    }

    await ctx.replyWithChatAction('typing');
    try {
        const prompt = `Generate a Location Context cheat sheet for this situation: "${situation}". Use the location-context skill format. Give me practical ${LANG} phrases and vocab I'll actually need in the next hour. Include casual and formal forms where relevant.`;
        const response = await processMessage(prompt);
        await ctx.reply(response);
    } catch (error) {
        console.error('Error in /cheatsheet:', error);
        await ctx.reply('Failed to generate cheat sheet.');
    }
});

// /shadow [level] [topic] — Start a shadowing practice session
bot.command('shadow', async (ctx) => {
    const args = (ctx.match as string)?.trim();
    let level = LEVEL;
    let topic = '';

    if (args) {
        topic = args;
    }

    await ctx.replyWithChatAction('typing');
    try {
        const topicInstruction = topic
            ? `The topic should be about: "${topic}".`
            : 'Pick a formal topic: office conversation, public announcement, doctor appointment, university discussion, or customer service encounter.';

        const prompt = `Start a Shadowing session. Use the shadowing skill format. Level: ${level}. ${topicInstruction} Generate a short natural ${LANG} passage (2-4 sentences), break it down with vocabulary and grammar notes, then read it aloud for me to shadow. After presenting the text, use the text-to-speech to read it so I can hear the pronunciation.`;
        const response = await processMessage(prompt);
        await ctx.reply(response);

        await ctx.replyWithChatAction('record_voice');
        const ttsPrompt = `Read ONLY the ${LANG} passage from the shadowing session you just generated. Nothing else — just the raw ${LANG} text, naturally and clearly.`;
        const ttsResponse = await processMessage(ttsPrompt);
        const voiceBuffer = await textToSpeech(ttsResponse);
        await ctx.replyWithVoice(new InputFile(voiceBuffer, 'shadow-audio.mp3'));
        await ctx.reply(`🔊 _${ttsResponse}_`, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in /shadow:', error);
        await ctx.reply('Failed to start shadowing session.');
    }
});

// /grammar [add|remove|list] — Manage grammar points for daily drills
bot.command('grammar', async (ctx) => {
    const args = (ctx.match as string)?.trim();

    if (!args || args === 'list') {
        const points = listGrammarPoints(true);
        if (points.length === 0) {
            await ctx.reply('No active grammar points.\n\nAdd one:\n/grammar add [pattern] | [meaning] | [optional notes]');
            return;
        }
        const list = points.map((p, i) => {
            const drilled = p.lastDrilledAt
                ? `drilled ${p.drillCount}x, last ${p.lastDrilledAt.split('T')[0]}`
                : 'never drilled';
            return `${i + 1}. **${p.pattern}** — ${p.meaning} (${drilled})${p.notes ? `\n   _${p.notes}_` : ''}`;
        }).join('\n');
        await ctx.reply(`📚 Active Grammar Points:\n\n${list}`, { parse_mode: 'Markdown' });
        return;
    }

    if (args.startsWith('add ')) {
        const rest = args.slice(4).trim();
        const parts = rest.split('|').map(s => s.trim());
        if (parts.length < 2) {
            await ctx.reply('Usage: /grammar add [pattern] | [meaning] | [optional notes]');
            return;
        }
        const [pattern, meaning, notes] = parts;
        const point = addGrammarPoint(pattern, meaning, notes);
        await ctx.reply(`✅ Added: **${point.pattern}** — ${point.meaning}${notes ? `\n_${notes}_` : ''}`, { parse_mode: 'Markdown' });
        return;
    }

    if (args.startsWith('remove ')) {
        const pattern = args.slice(7).trim();
        const success = removeGrammarPoint(pattern);
        await ctx.reply(success
            ? `🗑️ Removed "${pattern}" from drill rotation.`
            : `"${pattern}" not found. Use /grammar list to see active points.`);
        return;
    }

    await ctx.reply('Usage:\n/grammar list — see all active points\n/grammar add [pattern] | [meaning] | [notes]\n/grammar remove [pattern]');
});

// /morning — Combined morning briefing
bot.command('morning', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    try {
        const response = await runMorningRoutine();
        if (response.length > 4000) {
            const mid = response.lastIndexOf('\n', 2000);
            await ctx.reply(response.slice(0, mid));
            await ctx.reply(response.slice(mid));
        } else {
            await ctx.reply(response);
        }

        await ctx.replyWithChatAction('record_voice');
        const ttsPrompt = `Read ONLY the ${LANG} shadowing passage from the morning briefing you just generated. Nothing else — just the raw ${LANG} text, naturally and clearly.`;
        const ttsResponse = await processMessage(ttsPrompt);
        const voiceBuffer = await textToSpeech(ttsResponse);
        await ctx.replyWithVoice(new InputFile(voiceBuffer, 'morning-shadow.mp3'));
        await ctx.reply(`🔊 _${ttsResponse}_`, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in /morning:', error);
        await ctx.reply('Failed to generate morning briefing.');
    }
});

/**
 * Generates the full morning routine briefing via the agent.
 * Also used by the auto-scheduler.
 */
export async function runMorningRoutine(): Promise<string> {
    const prompt = `Generate the Morning Briefing. This is a combined routine with these sections — do ALL of them in one response:

1. **📝 Grammar Drill**: Use the pick_grammar_drill tool to get today's grammar point from my rotation. Generate ONE natural example sentence in ${LANG} using that grammar pattern. The sentence should be relevant to my life. Show the sentence, its breakdown, and a translation. Format it so I can shadow it. If no grammar points are saved yet, skip this section and tell me to add some with /grammar.

2. **🎯 Today's Mission**: Pick a useful ${LEVEL} word in ${LANG}. Give me a specific real-life challenge to use it today. Include a fill-in-the-blank or translation drill.

3. **🎧 Shadowing Clip**: Generate a short natural ${LANG} passage (2-3 sentences) at ${LEVEL} level. Topic: pick something relevant to my life or daily situations in ${LOC}. Include a quick vocab list for any harder words.

Keep the total response concise and scannable — this needs to be readable on a phone screen while having coffee. Use the emoji section headers exactly as shown above.`;

    return processMessage(prompt);
}

bot.on('message:text', async (ctx) => {
    const userMessage = ctx.message.text;
    console.log(`Received text message: ${userMessage}`);

    await ctx.replyWithChatAction('typing');

    try {
        const response = await processMessage(userMessage);
        await ctx.reply(response);
    } catch (error) {
        console.error('Error processing text message:', error);
        await ctx.reply('An error occurred while processing your request.');
    }
});

bot.on(['message:voice', 'message:video_note'], async (ctx) => {
    console.log(`Received voice/video note from user ID: ${ctx.from?.id}`);

    await ctx.replyWithChatAction('record_voice');

    try {
        const fileId = ctx.message.voice?.file_id || ctx.message.video_note?.file_id;
        if (!fileId) throw new Error('No file ID found.');

        const file = await ctx.getFile();
        const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
        const audioResponse = await fetch(url);

        if (!audioResponse.ok) {
            throw new Error(`Failed to download audio from Telegram: ${audioResponse.status}`);
        }

        const arrayBuffer = await audioResponse.arrayBuffer();

        const transcription = await transcribeAudio(arrayBuffer, 'voice_message.ogg');
        console.log(`Transcription: ${transcription}`);

        await ctx.reply(`🎙️ _${transcription}_`, { parse_mode: 'Markdown' });

        await ctx.replyWithChatAction('typing');
        const textResponse = await processMessage(transcription);

        await ctx.replyWithChatAction('record_voice');
        const generatedVoiceBuffer = await textToSpeech(textResponse);

        await ctx.replyWithVoice(new InputFile(generatedVoiceBuffer, 'response.mp3'));
        await ctx.reply(`🔊 _${textResponse}_`, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('Error processing voice message:', error);
        await ctx.reply('Sorry, an error occurred while processing your voice note.');
    }
});

bot.on('message:photo', async (ctx) => {
    console.log(`Received photo from user ID: ${ctx.from?.id}`);
    await ctx.replyWithChatAction('typing');

    try {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const file = await ctx.api.getFile(photo.file_id);
        const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error('Failed to download image.');
        const arrayBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = 'image/jpeg';

        const description = await analyzeImage(mimeType, base64Data);

        const caption = ctx.message.caption ? `Caption: ${ctx.message.caption}` : 'No caption.';
        const memoryEntry = `User sent an image. ${caption}\n\nImage Description: ${description}`;

        await executeCommitEpisode({ summary: memoryEntry });
        await ctx.reply(`👁️ I analyzed and memorized that image.`);

        if (ctx.message.caption) {
            const llmResponse = await processMessage(`I sent an image. Caption: ${ctx.message.caption}\nDescription: ${description}`);
            await ctx.reply(llmResponse);
        }

    } catch (error) {
        console.error('Error processing photo:', error);
        await ctx.reply('An error occurred while analyzing the image.');
    }
});

bot.on('message:document', async (ctx) => {
    console.log(`Received document from user ID: ${ctx.from?.id}`);
    await ctx.replyWithChatAction('typing');

    try {
        const file = await ctx.api.getFile(ctx.message.document.file_id);
        const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error('Failed to download document.');
        const arrayBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = ctx.message.document.mime_type || 'application/pdf';

        const description = await analyzeDocument(mimeType, base64Data);

        const caption = ctx.message.caption ? `Caption: ${ctx.message.caption}` : 'No caption.';
        const memoryEntry = `User sent a document (${ctx.message.document.file_name}). ${caption}\n\nDocument Analysis: ${description}`;

        await executeCommitEpisode({ summary: memoryEntry });
        await ctx.reply(`📄 I analyzed and memorized the document contents.`);

        if (ctx.message.caption) {
            const llmResponse = await processMessage(`I sent a document named ${ctx.message.document.file_name}. Caption: ${ctx.message.caption}\nAnalysis: ${description}`);
            await ctx.reply(llmResponse);
        }
    } catch (error) {
        console.error('Error processing document:', error);
        await ctx.reply('An error occurred while analyzing the document. Note: Only PDF and text formats are well supported by the vision model.');
    }
});

bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
});
