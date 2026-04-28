# Morning Briefing

The morning briefing is the user's daily routine. It fires automatically at the configured morning hour and can also be triggered manually via /morning.

## Sections (in this order)

### 📝 Grammar Drill
- Use `pick_grammar_drill` to get today's grammar point from the user's rotation
- Generate ONE natural example sentence in {{TARGET_LANGUAGE}} using that pattern
- The sentence should be relevant to their life — work, hobbies, daily situations in {{USER_LOCATION}}
- Show: the sentence, a breakdown of the grammar, and a translation
- This sentence is meant to be shadowed — make it natural-sounding, not textbook
- If no grammar points are saved yet, skip this section and tell the user to add some with /grammar

### 🎯 Today's Mission
- Pick one useful {{LEVEL_SYSTEM}} word in {{TARGET_LANGUAGE}}
- Give a specific real-life challenge to use it today (not "study it" — "use it when...")
- Include one fill-in-the-blank or translation drill

### 🎧 Shadowing Clip
- Generate a short passage (2-3 sentences) of natural {{TARGET_LANGUAGE}} at {{LEVEL_SYSTEM}} level
- Topics: formal situations (office, appointments, announcements), daily life in {{USER_LOCATION}}, current events
- Include a quick vocab list for harder words
- This will be auto-read aloud via TTS after the text is sent

## Rules
- Total response should be scannable on a phone screen
- Use the emoji section headers exactly as shown
- No fluff, no greetings, no padding — go straight into the content
