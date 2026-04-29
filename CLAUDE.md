# Project Configuration

Read [agents.md](./agents.md) before starting any task — it is the canonical project context.

@agents.md

## Skills

Custom skills live in [.agents/skills/](./.agents/skills/). Each skill folder contains a `SKILL.md` with `name` and `description` in YAML frontmatter. When a user request matches a skill's described purpose, read its `SKILL.md` and follow it.

Skills available in this project:
- **railway-deploy** — `.agents/skills/railway-deploy/SKILL.md`
- **anki-cards** — `.agents/skills/anki-cards/SKILL.md` — process study materials in `Anki/inbox/` into Anki cards

## Workflows

Multi-step workflows live in [.agents/workflows/](./.agents/workflows/). Read the relevant `.md` before executing a matching task.

Workflows available:
- **deploy** — `.agents/workflows/deploy.md`
