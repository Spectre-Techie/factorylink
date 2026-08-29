# API Plan

## 1. Design principles

The API is designed to be simple, predictable, and suitable for a small operational system. It will use REST conventions, clear status codes, and consistent payload structures.

## 2. API conventions

- JSON request and response payloads.
- Nouns for resource naming.
- Pluralized collection endpoints for list resources.
- Versioned routes only if required by the product lifecycle.
- Consistent error response format.
- Validation and audit metadata included where useful.

## 3. Endpoint categories

### Authentication and session endpoints

- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Users and roles

- GET /api/users
- GET /api/users/:id
- POST /api/users
- PATCH /api/users/:id

### Work orders

- GET /api/work-orders
- GET /api/work-orders/:id
- POST /api/work-orders
- PATCH /api/work-orders/:id
- POST /api/work-orders/:id/assign
- POST /api/work-orders/:id/status

### Inventory

- GET /api/inventory
- GET /api/inventory/:id
- POST /api/inventory
- PATCH /api/inventory/:id
- POST /api/inventory/requests

### Notifications and channels

- POST /api/notifications/sms
- POST /api/notifications/ussd
- POST /api/notifications/voice
- GET /api/notifications

### Webhooks

- POST /api/webhooks/africas-talking
- POST /api/webhooks/sms
- POST /api/webhooks/voice

## 4. Response conventions

Successful responses should use consistent resource shapes, while error responses should include:

- status
- code
- message
- timestamp
- optional field-level validation details

## 5. Validation rules

- Required fields must be enforced at the API boundary.
- Role-based checks must be enforced on protected routes.
- Input payloads must be sanitized and validated before use.
- Provider-specific payloads must be translated into internal domain objects.

## 6. Future implementation notes

This document does not implement the real business endpoints yet. It only defines the expected patterns and categories so the services can be built cleanly when the project moves from foundation to implementation.
