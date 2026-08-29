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

## 7. Marketplace readiness

To support a marketplace-style deployment or portfolio showcase, the project should present:

- clear setup instructions;
- clean documentation structure;
- environment variable examples;
- simple deployment entry points;
- good separation between app configuration and platform-specific values.

## 8. Limitations

This foundation does not include a full production-grade marketplace or commercial deployment pipeline. It focuses on the minimal operational assumptions needed for a realistic pilot deployment.
