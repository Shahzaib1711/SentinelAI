# Backend Setup — FastAPI + PostgreSQL

## Architecture

```text
Next.js (frontend)  :3000
        │  /api/* proxied via next.config rewrites
        ▼
FastAPI (backend)   :8000  ← all REST + WebRTC signaling
        │
        ▼
PostgreSQL (Prisma migrations + seed from Node)
```

| Layer | Tech | Role |
|-------|------|------|
| **API** | FastAPI + Uvicorn | All `/api/*` endpoints |
| **Database** | PostgreSQL + Prisma | Schema, migrations, seed |
| **ORM (API)** | SQLAlchemy async | FastAPI reads/writes Postgres |
| **Files** | PostgreSQL (`storageUrl`) | Blueprint images stored as data URLs |

---

## Step 1 — PostgreSQL (Neon)

1. Create a project at [neon.tech](https://neon.tech)
2. Open **Connect** and copy both connection strings:
   - **Pooled** → `DATABASE_URL` (app + Prisma client)
   - **Direct** → `DIRECT_URL` (migrations / `db push`)

Set in `.env`:

```env
DATABASE_URL="postgresql://USER:PASS@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASS@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
FASTAPI_URL=http://localhost:8000
```

SSL is required for Neon — the app and Prisma scripts add `sslmode=require` automatically if it is missing.

### Local Docker (optional)

```bash
npm run db:up
```

Use `DB_*` vars in `.env` instead of `DATABASE_URL` (see `.env.example`). Set `DB_SSLMODE=disable` for local Postgres.

---

## Step 2 — Database schema & seed (Prisma)

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

Prisma manages the schema. FastAPI uses the same tables via SQLAlchemy.

---

## Step 3 — FastAPI backend

### Install Python dependencies
```bash
npm run api:install
```

Or manually:
```bash
cd backend
python -m pip install -r requirements.txt
```

### Start API server
```bash
npm run api:dev
```

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### YOLO object detection (phone cameras)

When a phone broadcasts via `/broadcast?camera=CAM-01`, each relayed frame is analyzed with **YOLOv8 nano** on the API server. Bounding boxes are returned with the WebRTC room poll (`detections` field).

**First run:** downloads `yolov8n.pt` (~6 MB) automatically.

Optional `.env` settings:

```env
YOLO_ENABLED=true
YOLO_MODEL=yolov8n.pt
YOLO_CONFIDENCE=0.4
YOLO_INTERVAL_MS=1000
```

Detected classes: **person**, **vehicle** (car/truck/bus), **bag** (backpack/suitcase), **animal** (dog/cat/bird).

---

## Step 4 — Start frontend

In a **second terminal**:
```bash
npm run dev
```

Next.js proxies `/api/*` → FastAPI (`FASTAPI_URL` in `.env`).

---

## API endpoints (FastAPI)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/v1/events/{slug}/dashboard` | Dashboard KPIs |
| GET | `/api/v1/events/{slug}/cameras` | Cameras |
| GET | `/api/v1/events/{slug}/incidents` | Incidents |
| GET | `/api/v1/incidents/{id}` | Single incident |
| PATCH | `/api/v1/incidents/{id}` | Update incident |
| GET | `/api/v1/events/{slug}/alerts` | Alerts |
| PATCH | `/api/v1/alerts/{id}/acknowledge` | Acknowledge alert |
| GET | `/api/v1/events/{slug}/blueprint` | Blueprint + markers |
| POST | `/api/v1/events/{slug}/blueprint` | Add marker / update storage |
| POST | `/api/v1/events/{slug}/coverage/analyze` | Coverage analysis |
| GET/POST | `/api/webrtc/{cameraId}` | Phone camera frame relay |

---

## Dev workflow (two terminals)

**Terminal 1 — API:**
```bash
npm run api:dev
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

**ngrok (phone cameras):** tunnel port **3000** only — Next.js proxies API calls to FastAPI.

```bash
ngrok http 3000
```

---

## Project structure

```text
backend/
  app/
    main.py           # FastAPI entry
    config.py         # Settings
    database.py       # SQLAlchemy
    models/           # DB models (match Prisma schema)
    routers/          # API routes
    services/         # Coverage engine, WebRTC signaling
  requirements.txt

prisma/
  schema.prisma       # Source of truth for DB schema
  seed.ts             # Seed data
```
