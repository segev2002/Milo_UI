# Milo Console

Sigal's front end for **Milo**, the agency's assistant. It is a *client* of the
existing API and nothing more: one screen to see what he has been handling, and
one to ask him anything about the book.

Milo's backend lives in `../Milo_Agent` and is **not touched** by this app. No
business logic here, no second permission model, no re-wording of his answers.

```bash
npm install
npm run dev          # http://localhost:5173
```

## Signing in

The first page is **sign in with Google**, and nothing else is reachable without
a token. Google proves who someone is; it cannot know whether they have anything
to do with this agency, so the server still has to recognise the address —
`milo.identities.google_email`, the same Section 4.1 allowlist everything else
goes through. An address nobody added is refused, and told to ask Sigal.

What comes back is an ordinary Milo JWT. Google is not the session: it is
checked once, at the door.

```bash
cd ../Milo_Agent
uvicorn api.main:app --reload      # GOOGLE_CLIENT_ID must be set in its .env
```

The client id is fetched from `GET /auth/config` rather than baked into the
bundle, so the console can be rebuilt without it and a changed id is a server
setting. Vite proxies `/agent`, `/auth` and `/health` to `MILO_API_URL`
(`http://localhost:8000` by default) — leave **API base URL** empty in
development, and put the API's origin there for a deployed one.

**Signing in with a token instead.** The sign-in page keeps a second path, for a
developer with no Google account on the box and for the day Google is
unreachable:

```bash
python -m scripts.seed_identities --dev
python -m scripts.issue_token --subject dev:sigal
```

Paste it under "כניסה עם טוקן". `VITE_MILO_TOKEN` in `.env` still works too, and
a token saved in the browser takes precedence over the environment.

A session lasts `GOOGLE_SESSION_TTL_SECONDS` (12 hours by default). Any 401
clears the token and drops back to this page, rather than leaving every screen
quietly failing.

## What each screen is

| Screen | What it shows |
|---|---|
| **Overview** | Requests handled today / this week, how many are waiting on Sigal, median reply time, 14-day volume, and the split by the intent Milo routed to. |
| **Ask Milo** | The chat. Free text plus an optional client reference; his structured `report` is rendered as sections, tables and the missing / waiting / withheld lines. |
| **What he can do** | The ten spec scenarios plus the conversational extras, each runnable with a forced intent. |
| **Request log** | Every turn this console sent — filterable, exportable as CSV. |
| **Connection** | The token and API base URL, environment, `/health`, whether the integrations are mocked, and the switch between the live API and sample data. |
| **Sign in** | Google sign-in, before any of the above. Signing out from the sidebar clears the token and returns here. |

## Hosting

Deployed at **https://app.milo-agent-sigal.com** — S3 behind CloudFront, in the
same AWS account as Milo (`031476618869`, `eu-north-1`).

```bash
npm run deploy          # build, upload, invalidate
./deploy.sh --no-build  # publish whatever is already in dist/
```

| | |
|---|---|
| Bucket | `milo-ui` — **private**, Block Public Access fully on |
| Distribution | `EZ8CULA3OUM6A` → `d1i0i1ov8tcr1q.cloudfront.net` |
| Certificate | ACM `us-east-1` (CloudFront will not use an `eu-north-1` cert) |
| DNS | Route 53 zone `milo-agent-sigal.com`, A + AAAA alias |

**One origin is the whole point.** CloudFront serves `/` from S3 and forwards
`/agent/*` and `/health` to the ALB, so the browser sees a single origin:

```
app.milo-agent-sigal.com/            → S3 milo-ui  (private, via OAC)
app.milo-agent-sigal.com/agent/*     → milo-alb :443  (no caching, all methods)
app.milo-agent-sigal.com/health      → milo-alb :443  (no caching)
```

The API has **no CORS middleware**, so a console served from any other origin
would have every `/agent/turn` call blocked by the browser and would work in
sample-data mode only. Routing both through one distribution is what avoids
that without touching the backend. Leave **API base URL** empty in the
Connection screen — a relative path is what keeps it same-origin.

Two details that are load-bearing:

* The API origin is `milo-agent-sigal.com`, not `milo-alb-….elb.amazonaws.com`.
  The origin connection is HTTPS and the ALB's certificate is issued for the
  domain, so pointing at the load balancer's own hostname fails TLS validation.
* `/agent/*` uses the `AllViewerExceptHostHeader` origin request policy, which
  is what forwards the `Authorization` header while letting CloudFront set
  `Host` to the origin. Caching is disabled on both API behaviours — a cached
  `POST /agent/turn` would be a correctness bug, not an optimisation.

Assets carry `max-age=31536000,immutable` because their filenames are hashed;
`index.html` is `no-cache`, since it is the file that names the new hashes.

## Where the numbers come from

The console keeps its own ledger in the browser: one row per turn it sends, with
the intent, the duration, and the counts of missing / awaiting / withheld items.
That is the honest limit of what it can count today.

Milo also serves WhatsApp and runs his scheduled jobs — the 07:00 digest, the
08:00 birthdays, the weekly sweeps. That volume is in his own tables
(`milo.conversations`, `milo.messages`, `milo.job_runs`) and **no endpoint
exposes it**, so the Overview does not include it rather than estimating it. A
read-only stats endpoint on the backend would fill the gap; that is a backend
change and was deliberately left alone.

## API surface used

Everything the console does goes through five endpoints:

- `GET /auth/config` — the Google client id, or that sign-in is off.
- `POST /auth/google` — a Google ID token in, a Milo token out. 401 if Google
  did not sign it for us, 403 if the address is not on the allowlist.
- `POST /agent/turn` — one turn, optionally with a forced `intent` and a client
  reference (`client_crm_id`, `client_id_number`, `client_name`).
- `GET /agent/whoami` — who the token authorizes.
- `GET /health` — environment, timezone, dry-run and mock flags.

`src/types.ts` mirrors `api/routes/agent.py` and `core/formatting.py::Report`.
If those change, that file is the only place to follow.

## Stack

Vite · React 19 · TypeScript (strict) · Tailwind v4 · Recharts.

Palette: **Emerald Ink** `#064E3B` and **Champagne** `#F8E7C9`, defined once as
theme tokens in `src/index.css`.
