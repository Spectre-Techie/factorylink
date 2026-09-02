# Africa's Talking Integration Plan

## 1. Integration goals

Africa's Talking is the communication provider for FactoryLink's SMS, USSD, voice, and airtime capabilities. The integration remains isolated behind a provider abstraction layer so provider credentials and request logic do not enter frontend code or core business flows.

## 2. Architectural approach

The project will not call Africa's Talking directly from controllers, route handlers, or business logic. Instead, the flow will be:

1. application logic creates a domain-level request;
2. a provider service translates it into an Africa's Talking payload;
3. a provider adapter handles HTTP calls and errors;
4. result data is normalized before returning to the business layer.

This keeps the application easier to test and safer to evolve.

## 3. Communication channels

### SMS

For status notifications, assignment updates, and simple instructions.

Planned responsibilities:
- message template lookup;
- payload creation from work order or inventory events;
- provider call execution;
- response tracking and logging.

### USSD

For low-bandwidth interaction and menu-based operations for technicians or field users.

Planned responsibilities:
- session creation and menu routing;
- input parsing and validation;
- state tracking for multi-step flows;
- provider response mapping for the application.

### Voice

For call-based workflows, confirmations, and callback-triggered coordination.

Planned responsibilities:
- call initiation and callback handling;
- session state for interactive call flows;
- call event normalization for application use.

### Airtime

For planned operational or support-related credit distribution flows where allowed by business requirements.

Planned responsibilities:
- airtime request normalization;
- provider-specific execution;
- transaction record tracking and audit logs.

## 4. Provider abstraction layer

The abstraction layer should define a small interface such as:

- sendSms()
- sendUssdSession()
- initiateVoiceCall()
- sendAirtime()

The implementation should hide:

- endpoint URLs;
- credential handling;
- provider response details;
- retry or status translation logic.

## 5. Security and configuration

Provider credentials should be stored only in environment variables and never committed to source control. Configuration values should be managed from a centralized config module.

## 6. Error handling

Provider errors must not crash business flows. The adapter should:

- capture provider failures;
- map them to internal error codes;
- log provider metadata safely;
- return a structured failure result to the caller.

## 7. Development sandbox SMS test

This project includes a minimal development-only SMS test endpoint for the Africa's Talking sandbox. It is not a production business endpoint and must not be treated as part of the live application workflow.

### Endpoint

- Method: POST
- Path: /dev/at/sandbox/sms-test
- Purpose: send exactly one controlled SMS test through the Africa's Talking sandbox using the existing provider abstraction.

### Request body

```json
{
  "recipient": "+254712345678",
  "message": "FactoryLink sandbox test message",
  "senderId": "FactoryLink"
}
```

Notes:
- `recipient` is required and must be a valid international E.164 phone number.
- `message` is required and must be 160 characters or less for this sandbox test.
- `senderId` is optional for this test and defaults to the configured sender ID when present.
- The endpoint is only valid when the server is configured with `AT_ENVIRONMENT=sandbox` and `AT_USERNAME=sandbox` from local environment variables.

### Validation behavior

The endpoint validates before calling the provider:
- recipient must be present and match the E.164 format
- message must be present and not exceed 160 characters
- sandbox mode must be enabled
- any provider error is sanitized before being returned to the caller

The response is structured so the caller can see the endpoint type and sandbox status without exposing any credentials.

### Exact SDK method used

The implementation uses the official Africa's Talking SDK SMS service method:

- `africastalking.SMS.send({ to, message, senderId })`

This is called only through the provider abstraction, never from frontend code or business-layer modules.

### Manual execution

1. Set the local environment variables only in the server environment:
   - `AT_ENVIRONMENT=sandbox`
   - `AT_USERNAME=sandbox`
   - `AT_API_KEY=<local-only key>`
2. Start the server locally with the project server entry point.
3. Send exactly one request to the Sandbox test endpoint:

```bash
curl -X POST http://localhost:4000/dev/at/sandbox/sms-test \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "+254712345678",
    "message": "FactoryLink sandbox SMS test"
  }'
```

4. Review the response for `ok: true` and the sandbox metadata.
5. Do not treat this endpoint as a production business API.

### Safety rules

- API keys are never stored in source control or returned by the endpoint.
- No SDK error object is returned unfiltered.
- No production or live Africa's Talking environment is used.
- No database tables, frontend changes, or business-feature code are created here.

## 8. Phase 11 integration matrix

This matrix separates repository behavior from provider-account and handset verification. `READY` means covered by implementation and repository tests; `PARTIAL` means the flow exists but external verification is still required; `MISSING` means evidence is not present.

| Channel or capability | Status | Recorded behavior and remaining verification |
|---|---|---|
| SMS shortcode | MISSING | Shortcode `3979` is required for production configuration; no repository evidence confirms it is provisioned. |
| SMS outbound | READY | Server-side provider adapter sends outbound notifications and the repository has service coverage. |
| SMS inbound | READY | `POST /api/africastalking/sms` accepts AT callback fields, persists inbound messages, and deduplicates provider message IDs. |
| SMS Sandbox verification | PARTIAL | The development-only `/dev/at/sandbox/sms-test` endpoint and manual procedure are documented; a live provider send is still manual. |
| USSD ordering | READY | Session flow supports order placement with input validation. |
| USSD stock | READY | Session menu supports Check Stock. |
| USSD orders | READY | Session menu supports My Orders. |
| USSD sales reporting | READY | Session menu supports Report Sales and the airtime reward flow. |
| USSD help | READY | Session menu supports Help. |
| USSD validation/session behavior | READY | Invalid input and multi-step session behavior are covered by service tests. |
| Voice callback | READY | `POST /api/africastalking/voice` accepts callback payload variants and returns XML. |
| Voice technician call flow | READY | Authenticated work-order call initiation uses the provider adapter. |
| Voice callback digit handling | READY | Callback digit/DTMF values are normalized into the voice service flow. |
| Voice live handset limitation | BLOCKED | Live handset verification remains unavailable until a provisioned AT voice number and reachable callback are supplied. |
| Airtime reward tiers | READY | Sales-report eligibility and reward tiers are implemented and tested. |
| Airtime provider request | READY | Eligible rewards are dispatched through the provider adapter with sent/failed tracking. |
| Airtime live reward verification | PARTIAL | Live provider delivery and recipient confirmation remain manual. |
| Operational Insights | READY | FactoryLink internal organization-scoped analytics; this is **not** the Africa's Talking Insights API. |

## 9. Future implementation

Future work is limited to operational verification and marketplace submission tasks. It must not be interpreted as evidence that provider portal configuration, live handset tests, or production reward delivery have already occurred.
