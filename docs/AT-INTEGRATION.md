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

FactoryLink supports outbound notifications and inbound Africa's Talking callbacks. The verified Sandbox shortcode is `3979`; a real AT Sandbox message reached FactoryLink and was persisted in Supabase using the official `from` field handling.

### USSD

FactoryLink supports low-bandwidth order placement, stock checks, order history, sales reporting, Help, and invalid-input/session handling. These Sandbox flows are covered by the repository verification evidence.

### Voice

FactoryLink supports technician work-order call initiation, callback handling, and callback digit interaction. Live handset verification remains unavailable where AT account or platform limitations prevent a provisioned voice number or reachable callback.

### Airtime

FactoryLink fulfills eligible distributor rewards through the provider adapter. A real provider reward was successfully sent, with the provider reference recorded and status set to `sent`.

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

## 8. Phase 12 integration matrix

This matrix separates verified evidence from remaining external checks. `READY` means the capability is verified by known project evidence or repository tests; `PARTIAL` means implementation exists but an external check remains; `BLOCKED` means the check depends on an AT account/platform limitation.

| Channel or capability | Status | Recorded behavior and remaining verification |
|---|---|---|
| SMS shortcode | READY | Sandbox shortcode `3979` is verified. |
| SMS outbound | PARTIAL | Outbound notification code and provider abstraction are implemented; a live outbound delivery record is not included in the known evidence. |
| SMS inbound | READY | `POST /api/africastalking/sms` accepts AT callback fields, handles the official `from` field, persists a real inbound message in Supabase, and deduplicates provider message IDs. |
| SMS Sandbox verification | READY | Real AT Sandbox -> FactoryLink -> Supabase persistence was verified. |
| USSD ordering | READY | Sandbox Place Order flow was verified with input validation. |
| USSD stock | READY | Sandbox Check Stock flow was verified. |
| USSD orders | READY | Sandbox My Orders flow was verified. |
| USSD sales reporting | READY | Sandbox Report Sales flow was verified. |
| USSD help | READY | Sandbox Help flow was verified. |
| USSD validation/session behavior | READY | Sandbox invalid-input and session handling were verified. |
| Voice callback | READY | `POST /api/africastalking/voice` accepts callback payload variants and returns XML. |
| Voice technician call flow | READY | Application call initiation uses the provider adapter and the flow is implemented. |
| Voice callback digit handling | READY | Callback digit/DTMF values are normalized into the voice service flow. |
| Voice live handset limitation | BLOCKED | Live handset verification remains unavailable until a provisioned AT voice number and reachable callback are supplied. |
| Airtime reward tiers | READY | Sales-report eligibility and reward tiers are implemented and tested. |
| Airtime provider request | READY | A real provider reward was successfully sent and its provider reference was recorded. |
| Airtime live reward verification | READY | Known evidence confirms provider success and status `sent`; recipient-side confirmation remains an operational follow-up. |
| Operational Insights | READY | FactoryLink internal organization-scoped analytics; this is **not** the Africa's Talking Insights API. |

## 9. Callback inventory

| Channel | Application callback | Implemented | Tested/evidenced | AT portal configuration |
|---|---|---|---|---|
| SMS | `https://factorylink-m9ai.onrender.com/api/africastalking/sms` | Yes | Yes, including real Sandbox persistence | Externally unverified; configure in AT portal. |
| USSD | `https://factorylink-m9ai.onrender.com/api/africastalking/ussd` | Yes | Sandbox flows verified | Externally unverified; configure in AT portal. |
| Voice | `https://factorylink-m9ai.onrender.com/api/africastalking/voice` | Yes | Callback/application flow verified; handset blocked | Externally unverified; configure in AT portal. |

The URLs above are the documented application endpoints. “Implemented” and “tested/evidenced” describe FactoryLink; they do not claim that the Africa's Talking portal has been configured or that every callback has been exercised against a production account.

## 10. Production environment variables

The table below reflects the server configuration in `server/src/config.ts`. Required means the server rejects startup when the value is absent or empty. The frontend public variable is required for a useful deployed web service but is not validated by the server configuration module.

| Variable | Required/optional | Purpose | Example format | Secret classification |
|---|---|---|---|---|
| `NODE_ENV` | Required | Runtime environment label. | `production` | Non-secret |
| `PORT` | Optional | API listen port; defaults to `4000`. | `4000` | Non-secret |
| `NEXT_PUBLIC_API_BASE_URL` | Optional in server code; required for deployed frontend configuration | Public API origin used by the web app and default voice callback construction. | `https://factorylink-m9ai.onrender.com` | Non-secret |
| `SUPABASE_URL` | Optional in server config; required for persistence deployment | Supabase project URL. | `https://your-project.supabase.co` | Non-secret |
| `SUPABASE_ANON_KEY` | Optional | Supabase anonymous client key. | `eyJ...` | Sensitive public configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional in server assertion; required for persistence deployment | Supabase server-side service-role access. | `<supabase-service-role-key>` | Secret |
| `SUPABASE_DB_URL` | Optional | Optional direct Supabase database connection URL. | `postgresql://...` | Secret |
| `AT_ENVIRONMENT` | Required | Africa's Talking environment; must be `sandbox` or `production`. | `sandbox` | Non-secret configuration |
| `AT_USERNAME` | Required | Africa's Talking account username. | `sandbox` or `<account-username>` | Sensitive credential |
| `AT_API_KEY` | Required | Africa's Talking server-side API key. | `<africas-talking-api-key>` | Secret |
| `AT_BASE_URL` | Optional | Africa's Talking API origin; defaults to `https://api.africastalking.com`. | `https://api.africastalking.com` | Non-secret |
| `AT_SENDER_ID` | Optional | Sender ID; defaults to `FactoryLink`. | `FactoryLink` | Non-secret |
| `AT_VOICE_NUMBER` | Optional | Provider voice caller number. | `+254700000000` | Sensitive configuration |
| `VOICE_CALLBACK_URL` | Optional | Public callback URL for voice calls; defaults from the API base URL. | `https://factorylink-m9ai.onrender.com/api/africastalking/voice` | Non-secret |
| `CORS_ORIGIN` | Optional | Allowed frontend origin(s). | `https://factorylink-web.onrender.com` | Non-secret |

## 11. Future implementation

Future work is limited to operational verification and marketplace submission tasks. It must not be interpreted as evidence that provider portal configuration, live handset tests, or production reward delivery have already occurred.
