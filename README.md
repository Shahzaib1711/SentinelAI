# SentinelAI — Blueprint-Aware Security Intelligence System

AI-powered VIP security and surveillance platform for event operations: floor-plan analysis, security planning, personnel identification, live phone-camera monitoring, and threat analytics.

## Features

- **Event-centric workflows** — create events, upload venue blueprints, plan guard/camera deployment
- **Blueprint ML** — auto-detect markers, doors, windows, columns; coverage and blind-spot analysis
- **Live monitoring** — phone cameras stream via JPEG frame relay; YOLO person detection + face matching
- **Personnel registry** — enroll guards/VIPs; unknown faces captured from live feeds
- **Threat intelligence & incidents** — risk zones, timelines, incident tracking
- **Security planning chat** — natural-language plan refinement (OpenAI-compatible LLM, regex fallback)

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Framer Motion |
| **API** | FastAPI, Uvicorn, SQLAlchemy (async) |
| **Database** | PostgreSQL (Neon or Docker), Prisma (schema, migrations, seed) |
| **ML / Vision** | YOLOv8 (person + blueprint + floor-plan), face recognition embeddings |
| **Streaming** | Custom WebRTC signaling + JPEG frame relay (`/broadcast`) |

## Quick Start

```bash
npm install
copy .env.example .env          # Windows — use cp on macOS/Linux
npm run db:generate && npm run db:push && npm run db:seed
npm run api:install
```

Then run in **two terminals**:

```bash
npm run api:dev                 # Terminal 1 — http://localhost:8000
npm run dev                     # Terminal 2 — http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000), select **summit-2026** in the sidebar, then go to **Live Monitoring** to test camera feeds.

---

## Backend Setup

### Architecture

```text
Next.js (frontend)  :3000
        │  /api/* proxied via next.config rewrites
        ▼
FastAPI (backend)   :8000  ← REST + WebRTC frame relay + YOLO
        │
        ▼
PostgreSQL          ← Prisma (schema/seed) + SQLAlchemy (API)
```

| Layer | Tech | Role |
|-------|------|------|
| **API** | FastAPI + Uvicorn | All `/api/*` endpoints |
| **Database** | PostgreSQL + Prisma | Schema, migrations, seed |
| **ORM (API)** | SQLAlchemy async | FastAPI reads/writes Postgres |
| **Blueprint images** | `storageUrl` in DB | Floor plans stored as data URLs |

### Step 1 — Environment

```bash
copy .env.example .env
```

#### Option A: Neon PostgreSQL (recommended)

1. Create a project at [console.neon.tech](https://console.neon.tech)
2. Open **Connect** and copy both strings:
   - **Pooled** → `DATABASE_URL`
   - **Direct** → `DIRECT_URL`

```env
DATABASE_URL="postgresql://USER:PASS@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASS@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
FASTAPI_URL=http://localhost:8000
```

SSL is required for Neon. The app adds `sslmode=require` automatically if missing.

#### Option B: Local PostgreSQL (Docker)

```bash
npm run db:up
```

Comment out `DATABASE_URL` / `DIRECT_URL` in `.env` and use:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=sentinel
DB_PASSWORD=sentinel_dev
DB_NAME=sentinelai
DB_SCHEMA=public
DB_SSLMODE=disable
FASTAPI_URL=http://localhost:8000
```

### Step 2 — Database schema & seed

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

This creates the demo event **summit-2026** with cameras, incidents, alerts, and a floor plan. Prisma manages the schema; FastAPI uses the same tables via SQLAlchemy.

```bash
npm run db:studio    # optional — visual DB browser
```

### Step 3 — Python API

Requires **Python 3.10+**.

```bash
npm run api:install
npm run api:dev
```

Verify:

- Health: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Step 4 — Frontend

```bash
npm run dev
```

The Next.js app proxies `/api/*` to `FASTAPI_URL` — the browser only talks to port **3000**.

### Optional — ML models

```bash
npm run ml:blueprint:deploy       # custom blueprint marker YOLO weights
npm run ml:floor-plan:download    # doors/windows/columns detection model
```

If models are missing, blueprint auto-detect falls back to OpenCV heuristics.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` / `DIRECT_URL` | PostgreSQL (Neon pooled + direct) |
| `DB_*` | Local Docker Postgres (alternative to URLs above) |
| `FASTAPI_URL` | Backend URL for Next.js API proxy |
| `YOLO_ENABLED` | Person detection on relayed camera frames |
| `YOLO_MODEL` | YOLO weights file (default `yolov8n.pt`) |
| `FACE_MATCH_THRESHOLD` | Face match strictness (0.0–1.0) |
| `BLUEPRINT_ML_ENABLED` | Custom blueprint marker YOLO |
| `FLOOR_PLAN_ML_ENABLED` | Architectural element detection |
| `OPENAI_API_KEY` | Security planning chat (optional) |
| `LLM_MODEL` / `LLM_BASE_URL` | OpenAI-compatible LLM endpoint |
| `NEXT_PUBLIC_DEFAULT_EVENT_SLUG` | Default event on first load |

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `503 Database unavailable` | Check `DATABASE_URL`, wake Neon project at console.neon.tech |
| API calls fail from UI | Ensure `npm run api:dev` is running on port 8000 |
| Empty camera grid | Run `npm run db:seed` or select an event — cameras auto-provision on first fetch |
| Blueprint ML not loaded | Run `npm run ml:blueprint:deploy` |
| CORS errors | API allows all origins in dev; use the Next.js proxy, not direct `:8000` calls from browser |

---

## Phone Camera Setup

Stream your phone camera into **Live Monitoring** using the broadcast page and JPEG frame relay.

### What you need

- PC running SentinelAI (`npm run api:dev` + `npm run dev`)
- iPhone or Android phone
- Same Wi‑Fi network (PC and phone), **or** ngrok for remote/HTTPS access
- **ngrok** (free) — **required for iPhone** (Safari blocks camera on non-HTTPS pages)

### How it works

```text
Phone  →  /broadcast?camera=CAM-01  →  captures JPEG frames
              ↓
FastAPI  /api/webrtc/CAM-01  →  stores frame + runs YOLO + face ID
              ↓
PC  →  Live Monitoring  →  polls and displays feed + detections
```

### Local network (Android / same Wi‑Fi)

1. Start both servers on your PC:

```bash
npm run api:dev
npm run dev
```

2. On your PC, open [http://localhost:3000/live-monitoring](http://localhost:3000/live-monitoring)
3. Copy the broadcast link for a camera slot (e.g. **CAM-01**)
4. On your phone (same Wi‑Fi), open `http://YOUR_PC_LAN_IP:3000/broadcast?camera=CAM-01`
   - Find your PC IP: `ipconfig` (Windows) or `ifconfig` (macOS/Linux)
5. Allow camera access when prompted
6. The feed appears in the Live Monitoring grid within a few seconds

### iPhone / remote access (ngrok)

iOS requires **HTTPS** for `getUserMedia`. Use ngrok:

#### 1. Install ngrok (one time)

1. Download from [ngrok.com/download](https://ngrok.com/download)
2. Sign up for a free account
3. Add your authtoken:

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

#### 2. Start SentinelAI

```bash
npm run api:dev          # Terminal 1
npm run dev              # Terminal 2
```

#### 3. Start ngrok tunnel

```bash
ngrok http 3000          # Terminal 3
```

Copy the **HTTPS** forwarding URL (e.g. `https://abc123.ngrok-free.app`).

#### 4. Set the public URL in `.env`

```env
NEXT_PUBLIC_APP_URL=https://abc123.ngrok-free.app
```

Restart `npm run dev` so the env var loads.

#### 5. Broadcast from phone

1. On PC: open Live Monitoring — broadcast links now use the ngrok HTTPS URL
2. Copy a link (e.g. `https://abc123.ngrok-free.app/broadcast?camera=CAM-01`)
3. Open it on your phone, allow camera access
4. Keep the broadcast page open and screen on
5. View the feed on PC in Live Monitoring

### Tips

- One phone per camera slot (CAM-01, CAM-02, …)
- Keep the broadcast page in the foreground — background tabs may throttle frames
- YOLO person detection runs server-side when `YOLO_ENABLED=true`
- Enroll faces in **Personnel Registry** for guard/VIP identification on live feeds
- If the feed drops, refresh the broadcast page on the phone

### Phone camera troubleshooting

| Problem | Fix |
|---------|-----|
| Camera permission denied | Use HTTPS (ngrok); check browser site permissions |
| "Waiting for phone camera…" on PC | Confirm broadcast page shows **LIVE**; check `api:dev` is running |
| Feed stops after ~15s | Restart both servers (relay session fixes are in latest code) |
| ngrok link doesn't work | Restart `npm run dev` after setting `NEXT_PUBLIC_APP_URL` |
| No detections | Set `YOLO_ENABLED=true`; first detection may take a few seconds |

---

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Events | `/events` | Create and select active event |
| Dashboard | `/dashboard` | KPIs, threat trends, active threats |
| Venue Setup | `/venue-setup` | Upload floor plan, place markers, auto-detect |
| Security Planning | `/security-planning` | Coverage analysis, guard/camera deployment, LLM chat |
| Personnel Registry | `/personnel-registry` | Enroll staff/VIPs, view detected unknowns |
| Live Monitoring | `/live-monitoring` | Camera grid, YOLO overlays, personnel floor map |
| Threat Intelligence | `/threat-intelligence` | Risk heatmaps and threat analytics |
| Incident Center | `/incident-center` | Incident tracking and updates |
| Phone Broadcast | `/broadcast?camera=CAM-01` | Mobile camera feed publisher |

## Project Structure

```text
src/
├── app/                    # Next.js pages
├── components/
│   ├── charts/             # Recharts wrappers
│   ├── layout/             # AppLayout, Sidebar, TopNav
│   ├── shared/             # BlueprintViewer, CameraCard, etc.
│   └── ui/                 # shadcn/ui primitives
├── contexts/               # EventContext (active event slug)
├── hooks/                  # useCameraRelayRooms, useLivePersonnel, …
├── lib/
│   ├── api/                # Typed API clients
│   ├── mock-data.ts        # Demo/fallback data
│   └── services/           # Client helpers
└── types/

backend/
├── app/routers/            # FastAPI route modules
├── app/services/           # ML, planning, signaling, face recognition
└── app/models/             # SQLAlchemy models

prisma/                     # Schema + seed
ml/blueprint/               # YOLO training pipeline
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run api:dev` | FastAPI with hot reload |
| `npm run api:install` | Install Python dependencies |
| `npm run db:seed` | Seed demo event + cameras |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run db:up` | Start local Postgres (Docker) |
| `npm run lint` | ESLint |

## Notes

- Next.js proxies all `/api/*` requests to FastAPI — the browser only talks to `:3000`.
- Pages fall back to mock data if the API is unreachable.
- New events get default camera slots (CAM-01 … CAM-09) on creation or first cameras fetch.
- Dark-mode SOC aesthetic, responsive layout.
