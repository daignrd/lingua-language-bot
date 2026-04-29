# Lingua Language Bot

A configurable, single-user Telegram bot for AI-driven language learning. Set your target language via env vars and the entire bot adapts — voice calls, shadowing, grammar drills, morning briefings — all in your target language at your level.

## Tech Stack

- **Runtime:** TypeScript / Node.js (tsx)
- **Bot framework:** grammy (Telegram)
- **LLM:** Google Gemini via OpenRouter (`src/agent/`)
- **Database:** Supabase (PostgreSQL + pgvector for semantic search)
- **TTS:** ElevenLabs (`src/services/elevenlabs.ts`)
- **STT:** Groq Whisper (`src/services/groq.ts`)
- **Vision:** Google Gemini (`src/services/gemini.ts`)
- **Deployment:** Docker on Railway (or anywhere Node runs)

## Project Structure

```
src/
  index.ts            — Entry point, command registration, scheduler
  config.ts           — Environment variable loading
  bot/index.ts        — All Telegram command handlers (the central hub)
  agent/index.ts      — Agentic loop with tool calling, system prompt assembly
  tools/              — Tool definitions (memory, episodic, grammar, graph, search, etc.)
  services/           — External API integrations (Supabase, ElevenLabs, Groq, Gemini, etc.)
skills/               — Markdown behavioral instructions loaded into system prompt every turn
soul.md               — Core personality and behavioral rules
```

## Configuration

The bot's target language and the user's locale are configured via environment variables — see `.env.example`. Key vars:

- `BOT_NAME` — what the bot calls itself
- `TARGET_LANGUAGE` — the language to teach (e.g. `Italian`, `Japanese`, `Spanish`)
- `USER_LOCATION` — user's city, used for context-aware vocab (e.g. `Rome`)
- `LEVEL_SYSTEM` — user's level descriptor (e.g. `CEFR B1`, `JLPT N3`)
- `MORNING_HOUR` / `MORNING_TIMEZONE_OFFSET` — when the daily briefing fires

`{{BOT_NAME}}`, `{{TARGET_LANGUAGE}}`, `{{USER_LOCATION}}`, and `{{LEVEL_SYSTEM}}` placeholders inside `soul.md` and `skills/*.md` are substituted at runtime by `agent/index.ts`.

## Key Architecture

- **bot/index.ts** is the central hub — all Telegram commands and message handlers live here
- **agent/index.ts** assembles the system prompt from soul.md + skills + memory context, runs a multi-turn tool-calling loop, and substitutes placeholders
- **Memory is tri-partite:** working (chat logs in Supabase), declarative (core facts), episodic (RAG vectors via pgvector)
- **Voice flow:** user voice → Groq Whisper transcription → agent response → ElevenLabs TTS → voice reply + text transcript
- **Skills** in `skills/` are loaded every turn — the agent picks which to follow based on context (active call session, shadowing, etc.)

## Commands

`/call`, `/endcall`, `/shadow`, `/morning`, `/mission`, `/cheatsheet`, `/grammar`, `/new`, `/compact`, `/model`, `/usage`, `/setup`, `/status`

## Anki Pipeline

Beyond the bot, the repo includes a file-based Anki card creation workflow under `Anki/`. Drop study materials (class notes, textbook PDFs, photos, audio) into `Anki/inbox/` and ask Claude Code to process them — it'll extract cards into `Anki/cards/*.md` using the `anki-cards` skill (`.agents/skills/anki-cards/SKILL.md`). See [Anki/README.md](./Anki/README.md) for the canonical card format and tag conventions.

This is a Claude Code workflow, not a bot feature — cards live in your repo as plain markdown, ready to import into Anki.

## Environment Variables

All required — see `src/config.ts` and `.env.example`.

## Running

- **Local:** `npm install && npm run dev`
- **Deploy:** Docker on Railway works out of the box. See `.agents/workflows/deploy.md`.

## Rules

- Single-user bot — `TELEGRAM_ALLOWED_USER_ID` is the only authorized user
- Never commit `.env` or secrets
- Keep `bot/index.ts` as the single source of truth for all command handlers
- Skills are plain markdown — no code, just behavioral instructions for the agent
- When adding TTS voice output, always include a `🔊 _text_` transcript alongside it
- When the user sends voice, always echo back a `🎙️ _transcription_` before processing
