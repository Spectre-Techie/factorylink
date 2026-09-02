# FactoryLink

FactoryLink is an offline-first manufacturing coordination platform that connects factories, distributors, technicians, and management through web, USSD, SMS, and voice channels. The system is designed for operational coordination in environments with limited connectivity and device access, making critical workflows resilient even when smartphones and stable internet are unavailable.

## Why FactoryLink

Factory operations often fail not because of lack of information, but because information is fragmented across calls, SMS threads, manual logs, and field visits. FactoryLink aims to unify operational coordination into a simple platform that works in constrained environments while staying practical for a solo developer or small team.

## Core goals

- Give factory managers a single operational view across work orders, technicians, and inventory.
- Support field coordination through low-bandwidth channels such as USSD, SMS, and voice.
- Keep workflows usable even when connectivity is intermittent or unavailable.
- Reduce missed maintenance, delayed parts dispatch, and unclear operational handoffs.
- Provide a lightweight architecture suitable for rapid deployment and hackathon-scale validation.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Node.js
- Express
- Supabase PostgreSQL
- Africa's Talking APIs
- Docker
- GitHub

## Project structure

```text
factorylink/
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── docs/
│   ├── PRD.md
│   ├── MVP.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── AT-INTEGRATION.md
│   ├── MARKETPLACE.md
│   ├── SECURITY.md
│   └── DEVELOPMENT.md
├── app/
│   ├── (dashboard)
│   ├── api/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/
│   └── layout/
├── lib/
│   ├── config/
│   ├── utils/
│   └── validation/
├── server/
│   ├── src/
│   └── src/routes/
├── types/
├── public/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .github/
│   └── workflows/
└── scripts/
```

## Documentation

The project foundation includes the complete strategy and planning baseline in the docs directory:

- [docs/PRD.md](docs/PRD.md)
- [docs/MVP.md](docs/MVP.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DATABASE.md](docs/DATABASE.md)
- [docs/API.md](docs/API.md)
- [docs/AT-INTEGRATION.md](docs/AT-INTEGRATION.md)
- [docs/MARKETPLACE.md](docs/MARKETPLACE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## Current scope

FactoryLink is a deployed operations control center for organization-scoped work orders, inventory visibility, operational insights, distributor rewards, and Africa's Talking SMS, USSD, voice, and airtime workflows.

The frontend is served by Next.js and the API by Express. Supabase PostgreSQL is the persistent data store. Africa's Talking provider calls remain behind the server-side provider adapter.

## Getting started

1. Copy [.env.example](.env.example) to a local `.env` file and fill in values for your environment. Never commit `.env`.
2. Install dependencies:

```bash
npm install
```

3. Run the frontend during development:

```bash
npm run dev
```

4. Run the API server in a separate terminal:

```bash
npm run dev:server
```

## Production environment

The frontend requires:

- `NODE_ENV=production`
- `NEXT_PUBLIC_API_BASE_URL`: public API origin, for example `https://factorylink-m9ai.onrender.com`

The API requires these values at startup:

- `NODE_ENV=production`
- `PORT` (optional; defaults to `4000`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AT_ENVIRONMENT` (`sandbox` or `production`)
- `AT_USERNAME`
- `AT_API_KEY`

The API also supports these optional or deployment-specific values:

- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `AT_BASE_URL` (defaults to `https://api.africastalking.com`)
- `AT_SENDER_ID` (defaults to `FactoryLink`)
- `AT_VOICE_NUMBER`
- `VOICE_CALLBACK_URL`
- `CORS_ORIGIN`

Store all credentials in Render environment secrets or another secret manager.

## Database setup

Use the versioned SQL files in `server/sql/` against the target Supabase project, in order. The current repository contains the inventory/auth foundation, airtime rewards, and inbound SMS migrations. Confirm the target schema before applying a migration and record which migrations have been applied.

## Docker deployment

Build the two production images from the repository root:

```bash
docker build -f docker/Dockerfile -t factorylink-web .
docker build -f docker/Dockerfile.api -t factorylink-api .
```

Run the web image with `NEXT_PUBLIC_API_BASE_URL` and the API image with the required server environment variables. The web container listens on `PORT` 3000 by default; the API container listens on `PORT` 4000 by default. Both images use production artifacts and do not start development watchers.

The local compose definition is `docker/docker-compose.yml`. It expects API secrets from the shell or an external environment file; it does not contain credentials.

## Render deployment

The Render Blueprint defines two services:

- `factorylink-web`: `npm ci && npm run build`, then `npm start`
- `factorylink-api`: `npm ci && npm run build:server`, then `node dist/server/src/index.js`, with `/health` as its health check

Configure the Blueprint's repository, production branch, root directory, and auto-deploy settings in the Render dashboard. Set the frontend `NEXT_PUBLIC_API_BASE_URL` to the public API URL and set `CORS_ORIGIN` on the API to the public frontend URL.

## Africa's Talking callbacks and Sandbox

Configure these public callbacks in the Africa's Talking portal:

- Incoming SMS: `https://factorylink-m9ai.onrender.com/api/africastalking/sms`
- USSD: `https://factorylink-m9ai.onrender.com/api/africastalking/ussd`
- Voice: `https://factorylink-m9ai.onrender.com/api/africastalking/voice`

The inbound SMS endpoint accepts the Africa's Talking callback fields `date`, `from`, `id`, `linkId`, `text`, `to`, and `cost`. It persists inbound messages in `public.sms_messages` and deduplicates by provider message ID.

The development-only outbound Sandbox smoke endpoint is:

```text
POST /dev/at/sandbox/sms-test
```

It accepts JSON with `recipient`, `message`, and optional `senderId`. Use a public Render API URL for provider callbacks; localhost is not reachable by Africa's Talking.

## Supported workflows

- SMS: outbound notifications and inbound callback persistence
- USSD: order placement, My Orders, Check Stock, Report Sales, Help, and invalid-input handling
- Voice: technician call initiation and callback/DTMF handling
- Airtime: sales-report eligibility, reward tiers, provider dispatch, and sent/failed status tracking
- Operational Insights: FactoryLink's internal organization-scoped analytics layer, not the Africa's Talking Insights API

## Production considerations

- Apply Supabase migrations before enabling persistence-dependent callbacks.
- Use HTTPS public callback URLs.
- Keep service-role and Africa's Talking keys server-side only.
- Verify Render deployment commit and health after every release.
- Test organization isolation and role authorization with approved accounts.
- Keep Sandbox and production Africa's Talking credentials separated.

## Security notice

- Secrets must never be committed to source control.
- Use environment variables for all credentials.
- Keep provider details abstracted behind service interfaces.
- Validate all incoming payloads before use.

## License

This project is intended for prototype, hackathon, and portfolio use unless otherwise specified by the project owner.

## Status

Functional and UI baseline complete; production packaging and marketplace preparation are documented, with marketplace submission metadata still requiring manual completion.
