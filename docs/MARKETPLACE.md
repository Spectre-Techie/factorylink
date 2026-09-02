# Marketplace and Deployment Readiness

## 1. Product positioning

**Product name:** FactoryLink

**Core positioning:** Offline-first manufacturing coordination for Africa.

**One-line description:** FactoryLink connects factories, operations teams, technicians, and distributors through SMS, USSD, voice, and airtime incentives for work in connectivity-constrained environments.

FactoryLink is an operations coordination platform for factories, operations teams, technicians, and distributors. It combines a web dashboard with communication channels that remain useful when smartphones, continuous data access, or stable connectivity are not available. Africa's Talking provides the communication and airtime delivery layer; FactoryLink provides the workflow, persistence, authorization, and internal analytics layer.

### Marketplace copy

**Short description:**

FactoryLink helps African manufacturing teams coordinate work orders, inventory, technicians, distributor sales, and rewards through a web dashboard plus SMS, USSD, and voice workflows.

**Full description:**

FactoryLink is an offline-first manufacturing coordination platform for factories operating across mixed-connectivity environments. Managers and operations teams use the dashboard to review work orders, technician assignments, inventory risk, distributor activity, rewards, and FactoryLink's internal operational analytics. Technicians and distributors can use practical communication channels where a full web experience is unavailable: SMS notifications and callbacks, USSD ordering and reporting, and voice-based technician work-order interaction. Airtime incentives support eligible distributor sales rewards. The application uses Supabase PostgreSQL for persistence and Africa's Talking for supported communications and airtime provider operations. Provider-account configuration, live handset checks, and marketplace assets remain deployment responsibilities and are identified explicitly in this document.

**Key capabilities:**

- organization-scoped work orders and technician coordination;
- inventory visibility, low-stock alerts, and operational risk signals;
- USSD order placement, order history, stock checks, sales reporting, Help, and invalid-input handling;
- outbound and inbound SMS workflows, including shortcode `3979` Sandbox evidence;
- voice technician call initiation and callback digit interaction;
- eligible distributor reward calculation, airtime fulfillment, provider reference recording, and sent/failed status tracking;
- FactoryLink internal operational analytics, not the Africa's Talking Insights API.

**Target users:** Factory managers, operations teams, maintenance technicians, distributors, and deployment administrators.

**Why Africa's Talking matters:** Africa's Talking supplies the SMS, USSD, voice, and airtime channels that extend FactoryLink beyond smartphone-only workflows. These channels are central to the product's constrained-connectivity use case; FactoryLink does not claim that Africa's Talking provides its internal operational analytics.

**Deployment description:** Deploy the Next.js web service and Express API as separate production services. Configure environment variables through Render or another secret manager, connect the API to Supabase PostgreSQL, expose the documented AT callback URLs, and use the documented Docker or Render commands. See the README and integration documentation for the exact configuration contract.

**Pricing-plan wording:** Pricing is not defined in this repository. Marketplace pricing must be supplied manually; do not infer a free, paid, usage-based, or Africa's Talking charge from the implementation.

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
| Product slug | MISSING | Choose and register marketplace slug. |
| Short description | READY | Marketplace-ready short description is drafted in Section 1. |
| Full description | READY | Marketplace-ready full description is drafted in Section 1. |
| Category | PARTIAL | Manufacturing/operations is supported by the product scope; marketplace category selection is not registered. |
| Industry | MISSING | Supply the marketplace industry classification. |
| Pricing | MISSING | Define and publish pricing. |
| Logo | MISSING | Supply a marketplace logo asset. |
| Product screenshots | MISSING | Capture real product screenshots; no submission set is committed. |
| Demo/public URL | READY | `https://factorylink-web.onrender.com/` served HTTP 200 during Phase 11 verification. |
| Database requirements | READY | Supabase PostgreSQL and ordered SQL migrations are documented. |
| Docker image | READY | Web and API Dockerfiles, production commands, and Phase 11 images exist. |
| Container registry requirements | MISSING | No registry repository, image namespace, or publication instructions are recorded. |
| Environment variables | READY | Exact runtime variables are documented in the README and AT integration guide. |
| Deployment instructions | READY | Local, Docker, Compose, Supabase, and Render instructions are documented. |
| Callback URLs | PARTIAL | Application callback URLs are implemented and documented; AT portal configuration is externally unverified. |
| API documentation | READY | API routes and callback contracts are documented in `docs/API.md` and `docs/AT-INTEGRATION.md`. |
| Privacy Policy | MISSING | Publish a product-specific privacy policy. |
| Terms of Service | MISSING | Publish product-specific terms of service. |
| Support contact | MISSING | Provide a monitored support email or contact channel. |
| Support documentation | READY | Setup, operational limitations, security, API, and integration support guidance are documented; add the final support contact when supplied. |

## 8. Visual submission assets

Submit real screenshots from the deployed application, with sensitive data redacted:

- Overview dashboard showing operational summary and attention items;
- Work Orders view showing assignment/status context;
- Inventory view showing stock and risk information;
- Operational Insights view showing FactoryLink internal analytics;
- Distributor Rewards view showing an eligible reward and sent status where available;
- SMS/USSD evidence, using redacted real Sandbox evidence or documented callback/result captures where marketplace rules permit.

Do not create illustrative or fake screenshots. Record the URL, environment, and data-redaction status for each submitted image.

## 9. Final demo narrative

Use this 3–5 minute judge-focused sequence with a prepared account and redacted demonstration data:

| Step | Show | Say | Proves |
|---|---|---|---|
| 1. Manager login | Sign in to the dashboard. | FactoryLink gives authorized users an organization-scoped operations workspace. | Authentication and role-aware access. |
| 2. Operations overview | Summary metrics and attention items. | The manager can see the operational state before opening individual records. | Consolidated operational view. |
| 3. Work order | Open a work order, assignment, and status. | A work order can move from operational need to technician coordination. | Work-order workflow. |
| 4. Technician coordination | Assignment and voice/SMS coordination context. | Technicians can be reached through channels suited to field conditions; live handset availability depends on the AT account. | Technician coordination and provider boundary. |
| 5. Inventory/risk | Inventory quantities, thresholds, and alerts. | Operations can connect stock risk to active work instead of relying on separate manual logs. | Inventory visibility and risk handling. |
| 6. SMS/USSD interaction | Redacted verified callback or Sandbox evidence. | SMS and USSD extend the workflow beyond the dashboard, including inbound messages and low-bandwidth menus. | AT SMS/USSD integration. |
| 7. Distributor sales report | USSD sales-report result or dashboard record. | A distributor can report sales through the supported flow. | Sales reporting and validation. |
| 8. Airtime reward | Reward record with provider reference and sent status. | Eligible distributor activity can result in a recorded airtime reward. | Reward fulfillment and audit trail. |
| 9. Operational Insights | Insights view. | These are FactoryLink's internal analytics, not the Africa's Talking Insights API. | Internal operational analytics. |

## 10. Final submission checklist

### READY NOW

- Product name and positioning copy;
- short and full descriptions;
- application architecture and API documentation;
- environment-variable contract;
- Supabase, Docker, Compose, and Render deployment guidance;
- public web and API URLs;
- implemented and repository-tested workflows;
- verified SMS Sandbox/inbound persistence evidence;
- verified airtime reward sent/reference evidence;
- verified USSD flow coverage.

### NEEDS MANUAL ACTION

- Select slug, category, industry, and pricing;
- supply logo and real product screenshots;
- publish Docker images to a container registry if required;
- configure and evidence AT portal callback URLs;
- provide Privacy Policy, Terms of Service, and support contact;
- perform any remaining live Sandbox or production account checks.

### BLOCKED BY EXTERNAL AT LIMITATION

- Live voice handset verification remains blocked if the AT account/platform does not provide a provisioned voice number or usable live callback path.

## 11. Limitations

This foundation does not include a full production-grade marketplace or commercial deployment pipeline. It focuses on the minimal operational assumptions needed for a realistic pilot deployment.
