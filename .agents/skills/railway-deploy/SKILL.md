---
name: Railway Deployment Protocol
description: The official Standard Operating Procedure for testing and deploying this bot to Railway.
---

# Railway Standard Operating Procedures — this bot

When the user asks you to deploy changes or iterate on the Railway production build, you MUST follow this strict cycle:

`1. Pause Railway  →  2. Test Locally  →  3. Deploy  →  4. Verify`

## Authentication
The Railway CLI uses a **project environment token** stored in `.env` as `RAILWAY_TOKEN`. This is scoped to a specific project/environment and requires no `railway login` or linking — perfect for multiple accounts.

**To generate a project token (one-time per project):**
1. Open the project on railway.com → click the environment (e.g. "production")
2. Go to **Settings → Tokens → Generate**
3. Paste it into this project's `.env` as `RAILWAY_TOKEN`

If `RAILWAY_TOKEN` is not yet set, fall back to the browser session in `~/.railway/config.json` (requires `railway login` + `railway link` once).

## Phase 1: Pause Railway (Enter Dev Mode)
Before testing locally, **always pause the Railway service first.** Two bot instances polling the same Telegram token will fight over messages.
Run:
`RAILWAY_TOKEN=$(grep RAILWAY_TOKEN .env | cut -d= -f2) npx -y @railway/cli down --yes`

## Phase 2: Test Locally
Start the local dev server:
`npm run dev`
Interact with the bot on Telegram to test changes. When done, stop the local server.

## Phase 3: Deploy to Railway
Once you determine the changes are ready and the user confirms:

1. **Type-check** to catch errors before deploying:
   `npx tsc --noEmit`
2. **Set new env vars** (if you added any):
   `RAILWAY_TOKEN=$(grep RAILWAY_TOKEN .env | cut -d= -f2) npx -y @railway/cli variables set NEW_VAR_NAME="value"`
3. **Deploy:**
   `RAILWAY_TOKEN=$(grep RAILWAY_TOKEN .env | cut -d= -f2) npx -y @railway/cli up --detach`

## Phase 4: Verify
Wait ~60 seconds for the build to finish, then check logs:
`RAILWAY_TOKEN=$(grep RAILWAY_TOKEN .env | cut -d= -f2) npx -y @railway/cli logs --lines 40`

Ensure there are no crash traces or unhandled errors.

## Important Notes
- **Missing CLI?** Use `npx -y @railway/cli [command]` for all Railway interactions.
- **SQLite resets on every deploy:** Short-term memory rests.
- **Docker deployed files:** `src/`, `tsconfig.json`, `soul.md`, `package.json`, `package-lock.json`.
- **Ignored:** `.env`, `node_modules/`, `data/`.
