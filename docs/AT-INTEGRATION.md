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

## 7. Future implementation

This task does not include real Africa's Talking credentials or API requests. The integration foundation is only documented and structurally prepared.
