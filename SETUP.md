# Setup Guide

Get a personal language-learning Telegram bot running for any language in under an hour.

## 1. Configure your target language

Copy `.env.example` to `.env` and set:

```
BOT_NAME=Lingua            # what your bot calls itself
TARGET_LANGUAGE=Italian    # the language you want to learn
USER_LOCATION=Rome         # your city, for context-aware vocab
LEVEL_SYSTEM=CEFR B1       # how you describe your level
MORNING_HOUR=9             # local hour for the daily briefing
MORNING_TIMEZONE_OFFSET=1  # your UTC offset (CET=1, EST=-5, JST=9, etc.)
```

The four config values above are the only knobs that change the bot's behavior. Everything else is plumbing.

## 2. Get your API keys

You'll need accounts (most have free tiers) at:

- **Telegram BotFather** — `TELEGRAM_BOT_TOKEN` (talk to @BotFather, run `/newbot`)
- Your own Telegram user ID — `TELEGRAM_ALLOWED_USER_ID` (talk to @userinfobot)
- **OpenRouter** — `OPENROUTER_API_KEY` (chat LLM)
- **Google AI Studio** — `GEMINI_API_KEY` (vision)
- **Groq** — `GROQ_API_KEY` (Whisper STT)
- **ElevenLabs** — `ELEVENLABS_API_KEY` + optional `ELEVENLABS_VOICE_ID` (TTS — pick a voice that speaks your target language well)
- **Supabase** — `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (memory storage)

## 3. Set up the database

In your Supabase project's SQL editor, run:

1. `supabase_schema.sql` — creates the core tables (messages, core facts, episodes)
2. `supabase_graphs.sql` — creates the knowledge graph tables (optional but used by graph tools)

Make sure the `pgvector` extension is enabled in your Supabase project (Database → Extensions).

## 4. Run it

```bash
npm install
npm run dev
```

Open Telegram, find your bot, send `/setup` — it'll walk you through the initial questions and start learning who you are.

## 5. Customize for your language (optional)

The skills in `skills/*.md` use `{{TARGET_LANGUAGE}}`, `{{USER_LOCATION}}`, `{{LEVEL_SYSTEM}}`, and `{{BOT_NAME}}` placeholders that get substituted at runtime. If your target language has unique features (e.g. tones for Mandarin, gendered nouns for Romance languages, formality levels for Japanese/Korean), edit the relevant skill file directly to teach the bot how to handle them. For example, you might add to `grammar-correction.md`:

> Pay special attention to gender agreement on adjectives and articles.

## 6. Daily use

- Talk to it in either your native language or your target language — it'll mirror you
- Send voice messages to practice speaking
- `/call 10` for a 10-minute target-language-only voice call
- `/morning` for your daily briefing (auto-fires at the configured hour)
- `/grammar add [pattern] | [meaning] | [notes]` to track grammar you're working on
- `/cheatsheet [situation]` before a meeting/appointment/etc. to get just-in-time vocab

That's it. The bot remembers everything via the tri-partite memory system, so over time it adapts to your specific weak points and life context.
