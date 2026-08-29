# MVP Definition

## Goal

Define the smallest viable product that delivers operational coordination value while keeping the architecture lean and implementation realistic for a solo developer.

## Scope categorization

### P0: Must have for launch

These are the features required for a functional MVP.

1. Work order creation and assignment
   - A manager or operations user can create a work order.
   - Work orders include priority, status, location, and ownership.
   - Acceptance criteria:
     - A work order can be created with required fields.
     - The work order is stored in the system with a unique identifier.
     - A valid assignee or team is required for assignment.
     - Initial status is set to pending or assigned.

2. Technician status tracking
   - A technician can acknowledge and update task status.
   - Status changes must be visible in the dashboard.
   - Acceptance criteria:
     - A status update is logged with timestamp and source channel.
     - The dashboard reflects the latest status.
     - Invalid transitions are rejected by validation rules.

3. SMS notification flow
   - A work order can trigger an SMS message to a technician or partner.
   - The flow is routed via an abstraction layer for Africa's Talking integration.
   - Acceptance criteria:
     - A message template can be generated from a work order event.
     - The provider abstraction receives a structured payload.
     - The application can handle provider errors without crashing.

4. Role-based access to operational dashboard
   - Management and operational users can access relevant views.
   - Unauthorized users are blocked.
   - Acceptance criteria:
     - Users are authenticated before accessing protected routes.
     - Roles are checked before operations are allowed.
     - Missing or invalid tokens are rejected.

5. Basic operational dashboard
   - A concise dashboard shows active work orders and statuses.
   - Acceptance criteria:
     - The dashboard shows total active items, in-progress items, and pending items.
     - Users can filter items by status or team.
     - The dashboard does not require real-time streaming to be useful.

### P1: Important for pilot value

1. USSD interaction workflow.
2. Inventory request and fulfillment tracking.
3. Voice callback or call trigger integration hooks.
4. Basic audit log for status changes.
5. Helpful error messaging and retry flow for provider issues.

### P2: Future enhancements

1. Advanced analytics.
2. AI-powered summarization and status prediction.
3. Expanded voice automation.
4. More granular inventory optimization.
5. Multi-site scaling and advanced deployment features.

## Out of scope for MVP

- Full ERP integration.
- Advanced data science or forecasting.
- Multi-tenant SaaS marketplace features.
- Complex campaign automation.
- Full production API monetization model.

## Definition of done for MVP

The MVP is complete when the core operational flow can be demonstrated end-to-end in a local environment without real business data or production provider access. It should show the project can coordinate work order creation, assignment, status updates, and communication notifications using the planned architecture.
