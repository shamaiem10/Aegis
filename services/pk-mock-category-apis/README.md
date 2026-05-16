# PK mock category alert APIs

Standalone Express service exposing the four Pakistan AOI mock-category routes used by Aegis Mobile, plus combined `live/parsed`.

## Endpoints

- `GET /health`
- **Four dedicated category APIs** (each can front a separate deployed service URL):
  - `GET /api/v1/signals/mock/accidents` → `{ success, data, error }`
  - `GET /api/v1/signals/mock/earthquakes` → `{ success, data, error }`
  - `GET /api/v1/signals/mock/floods` → `{ success, data, error }`
  - `GET /api/v1/signals/mock/disease` → `{ success, data, error }`
- `GET /api/v1/signals/mock/category/{accidents|earthquakes|floods|disease}` → same envelope (aliases like `disease-spreads`)
- `GET /api/v1/signals/live/parsed` → JSON array (all categories merged)

Deploy **four GCP services** or four Vercel projects by assigning each URL to your app (`EXPO_PUBLIC_PK_MOCK_ALERTS_URL_*` patterns) — or reuse one origin for all routes.

## Splitting into four backends (optional)

Point each deployed service root at the same codebase; configure your platform so public paths map to `/api/v1/signals/mock/accidents` (etc.). The mobile helpers `MOCK_CATEGORY_STANDALONE_API_PATHS` and `canonicalMockPkCategorySlug` in `frontend/mobile/src/api/client.ts` match these paths exactly.

After deploy, set in Expo `.env`:

`EXPO_PUBLIC_PK_MOCK_ALERTS_URL=https://your-deployment.example.com`

Omit trailing slash. When set, `listSignals()` and `fetchMockCategorySignals()` use this host instead of the main backend for those paths.

Source data: **`src/signals-data.ts`** (keep aligned with `backend/tools/mock_pk_category_signals.py` when editing scenarios).

## GCP Cloud Run

From this directory:

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT/repo/pk-mock-category-apis:latest .
gcloud run deploy pk-mock-category-apis \
  --image REGION-docker.pkg.dev/PROJECT/repo/pk-mock-category-apis:latest \
  --platform managed \
  --region REGION \
  --allow-unauthenticated
```

## Vercel

1. Import this repo (or subdirectory). Set **Root Directory** to `services/pk-mock-category-apis` if deploying from monorepo.
2. Defaults: **Build Command** `npm run vercel-build`; output uses `api/server.js` + rewrite in `vercel.json`.

## Deploy (Vercel) — live

Production: **https://pk-mock-category-apis.vercel.app**

```powershell
cd services/pk-mock-category-apis
.\deploy-vercel.ps1
```

## Local

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:8080/api/v1/signals/live/parsed`.
