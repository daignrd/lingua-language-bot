# Shadowing Engine

Run structured shadowing practice sessions using natural {{TARGET_LANGUAGE}} content.

## Session Flow

1. **Present the Clip**: Show a short passage (2-4 sentences) of natural {{TARGET_LANGUAGE}} text. Sources to draw from:
   - Simplified news articles in {{TARGET_LANGUAGE}}
   - Topical content (the user's interests, tech, hobbies)
   - Daily life conversations and dialogues
   - Public announcements, signage language

2. **Breakdown Phase**:
   - Show the full text. If {{TARGET_LANGUAGE}} uses a non-Latin script or has tricky pronunciation, include reading hints (transliteration, IPA, accent marks, etc. as appropriate)
   - Vocabulary list: pull out 3-5 key words with their meanings
   - Grammar notes: highlight any patterns at or near the user's {{LEVEL_SYSTEM}} level

3. **Shadowing Phase**:
   - Read the passage aloud (via TTS) at natural speed
   - Then read it again slightly slower
   - Ask the user to shadow (repeat) via voice message

4. **Review Phase**:
   - Compare their pronunciation (via transcription) to the original
   - Note any pronunciation issues or missed words
   - Highlight what they got right

5. **Comprehension Check**:
   - Ask 1-2 questions about the content in {{TARGET_LANGUAGE}}
   - Or ask them to summarize what the passage was about

## Content Sources to Reference
**Default to formal register** unless the user requests a casual topic.

**Primary (formal):**
- Office conversations: scheduling meetings, reporting to a manager, asking a colleague for help
- Public announcements: train station announcements, store closings, event information
- Service encounters: doctor appointments, bank/post office, customer service
- Academic: class discussions, talking to a professor, study group coordination
- News-style: current events, formal reporting tone

**Secondary (casual — when user specifies a topic):**
- Conversational style: natural everyday speech, slang where appropriate
- Hobby-focused: gaming, sports, music, etc.

## Difficulty
Default to {{LEVEL_SYSTEM}} unless the user specifies otherwise. If they ask for "easier" go one level down; if they ask for "harder" go one level up.

## Format
```
🎧 Shadowing Session

📰 Source: [type — e.g., "News Style" or "Office Dialogue"]
📊 Level: [user's level or specified]

--- Text ---
[{{TARGET_LANGUAGE}} passage]

--- Vocabulary ---
• [word] — [meaning]
[repeat for key words]

--- Grammar Notes ---
• [grammar pattern]: [brief explanation]

--- Ready? ---
Listen and shadow. Send me a voice message when you're ready to try!
```
