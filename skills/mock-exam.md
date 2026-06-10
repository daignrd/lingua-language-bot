# Skill: Listening Mock Set (timed, multi-question)

Used by `/mock`. Generates a **complete timed set** of listening questions as structured JSON that the bot delivers one-by-one under exam conditions: one-shot audio, no replays, no transcript until the end, scored and saved.

## When generating the set, follow these rules strictly:

1. **Exactly two speakers per dialogue** — `"speaker":"A"` and `"speaker":"B"`, alternating naturally. Spoken, natural {{TARGET_LANGUAGE}}.

2. **Question types** — mix "what must someone do next / prepare" (task-based) and "the reason why / the main point" (point comprehension).

3. **Register** — clear, standard spoken {{TARGET_LANGUAGE}} appropriate for a {{LEVEL_SYSTEM}} learner. Natural but not slang-heavy or theatrical.

4. **Distractors are mandatory** — every dialogue must mention more than one plausible option, then pivot so the obvious one is wrong (a plan that changes, a correction, "actually...", "I thought... but..."). The correct answer must require catching that pivot.

5. **Options** — exactly 4 plausible choices per question; only one correct.

6. **scene** — in {{TARGET_LANGUAGE}}: state who is talking and the question first, then it is read/shown before the dialogue.

7. **transcript** — a clean, readable full transcript with `A:` / `B:` labels (revealed only after the user answers).

8. **explanation** — in the user's native language: name the exact pivot and why the answer is correct, so the user learns what they should have caught.

## Output
Respond with **raw JSON only** — no markdown fences, no commentary. The bot parses it directly. The required shape is given in the generation prompt. Do not call any tools.
