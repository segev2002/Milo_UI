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

## Pointing it at Milo

There is no sign-in screen: the console opens straight onto the Overview. With
no token anywhere it starts on **sample data** (it calls nothing, and says so on
every screen). To talk to the real Milo, go to **Connection**, paste a token and
save:

```bash
cd ../Milo_Agent
python -m scripts.seed_identities --dev
python -m scripts.issue_token --subject dev:sigal
uvicorn api.main:app --reload
```

Leave **API base URL** empty in development — Vite proxies `/agent` and
`/health` to `MILO_API_URL` (`http://localhost:8000` by default). For a deployed
API, put its origin in that field.

Both values can also come from the environment, so a dev checkout opens live:

```ini
VITE_MILO_TOKEN=eyJhbGciOi…
VITE_MILO_API_URL=
```

A token saved in the browser takes precedence over the environment. Tokens are
short-lived by design (`security/jwt_service.py`), so expect to reissue.

## What each screen is

| Screen | What it shows |
|---|---|
| **Overview** | Requests handled today / this week, how many are waiting on Sigal, median reply time, 14-day volume, and the split by the intent Milo routed to. |
| **Ask Milo** | The chat. Free text plus an optional client reference; his structured `report` is rendered as sections, tables and the missing / waiting / withheld lines. |
| **What he can do** | The ten spec scenarios plus the conversational extras, each runnable with a forced intent. |
| **Request log** | Every turn this console sent — filterable, exportable as CSV. |
| **Connection** | The token and API base URL, environment, `/health`, whether the integrations are mocked, and the switch between the live API and sample data. |

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

Everything the console does goes through three endpoints:

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
