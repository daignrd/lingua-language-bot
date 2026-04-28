# Technical Setup Reference

For the friendly install path, see [README.md](README.md). This document is the deeper technical reference for manual installation, database setup, and deployment.

## Prerequisites

- Node.js 20+
- A Supabase project with the `pgvector` extension enabled
- API keys (see README.md for the full list and links)

## 1. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```
BOT_NAME=Lingua
TARGET_LANGUAGE=Italian
USER_LOCATION=Rome
LEVEL_SYSTEM=CEFR B1
MORNING_HOUR=9
MORNING_TIMEZONE_OFFSET=1

TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_USER_ID=...
OPENROUTER_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

Timezone offset is your UTC offset in hours: CET=1, EST=-5, JST=9, IST=5 (round half-hour zones to nearest hour or accept a 30-minute drift).

## 2. Set up the database

In the Supabase SQL editor:

1. Enable the `vector` extension: Database → Extensions → search `vector` → enable
2. Run `supabase_schema.sql` to create core tables (messages, core_facts, episodes with embedding column)
3. Run `supabase_graphs.sql` to create the knowledge-graph tables (entities, edges)

The `SUPABASE_SERVICE_KEY` must be the **service role** key (not the anon key) — the bot writes directly to tables.

## 3. Install and run

```bash
npm install
npm run dev
```

You should see:

```
Starting Lingua (target: Italian)...
Bot initialized as @your_bot_username
Listening for messages (Long Polling)...
[Scheduler] Initializing 9:00 (UTC+1) morning briefing scheduler...
```

Open Telegram, find your bot, send `/setup`. The bot will interview you for the 8 core facts.

## 4. How configuration flows through the code

- `src/config.ts` reads env vars and exposes a typed `config` object
- `src/agent/index.ts` injects `config.bot.name`, `targetLanguage`, `userLocation`, `levelSystem` into the system prompt and substitutes the same values into `{{BOT_NAME}}` / `{{TARGET_LANGUAGE}}` / `{{USER_LOCATION}}` / `{{LEVEL_SYSTEM}}` placeholders inside `soul.md` and every `skills/*.md`
- `src/bot/index.ts` uses `config.bot.targetLanguage` etc. directly when building agent prompts for slash commands
- `src/services/scheduler.ts` uses `config.schedule` to compute when to fire the morning briefing

To change *what* the bot teaches: edit `.env`. To change *how* the bot teaches: edit `skills/*.md`.

## 5. Deployment (Docker / Railway)

A working `Dockerfile` and `.railwayignore` are included. To deploy on Railway:

1. Create a Railway project, link it to your repo (private)
2. Set every variable from `.env` in Railway's Variables tab
3. Deploy — Railway auto-detects the Dockerfile

For an automated deploy workflow with type-checking, see `.agents/workflows/deploy.md`.

## 6. Architecture summary

```
src/
  index.ts          — boot, command registration, scheduler init
  config.ts         — typed env-var loading
  bot/index.ts      — all Telegram command handlers + message routers
  agent/index.ts    — system-prompt assembly, tool-calling loop, placeholder substitution
  tools/            — agent-callable tools (memory, episodic, grammar, graph, file, search, etc.)
  services/         — external integrations (Supabase, ElevenLabs, Groq, Gemini, scheduler)
skills/             — markdown behavior modules loaded into every agent turn
soul.md             — core personality
.agents/            — agent workflow / SOP docs
```

Memory is tri-partite:
- **Working memory**: the last 15 messages (Supabase `messages` table)
- **Declarative memory**: `core_facts` — persistent K/V facts about the user
- **Episodic memory**: `episodes` table with pgvector embeddings, queried via RAG

The agent loop runs up to 5 tool-calling iterations per user message before forcing a final reply.
