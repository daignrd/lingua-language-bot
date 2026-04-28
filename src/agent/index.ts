import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_TOOLS, executeTool } from '../tools/index.ts';
import { getCoreFacts, getRecentMessages, saveMessage } from '../services/supabase.ts';
import { config } from '../config.ts';
import { isInCallSession, getCallTimeRemaining } from '../services/session.ts';

const openai = new OpenAI({
    apiKey: config.openRouter.apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        'X-Title': config.bot.name,
    }
});

const MAX_ITERATIONS = 5;

let sessionTokens = {
    prompt: 0,
    completion: 0,
    total: 0,
    calls: 0,
    totalLatencyMs: 0
};

export function getUsageStats(): string {
    const avgLatency = sessionTokens.calls > 0 ? Math.round(sessionTokens.totalLatencyMs / sessionTokens.calls) : 0;
    return `📊 Session Usage Stats:\nPrompt Tokens: ${sessionTokens.prompt}\nCompletion Tokens: ${sessionTokens.completion}\nTotal Tokens: ${sessionTokens.total}\nTotal API Calls: ${sessionTokens.calls}\nAverage Turn Latency: ${avgLatency}ms`;
}

function substitutePlaceholders(text: string): string {
    return text
        .replaceAll('{{BOT_NAME}}', config.bot.name)
        .replaceAll('{{TARGET_LANGUAGE}}', config.bot.targetLanguage)
        .replaceAll('{{USER_LOCATION}}', config.bot.userLocation || 'their city')
        .replaceAll('{{LEVEL_SYSTEM}}', config.bot.levelSystem);
}

export async function processMessage(userMessage: string): Promise<string> {

    const coreFacts = await getCoreFacts();
    const knownKeys = coreFacts.map(fact => fact.fact_key);

    const DESIRED_FACTS = [
        'user_name',
        'primary_occupation',
        'location',
        'current_goals_projects',
        'topics_of_interest',
        'communication_style',
        'daily_tools',
        'important_people'
    ];

    const missingFacts = DESIRED_FACTS.filter(fact => !knownKeys.includes(fact));

    let factsContext = '';
    if (coreFacts.length > 0) {
        factsContext = '\n\nCORE FACTS ABOUT THE USER (DO NOT FORGET THESE):\n' +
            coreFacts.map(fact => `- ${fact.fact_key}: ${fact.fact_value}`).join('\n');
    }

    let proactiveGathering = '';
    if (missingFacts.length > 0) {
        proactiveGathering = `\n\nFACT GATHERING AWARENESS:\nYou are currently missing the following core facts about the user: [${missingFacts.join(', ')}].\nIf the user is doing a setup interview, systematically ask them about these one by one to gather the information. In normal conversation, look out for this info or ask when appropriate. Once you learn the answer, immediately use the \`add_core_fact\` tool to save it.`;
    }

    const soulContent = substitutePlaceholders(
        fs.readFileSync(path.join(process.cwd(), 'soul.md'), 'utf-8')
    );

    let skillsContent = '';
    const skillsDir = path.join(process.cwd(), 'skills');
    if (!fs.existsSync(skillsDir)) {
        fs.mkdirSync(skillsDir, { recursive: true });
    }
    const skillFiles = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
    if (skillFiles.length > 0) {
        skillsContent = '\n\nLOADED SKILLS:\n' + skillFiles.map(file => {
            const content = substitutePlaceholders(
                fs.readFileSync(path.join(skillsDir, file), 'utf-8')
            );
            return `<skill name="${file}">\n${content}\n</skill>`;
        }).join('\n');
    }

    let callContext = '';
    if (isInCallSession()) {
        const remainingMs = getCallTimeRemaining();
        const remainingMin = Math.ceil(remainingMs / 60000);
        callContext = `\n\nACTIVE VOICE CALL SESSION: You are currently in a ${config.bot.targetLanguage}-only voice call session. ${remainingMin} minute(s) remaining. Follow the voice-call skill rules strictly — speak ONLY in ${config.bot.targetLanguage}, keep responses short (1-3 sentences), and batch grammar errors for the end-of-session report. Do NOT switch to the user's native language.`;
    }

    const systemPreamble = `You are ${config.bot.name}, a helpful local AI agent dedicated to helping the user learn ${config.bot.targetLanguage}. Their target proficiency is ${config.bot.levelSystem}. Use tools when necessary. IMPORTANT: Always reply in the same language the user spoke to you in. If the user writes in their native language, reply in that language. If they write in ${config.bot.targetLanguage}, reply in ${config.bot.targetLanguage}. Do NOT translate their language unless explicitly asked. When replying with text-to-speech in ${config.bot.targetLanguage}, write naturally — punctuation and pacing will guide the TTS engine.`;

    let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: `${systemPreamble}\n\n${soulContent}${factsContext}${proactiveGathering}${skillsContent}${callContext}` }
    ];

    const recentHistory = await getRecentMessages(15);
    for (const msg of recentHistory) {
        messages.push({ role: msg.role as any, content: msg.content });
    }

    messages.push({ role: 'user', content: userMessage });
    await saveMessage('user', userMessage);

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`Agent Iteration ${iterations}/${MAX_ITERATIONS}`);

        const startTime = Date.now();
        const response = await openai.chat.completions.create({
            model: 'google/gemini-3.1-flash-lite-preview',
            messages: messages,
            tools: ALL_TOOLS as OpenAI.Chat.ChatCompletionTool[],
            max_tokens: 2048,
        });
        const latencyMs = Date.now() - startTime;

        if (response.usage) {
            sessionTokens.prompt += response.usage.prompt_tokens;
            sessionTokens.completion += response.usage.completion_tokens;
            sessionTokens.total += response.usage.total_tokens;
        }
        sessionTokens.calls++;
        sessionTokens.totalLatencyMs += latencyMs;

        const responseMessage = response.choices[0].message;
        messages.push(responseMessage);

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            for (const toolCall of responseMessage.tool_calls) {
                if (toolCall.type !== 'function') continue;

                console.log(`Executing tool: ${toolCall.function.name}`);
                try {
                    const args = JSON.parse(toolCall.function.arguments || '{}');
                    const result = await executeTool(toolCall.function.name, args);

                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: result,
                    });
                } catch (error) {
                    console.error(`Tool execution error for ${toolCall.function.name}:`, error);
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    });
                }
            }
        } else {
            const finalReply = responseMessage.content || 'No text response from model.';
            await saveMessage('assistant', finalReply);
            return finalReply;
        }
    }

    const failReply = "I reached my maximum tool iteration limit and had to stop.";
    await saveMessage('assistant', failReply);
    return failReply;
}
