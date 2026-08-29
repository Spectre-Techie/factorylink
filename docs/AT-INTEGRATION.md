# Africa's Talking Integration Plan

## 1. Integration goals

Africa's Talking is the planned communication provider for FactoryLink's SMS, USSD, voice, and airtime capabilities. The integration must remain isolated behind a provider abstraction layer so that provider credentials and request logic can be added later without polluting core business flows.

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

## 8. Future implementation

This task does not include live business workflows, database persistence, or non-SMS functionality. It only establishes the first controlled sandbox integration test for the provider layer.
