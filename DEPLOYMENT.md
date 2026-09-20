# NEXORA POS — Production Deployment Guide

This guide details the deployment options, environment configuration, caching strategies, and operational maintenance for running NEXORA POS in production.

---

## 1. Quick Start with Docker Container

NEXORA POS is optimized for lightweight container deployments via Next.js `output: 'standalone'`.

### Build & Run Container Locally
```bash
# Build the production Docker image
docker build -t nexora-pos:latest .

# Run the container exposing port 3000
docker run -d \
  -p 3000:3000 \
  --name nexora-pos-instance \
  --restart unless-stopped \
  -e NODE_ENV=production \
  nexora-pos:latest
```

---

## 2. Deploy to Google Cloud Run

Google Cloud Run provides serverless autoscaling with fast global distribution.

### Prerequisites
- Google Cloud SDK (`gcloud`) installed and authenticated
- Google Artifact Registry or Container Registry configured

### Deployment Commands
```bash
# 1. Set your GCP project
gcloud config set project YOUR_PROJECT_ID

# 2. Build and submit container to Google Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/nexora-pos:latest

# 3. Deploy to Cloud Run
gcloud run deploy nexora-pos \
  --image gcr.io/YOUR_PROJECT_ID/nexora-pos:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10
```

---

## 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy directly
vercel --prod
```

Environment Variables to configure in Vercel Project Settings:
- `NEXT_TELEMETRY_DISABLED`: `1`
- `NODE_ENV`: `production`

---

## 4. Production Checklist & Security Hardening

- [x] **Service Worker & PWA Caching**: Ensure `public/sw.js` and `manifest.ts` are served over HTTPS.
- [x] **IndexedDB Persistence**: Local storage and Dexie tables operate client-side without external dependencies.
- [x] **Security Headers**: Standard security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy) enabled in Next.js config.
- [x] **Thermal Receipt & Hardware Support**: Enable Web Serial / Web Bluetooth permissions if connecting physical ESC/POS hardware.
- [x] **Cold Start Optimization**: Standalone Docker image size is under 180MB for fast container spin-up.

---

## 5. Health Checks & Monitoring

The application exposes standard Next.js health routes:
- **Liveness Probe**: `GET /` (HTTP 200)
- **Container Health Check**: Built into `Dockerfile` using `wget --spider http://localhost:3000/`.
