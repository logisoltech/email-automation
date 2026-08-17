# OutreachOS

Multi-tenant AI outreach platform. Teams sign up, create a workspace, connect delivery (own SMTP or platform domain verify via Amazon SES), import leads, generate personalized emails with platform AI, and send at a controlled rate.

## Features

- Public signup + login
- Workspaces with owner/member roles and invite links
- Dual delivery: per-workspace SMTP **or** platform send (Amazon SES) after domain DNS verification
- Platform-managed AI (Groq / Gemini / OpenAI)
- Compose, campaigns, lead import (website + SMM), templates, AI instructions, history
- Vercel cron for scheduled sends and lead queues

## Setup

1. Create a Supabase project and enable Email auth (turn on public signups).
2. Run SQL migrations in order from `supabase/migrations/` (through `018_hubspot_integrations.sql`).
3. Copy env vars into `.env.local` (include AWS SES credentials for platform delivery; optional HubSpot OAuth keys).
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
3. Choose delivery:
   - **Own SMTP** — host/port/user/password + test email, or
   - **Our server** — register domain in Amazon SES, add DKIM CNAME records, verify, finish.
4. Finish setup to unlock the dashboard.

## SMTP notes

- Prefer mailbox credentials (e.g. `you@domain.com`), not hosting panel passwords.
- Common shared hosting: host `mail.yourdomain.com`, port `587`.
- If certificate hostname mismatches, enable “Allow mismatched TLS certificates” in Settings.

## Platform delivery (Amazon SES)

1. Create an IAM user with SES send + identity permissions (e.g. `ses:SendEmail`, `ses:SendRawEmail`, `ses:CreateEmailIdentity`, `ses:GetEmailIdentity`).
2. Set in env:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (same region as your SES identities, e.g. `us-east-1`)
3. In AWS SES console, leave the sandbox or request **production access** so you can send to any recipient.
4. Users add the CNAME records returned by OutreachOS for their domain, then verify.

## HubSpot (optional)

1. Create a HubSpot public app with redirect URI  
   `{APP_URL}/api/integrations/hubspot/callback`  
   and scopes: `oauth`, `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.schemas.contacts.read`, `crm.schemas.contacts.write`.
2. Set env:
   - `HUBSPOT_CLIENT_ID`
   - `HUBSPOT_CLIENT_SECRET`
   - `HUBSPOT_REDIRECT_URI` (optional; defaults from `NEXT_PUBLIC_APP_URL`)
3. Workspace owners connect under **Integrations**.
4. Import contacts from **Leads → From HubSpot**. Linked contacts get outreach status pushed on send/open (`bulkly_outreach_status`).

## Zoho CRM (optional)

1. Create a **Server-based** client at [Zoho API Console](https://api-console.zoho.com/).
2. Redirect URI: `{APP_URL}/api/integrations/zoho/callback`
3. Scopes used by the app:  
   `ZohoCRM.modules.contacts.READ`, `ZohoCRM.modules.contacts.WRITE`,  
   `ZohoCRM.settings.fields.READ`, `ZohoCRM.settings.fields.CREATE`,  
   `ZohoCRM.org.READ`
4. Set env:
   - `ZOHO_CLIENT_ID`
   - `ZOHO_CLIENT_SECRET`
   - `ZOHO_REDIRECT_URI` (optional)
   - `ZOHO_ACCOUNTS_URL` if not US (e.g. `https://accounts.zoho.eu`)
5. Connect under **Integrations**, then import from **Leads → From Zoho**.  
   Status sync writes `Bulkly_Outreach_Status` on the Contact.

## Salesforce (optional)

1. In Salesforce Setup, create a **Connected App** (Enable OAuth Settings).
2. Callback URL: `{APP_URL}/api/integrations/salesforce/callback`
3. Selected OAuth scopes: `Full access (api)`, `Perform requests at any time (refresh_token, offline_access)`.
4. After save, copy **Consumer Key** / **Consumer Secret** (may need “Manage Consumer Details”).
5. Set env:
   - `SALESFORCE_CLIENT_ID` (Consumer Key)
   - `SALESFORCE_CLIENT_SECRET` (Consumer Secret)
   - `SALESFORCE_REDIRECT_URI` (optional; defaults from `NEXT_PUBLIC_APP_URL`)
   - `SALESFORCE_LOGIN_URL` for sandbox (`https://test.salesforce.com`) — production defaults to `https://login.salesforce.com`
6. Run migration `020_salesforce_import_source.sql` if you use import runs.
7. Connect under **Integrations**, then import from **Leads → From Salesforce**.  
   Status sync writes `Bulkly_Outreach_Status__c` on the Contact (created via Tooling API when possible).

## Security

- SMTP passwords and CRM tokens are encrypted with `CREDENTIALS_ENCRYPTION_KEY` (AES-256-GCM).
- Never returned to the client after save.
- Row Level Security scopes all data by workspace membership.
- Cron uses `CRON_SECRET` and the service role, resolving each workspace’s SMTP independently.

## Deploy

- Deploy to Vercel.
- Set all env vars in the project settings.
- Hobby does not support Vercel Cron. Ping `GET /api/emails/process-scheduled` with `Authorization: Bearer CRON_SECRET` from an external scheduler (Google Apps Script, cron-job.org, etc.).
- Add Supabase auth redirect URLs for your production domain.

## Stripe (later)

Plan/quota fields exist on workspaces (`plan`, `sends_per_hour`) for a future billing phase. Not wired yet.
