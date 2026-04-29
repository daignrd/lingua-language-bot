# Lingua — Your Personal Language Tutor on Telegram

A private, single-user Telegram bot that helps you learn **any language** through daily voice conversations, shadowing practice, grammar drills, and just-in-time vocabulary cheat sheets — all powered by AI and tailored to your level and life.

You set the target language. The bot adapts.

---

## What you get

Once running, your bot:

- 📞 **Holds voice calls in your target language** — speak into Telegram, get a voice reply back. It only switches out of the target language when you're truly stuck.
- 🎧 **Generates shadowing clips** — short audio passages at your level for pronunciation practice.
- ☀️ **Sends you a morning briefing** at the time you choose — a grammar drill, today's mission, and a shadowing clip. Auto-delivered every day.
- 📝 **Corrects your grammar in real time** when you write or speak in the target language.
- 📍 **Gives you cheat sheets** for specific situations — `/cheatsheet doctor appointment` and you'll get the phrases you need before walking in.
- 🧠 **Remembers everything** — your level, your interests, your life. Grows smarter the more you use it.
- 🃏 **Builds Anki cards from your study materials** — drop class notes, textbook PDFs, audio recordings, or teacher corrections into `Anki/inbox/` and ask Claude Code to extract cards. See [Anki/README.md](Anki/README.md).

---

## Install with Claude Code (recommended for non-developers)

If you're not comfortable with the terminal, this is the easiest path.

### Step 1: Install Claude Code

Download Claude Code from [claude.com/claude-code](https://claude.com/claude-code) and install it. You'll need an Anthropic account.

### Step 2: Clone this repo

In Claude Code, ask:

> "Clone https://github.com/daignrd/lingua-language-bot to a folder on my computer and open it."

Claude Code will handle the git clone and open the project for you.

### Step 3: Ask Claude Code to walk you through setup

Once the project is open, say something like:

> "I want to set up this language bot to learn [Italian / Spanish / Korean / etc.]. Walk me through the setup — what API keys do I need, how do I get them, and how do I configure the bot?"

Claude Code will:
- Explain each API key you need (with links to where to get them)
- Help you create a `.env` file with the right values
- Set up the Supabase database tables for you
- Run the bot and verify it's working

You don't need to know what `npm install` or `tsx` mean. Claude Code handles it.

### Step 4: Customize for your specific language

After it's running, ask Claude Code:

> "Update the skills files so the bot is great at teaching [your language]. Pay attention to [tones / gendered nouns / formality levels / verb conjugations / whatever's tricky in your language]."

Claude Code will edit the markdown files in `skills/` to give the bot specific guidance.

---

## What you'll need (API keys)

All of these have generous free tiers — most users won't pay anything:

| Service | What it does | Where to get it |
|---|---|---|
| Telegram (BotFather) | Hosts your bot | Telegram → message [@BotFather](https://t.me/BotFather) → `/newbot` |
| Telegram (your user ID) | Restricts the bot to only you | Message [@userinfobot](https://t.me/userinfobot) — it'll reply with your ID |
| OpenRouter | Powers the AI brain | [openrouter.ai](https://openrouter.ai) |
| Google AI Studio | Image / document understanding | [aistudio.google.com](https://aistudio.google.com) |
| Groq | Speech-to-text (Whisper) | [console.groq.com](https://console.groq.com) |
| ElevenLabs | Text-to-speech (the bot's voice) | [elevenlabs.io](https://elevenlabs.io) — pick a voice that speaks your language well |
| Supabase | Memory storage | [supabase.com](https://supabase.com) |

Claude Code can guide you through each one if you ask.

---

## Configure your target language

Almost everything about how the bot behaves comes from these four values in your `.env` file:

```
BOT_NAME=Lingua            # what your bot calls itself
TARGET_LANGUAGE=Italian    # the language you want to learn
USER_LOCATION=Rome         # your city — used for context-aware vocab
LEVEL_SYSTEM=CEFR B1       # your level (e.g. CEFR A2, JLPT N3, HSK 4)
```

Change `TARGET_LANGUAGE` to anything — `Mandarin`, `French`, `Korean`, `Arabic`, `Portuguese`, `Hindi`. The bot's prompts, drills, and corrections automatically adapt.

---

## Adapt the bot to your language's quirks

The bot's behavior is defined in plain-English markdown files under `skills/`:

- `voice-call.md` — rules for the immersion voice call mode
- `morning-mission.md` — what your daily briefing looks like
- `grammar-correction.md` — how it corrects you
- `shadowing.md` — how shadowing sessions work
- `location-context.md` — how it generates situational cheat sheets

These use placeholders like `{{TARGET_LANGUAGE}}` that get filled in automatically. **You don't have to touch them** to get a working bot — but you can edit them to teach the bot about your language's specific features.

Examples of language-specific tweaks:

- **Mandarin / Cantonese / Vietnamese**: add tone-marking instructions to `shadowing.md`
- **Italian / Spanish / French**: add gender-agreement focus to `grammar-correction.md`
- **Japanese / Korean**: add formality / honorific level guidance to `voice-call.md`
- **Arabic**: add notes about MSA vs. dialect (`USER_LOCATION` will help here)
- **German / Russian**: add case-system focus to `grammar-correction.md`

Just edit the file in plain English. The bot reads the markdown directly.

---

## Daily use

Once it's running, in Telegram:

| Command | What it does |
|---|---|
| `/call 10` | Start a 10-minute target-language-only voice call |
| `/endcall` | End the call, get a session report with corrections |
| `/morning` | Your daily briefing on demand (also auto-fires at your configured hour) |
| `/shadow` | A shadowing practice clip with audio |
| `/cheatsheet doctor appointment` | Just-in-time vocab for a situation |
| `/grammar add [pattern] \| [meaning] \| [notes]` | Save a grammar point you're working on |
| `/grammar list` | See your active grammar points |
| `/setup` | First-time setup interview |
| `/new` | Reset working memory (start fresh conversation) |

You can also just **send voice messages** for free-form practice. The bot transcribes you, replies with text + voice, and corrects your grammar inline.

---

## Going deeper

- [SETUP.md](SETUP.md) — full technical setup reference (database SQL, manual install, deployment)
- [agents.md](agents.md) — architecture overview for developers / AI assistants editing the project
- [Anki/README.md](Anki/README.md) — how the Anki card pipeline works (drop materials in, get cards out)

---

## Privacy

This is a **single-user bot**. The `TELEGRAM_ALLOWED_USER_ID` setting means only your Telegram account can talk to it — anyone else who finds the bot will be silently ignored. Your conversations live in your own Supabase database.

---

## License

MIT — do whatever you want with it.
