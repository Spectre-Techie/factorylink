# Development Guide

## 1. Development workflow

The project will use a simple, maintainable workflow suitable for a solo developer or small team.

- work on a feature branch for each change set;
- keep commits atomic and descriptive;
- validate type safety and project health regularly;
- avoid broad refactors before the foundation is stable.

## 2. Branch strategy

Recommended branch structure:

- main: stable project baseline;
- develop: integration branch when team work is active;
- feature/*: feature work;
- hotfix/*: urgent fixes.

## 3. Commit conventions

Use concise commit messages that describe the purpose of the change, for example:

- init: project foundation and docs
- docs: add PRD and MVP planning
- config: add TypeScript and environment setup
- chore: add project structure and ignore rules

## 4. Testing expectations

This project is in foundation mode. The expected validation includes:

- TypeScript compilation checks;
- project configuration sanity checks;
- documentation completeness review;
- no production secret exposure.

Real business endpoint tests and provider integration tests are not required at this stage.

## 5. Coding-agent rules

When working on this project, the agent must:

- respect the architecture and avoid unnecessary feature work;
- not implement business logic beyond the defined foundation;
- not add credentials, secrets, or provider keys;
- not create database migrations or schema changes without explicit instruction;
- keep configuration centralized;
- use TypeScript strict mode and avoid unnecessary `any` usage;
- keep documentation aligned with actual implementation status.

## 6. Implementation policy

The repository is the source of truth. All future work must stay aligned with the shipped requirements and must not invent new product scope beyond the documented foundation.
