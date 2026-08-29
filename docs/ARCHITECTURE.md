# Architecture

## 1. Overview

FactoryLink uses a simple, production-minded architecture built for a solo developer and a hackathon deployment. It avoids unnecessary fragmentation and keeps the system straightforward to reason about, operate, and extend.

The architecture combines:

- Next.js for the user-facing web application;
- Express for backend APIs and channel handlers;
- Supabase PostgreSQL for persistence;
- Africa's Talking as a provider-facing communication layer;
- Docker for repeatable deployment assumptions.

## 2. High-level components

### Frontend

The frontend is a Next.js application responsible for:

- dashboard views for managers and operations staff;
- work order and assignment interfaces;
- viewing operational summaries and status reports;
- authentication-aware UI flows.

### Backend

The backend is an Express service responsible for:

- REST API routes;
- provider integration adapters;
- webhook ingestion; 
- validation and request handling;
- orchestration of operational workflows.

### Database

Supabase PostgreSQL is the system of record for:

- users and roles;
- work orders;
- technician assignments;
- notifications and events;
- inventory and fulfillment lifecycle information.

### Africa's Talking layer

This is a provider abstraction layer that isolates all SMS, USSD, voice, and airtime interactions. It centralizes configuration and request structure so provider credentials can be added later without contaminating business logic.

## 3. Authentication strategy

The system should use a clear, simple authentication model:

- session-based or token-based authentication for web dashboard users;
- role-based authorization for managers, operations users, and support users;
- strict validation on protected routes;
- unique secrets in environment variables only.

The implementation will keep this layer decoupled from business logic so it can evolve without heavy framework changes.

## 4. Deployment architecture

### Local development

- Next.js runs on a local port for the web interface.
- Express runs as an API service on a separate port.
- Supabase is connected through environment-configured database connection strings.
- Docker can be used for repeatable local environment setup.

### Production-minded deployment model

- Containerized runtime using Docker.
- A single application environment containing web and API services where appropriate.
- Infrastructure remains simple and does not introduce microservices.
- Environment values are loaded from `.env` or deployment secret management.

## 5. Configuration model

All runtime configuration should come from environment variables, centralized through a single configuration module. This includes:

- app port and environment;
- Supabase configuration;
- Africa's Talking credentials;
- secrets and signing values;
- operational logging level.

This approach keeps secrets out of source control and reduces drift between development and deployment.

## 6. Error handling

The system should follow consistent error handling patterns:

- validation failures return clear API messages;
- provider failures are isolated behind service interfaces;
- internal errors are logged without exposing sensitive details;
- retries and fallback behavior remain deliberately simple.

## 7. High-level data flow

1. A user or system event creates or updates a work order.
2. The API validates the payload and persists the record.
3. Domain logic determines whether notifications or assignments are required.
4. A provider adapter calls Africa's Talking for SMS, USSD, or voice actions.
5. Responses are logged and used to update operational state.
6. The dashboard reflects the resulting status changes.

## 8. Architectural constraints

This project must not:

- introduce microservices;
- replace Express with another backend framework;
- replace Next.js with another frontend framework;
- add MongoDB, Firebase, Prisma, or similar alternatives;
- create unnecessary infrastructure or duplication.

The goal is a maintainable, understandable implementation that is appropriate for a solo developer and a short deployment cycle.
