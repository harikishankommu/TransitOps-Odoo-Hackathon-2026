# TransitOps Deployment Guide

## Required environment variables

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<secure-random-value-with-at-least-32-characters>
JWT_EXPIRES_IN=8h
CORS_ORIGINS=https://your-frontend-domain.example
TRUST_PROXY=1
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=240
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=10
```

Generate a secure JWT secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

## Build and start

```powershell
npm ci
npm run build
npm start
```

## Health check

```text
GET /api/health
```

## Reverse proxy

When a hosting platform terminates HTTPS before forwarding traffic to Node, configure:

```env
TRUST_PROXY=1
```

Add the public frontend origin to `CORS_ORIGINS` when the frontend and backend use different origins.

## Database persistence

The application writes to:

```text
src/server/db.json
```

The deployment filesystem must be writable and persistent. Ephemeral hosting can erase runtime records after restart or redeployment. A real production version should migrate to PostgreSQL.

## Production verification

```powershell
npm run typecheck
npm run check
npm start
```

Then verify:

- `/api/health`
- Login
- Role permissions
- One complete trip lifecycle
- One maintenance lifecycle
- Dashboard and reports
- Notification badge
