# PK resource inventory API

Emergency resource catalog for Islamabad / Rawalpindi: curated operational units (Rescue 1122, ICT Police, PIMS EMS, etc.) plus **OpenStreetMap** hospitals, police posts, and fire stations via Overpass.

## Endpoints

- `GET /health`
- `GET /api/v1/resources/inventory` — `?enrich=1` (default), `?refresh=1` to bust OSM cache
- `GET /api/v1/resources/inventory/islamabad` — preset bbox

Response: `{ success, data: { units[], items[], sources, bbox }, error }`

## Vercel

Root directory: `services/pk-resource-inventory-api`

```powershell
cd services/pk-resource-inventory-api
.\deploy-vercel.ps1
```

Set:

- `EXPO_PUBLIC_PK_RESOURCES_URL=https://pk-resource-inventory-api.vercel.app`
- `PK_RESOURCES_INVENTORY_URL` (same) in `cloud-run/.env`

## Local

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:8080/api/v1/resources/inventory`
