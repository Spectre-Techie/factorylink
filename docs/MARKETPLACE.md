# Marketplace and Deployment Readiness

## 1. Purpose

This document defines the operational deployment assumptions for FactoryLink as a practical product foundation. It is intended to support a hackathon, pilot, or reusable-instance deployment without creating unnecessary infrastructure complexity.

## 2. Container requirements

Docker should be used for a reproducible environment and simplified deployment. Recommended requirements:

- one application container for the Next.js frontend;
- one application container for the Express API;
- optional database container or Supabase-managed PostgreSQL service;
- a local or hosted environment-specific configuration layer.

## 3. Environment variables

A complete environment configuration should include:

- application runtime settings;
- frontend public variables;
- backend service settings;
- Supabase configuration;
- Africa's Talking credentials;
- token and signing secrets;
- operational logging configuration.

These values must be loaded from environment files or deployment secret management and never stored in source control.

## 4. Deployment assumptions

- A single deployment environment is sufficient for the MVP.
- The application is designed around a simple, maintainable runtime.
- Database access is through a managed PostgreSQL service or a local containerized PostgreSQL deployment.
- Secrets are managed outside version control.
- The product should be deployable with minimal operational overhead.

## 5. Reusable-instance requirements

The application should support reusable deployment patterns where an instance can be redeployed or cloned with a fresh environment configuration. This requires:

- centralized env management;
- no hardcoded production credentials;
- no embedded secrets in build artifacts;
- container-friendly defaults and documented runtime assumptions.

## 6. Health checks

The deployment setup should define basic health endpoints or container readiness checks to ensure the app is able to answer requests. Recommended checks include:

- application status endpoint;
- database connectivity status;
- provider connectivity readiness checks where appropriate;
- graceful startup and shutdown handling.

## 7. Marketplace readiness matrix

The following matrix records repository evidence only. `READY` means the item is documented or verifiable in this repository; it does not mean a third-party marketplace submission has been completed.

| Requirement | Status | Evidence or remaining action |
|---|---|---|
| Product name | READY | FactoryLink is the application name in the README and server configuration. |
| Slug | MISSING | Choose and register marketplace slug. |
| Description | READY | Product description and scope are documented in the README. |
| Category | PARTIAL | Manufacturing is implied by the product scope; no marketplace category metadata is registered. |
| Industry | MISSING | Supply the marketplace industry classification. |
| Pricing | MISSING | Define and publish pricing. |
| Logo | MISSING | Supply a marketplace logo asset. |
| Environment variables | READY | Required and optional variables are listed in the README and `.env.example`. |
| Database requirements | READY | Supabase PostgreSQL and ordered SQL migrations are documented. |
| Docker image | READY | Web and API Dockerfiles, production commands, and Phase 11 images exist. |
| Deployment URL | READY | Web and API Render URLs are documented and returned HTTP 200 during Phase 11 verification. |
| Callbacks | PARTIAL | AT callback paths are documented; provider portal configuration and live callback delivery remain manual. |
| Documentation | READY | README and `docs/` contain architecture, setup, security, API, deployment, and integration guidance. |
| Privacy Policy | MISSING | Publish a product-specific privacy policy. |
| Terms of Service | MISSING | Publish product-specific terms of service. |
| Support contact | MISSING | Provide a monitored support email or contact channel. |
| Deployment instructions | READY | Local, Docker, Compose, Supabase, and Render instructions are documented. |

## 8. Limitations

This foundation does not include a full production-grade marketplace or commercial deployment pipeline. It focuses on the minimal operational assumptions needed for a realistic pilot deployment.
