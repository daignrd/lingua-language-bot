# Inbox — drop zone for raw study material

Drop study material here and tell Claude Code to process it. It'll extract card-worthy items and append them to the right file under `../cards/`.

## What to drop

**Good inbox material:**
- Class notes (text or photos)
- New grammar patterns introduced by a teacher or textbook
- Vocabulary the teacher emphasized or you looked up
- Your errors + the correction
- Sentences you wanted to say but couldn't
- Teacher feedback on returned writing
- Textbook pages (PDF or photo)
- Course guide excerpts
- Audio recordings of lessons (see "Audio recordings" section below)

**Skip these — they don't need cards:**
- Generic announcements
- Stuff you already know solidly
- Long passages of example text (extract patterns from them instead)

## Naming convention

```
YYYY-MM-DD_<source>_<type>.<ext>
```

Examples:
- `2026-04-22_class_notes.md` — typed-up class notes from Apr 22
- `2026-04-28_tutor_correction.md` — correction on a returned essay
- `2026-05-05_textbook_ch5.pdf` — chapter 5 of your textbook
- `2026-04-15_class_photo.jpg` — photo of handwritten board or handout
- `2026-04-22_lesson_transcript.txt` — Whisper transcript of a recording

Consistent naming lets Claude Code process in date order and lets you audit later what was captured.

## How to ask Claude Code to process

Once material is dropped, say something like:

> "Process the latest file in inbox"

> "Card this textbook chapter"

> "Here's my class today" (then paste notes into the chat — no file needed for short captures)

> "Process everything in inbox from this week"

Claude Code will:
1. Read the raw material (PDF, image, text — all native to Claude Code; audio needs the step below)
2. Extract cards in the canonical format (see `../README.md`)
3. Append to the right `cards/*.md` file (avoiding duplicates — it greps first)
4. Tell you what was added and flag anything ambiguous
5. Move the raw file into `inbox/processed/` so you don't re-process it

## Audio recordings

Claude Code can't transcribe audio directly. You have a few options:

**Option A — Use the bot's Groq Whisper key (fastest if your bot is set up):**
The repo already has `GROQ_API_KEY` in `.env`. Ask Claude Code:
> "Transcribe `inbox/2026-04-22_lesson.m4a` using the Groq Whisper API key in `.env`"

It'll write a small one-shot script, transcribe, save the transcript to inbox, then process it.

**Option B — Local Whisper (free, works offline):**
Install [whisper-cli](https://github.com/openai/whisper) (`pip install openai-whisper`) and run:
```bash
whisper inbox/2026-04-22_lesson.m4a --language <your-target-language-code> --model medium
```
Then ask Claude Code to process the resulting `.txt`.

**Option C — Send to the Telegram bot:**
Forward the audio to your Lingua bot in Telegram. The bot will reply with a transcription you can copy into a new inbox file.

## Quick capture: the fast path for busy weeks

If you just want to dump a single point without formatting, create a file like `2026-04-22_quick.md` with:

```
- Teacher said [target-language phrase] means "depending on" — example: [example sentence]
- I didn't understand [phrase] when she used it
- Correction on my essay: I wrote [my version] but teacher said [correct version] is more natural
```

That's enough. Claude Code will parse it and build proper cards.

## What gets created

After processing, expect:
- New entries in `../cards/<the right file>.md`
- A summary message: "Added 6 grammar cards and 4 vocab cards. Ambiguous: [item]. Moved file to processed/."
- Your raw file relocated to `inbox/processed/<filename>` (or deleted if you prefer).
