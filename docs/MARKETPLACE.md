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

## 2. Hackathon submission copy

### Short Description

FactoryLink is offline-first manufacturing coordination for Africa. It helps factories, operations teams, technicians, and distributors coordinate work orders, inventory, sales, and rewards through web, SMS, USSD, and voice workflows.

### Full Solution Description

FactoryLink connects the people who keep manufacturing operations moving: factory managers, operations teams, maintenance technicians, and distributors. The web dashboard provides organization-scoped visibility into work orders, technician assignments, inventory risk, distributor sales, rewards, and FactoryLink's own operational analytics. SMS, USSD, and voice workflows extend coordination to environments where smartphones or continuous data access are not dependable. Africa's Talking supplies the SMS, USSD, voice, and airtime provider services; FactoryLink supplies the workflow, persistence, authorization, and internal analytics. A real AT Sandbox inbound SMS reached FactoryLink and was persisted in Supabase, and a real airtime reward was sent with its provider reference recorded and status set to `sent`.

### Problem Statement

Manufacturing work is often coordinated across phone calls, SMS threads, spreadsheets, manual stock records, and field visits. In constrained-connectivity environments, smartphone-only tools can leave technicians and distributors outside the operational system. FactoryLink brings work orders, inventory risk, field coordination, sales reporting, and distributor rewards into one workflow while retaining channels that work on basic phones and intermittent connectivity.

### Key Features

- organization-scoped work orders, assignment, and status tracking;
- inventory visibility, low-stock alerts, and operational risk signals;
- USSD Place Order, My Orders, Check Stock, Report Sales, Help, and invalid-input/session handling;
- outbound SMS notifications and inbound SMS callbacks using shortcode `3979` evidence;
- technician work-order voice calls, callback handling, and GetDigits interaction;
- distributor reward tiers, Africa's Talking airtime requests, provider references, and sent/failed status;
- FactoryLink internal operational analytics, not the Africa's Talking Insights API.

### User Workflow

1. A manager signs in and reviews the organization-scoped overview.
2. Operations opens or updates a work order and assigns a technician.
3. The technician is coordinated through supported SMS or voice application flows.
4. Operations checks inventory, thresholds, and risk signals.
5. A distributor uses USSD to place orders, check stock, view order history, or report sales.
6. Eligible sales produce a reward request through the airtime provider, with the result and provider reference recorded.
7. Management reviews FactoryLink's internal operational analytics.

### Africa's Talking Products Used

Select only: **SMS API, USSD API, Voice API, Airtime API**.

Do not select Mobile Data, Insights/Application Data & Insight, Bulk SMS, or Premium SMS based on this repository. Operational Insights is FactoryLink's internal analytics layer.

### Africa's Talking Integration Explanation

FactoryLink keeps Africa's Talking calls behind a server-side provider adapter. SMS supports outbound notifications and inbound callbacks; the verified Sandbox shortcode is `3979`, and real AT Sandbox inbound data was persisted in Supabase using the official `from` field and organization-aware sender lookup. USSD supports order placement, stock checks, order history, sales reporting, Help, and invalid input/session handling. Voice supports technician work-order call flow, callbacks, and GetDigits callback interaction; live handset testing remains externally limited where the AT account or platform does not provide the required voice setup. Airtime fulfills eligible distributor rewards, with a successful provider result, provider reference, and `sent` status recorded.

### Technologies Used

Next.js, React, TypeScript, Node.js, Express, Supabase PostgreSQL, Africa's Talking APIs, Docker, Render, and GitHub.

## 3. Submission-form checklist

Status meanings: `READY` is supported by repository evidence; `PARTIAL` is drafted or implemented but needs an external/form step; `MISSING` has no supplied value or artifact; `MANUAL` must be supplied by the submitter.

| Form field | Status | Submission evidence or required action |
|---|---|---|
| Team Name | MANUAL | Supply the team name. No team name is recorded in the repository. |
| Team Leader Email | MANUAL | Supply the team leader email. |
| Team Leader Phone Number | MANUAL | Supply the team leader phone number. |
| Short Description | READY | Final copy is in Section 2. |
| Full Solution Description | READY | Final copy is in Section 2. |
| Problem Statement | READY | Final copy is in Section 2. |
| Key Features | READY | Final list is in Section 2. |
| User Workflow | READY | Final workflow is in Section 2. |
| Africa's Talking Products Used | READY | Select SMS API, USSD API, Voice API, and Airtime API only. |
| Africa's Talking Integration Explanation | READY | Evidence-based copy is in Section 2 and `docs/AT-INTEGRATION.md`. |
| Technologies Used | READY | Final list is in Section 2. |
| Git Repository | READY | `https://github.com/Spectre-Techie/factorylink` |
| Live Application URL | READY | `https://factorylink-web.onrender.com` |
| Demo Video | MANUAL | Record and submit a 3–5 minute demo video. |
| Demo Credentials | MANUAL | Supply a non-production demo account and credentials through the form's secure mechanism. Do not commit them. |
| Docker Image URL | MISSING | Publish the verified images to a container registry and supply public pull URLs. |
| Environment Variables | READY | Exact matrix is in `docs/AT-INTEGRATION.md`; submit values through the form's secure mechanism only. |
| Logo | MISSING | Supply an approved logo asset. |
| Solution Documentation | READY | README, architecture, API, database, security, deployment, and AT documentation exist. |
| Team Declaration | MANUAL | Complete the declaration in the submission form. |

The prompt names 20 form fields but separately requests a 23-section documentation outline. The three additional section names are not provided. They are recorded as unidentified below rather than invented.

## 4. Master solution document

The following are the exact 23 required solution-document sections supplied for Phase 12B. Statuses identify content that is ready versus information that must be supplied manually.

### 1. Solution Name

**READY:** FactoryLink

### 2. Team Name

**WAITING FOR MY INPUT:** Supply the team name.

### 3. Team Members

**WAITING FOR MY INPUT:** Supply team member names and roles.

### 4. Problem Statement

**READY:** Manufacturing coordination is often split across calls, SMS threads, spreadsheets, manual stock records, and field visits. Smartphone-only tools can exclude technicians and distributors in constrained-connectivity environments.

### 5. Solution Overview

**READY:** FactoryLink is offline-first manufacturing coordination for Africa, connecting factories, operations teams, technicians, and distributors through a web dashboard plus SMS, USSD, voice, and airtime workflows.

### 6. Target Users

**READY:** Factory managers, operations teams, maintenance technicians, distributors, and deployment administrators.

### 7. How the Solution Works

**READY:** Managers coordinate work orders and inventory in the dashboard. Technicians receive field coordination through supported SMS or voice flows. Distributors use USSD for ordering, stock checks, order history, and sales reporting. Eligible sales can trigger an airtime reward whose provider result, reference, and status are recorded.

### 8. Key Features

**READY:** Organization-scoped work orders; technician coordination; inventory visibility and low-stock alerts; USSD ordering, stock, orders, sales reporting, Help, and validation; inbound/outbound SMS; voice callbacks and GetDigits interaction; distributor reward calculation and airtime fulfillment; FactoryLink internal analytics.

### 9. User Workflow

**READY:** Manager login -> operations overview -> work order assignment -> technician coordination -> inventory/risk review -> distributor USSD activity -> airtime reward -> internal analytics review.

### 10. Africa's Talking APIs Used

**READY:** Select only SMS API, USSD API, Voice API, and Airtime API. FactoryLink Operational Insights is not the Africa's Talking Insights API.

### 11. How Each API Is Integrated

**READY:** A server-side provider adapter handles SMS, USSD, voice, and airtime requests. Verified evidence includes shortcode `3979`, inbound SMS callback handling using the official `from` field, real AT Sandbox -> FactoryLink -> Supabase persistence, all listed USSD Sandbox flows, voice callback/GetDigits application testing, and successful airtime delivery with provider reference and `sent` status. Live voice handset testing remains externally limited.

### 12. Technologies Used

**READY:** Next.js, React, TypeScript, Node.js, Express, Supabase PostgreSQL, Africa's Talking APIs, Docker, Render, and GitHub.

### 13. System Architecture

**READY:** Next.js frontend and Express API run as separate services. Supabase PostgreSQL provides persistence. Africa's Talking calls remain behind the server-side provider adapter. Render and Docker provide deployment options.

### 14. Database Used

**READY:** Supabase PostgreSQL, initialized with the ordered SQL files in `server/sql/`.

### 15. Deployment Information

**READY:** Render services are defined in `render.yaml`; Docker production artifacts are `docker/Dockerfile` and `docker/Dockerfile.api`. Web runs `npm start` on port 3000; API runs `node dist/server/src/index.js` on port 4000. Environment values are injected externally.

### 16. Live Application URL

**READY:** `https://factorylink-web.onrender.com`

Backend: `https://factorylink-m9ai.onrender.com`
Health: `https://factorylink-m9ai.onrender.com/health`

### 17. Git Repository

**READY:** `https://github.com/Spectre-Techie/factorylink`

### 18. Docker Image

**PARTIAL:** Local Phase 11 images `factorylink-web:phase11` and `factorylink-api:phase11` are built and verified. **MANUAL EXTERNAL ACTION:** publish them to a public registry and supply the public image URL; no URL is invented here.

### 19. Demo Credentials

**WAITING FOR MY INPUT:** Supply a non-production demo account through the form's secure mechanism. Do not commit credentials.

### 20. Future Improvements

**READY:** Complete marketplace metadata, publish registry images, finalize legal/support information, and perform remaining provider-account and live handset checks. These are submission operations, not new product scope.

### 21. Scalability Potential

**READY:** The separate web/API services, organization-scoped service boundaries, provider adapter, and managed PostgreSQL deployment model support reuse across deployments. Scaling limits and production capacity have not been load-tested and should not be claimed.

### 22. Business / Real-World Impact

**READY:** FactoryLink gives manufacturing teams a shared operational view while preserving SMS, USSD, and voice access for field users in constrained-connectivity environments. Airtime rewards provide a recorded incentive path for eligible distributor sales.

### 23. Demo Video Link

**WAITING FOR MY INPUT:** Record the 3–5 minute demonstration and supply its URL.

## 5. Container requirements

Docker should be used for a reproducible environment and simplified deployment. Recommended requirements:

- one application container for the Next.js frontend;
- one application container for the Express API;
- optional database container or Supabase-managed PostgreSQL service;
- a local or hosted environment-specific configuration layer.

## 6. Environment variables

A complete environment configuration should include:

- application runtime settings;
- frontend public variables;
- backend service settings;
- Supabase configuration;
- Africa's Talking credentials;
- token and signing secrets;
- operational logging configuration.

These values must be loaded from environment files or deployment secret management and never stored in source control.

## 7. Deployment assumptions

- A single deployment environment is sufficient for the MVP.
- The application is designed around a simple, maintainable runtime.
- Database access is through a managed PostgreSQL service or a local containerized PostgreSQL deployment.
- Secrets are managed outside version control.
- The product should be deployable with minimal operational overhead.

## 8. Reusable-instance requirements

The application should support reusable deployment patterns where an instance can be redeployed or cloned with a fresh environment configuration. This requires:

- centralized env management;
- no hardcoded production credentials;
- no embedded secrets in build artifacts;
- container-friendly defaults and documented runtime assumptions.

## 9. Health checks

The deployment setup should define basic health endpoints or container readiness checks to ensure the app is able to answer requests. Recommended checks include:

- application status endpoint;
- database connectivity status;
- provider connectivity readiness checks where appropriate;
- graceful startup and shutdown handling.

## 10. Marketplace readiness matrix

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

## 11. Visual submission assets

Submit real screenshots from the deployed application, with sensitive data redacted:

- Overview dashboard showing operational summary and attention items;
- Work Orders view showing assignment/status context;
- Inventory view showing stock and risk information;
- Operational Insights view showing FactoryLink internal analytics;
- Distributor Rewards view showing an eligible reward and sent status where available;
- SMS/USSD evidence, using redacted real Sandbox evidence or documented callback/result captures where marketplace rules permit.

Do not create illustrative or fake screenshots. Record the URL, environment, and data-redaction status for each submitted image.

## 12. Final demo narrative

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

## 13. Final submission checklist

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

## 14. Deployment and callback audit

| Item | Status | Verified value |
|---|---|---|
| Frontend | READY | `https://factorylink-web.onrender.com` |
| Backend | READY | `https://factorylink-m9ai.onrender.com` |
| Health | READY | `https://factorylink-m9ai.onrender.com/health` |
| GitHub | READY | `https://github.com/Spectre-Techie/factorylink` |
| SMS callback | PARTIAL | `https://factorylink-m9ai.onrender.com/api/africastalking/sms`; implemented and real inbound evidence exists, AT portal configuration needs confirmation. |
| USSD callback | PARTIAL | `https://factorylink-m9ai.onrender.com/api/africastalking/ussd`; implemented and Sandbox flows verified, AT portal configuration needs confirmation. |
| Voice callback | PARTIAL | `https://factorylink-m9ai.onrender.com/api/africastalking/voice`; implemented and application callback flow verified, live handset remains externally limited. |

### Docker audit

| Item | Status | Evidence |
|---|---|---|
| Web image | READY | `factorylink-web:phase11`; Dockerfile `docker/Dockerfile`; production command `npm start`; exposed port `3000`. |
| API image | READY | `factorylink-api:phase11`; Dockerfile `docker/Dockerfile.api`; production command `node dist/server/src/index.js`; exposed port `4000`. |
| Build | READY | Both Phase 11 images built successfully. |
| Run | READY | API image started with externalized environment variables. |
| Health | READY | API container `/health` returned HTTP 200. |
| Public Docker Image URL | MISSING | Push both images to a public registry, record registry namespace/tags, and submit the public pull URLs. |

## 15. Legal and support status

- Privacy Policy: **MISSING**. No policy document or URL exists in the repository; supply and publish one manually if required by the form or deployment.
- Terms of Service: **MISSING**. No terms document or URL exists in the repository; supply and publish one manually if required.
- Support contact: **MISSING**. No monitored support email or contact channel is recorded; supply one manually.

The solution documentation should reference these as submission/deployment prerequisites without fabricating legal text or contact details.

## 16. Limitations

This foundation does not include a full production-grade marketplace or commercial deployment pipeline. It focuses on the minimal operational assumptions needed for a realistic pilot deployment.
