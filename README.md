# OutreachOS

Multi-tenant AI outreach platform. Teams sign up, create a workspace, connect their own SMTP, import leads, generate personalized emails with platform AI, and send at a controlled rate.

## Features

- Public signup + login
- Workspaces with owner/member roles and invite links
- Per-workspace SMTP (encrypted password storage)
- Platform-managed AI (Groq / Gemini / OpenAI)
- Compose, campaigns, lead import (website + SMM), templates, AI instructions, history
- Vercel cron for scheduled sends and lead queues

## Setup

1. Create a Supabase project and enable Email auth (turn on public signups).
2. Run SQL migrations in order from `supabase/migrations/` (through `009_require_smtp_onboarding.sql`).
3. Copy `.env.local.example` to `.env.local` and fill values.
4. Generate an encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Install and run:

```bash
npm install
npm run dev
```

6. Open `http://localhost:3000/signup` and create your first workspace.

## Onboarding

1. Sign up with name, email, password, and workspace name.
2. Set sender identity + signature.
3. Add SMTP host/port/user/password and send a test email.
4. Finish setup to unlock the dashboard.

## SMTP notes

- Prefer mailbox credentials (e.g. `you@domain.com`), not hosting panel passwords.
- Common shared hosting: host `mail.yourdomain.com`, port `587`.
- If certificate hostname mismatches, enable “Allow mismatched TLS certificates” in Settings.

## Security

- SMTP passwords are encrypted with `CREDENTIALS_ENCRYPTION_KEY` (AES-256-GCM).
- Never returned to the client after save.
- Row Level Security scopes all data by workspace membership.
- Cron uses `CRON_SECRET` and the service role, resolving each workspace’s SMTP independently.

## Deploy

- Deploy to Vercel.
- Set all env vars in the project settings.
- Ensure `vercel.json` cron hits `/api/emails/process-scheduled` every minute.
- Add Supabase auth redirect URLs for your production domain.

## Stripe (later)

Plan/quota fields exist on workspaces (`plan`, `sends_per_hour`) for a future billing phase. Not wired yet.
