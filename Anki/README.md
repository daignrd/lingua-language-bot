# Anki Workspace

A file-based pipeline for turning study materials — class notes, textbook pages, audio recordings, PDFs, teacher corrections — into Anki cards in your target language. Ask Claude Code to process anything you drop into `inbox/` and it'll extract card-worthy material into `cards/*.md`.

## Folder layout

```
Anki/
├── README.md                  # this file
├── inbox/                     # drop raw material here
│   └── README.md              # what to drop, naming conventions, audio handling
└── cards/                     # card-ready markdown, grouped by source
    ├── _template.md           # canonical card template — copy this for new sources
    ├── priority_grammar.md    # your highest-priority grammar items (production gap)
    ├── priority_vocab.md      # your highest-priority vocab items
    ├── corrections.md         # errors that got corrected (highest personal value)
    └── general.md             # catch-all when no specific source file fits
```

You can add more source-specific files (e.g. `course_a1.md`, `textbook_chapter5.md`, `tutor_notes.md`) — Claude Code will route cards to whichever file best matches the source.

## Workflow (the fast path)

1. **Drop material in `inbox/`** — class notes, photos of textbook pages, PDF chapters, audio recordings, teacher feedback, sentences you wanted to say but couldn't.
2. **Ask Claude Code to process** — e.g., "process the latest file in inbox" or "card this PDF".
3. **Claude extracts** grammar patterns, vocabulary, and corrections, and **appends** them to the appropriate `cards/*.md` file in the canonical format below.
4. **Claude moves the processed file** to `inbox/processed/` (or deletes it, your call).
5. **You review** the new cards and export to Anki when convenient (weekend batch session).

## The canonical card format

One card per markdown block. Fields:

```markdown
### [pattern or word in the target language]
- **Meaning:** [in your native language]
- **Level/Source:** [your level | source label, e.g. "B1 | Chapter 5"]
- **Native → Target:** "[native-language production cue]" → [target-language answer]
- **Pattern:** [conjugation/structure notes, if applicable]
- **Nuance:** [when to use; contrast with similar items]
- **Examples:**
  - [example 1 in target language]
  - [example 2 in target language]
- **Tags:** [space-separated tags for Anki import]
```

**Why this format?**
- The `Native → Target` line is the **production card** — most learners' weak point is recall, not recognition. Every card should have one.
- The `Meaning` line becomes the recognition card.
- `Tags` map directly to Anki tags at import time.
- Structured enough to auto-convert to TSV for bulk Anki import; readable enough to review by eye.

## Tag conventions

Keep tags consistent so filtering in Anki works later. Replace `<level>` with your actual level slug (e.g. `cefr-b1`, `jlpt-n3`, `hsk-4`).

| Tag | Use |
|---|---|
| `grammar` | Any grammar pattern card |
| `vocab` | Vocabulary word card |
| `phrase` | Multi-word phrase / idiom |
| `pronunciation` | Pronunciation/tone/accent-focused card |
| `<level>` | Your proficiency level (e.g. `cefr-b1`) |
| `production` | Card tests production (Native → Target) |
| `correction` | Sourced from a teacher/peer correction |
| Source label | Course name, textbook chapter, tutor name, etc. |

Tags are space-separated in the card markdown. Anki reads them as-is at import time.

## Exporting to Anki

When you're ready to actually create cards:

1. Open the relevant `cards/*.md` file.
2. Copy the card blocks you want to import.
3. Either:
   - Paste into Anki using the "Basic" or "Basic (and reversed)" note type, manually splitting front/back, OR
   - Ask Claude Code: "Convert `cards/priority_grammar.md` to TSV for Anki import" — it'll generate a tab-separated file ready for Anki's `File → Import`.

## Priority order when catching up

If the inbox piles up, process in this order:
1. **`corrections.md`** — teacher/peer corrections target *your specific* gaps (highest ROI).
2. **Course-specific files** — new material at your target level.
3. **`priority_*.md`** — already-curated lists; just need drilling, not processing.
4. **`general.md`** — catch-all, lowest priority unless a specific item is hot.

## How this connects to the bot

This Anki workflow is **separate** from the Telegram bot — cards live as plain markdown in your repo, not in the bot's database. But they're complementary:

- Use `/grammar add` in the bot for grammar you want **actively drilled** in your daily morning briefing.
- Use this Anki pipeline for **everything you want to eventually review in Anki** (much higher volume).
- When the bot catches a recurring grammar mistake during voice calls, you can ask Claude Code to add it to `corrections.md`.
