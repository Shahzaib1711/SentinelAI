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

### 1. Install dependencies

```bash
npm install
copy .env.example .env   # Windows — use cp on macOS/Linux
```

Edit `.env` with your PostgreSQL connection strings (see [BACKEND_SETUP.md](BACKEND_SETUP.md)).

### 2. Database

```bash
npm run db:generate
npm run db:push
npm run db:seed          # creates demo event summit-2026
```

Or use local Postgres: `npm run db:up` then set `DB_*` vars in `.env`.

### 3. Python API

```bash
npm run api:install
npm run api:dev          # Terminal 1 — http://localhost:8000
```

### 4. Frontend

```bash
npm run dev              # Terminal 2 — http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000). Select **summit-2026** in the sidebar (or create a new event — default camera slots are provisioned automatically).

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

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

## Architecture

```text
Browser (:3000)
    │  Next.js App Router + React
    │  /api/* → proxied to FastAPI (next.config rewrites)
    ▼
FastAPI (:8000)
    ├── events, incidents, alerts, personnel
    ├── blueprint analysis + security planning
    └── /api/webrtc — frame relay + YOLO + face ID
    ▼
PostgreSQL (Prisma schema + SQLAlchemy ORM)
```

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

## Live Phone Cameras

1. Open **Live Monitoring** on your PC.
2. Copy a broadcast link for a camera slot (e.g. CAM-01).
3. Open the link on your phone — allow camera access.
4. The feed appears in the dashboard grid with YOLO detection overlays.

For iPhone / remote access, use **ngrok** (HTTPS required). Full guide: [PHONE_CAMERA_SETUP.md](PHONE_CAMERA_SETUP.md).

## Environment Variables

Key settings in `.env` (see `.env.example` for the full list):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` / `DIRECT_URL` | PostgreSQL (Neon pooled + direct) |
| `FASTAPI_URL` | Backend URL for Next.js API proxy |
| `YOLO_ENABLED` | Person detection on relayed frames |
| `BLUEPRINT_ML_ENABLED` | Custom blueprint marker YOLO |
| `FLOOR_PLAN_ML_ENABLED` | Doors/windows/columns detection |
| `OPENAI_API_KEY` | Security planning chat (optional) |
| `NEXT_PUBLIC_DEFAULT_EVENT_SLUG` | Default event on first load |

## ML Scripts (optional)

```bash
npm run ml:blueprint:deploy       # deploy custom blueprint YOLO weights
npm run ml:floor-plan:download    # download floor-plan object detection model
npm run ml:blueprint:train        # retrain blueprint model
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run api:dev` | FastAPI with hot reload |
| `npm run db:seed` | Seed demo event + cameras |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run lint` | ESLint |

## Notes

- Next.js proxies all `/api/*` requests to FastAPI — the browser only talks to `:3000`.
- Pages fall back to mock data if the API is unreachable.
- New events get default camera slots (CAM-01 … CAM-09) on creation or first cameras fetch.
- Dark-mode SOC aesthetic, responsive layout.

## Further Reading

- [BACKEND_SETUP.md](BACKEND_SETUP.md) — database, API, deployment details
- [PHONE_CAMERA_SETUP.md](PHONE_CAMERA_SETUP.md) — ngrok + mobile broadcast setup
