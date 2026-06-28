# SentinelAI — Blueprint-Aware Security Intelligence System

A professional frontend-only web application prototype for an AI-powered VIP security and surveillance platform.

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** components
- **Lucide React** icons
- **Recharts** for data visualization
- **Framer Motion** for animations

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | KPI cards, threat trends, active threats |
| Venue Setup | `/venue-setup` | Blueprint upload and marker placement |
| Security Planning | `/security-planning` | Blueprint analysis, guard/camera deployment |
| Coverage Analysis | `/coverage-analysis` | Camera coverage and blind spots |
| Live Monitoring | `/live-monitoring` | Real-time camera feeds and alerts |
| Threat Intelligence | `/threat-intelligence` | Heatmaps and threat analytics |
| Incident Center | `/incident-center` | Incident tracking and details |
| Reports | `/reports` | Security assessment reports |

## Architecture

```
src/
├── app/                  # Next.js App Router pages
├── components/
│   ├── charts/           # Recharts wrappers
│   ├── layout/           # Sidebar, TopNav, AppLayout
│   ├── shared/           # Reusable domain components
│   └── ui/               # shadcn/ui primitives
├── lib/
│   ├── mock-data.ts      # Realistic dummy data
│   └── utils.ts          # Utilities and helpers
└── types/
    └── index.ts          # TypeScript interfaces
```

## Backend (FastAPI + PostgreSQL)

- **FastAPI** — all API routes (`backend/`)
- **PostgreSQL** — database (Prisma schema + seed)

```bash
# See BACKEND_SETUP.md for full instructions
copy .env.example .env
npm run db:push && npm run db:seed
npm run api:install
npm run api:dev          # Terminal 1 — API on :8000
npm run dev              # Terminal 2 — UI on :3000
```

API docs: http://localhost:8000/docs

## Notes

- Live phone cameras via frame relay (`/broadcast`)
- Pages fall back to mock data if database is unavailable
- Dark mode SOC aesthetic
- Responsive design
