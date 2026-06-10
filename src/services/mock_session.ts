/**
 * Mock listening-exam session manager (target-language agnostic).
 *
 * Runs a timed, one-shot listening set: questions are generated up front as
 * structured JSON, the dialogue is delivered as audio, answers are graded
 * deterministically, and the final score is persisted to Supabase for trend
 * tracking. Mirrors the call-session pattern in session.ts so the bot can route
 * plain-text answers while a set is in progress.
 */

import { config } from '../config.ts';
import { processMessage } from '../agent/index.ts';
import { saveMockResult } from './supabase.ts';

export interface DialogueTurn {
    speaker: 'A' | 'B';
    text: string;
}

export interface MockQuestion {
    scene: string;            // situation + question, in the target language (shown as text)
    options: string[];        // choices
    answer: number;           // 1-based index of the correct option
    dialogue: DialogueTurn[]; // two-speaker turns for audio narration
    transcript: string;       // full readable transcript (revealed after answering)
    explanation: string;      // why the answer is correct (in the user's native language)
}

export interface MockSession {
    active: boolean;
    startedAt: number;
    questions: MockQuestion[];
    current: number;
    correct: number;
}

let mock: MockSession = { active: false, startedAt: 0, questions: [], current: 0, correct: 0 };

export function isInMockSession(): boolean {
    return mock.active;
}

export function getMockProgress(): { current: number; total: number } {
    return { current: mock.current + 1, total: mock.questions.length };
}

/** Build a single narration string from the dialogue turns (single-voice TTS). */
export function dialogueToNarration(turns: DialogueTurn[]): string {
    return turns.map(t => t.text).join('\n');
}

/** Best-effort extraction of a JSON object from an LLM string response. */
function parseQuestions(raw: string): MockQuestion[] {
    let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

    const parsed = JSON.parse(text);
    const questions = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('No questions array in generated set.');
    }

    return questions.map((q: any, i: number): MockQuestion => {
        if (!Array.isArray(q.options) || q.options.length < 2) {
            throw new Error(`Question ${i + 1} has no options.`);
        }
        if (!Array.isArray(q.dialogue) || q.dialogue.length === 0) {
            throw new Error(`Question ${i + 1} has no dialogue.`);
        }
        return {
            scene: String(q.scene || '').trim(),
            options: q.options.map((o: any) => String(o).trim()),
            answer: Math.min(Math.max(parseInt(q.answer, 10) || 1, 1), q.options.length),
            dialogue: q.dialogue
                .filter((t: any) => t && t.text)
                .map((t: any) => ({ speaker: t.speaker === 'B' ? 'B' : 'A', text: String(t.text).trim() })),
            transcript: String(q.transcript || '').trim(),
            explanation: String(q.explanation || '').trim(),
        };
    });
}

/**
 * Generate a fresh listening set and start the session.
 * @param count Number of questions (default 5).
 */
export async function startMockSession(count: number = 5): Promise<MockQuestion[]> {
    const lang = config.bot.targetLanguage;
    const level = config.bot.levelSystem;

    const prompt = `Generate a complete ${lang} listening mock set of exactly ${count} questions at ${level} level. Follow the mock-exam skill. Each dialogue is between exactly two speakers ("A" and "B"), in natural spoken ${lang}, with a realistic listening distractor (a plan or fact that changes partway through). Keep the register clear and standard, not slang-heavy.

Respond with ONLY raw JSON (no markdown, no commentary) in exactly this shape:
{
  "questions": [
    {
      "scene": "<in ${lang}: who is talking + the question being asked>",
      "options": ["<choice 1>", "<choice 2>", "<choice 3>", "<choice 4>"],
      "answer": <1-4, the correct option number>,
      "dialogue": [ {"speaker":"A","text":"<line>"}, {"speaker":"B","text":"<line>"} ],
      "transcript": "<full readable transcript with A:/B: labels>",
      "explanation": "<the pivot and why the answer is correct, in the user's native language>"
    }
  ]
}
Do not use any tools. Output JSON only.`;

    const raw = await processMessage(prompt);
    const questions = parseQuestions(raw);

    mock = { active: true, startedAt: Date.now(), questions, current: 0, correct: 0 };
    return questions;
}

export function getCurrentQuestion(): MockQuestion | null {
    if (!mock.active || mock.current >= mock.questions.length) return null;
    return mock.questions[mock.current];
}

export interface AnswerResult {
    isCorrect: boolean;
    correctAnswer: number;
    question: MockQuestion;
    finished: boolean;
    score?: { correct: number; total: number; durationMs: number };
}

/**
 * Grade the user's answer to the current question and advance.
 * @returns null if no question is awaiting / input has no parseable choice.
 */
export async function submitMockAnswer(input: string): Promise<AnswerResult | null> {
    const q = getCurrentQuestion();
    if (!q) return null;

    const match = input.match(/[1-9]/);
    if (!match) return null;
    const choice = parseInt(match[0], 10);

    const isCorrect = choice === q.answer;
    if (isCorrect) mock.correct++;
    mock.current++;

    const finished = mock.current >= mock.questions.length;
    const result: AnswerResult = { isCorrect, correctAnswer: q.answer, question: q, finished };

    if (finished) {
        const durationMs = Date.now() - mock.startedAt;
        result.score = { correct: mock.correct, total: mock.questions.length, durationMs };
        await saveMockResult('listening', mock.questions.length, mock.correct, durationMs);
        mock = { active: false, startedAt: 0, questions: [], current: 0, correct: 0 };
    }

    return result;
}

export function abortMockSession(): boolean {
    if (!mock.active) return false;
    mock = { active: false, startedAt: 0, questions: [], current: 0, correct: 0 };
    return true;
}
