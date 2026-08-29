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

This repository currently contains the project foundation, configuration, and documentation required to begin implementation. Database schema creation, real Africa's Talking integrations, and business logic implementation are intentionally not included yet.

## Getting started

1. Copy [.env.example](.env.example) to a local `.env` file and fill in values for your environment.
2. Install dependencies:

```bash
npm install
```

3. Run the development setup:

```bash
npm run dev
```

4. Run the backend server in a separate terminal:

```bash
npm run dev:server
```

## Security notice

- Secrets must never be committed to source control.
- Use environment variables for all credentials.
- Keep provider details abstracted behind service interfaces.
- Validate all incoming payloads before use.

## License

This project is intended for prototype, hackathon, and portfolio use unless otherwise specified by the project owner.

## Status

Foundation and documentation setup complete.
