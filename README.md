# EduStream — Secure Online Course Platform

Production-grade online course platform with HD adaptive streaming, Supabase auth, and Cloudflare R2 storage.

---

## Architecture

```
Next.js (Vercel) ← API + Frontend
Supabase          ← Auth + PostgreSQL + RLS
Cloudflare R2     ← Video storage (2 buckets: temp + prod)
Redis             ← BullMQ job queue
Video Worker      ← Node.js service on Railway/Fly.io
Cloudflare CDN    ← Global HLS delivery
```

---

## Prerequisites

- Node.js 18+
- Redis instance (Railway or Upstash)
- [Supabase](https://supabase.com) project
- [Cloudflare R2](https://developers.cloudflare.com/r2/) account with 2 buckets
- FFmpeg installed on the worker server

---

## Step 1: Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run:

```sql
-- Paste contents of teacher-app/supabase/migrations/001_initial_schema.sql
```

3. Under **Authentication → Providers**, enable:
   - **Email** (enable "Confirm email")
   - **Google** (add your OAuth Client ID/Secret from Google Cloud Console)

4. Under **Authentication → URL Configuration**, set:
   - Site URL: `https://your-vercel-domain.vercel.app`
   - Redirect URLs: `https://your-vercel-domain.vercel.app/dashboard`

---

## Step 2: Cloudflare R2 Setup

1. Create **two R2 buckets**:
   - `course-videos-temp` (for raw MP4 uploads)
   - `course-videos-prod` (for HLS segments + thumbnails)

2. Both buckets should be **private** (no public access).

3. Create an **R2 API Token** with read/write access to both buckets.

4. **Cloudflare Cache Rules** (set in Cloudflare Dashboard → Caching → Cache Rules):

| URL Pattern | Cache TTL |
|---|---|
| `*.m3u8` | 30 seconds |
| `*.m4s` | 1 hour |
| `*.jpg` | 24 hours |

5. Set **CORS policy** on the TEMP bucket to allow PUT from your Vercel domain:

```json
[
  {
    "AllowedOrigins": ["https://your-vercel-domain.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Step 3: Environment Variables

### teacher-app/.env.local (copy from .env.example)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# R2 TEMP
R2_TEMP_ACCOUNT_ID=your-cf-account-id
R2_TEMP_ACCESS_KEY_ID=your-key
R2_TEMP_SECRET_ACCESS_KEY=your-secret
R2_TEMP_BUCKET_NAME=course-videos-temp
R2_TEMP_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com

# R2 PROD
R2_PROD_ACCESS_KEY_ID=your-key
R2_PROD_SECRET_ACCESS_KEY=your-secret
R2_PROD_BUCKET_NAME=course-videos-prod
R2_PROD_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com

# Redis
REDIS_URL=redis://default:password@host:port

# App
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
```

### video-worker/.env (same Redis + Supabase + R2 vars)

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=...
R2_TEMP_ENDPOINT=...
R2_TEMP_BUCKET_NAME=...
R2_TEMP_ACCESS_KEY_ID=...
R2_TEMP_SECRET_ACCESS_KEY=...
R2_PROD_ENDPOINT=...
R2_PROD_BUCKET_NAME=...
R2_PROD_ACCESS_KEY_ID=...
R2_PROD_SECRET_ACCESS_KEY=...
```

---

## Step 4: Deploy Next.js to Vercel

```bash
cd teacher-app
npm install
npm run build   # Verify no TypeScript errors
```

1. Push `teacher-app/` to GitHub
2. Import repository in [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local`
4. Deploy

---

## Step 5: Deploy Video Worker to Railway

```bash
cd video-worker
npm install
npm run build
```

1. Create a new project in [railway.app](https://railway.app)
2. Add a **Redis** plugin to the project
3. Deploy the `video-worker/` folder as a Docker service:
   ```bash
   railway up
   ```
4. Set environment variables in Railway dashboard
5. The worker will automatically start and listen for BullMQ jobs

> **FFmpeg** is included in the Dockerfile via `apt-get install ffmpeg`.

---

## Step 6: Create Admin User

1. Register normally at `/register`
2. In Supabase SQL Editor, promote to admin:

```sql
UPDATE user_profiles
SET role = 'admin'
WHERE id = 'your-user-uuid';
```

---

## Development

### Run Next.js locally

```bash
cd teacher-app
npm install
cp .env.example .env.local  # Fill in your values
npm run dev                 # http://localhost:3000
```

### Run video worker locally

```bash
cd video-worker
npm install
cp ../teacher-app/.env.example .env  # Fill in same values
npm run dev
```

---

## Security Checklist

- [x] Supabase JWT verified on all API routes (middleware.ts)
- [x] RLS enabled on all tables
- [x] Enrollment check before issuing streaming URL
- [x] R2 buckets are private (no public URLs)
- [x] Signed URLs expire: 2min (playlist), 15min (segments)
- [x] Right-click disabled on video player
- [x] Dynamic watermark: email + timestamp + IP + lessonId
- [x] Device session limiting (max 3 devices per account)
- [x] CSP, X-Frame-Options, X-Content-Type-Options headers
- [x] CORS locked to Vercel domain on R2 TEMP bucket
- [x] Rate limiting on login (configure Upstash)

---

## Folder Structure

```
Teacher App/
├── teacher-app/          # Next.js app (deploy to Vercel)
│   ├── app/              # App Router pages + API routes
│   ├── components/       # Shared React components
│   ├── lib/              # Supabase, R2, BullMQ clients
│   ├── types/            # TypeScript types
│   ├── middleware.ts      # Auth + security headers
│   └── supabase/
│       └── migrations/   # SQL schema
│
└── video-worker/         # BullMQ worker (deploy to Railway)
    └── src/
        ├── index.ts      # Worker entry point
        ├── processor.ts  # Main job handler
        ├── convert.ts    # FFmpeg ABR HLS
        ├── thumbnail.ts  # Thumbnail extraction
        ├── r2.ts         # R2 upload/download
        └── cleanup.ts    # Hourly cron cleanup
```
