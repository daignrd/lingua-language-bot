---
name: anki-cards
description: Process raw study materials (class notes, textbook pages, PDFs, photos, audio transcripts, teacher corrections) into Anki cards in markdown. Reads from Anki/inbox/, appends to Anki/cards/*.md. Triggered when user says "process my [material]", "add this to Anki", "card this", or drops files in Anki/inbox/.
---

# Anki Card Creation Skill

Turn raw study material into Anki cards. Inputs come from `Anki/inbox/`. Outputs append to `Anki/cards/*.md` in the canonical format defined in `Anki/README.md`.

## When to use

- User says: "process my [class notes / textbook / recording / inbox]"
- User says: "card this", "add this to Anki", "make Anki cards from [X]"
- User drops a file in `Anki/inbox/` and asks for processing
- User shares text in chat and asks to extract cards

## The user's target language

Read `TARGET_LANGUAGE` and `LEVEL_SYSTEM` from `.env` to know what language and level the cards should target. If `.env` is missing, ask the user. The cards always have:
- The card title in the **target language**
- The "Meaning" and "Native → Target" cue in the **user's native language** (default: English unless user specifies otherwise)

## Steps

### 1. Identify the material

If the user pointed to a specific file: read it. If they said "the latest" or "everything in inbox": list `Anki/inbox/` (excluding `processed/` and `README.md`) and process the relevant files.

**Material types and how to read them:**
- `.md`, `.txt`, `.html` — read directly with the Read tool
- `.pdf` — read directly (Claude Code is multimodal)
- `.jpg`, `.png`, `.heic` — read directly (multimodal)
- `.m4a`, `.mp3`, `.wav`, `.ogg` — needs transcription first (see "Handling audio" below)

### 2. Handle audio (if applicable)

Audio files can't be read directly. Pick the fastest available path:

**Path A — Groq Whisper (preferred if `GROQ_API_KEY` is in `.env`):**
Write a one-shot Node script that POSTs the file to `https://api.groq.com/openai/v1/audio/transcriptions` with model `whisper-large-v3` and the user's `TARGET_LANGUAGE`. Save the transcript next to the audio file as `<basename>_transcript.md`. Then process the transcript.

**Path B — Local whisper:**
If the user has whisper-cli (`which whisper` works), suggest they run it themselves with the right `--language` code, then re-invoke this skill on the resulting `.txt`.

**Path C — Telegram bot:**
Suggest the user forward the audio to their Lingua Telegram bot, copy the transcribed reply into a new inbox file, then process that.

Default to Path A unless the user specifies otherwise.

### 3. Extract cards

Read the material and identify:
- **Grammar patterns** new to the user — anything explained, drilled, or used in a way that taught a new structure
- **Vocabulary** — words the teacher emphasized, you looked up, the textbook bolded, or that appeared multiple times in context
- **Corrections** — explicit "you said X, the correct form is Y" moments
- **Phrases / collocations** — natural-sounding multi-word units the user wouldn't have produced
- **Pronunciation / tone / register notes** — when the source explicitly teaches *how* to say something

**Skip:**
- Material the user clearly already knows (don't card "hello" for a B1 learner)
- Long example texts (extract the pattern, don't card the whole sentence)
- Generic announcements / scheduling / off-topic conversation

### 4. Pick the destination file

For each card, route to the most appropriate file under `Anki/cards/`:
- Teacher / tutor / bot correction → `corrections.md`
- High-priority list (exam syllabus, target-level priority) → `priority_grammar.md` or `priority_vocab.md`
- Source-specific (a course, textbook, recurring tutor) → existing file like `course_b1.md` or create a new one (e.g. `textbook_ch5.md`)
- Anything that doesn't fit → `general.md`

If a fitting source file doesn't exist yet, ask the user before creating one. Suggest a name like `<source>_<level>.md`.

### 5. Avoid duplicates

Before appending, **grep the destination file** for the card's title (the pattern or word). If it already exists:
- Update the existing entry (add a new example, refine the nuance, add a tag)
- Don't create a duplicate

### 6. Append in the canonical format

Use the format from `Anki/README.md`:

```markdown
### [pattern or word in target language]
- **Meaning:** [in user's native language]
- **Level/Source:** [level | source label]
- **Native → Target:** "[native cue]" → [target answer]
- **Pattern:** [structure notes]
- **Nuance:** [usage / contrast]
- **Examples:**
  - [example 1]
  - [example 2]
- **Tags:** [space-separated]
```

Required fields: `Meaning`, `Level/Source`, `Native → Target`, `Tags`. Other fields when relevant. Always include at least one example — preferably from the actual source material so the card is grounded.

### 7. Apply tags

Default tags every card needs:
- Card type: `grammar`, `vocab`, `phrase`, `pronunciation`, or `correction`
- Level slug: derive from `LEVEL_SYSTEM` env var (e.g. "CEFR B1" → `cefr-b1`, "JLPT N3" → `jlpt-n3`)
- `production` (because `Native → Target` cards are production-tested)
- Source label (course name, textbook chapter, "tutor", "bot-correction", etc.)
- Topic tag if obviously relevant (e.g. `food`, `business`, `travel`)

### 8. Move processed file

Once cards are added, move the source file from `Anki/inbox/` to `Anki/inbox/processed/` (create the directory if missing). Don't delete unless the user asks.

For audio files, also move the transcript to `processed/`.

### 9. Report to the user

Summarize concisely:
- Source file processed
- N grammar cards added (list the patterns)
- N vocab cards added (list the words)
- N corrections logged
- Any duplicates found and updated (so the user knows what was deduplicated)
- Any items you skipped or were unsure about (so the user can verify)

## Notes & edge cases

- **Photos of handwriting**: read with multimodal vision. If the handwriting is illegible, tell the user which parts you couldn't read instead of guessing.
- **Mixed-language source**: if the textbook explains target-language grammar in the user's native language, that's normal — extract from both sides.
- **Long PDFs**: process by section. If a chapter has 40 grammar points, extract the top ~10 most relevant to the user's level and ask before adding more.
- **Conflicting info**: if a source contradicts an existing card, flag it for the user — don't silently overwrite.
- **Card volume**: if you'd be adding more than ~20 cards from a single source, pause and ask the user to confirm — they may want to filter.
- **No level set**: if `LEVEL_SYSTEM` isn't in `.env`, ask the user before creating cards (the level tag drives filtering in Anki later).
