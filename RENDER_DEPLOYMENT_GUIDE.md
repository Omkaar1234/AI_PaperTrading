# UPRISE — Render Blueprint Deployment Guide

**Target Release:** Commit `af768b293f9a7e5a3d920a5fafcff111882f596c` on branch `main`
**Repository:** `https://github.com/Omkaar1234/AI_PaperTrading.git`
**Infrastructure Blueprint:** `render.yaml`

---

## 1. Architecture Overview

UPRISE is deployed across four distinct Render services using containerized internal services and an edge static CDN:

```
[ Browser / Client ]
      │
      ├────────────────────── HTTPS (Port 443) ──────────────────────┐
      │                                                              │
      ▼                                                              ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│ uprise-frontend                 │           │ uprise-backend                  │
│ Render Static Site (Edge CDN)   │           │ Render Web Service (Docker)     │
│ https://uprise-frontend.onrender.com         │ https://uprise-backend.onrender.com
└─────────────────────────────────┘           └─────────────────────────────────┘
                                                               │            │
                                             Raw TCP (9000)   │            │ HTTP (5000)
                                        (Internal Network)     ▼            ▼
                                      ┌────────────────────────┐  ┌───────────────┐
                                      │ uprise-matching-engine │  │ uprise-ml-    │
                                      │ Render Private Service │  │ service       │
                                      │ (C++20 TCP Server)     │  │ (Python/Flask)│
                                      └────────────────────────┘  └───────────────┘
                                                                            │
                                                                            ▼
                                                                ┌───────────────────┐
                                                                │ MongoDB Atlas     │
                                                                │ External Database │
                                                                └───────────────────┘
```

---

## 2. Pre-Deployment Setup Checklist

Before initiating the Render deployment, verify the following external prerequisites:

### A. MongoDB Atlas Network Access
Because Render Web Services use dynamic egress IP addresses, MongoDB Atlas must allow traffic from Render:
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Navigate to **Security > Network Access > IP Access List**.
3. Confirm `0.0.0.0/0` (Allow Access from Anywhere) is active.
4. Verify your database user credentials and cluster connection string format:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```

### B. Google Cloud Console OAuth Credentials
1. Open the [Google Cloud Console](https://console.cloud.google.com) > **APIs & Services > Credentials**.
2. Select your OAuth 2.0 Client ID for Web Applications.
3. Under **Authorized JavaScript origins**, add:
   ```
   https://uprise-frontend.onrender.com
   ```
4. Under **Authorized redirect URIs**, add:
   ```
   https://uprise-backend.onrender.com/api/auth/google/callback
   ```
5. Save changes.

---

## 3. Render Blueprint Deployment Steps

### Step 1: Connect Repository to Render
1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub repository: `https://github.com/Omkaar1234/AI_PaperTrading`.
4. Select the `main` branch.
5. Render will discover `render.yaml` and display the 4-service stack:
   - `uprise-matching-engine` (Private Service)
   - `uprise-ml-service` (Private Service)
   - `uprise-backend` (Web Service)
   - `uprise-frontend` (Static Site)

### Step 2: Input Unsynced Secrets
Render will prompt you for the four unsynced secrets declared with `sync: false` in `render.yaml`:
- **`JWT_SECRET`**: Strong random secret key used to sign session cookies.
- **`MONGODB_URI`**: Full MongoDB Atlas connection string (`mongodb+srv://...`).
- **`GOOGLE_CLIENT_ID`**: OAuth Client ID from Google Cloud Console.
- **`GOOGLE_CLIENT_SECRET`**: OAuth Client Secret from Google Cloud Console.

> [!CAUTION]
> Never commit secret values to Git. Entering them via the Render Dashboard keeps them securely encrypted in Render's secret manager.

### Step 3: Approve & Launch
1. Review the generated plan. The private services require a **Starter plan** (\$7/month each = \$14/month total).
2. Click **Apply Blueprint**.
3. Render will initiate the builds in dependency order.

---

## 4. Environment Variables Reference

### Service 1: `uprise-backend` (Web Service)

| Variable Name | Classification | Injected By | Description / Recommended Value |
| :--- | :---: | :---: | :--- |
| `NODE_ENV` | Public Config | `render.yaml` | `production` |
| `PORT` | Public Config | `render.yaml` | `3001` (Render also injects `$PORT`) |
| `BACKEND_PORT` | Public Config | `render.yaml` | `3001` |
| `BACKEND_HOST` | Public Config | `render.yaml` | `0.0.0.0` |
| `FRONTEND_URL` | Public Config | `render.yaml` | `https://uprise-frontend.onrender.com` |
| `CORS_ORIGIN` | Public Config | `render.yaml` | `https://uprise-frontend.onrender.com` |
| `COOKIE_SECURE` | Public Config | `render.yaml` | `true` |
| `COOKIE_SAME_SITE` | Public Config | `render.yaml` | `none` |
| `MATCHING_ENGINE_HOST` | Network | `fromService` | Internal DNS: `uprise-matching-engine` |
| `MATCHING_ENGINE_PORT` | Network | `fromService` | `9000` |
| `ML_HOST` | Network | `fromService` | Internal DNS: `uprise-ml-service` |
| `ML_PORT` | Network | `fromService` | `5000` |
| `MONGODB_ENABLED` | Public Config | `render.yaml` | `true` |
| `MONGODB_DB` | Public Config | `render.yaml` | `paper_trading` |
| `MONGODB_CONNECT_TIMEOUT_MS` | Public Config | `render.yaml` | `10000` |
| `GOOGLE_CALLBACK_URL` | Public Config | `render.yaml` | `https://uprise-backend.onrender.com/api/auth/google/callback` |
| `JWT_SECRET` | **SECRET** | Dashboard | Unsynced secret for session signing |
| `MONGODB_URI` | **SECRET** | Dashboard | Unsynced secret for Atlas connection |
| `GOOGLE_CLIENT_ID` | Secret / ID | Dashboard | Unsynced Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | **SECRET** | Dashboard | Unsynced Google OAuth Client Secret |

### Service 2: `uprise-ml-service` (Private Service)
- Port: `5000` (Internal HTTP)
- Gunicorn command in Dockerfile handles binding to `0.0.0.0:5000`.
- All required Phase 5A (`hybrid21d_models.pkl`) and Phase 5B (`broad21d_models.pkl`) models and manifests are bundled inside the Docker image.

### Service 3: `uprise-matching-engine` (Private Service)
- Port: `9000` (Internal Raw TCP)
- Binary runs `./matching_engine 9000` and binds to `0.0.0.0:9000`.

### Service 4: `uprise-frontend` (Static Site)

| Variable Name | Classification | Injected By | Description / Recommended Value |
| :--- | :---: | :---: | :--- |
| `REACT_APP_API_URL` | Build-time | `render.yaml` | `https://uprise-backend.onrender.com` |

---

## 5. Health Checks & Verification Endpoints

| Service | Protocol & Path | Success Indicator | Failure Indicator |
| :--- | :---: | :--- | :--- |
| **`uprise-backend`** | `GET /health` | HTTP `200 OK`<br>`{"status":"healthy","service":"backend-api","matching_engine":"connected","database":"connected"}` | HTTP 500, or `database: "disabled"`, or `matching_engine: "disconnected"` |
| **`uprise-matching-engine`** | TCP Socket Probe (`:9000`) | TCP handshake succeeds immediately | Connection refused or timeout |
| **`uprise-ml-service`** | Internal `GET /health` | HTTP `200 OK`<br>`{"status":"healthy","service":"ml-service"}` | Gunicorn crash, OOM kill, or model import failure |
| **`uprise-frontend`** | `GET /index.html` | HTTP `200 OK` (Served via Render CDN) | HTTP 404 or build failure |

---

## 6. End-to-End Smoke Test Suite

Run these tests immediately following deployment to confirm system health:

### Test 1: Public Backend Health
```bash
curl -I https://uprise-backend.onrender.com/health
```
- Verify status `200 OK`.
- Verify JSON body shows `matching_engine: "connected"` and `database: "connected"`.

### Test 2: User Registration & Session Cookie
1. In your browser, open `https://uprise-frontend.onrender.com/register`.
2. Register a new test user (Name, Age, Email, Password).
3. Select an initial paper balance chip (e.g. `₹5,00,000`).
4. Click **Create Paper Trading Account**.
5. Confirm redirection to `/dashboard`.
6. Open browser DevTools > Application > Cookies: confirm `ptx_session` cookie is present with `Secure` and `SameSite=None`.

### Test 3: Session Authentication (`/api/auth/me`)
- Refresh `/dashboard`. Confirm user balance, name, and profile remain loaded.
- Confirm network request `GET /api/auth/me` returns `200 OK`.

### Test 4: WebSocket Real-Time Market Stream
- Open DevTools > Network > WS tab.
- Confirm connection to:
  ```
  wss://uprise-backend.onrender.com/ws/market?symbols=RELIANCE.NS,TCS.NS,INFY.NS...
  ```
- Status must be `101 Switching Protocols`.
- Live quote ticks must stream into the dashboard ticker and market overview.

### Test 5: Order Submission & C++ Matching Engine Execution
1. Navigate to `/trade`. Select `RELIANCE.NS`.
2. Submit a **BUY Market Order** for 10 shares.
3. Confirm trade execution modal/toast appears.
4. Confirm Available Cash decreases and 10 shares appear under **Portfolio Holdings** and **Positions Table**.
5. Check `/orders` tab: confirm order status is `FILLED`.

### Test 6: Order Cancellation
1. Submit a **BUY Limit Order** with a price 10% below market price.
2. Confirm order status is `OPEN` in the Open Orders table.
3. Click **Cancel**.
4. Confirm order status transitions to `CANCELLED` and reserved cash returns to available balance.

### Test 7: ML 21-Day Price Prediction
1. Navigate to `/prediction`.
2. Select `RELIANCE.NS` or `TCS.NS`.
3. Confirm directional forecast (`UP` / `DOWN`), confidence percentage, and plain-English factor summary load cleanly.
4. Search for `BTC-USD`: confirm the system displays an honest notice stating that cryptocurrency predictions are isolated and unavailable.

---

## 7. Diagnostics & Log Inspection

If any service encounters issues during or after deployment:

### Backend Logs
- Navigate to **`uprise-backend` > Logs** in the Render Dashboard.
- **Normal Startup:**
  ```
  Server running on port 3001
  ML Service: http://uprise-ml-service:5000
  Matching Engine: uprise-matching-engine:9000
  Database: connected
  ```
- **Diagnostic Tips:**
  - If `Database: disabled (missing_mongodb_uri)`: Verify `MONGODB_URI` secret is populated in the backend service environment.
  - If `Matching Engine: disconnected`: Confirm `uprise-matching-engine` is healthy and listening on port 9000.
  - If `CORS Error: Origin not allowed`: Check `FRONTEND_URL` and `CORS_ORIGIN` match the exact frontend domain (`https://uprise-frontend.onrender.com`).

### ML Service Logs
- Navigate to **`uprise-ml-service` > Logs**.
- **Normal Startup:**
  ```
  [INFO] Production 21D ML Service initialized successfully.
  [INFO] Listening at: http://0.0.0.0:5000
  ```
- **Diagnostic Tips:**
  - If process exits with code 137: Out of Memory (OOM). Ensure the instance has at least 512 MB to 1 GB RAM.

### Matching Engine Logs
- Navigate to **`uprise-matching-engine` > Logs**.
- **Normal Startup:**
  ```
  Matching Engine listening on port 9000
  ```

---
*Guide Complete — Follow the sequence above for a stable production release.*
