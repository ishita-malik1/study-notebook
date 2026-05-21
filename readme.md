# Study Notebook

Personal productivity web app for product/TPM case interview practice, daily habits, and progress tracking.

## Tech Stack

- **Frontend:** React 18 + Vite, Tailwind CSS, Recharts
- **API:** Azure Static Web Apps Functions (Node.js v18)
- **Database:** Azure Cosmos DB
- **AI:** Azure OpenAI (gpt-4o-mini)

## Setup

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
   Fill in your Azure values in `.env`.

2. Install dependencies:
   ```bash
   npm install
   cd api && npm install
   ```

3. Use **Node.js 20 LTS** (Azure Functions does not support Node 24):
   ```bash
   node -v   # should print v20.x.x
   ```
   If you have [nvm-windows](https://github.com/coreybutler/nvm-windows):
   ```bash
   nvm install 20
   nvm use 20
   ```

4. Run locally (**two terminals**, both from project root `study-notebook/`):

   **Terminal A — API:**
   ```bash
   npm run dev:api
   ```

   **Terminal B — Frontend:**
   ```bash
   npm run dev
   ```

   Do **not** run `npm run dev:api` from inside the `api/` folder.

5. Deploy: Push to GitHub. Azure Static Web Apps auto-deploys. Add all env variables in Azure Portal → Static Web App → Configuration.

## Cosmos DB containers

Create two containers in database `studynotebook` (partition key `/id`):

- `habits` — daily habit documents (`habit-YYYY-MM-DD`)
- `streaks` — single document `streaks-main`
- `practice_sessions` — saved walkthrough + live sessions (partition key `/id`)
- `learning_profiles` — per-type learning progress (`learning-profile-product`, `learning-profile-tpm`)

Add to `api/local.settings.json` and Azure Portal for case generation:

| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_ENDPOINT` | e.g. `https://YOUR-RESOURCE.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name (e.g. `gpt-4o`) |

## Habits API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/habits?date=YYYY-MM-DD` | Single day habits |
| GET | `/api/habits?from=YYYY-MM-DD&to=YYYY-MM-DD` | Date range (heatmap) |
| POST | `/api/habits` | Toggle habit `{ date, habitKey, value }` |
| GET | `/api/streaks` | Streak document |
| POST | `/api/streaks` | Upsert streak document |
| POST | `/api/generateCase` | Generate walkthrough + practice case pair |
| POST | `/api/savePracticeSession` | Save walkthrough to review bank |
| POST | `/api/conductInterview` | Live interviewer (`stream: true` for SSE) |
| POST | `/api/evaluateSession` | Score live practice session |
| POST | `/api/saveLiveSession` | Save live session + update profile + mark habit |
| GET | `/api/learningProfile?type=` | Fetch learning profile |
| POST | `/api/learningProfile` | Diagnostic onboarding (first session) |

## Adaptive case generation

From **session 4** (`sessions_total >= 3`), cases target weak areas, avoid recent problem types/domains, and match `current_level`. Sessions 1–3 stay at **beginner** difficulty. **Advanced** never before session 10.

See `context.md` for full architecture and file map.

## Routes

| Path | Page |
|------|------|
| `/` | Redirects to `/product-case` |
| `/product-case` | Product case practice |
| `/tpm-case` | TPM case practice |
| `/habits` | Daily habits |
| `/progress` | Dashboard |
