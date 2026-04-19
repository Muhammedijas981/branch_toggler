# 🚀 Branch Toggler — Setup Guide

A production-ready Vercel deployment control center with OAuth authentication, audit logs, scheduled switches, and Slack/Discord notifications.

---

## Prerequisites

- A [Vercel](https://vercel.com) account
- A [Supabase](https://supabase.com) project
- Node.js 18+

---

## Step 1 — Create a Vercel OAuth App

1. Go to [vercel.com/account/oauth](https://vercel.com/account/oauth)
2. Click **Create** → fill in:
   - **Name**: Branch Toggler
   - **Redirect URI (local)**: `http://localhost:3000/api/auth/callback/vercel`
   - **Redirect URI (production)**: `https://your-domain.com/api/auth/callback/vercel`
3. Copy the **Client ID** and **Client Secret**

---

## Step 2 — Set Up the Supabase Database

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → New Query
3. Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and run it
4. Go to **Settings → API** and copy:
   - **Project URL** (`SUPABASE_URL`)
   - **service_role** key (`SUPABASE_SERVICE_KEY`) ← use the service role, NOT the anon key

---

## Step 3 — Configure Environment Variables

Copy the template:

```bash
cp .env.local.example .env.local
```

Then fill in `.env.local`:

```env
# Vercel OAuth (from Step 1)
VERCEL_CLIENT_ID=your_client_id
VERCEL_CLIENT_SECRET=your_client_secret

# NextAuth
NEXTAUTH_SECRET=<generate below>
NEXTAUTH_URL=http://localhost:3000

# Supabase (from Step 2)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Encryption key for scheduled switch tokens (generate below)
ENCRYPTION_KEY=<generate below>

# Cron protection (generate below)
CRON_SECRET=<generate below>
```

### Generate secrets:

```bash
# NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (must be 64 hex chars = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4 — Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Vercel.

---

## Step 5 — Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set all the environment variables from `.env.local` in your Vercel project:
**Vercel Dashboard → Project → Settings → Environment Variables**

> ⚠️ After deploying, update your Vercel OAuth app's redirect URI to include your production URL:
> `https://your-project.vercel.app/api/auth/callback/vercel`

---

## Features

| Feature | Description |
|---|---|
| ⚡ Branch Switching | One-click production branch switching via Vercel OAuth |
| 🔒 Vercel OAuth | Users authenticate with their own Vercel account — no shared tokens |
| 📋 Audit Log | Full history of every production switch with who, when, from/to |
| ⏰ Scheduled Switches | Schedule branch switches to execute automatically at a future time |
| 🔔 Notifications | Slack and Discord webhooks for switch events, schedules, and failures |
| 🛡️ Security Headers | CSP, HSTS, X-Frame-Options, and more via `next.config.js` |
| 🚦 Rate Limiting | Per-IP rate limiting on all API routes |
| ✅ Input Validation | All inputs are sanitized and validated before use |

---

## Architecture

```
pages/
  login.js              ← Vercel OAuth sign-in page
  index.js              ← Dashboard (project + branch switcher)
  history.js            ← Paginated audit log
  schedule.js           ← Schedule management
  settings.js           ← Notification settings
  api/
    auth/[...nextauth]  ← NextAuth handler
    vercel.js           ← Core Vercel API proxy (auth-protected)
    audit.js            ← Audit log read endpoint
    schedule.js         ← Schedule CRUD
    settings.js         ← Notification settings CRUD + test
    cron/
      execute-scheduled ← Vercel Cron Job (runs every minute)

lib/
  auth.js               ← NextAuth + Vercel OAuth config
  supabase.js           ← DB client (server-side only)
  vercel-api.js         ← Vercel API helpers
  validators.js         ← Input sanitization
  rate-limit.js         ← LRU-cache rate limiter
  encrypt.js            ← AES-256-CBC for token storage
  notifications.js      ← Slack + Discord payload builders
```

---

## Security Notes

- The **Vercel OAuth token** from each user's session is used for their API calls — no shared admin tokens
- Tokens stored for scheduled switches are **AES-256-CBC encrypted** at rest using `ENCRYPTION_KEY`
- The cron endpoint is protected by `CRON_SECRET` (Vercel injects this automatically)
- All sensitive errors return generic messages to the client; details are server-log only
- `noindex, nofollow` meta tag prevents search engine indexing of this admin tool
