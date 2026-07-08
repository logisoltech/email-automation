# Email Automation

AI-assisted email drafting, scheduling, and sending — built with Next.js, Supabase, and plug-and-play AI providers.

> **Status:** Approved — 4 team members @ `logisol.tech`. Ready for Phase 0.

---

## Deployment Model: Private Internal Tool

**This is not a SaaS product.** It is a private tool for your company only. Random people cannot sign up, log in, or use the app.

| SaaS (not building) | Private tool (what we're building) |
|---------------------|-------------------------------------|
| Public signup page | **No signup** — accounts created manually |
| Per-customer billing/tenants | Single company, single SMTP account |
| Anyone can register | **Allowlist only** — your company emails |
| Per-user SMTP settings | One Namecheap SMTP config in env vars |
| Multi-tenant data isolation | Shared company email history |

### How access is locked down

1. **No public signup** — the `/signup` route does not exist. New users are created by you in the Supabase dashboard (or via a one-time setup script).
2. **Email allowlist** — middleware rejects login/API access unless the user's email ends with `@logisol.tech` (configured via `ALLOWED_EMAIL_DOMAINS`).
3. **Supabase Auth** — disable "Enable sign ups" in the Supabase project settings so the API cannot create accounts even if someone tries.
4. **Optional: Vercel Deployment Protection** — password-gate the entire site in Vercel settings for an extra layer (recommended for production).

Your team of **4 people** at **logisol.tech** each get a login (created manually in Supabase). They share the same SMTP sender and see the same send history. A `sent_by` column tracks who sent what — for internal audit, not tenant isolation.

---

## What We're Building

An internal web app where your team can:

1. **Log in** with a pre-created company account (no public registration)
2. **Send from your company email** via Namecheap SMTP (configured once in env vars)
3. **Create emails** with AI-generated subject lines and body copy
4. **Preview, edit, and send** (or schedule) emails
5. **View company send history** and status (sent, failed, scheduled)

The AI layer is **provider-agnostic**: start with Gemini or Groq (free tiers), swap to OpenAI later by changing one env var — no code changes required.

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Next.js 16 + React 19 + **JavaScript** | Keep current JS scaffold |
| Backend | Next.js API Routes (App Router) | Same repo, serverless on Vercel |
| Database | Supabase (Postgres) | Simple schema; shared company data |
| Auth | Supabase Auth | Login only; signups disabled; email allowlist |
| Email | Nodemailer + Namecheap SMTP | Single company SMTP config in env vars |
| AI | Plug-and-play adapter | Gemini → Groq → OpenAI |
| Styling | Tailwind CSS v4 | Already in scaffold |
| Deployment | Vercel | Env vars for secrets |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│  Dashboard · Compose · Templates · History · Settings        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Next.js API Routes (server)                     │
│  /api/ai/generate   /api/emails/send   /api/emails/schedule  │
└──────┬─────────────────────┬────────────────────┬───────────┘
       │                     │                    │
       ▼                     ▼                    ▼
┌──────────────┐    ┌─────────────────┐   ┌──────────────┐
│ AI Adapter   │    │  Nodemailer     │   │  Supabase    │
│ (Gemini/     │    │  (Namecheap     │   │  (Auth + DB) │
│  Groq/OpenAI)│    │   SMTP)         │   │              │
└──────────────┘    └─────────────────┘   └──────────────┘
```

### Plug-and-Play AI Provider

All AI calls go through a single interface. Adding or switching providers means implementing one adapter file.

```javascript
// lib/ai/types.js
// AIProvider interface documented via JSDoc

// lib/ai/index.js — factory reads AI_PROVIDER env var
// lib/ai/providers/gemini.js
// lib/ai/providers/groq.js
// lib/ai/providers/openai.js  (added later)
```

**Env-driven selection:**

```env
AI_PROVIDER=gemini   # gemini | groq | openai
GEMINI_API_KEY=...
GROQ_API_KEY=...
OPENAI_API_KEY=...   # optional, for later
```

---

## Project Structure (Target)

```
email-automation/
├── app/
│   ├── (auth)/
│   │   └── login/page.js             # No signup — accounts created manually
│   ├── (dashboard)/
│   │   ├── layout.js               # Sidebar + auth guard
│   │   ├── page.js                 # Dashboard home
│   │   ├── compose/page.js         # AI compose + send
│   │   ├── campaigns/page.js       # List campaigns
│   │   ├── history/page.js         # Sent email log
│   │   └── settings/page.js        # AI prefs, test send (SMTP is env-only)
│   ├── api/
│   │   ├── ai/
│   │   │   └── generate/route.js
│   │   └── emails/
│   │       ├── send/route.js
│   │       └── schedule/route.js   # Phase 2
│   ├── layout.js
│   └── globals.css
├── components/
│   ├── ui/                         # Buttons, inputs, modals
│   ├── compose/                    # Email editor, AI panel
│   └── layout/                     # Sidebar, header
├── lib/
│   ├── ai/
│   │   ├── types.js
│   │   ├── index.js                # Provider factory
│   │   └── providers/
│   │       ├── gemini.js
│   │       ├── groq.js
│   │       └── openai.js
│   ├── email/
│   │   ├── nodemailer.js           # SMTP transport
│   │   └── templates.js            # HTML/plain wrappers
│   ├── supabase/
│   │   ├── client.js               # Browser client
│   │   ├── server.js               # Server client (cookies)
│   │   └── middleware.js           # Session refresh
│   └── utils/
├── types/
│   └── database.js                 # Supabase table shapes (JSDoc)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── middleware.js                   # Auth redirect + email allowlist check
├── .env.local.example
└── README.md                       # This file
```

---

## Database Schema (Supabase)

No per-user SMTP table. SMTP credentials live only in server env vars.

### `emails`
Every composed/sent email. Shared across the company — all logged-in team members see the same history.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| sent_by | uuid FK | → auth.users (who clicked send) |
| subject | text | |
| body_html | text | |
| body_text | text | |
| recipients | text[] | |
| status | enum | `draft`, `scheduled`, `sent`, `failed` |
| ai_provider | text | Which provider generated it |
| ai_prompt | text | Original user prompt |
| scheduled_at | timestamptz | nullable |
| sent_at | timestamptz | nullable |
| error_message | text | nullable |
| created_at | timestamptz | |

### `email_templates` (Phase 2)
Reusable templates with variable placeholders. Shared company templates.

**Access control:** RLS allows any authenticated allowlisted user to read/write all rows. This is intentional — it's one company, not isolated tenants. The allowlist middleware is the real gate.

---

## Core User Flows

### 1. Compose with AI
```
User enters prompt → POST /api/ai/generate
  → AI adapter returns { subject, bodyHtml, bodyText }
  → User edits in rich editor
  → Save as draft OR send
```

### 2. Send Email
```
User clicks Send → POST /api/emails/send
  → Validate recipients + SMTP config
  → Nodemailer sends via Namecheap SMTP
  → Insert row in `emails` with status=sent
  → Return success / error to UI
```

### 3. Auth Flow
```
Unauthenticated → redirect to /login
Login (email + password) → Supabase Auth
  → Middleware checks email against ALLOWED_EMAIL_DOMAINS
  → If not allowed: sign out + show "Access denied"
  → If allowed: redirect to /dashboard
No signup route exists. New team members added manually in Supabase dashboard.
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Server-only, for admin tasks

# AI (set the provider you want + its key)
AI_PROVIDER=gemini
GEMINI_API_KEY=
GROQ_API_KEY=
OPENAI_API_KEY=

# SMTP — your company's Namecheap account (shared by everyone)
SMTP_HOST=mail.privateemail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=
SMTP_FROM_EMAIL=

# Access control (private tool)
ALLOWED_EMAIL_DOMAINS=logisol.tech

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Implementation Phases

Approve phases individually. We build sequentially; each phase is deployable.

### Phase 0 — Foundation (≈1 session)
- [ ] Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `nodemailer`, AI SDKs
- [ ] Add `.env.local.example`
- [ ] Set up Supabase project + disable public signups + run initial migration
- [ ] Auth: login only (no signup page), email allowlist in middleware, protected dashboard layout
- [ ] Manually create your admin account in Supabase dashboard

**Deliverable:** You can log in with your company account and see an empty dashboard. Nobody else can register.

---

### Phase 1 — AI Compose + Send (≈2 sessions)
- [ ] Build AI adapter interface + Gemini provider
- [ ] Add Groq provider (second adapter, same interface)
- [ ] Compose page: prompt input → AI generate → editable preview
- [ ] Nodemailer integration with global SMTP env vars
- [ ] `POST /api/emails/send` — send and log to `emails` table
- [ ] History page — list sent/failed emails

**Deliverable:** User can AI-generate an email, edit it, send it, and see it in history.

---

### Phase 2 — Polish (≈1–2 sessions)
- [ ] Settings page: AI provider info, SMTP test-send button (uses env config)
- [ ] Draft saving (status=`draft`)
- [ ] Email templates (shared company templates)
- [ ] Better error handling + toast notifications
- [ ] Responsive mobile layout

**Deliverable:** Polished internal tool; add team members by creating accounts in Supabase.

---

### Phase 3 — Scheduling + OpenAI (≈1 session)
- [ ] Schedule send (Vercel Cron or Supabase `pg_cron`)
- [ ] OpenAI provider adapter
- [ ] Campaign grouping (batch recipients)
- [ ] Basic analytics (open tracking deferred — requires pixel/links)

**Deliverable:** Schedule emails; swap AI provider to OpenAI via env var.

---

## SMTP: Namecheap Setup

Namecheap Private Email uses:

| Setting | Value |
|---------|-------|
| Host | `mail.privateemail.com` |
| Port | `465` (SSL) or `587` (STARTTLS) |
| Auth | Your full email address + password |

We will add a **Test Connection** button in Settings that sends a test email to the logged-in user.

---

## Security Considerations

- **Private by design** — no signup, email allowlist, Supabase signups disabled
- **API keys + SMTP credentials** live only in server env vars — never exposed to the client
- **Vercel Deployment Protection** (optional) — password-gate the whole site in production
- **Rate limiting** on `/api/ai/generate` to prevent accidental overuse of AI quota
- **Input validation** with Zod on all API routes
- **Repo visibility** — keep the GitHub repo private since it contains your app structure

---

## Deployment (Vercel)

1. Push repo to GitHub
2. Import project in Vercel
3. Add all env vars from `.env.local.example`
4. Deploy — API routes and frontend deploy together
5. Set `NEXT_PUBLIC_APP_URL` to production URL
6. Add production URL to Supabase Auth redirect allowlist
7. Enable **Vercel Deployment Protection** (Settings → Deployment Protection) to password-gate the site
8. In Supabase: **Authentication → Providers → Email → disable "Enable sign ups"**

For scheduled sends (Phase 3), add a `vercel.json` cron entry pointing to `/api/emails/process-scheduled`.

---

## Decisions (Confirmed)

| # | Decision | Value |
|---|----------|-------|
| 1 | **Private tool** | No public signup; allowlist only |
| 2 | **Team size** | **4 people** — accounts created manually in Supabase |
| 3 | **Allowed domain** | **`logisol.tech`** |
| 4 | **AI default** | Gemini (free tier) |
| 5 | **Rich text editor** | Textarea first, rich editor in Phase 2 |
| 6 | **Phase scope** | Phases 0 + 1 first, then pause for review |

### Team accounts to create in Supabase

Create 4 email/password accounts in **Supabase → Authentication → Users → Add user**:

- `you@logisol.tech`
- (+ 3 colleagues — add their `@logisol.tech` addresses)

Only `@logisol.tech` emails can log in. Everyone else gets access denied.

---

## Getting Started (After Approval)

```bash
# 1. Clone and install
npm install

# 2. Copy env template and fill in values
cp .env.local.example .env.local

# 3. Run Supabase migration (after project is created)
#    Paste supabase/migrations/001_initial_schema.sql into Supabase SQL editor

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Current State

The repo contains a **Next.js 16 + Tailwind v4 + JavaScript** scaffold. Phase 0 will keep it in JavaScript and replace the default landing page with the auth + dashboard shell.

---

*Say the word and we start Phase 0.*
