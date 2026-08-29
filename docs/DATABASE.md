# Database Plan

## 1. Database choice

FactoryLink uses Supabase PostgreSQL as the relational database layer. This supports structured operational persistence, clear constraints, indexing, and a straightforward deployment model without introducing unnecessary complexity.

## 2. Core entities

### Users
Represents platform users across roles such as manager, technician, distributor, or operations support.

Planned fields:
- id
- full_name
- phone_number
- email
- role
- status
- created_at
- updated_at

### Organizations
Represents a factory, service unit, or partner organization.

Planned fields:
- id
- name
- type
- status
- created_at

### Sites
Represents a physical site or facility managed by an organization.

Planned fields:
- id
- organization_id
- name
- location
- status
- created_at

### WorkOrders
Represents a maintenance or operational task that requires assignment and progress tracking.

Planned fields:
- id
- site_id
- created_by_user_id
- assigned_to_user_id
- title
- description
- priority
- status
- due_at
- created_at
- updated_at

### WorkOrderEvents
Represents a timeline of state changes and status updates.

Planned fields:
- id
- work_order_id
- actor_user_id
- event_type
- source_channel
- payload
- created_at

### InventoryItems
Represents stock items or parts available for use or dispatch.

Planned fields:
- id
- organization_id
- sku
- name
- quantity_available
- unit
- status
- updated_at

### InventoryRequests
Represents requests for parts or fulfillment actions.

Planned fields:
- id
- work_order_id
- inventory_item_id
- requested_by_user_id
- quantity
- status
- created_at
- updated_at

### Notifications
Represents messages or event records sent through SMS, USSD, voice, or dashboard notifications.

Planned fields:
- id
- recipient_user_id
- channel
- template_name
- status
- payload
- sent_at
- created_at

## 3. Relationships

- One organization has many sites.
- One organization has many users.
- One site has many work orders.
- One work order has many events.
- One user may create many work orders.
- One user may be assigned many work orders.
- One inventory item can support many inventory requests.
- One work order may generate many notifications.

## 4. Constraints

Planned constraints include:

- unique user identity references;
- non-null required fields for operational records;
- status value restrictions using enumerated or checked values;
- foreign key relationships for all dependent records;
- validation on priority, status, and role values;
- audit timestamps for all mutable records.

## 5. Indexing strategy

Recommended indexing priorities:

- work_orders(site_id, status)
- work_orders(assigned_to_user_id, status)
- work_orders(created_at)
- users(role, status)
- notifications(recipient_user_id, status)
- inventory_items(organization_id, status)
- work_order_events(work_order_id, created_at)

This is intended to support operational lookup speed without overengineering the schema.

## 6. Migration approach

Migrations are intentionally not executed in this task. The project will adopt a straightforward migration process later:

- versioned SQL migration files;
- explicit schema checks in CI or local validation;
- migration review before production rollout;
- additive changes before destructive ones.

The database is planned as a stable relational model that can evolve iteratively without violating the current architecture.
