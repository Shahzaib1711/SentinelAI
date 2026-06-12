# Phone Camera Setup (iPhone & Android)

Stream your phone camera into **Live Monitoring** using WebRTC.

## What you need

- PC running SentinelAI (`npm run dev`)
- iPhone or Android phone
- Both devices on the **same Wi‑Fi** (or phone hotspot)
- **ngrok** (free) — required for iPhone camera access (HTTPS)

---

## Step 1 — Install ngrok (one time)

1. Download from [https://ngrok.com/download](https://ngrok.com/download)
2. Sign up for a free account
3. Copy your authtoken from the ngrok dashboard
4. Run in terminal:

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

---

## Step 2 — Start SentinelAI

```bash
cd c:\Users\ZnCl2\Desktop\SentinelAI
npm run dev
```

App runs at `http://localhost:3000`

---

## Step 3 — Start ngrok tunnel

Open a **second terminal**:

```bash
ngrok http 3000
```

Copy the **HTTPS** URL, e.g.:

```
https://a1b2c3d4.ngrok-free.app
```

> Keep both terminals running.

---

## Step 4 — Open Live Monitoring on PC

In your browser:

```
https://a1b2c3d4.ngrok-free.app/live-monitoring
```

(Can also use `http://localhost:3000/live-monitoring` on PC only.)

Feeds for **CAM-01**, **CAM-02**, **CAM-03** will show "Waiting for phone camera..." until you broadcast.

---

## Step 5 — Start broadcast on your phone

On your **iPhone or Android**, open Safari/Chrome:

| Camera slot | URL |
|-------------|-----|
| CAM-01 | `https://a1b2c3d4.ngrok-free.app/broadcast?camera=CAM-01` |
| CAM-02 | `https://a1b2c3d4.ngrok-free.app/broadcast?camera=CAM-02` |
| CAM-03 | `https://a1b2c3d4.ngrok-free.app/broadcast?camera=CAM-03` |

Replace `a1b2c3d4.ngrok-free.app` with your actual ngrok URL.

### On the phone

1. Tap **Allow** when asked for camera permission
2. Wait until status shows **Streaming** / **LIVE**
3. **Keep the page open** and screen on (don't lock the phone)

---

## Step 6 — Confirm on PC

Go back to **Live Monitoring** on your PC. Within a few seconds the matching camera tile should show your live phone video with a **LIVE** badge.

---

## Multiple phones

Use one phone per camera ID:

- Phone 1 → `/broadcast?camera=CAM-01`
- Phone 2 → `/broadcast?camera=CAM-02`
- Phone 3 → `/broadcast?camera=CAM-03`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Camera permission denied | iOS: Settings → Safari → Camera → Allow. Retry broadcast URL. |
| "Waiting for phone camera..." forever | Use **HTTPS ngrok URL** on phone, not `http://localhost`. |
| ngrok warning page | Tap "Visit Site" on the ngrok interstitial page. |
| Stream drops when phone locks | Keep screen on; disable auto-lock temporarily. |
| Peer connection error | Refresh broadcast page on phone, then refresh Live Monitoring on PC. |
| Only works on Wi‑Fi | Phone and PC must reach the same ngrok tunnel (internet is fine). |

---

## How it works

```
Phone (/broadcast)  ──WebRTC──►  PeerJS cloud  ◄──WebRTC──  PC (Live Monitoring)
```

No video is stored. Streams are peer-to-peer via WebRTC signaling through PeerJS.

---

## Disable phone feeds (back to mock)

In `src/lib/mock-data.ts`, remove `useWebRTC: true` from camera entries.
