---
description: How to safely deploy changes or new features to Railway
---

When the user asks you to deploy changes, add new features, or iterate on the Railway production build, you must follow the strict deployment cycle.

**Authentication:** Each project uses a **project environment token** in `.env` as `RAILWAY_TOKEN` — no `railway login` or account switching needed. Generate one from: railway.com → project → environment → Settings → Tokens → Generate.

1. **Pause Railway:** Before testing locally, run `RAILWAY_TOKEN=$(grep RAILWAY_TOKEN .env | cut -d= -f2) npx -y @railway/cli down --yes` to prevent Telegram bot connection conflicts.
2. **Test Locally:** Try out your code by running `npm run dev` and testing via Telegram. Stop the local bot when done.
3. **Type-check & Deploy:**
   - Ask the user for confirmation.
   - Run `npx tsc --noEmit` to ensure there are no compilation errors.
   - Run `RAILWAY_TOKEN=$(grep RAILWAY_TOKEN .env | cut -d= -f2) npx -y @railway/cli up --detach` to deploy the codebase.
4. **Verify:** Wait ~60 seconds and run `RAILWAY_TOKEN=$(grep RAILWAY_TOKEN .env | cut -d= -f2) npx -y @railway/cli logs --lines 40` to confirm the bot connected successfully without crashing.
