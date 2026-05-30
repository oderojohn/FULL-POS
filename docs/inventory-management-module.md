# Multi-Company Multi-Branch POS Inventory Module

## 1. Executive Summary

This document defines a production-ready Inventory Management Module for a cloud POS platform that supports multiple companies, branches, warehouses, users, and roles. The design is API-first, SaaS-ready, PostgreSQL-backed, and optimized for real-time stock accuracy.

Primary stack:

- Backend: Django, Django REST Framework, PostgreSQL, Redis, Celery, Channels/WebSockets
- Frontend: React, TypeScript, Tailwind, React Query, Zustand
- Auth: JWT access tokens, refresh tokens, role-based access control
- Deployment: Docker, Kubernetes or container platform, managed PostgreSQL, Redis, object storage

Core invariant:

Every stock-changing operation is executed inside a database transaction, locks the affected inventory row, updates inventory balances, and writes an immutable stock movement record before commit.

## 2. System Architecture

### Logical Components

- Identity and tenancy: users, companies, branches, roles, permissions, JWT claims
- Catalog: products, categories, brands, suppliers, units, barcodes, batches
- Inventory: warehouse stock balances, reserved stock, damaged stock, expired stock
- Stock ledger: immutable stock movement history
- Purchasing: purchase orders, receipts, supplier balances
- Transfers: warehouse and branch stock movement workflow
- Returns: supplier returns and customer returns
- Alerts: low-stock, expiry, out-of-stock notifications
- Reports: current stock, valuation, movement, supplier, transfer, analytics
- Audit: immutable audit logs for creates, edits, soft deletes, approvals

### Runtime Architecture

```text
React POS/Admin UI
  -> API Gateway / Load Balancer
    -> Django REST API
      -> Service Layer
        -> Repository Layer
          -> PostgreSQL
      -> Redis Cache
      -> Celery Workers
      -> WebSocket Inventory Events
```

### Tenant Isolation

Every tenant-owned table includes `company_id`. Branch-scoped tables also include `branch_id`. API requests resolve active company and branch from JWT claims, route context, or explicit branch switch, then enforce filtering at repository/queryset level.

Recommended JWT claims:

```json
{
  "sub": "user_uuid",
  "company_id": "company_uuid",
  "branch_ids": ["branch_uuid"],
  "active_branch_id": "branch_uuid",
  "roles": ["Inventory Manager"],
  "permissions": ["inventory.adjust", "purchase.approve"]
}
```

## 3. Database Design

### Design Rules

- Use UUID primary keys.
- Use `numeric(18,4)` for quantities and money.
- Use soft deletes for master data, not for immutable ledgers.
- Never update or delete stock movements after creation.
- Use partial unique indexes for soft-deleted business keys.
- Use row-level locks for inventory mutation.
- Use optimistic locking via `version` on inventory balances.
- Use `created_by`, `updated_by`, `deleted_by`, approval users, and timestamps.

### ERD Structure

```text
companies 1--N branches 1--N warehouses
companies 1--N users
users N--N roles N--N permissions

companies 1--N categories
companies 1--N brands
companies 1--N suppliers
companies 1--N products
categories 1--N categories
products N--1 categories
products N--1 brands
products N--1 suppliers

warehouses 1--N inventory_balances
products 1--N inventory_balances
products 1--N product_batches
product_batches 1--N inventory_balances

inventory_balances 1--N stock_movements
products 1--N stock_movements
warehouses 1--N stock_movements

suppliers 1--N purchase_orders 1--N purchase_order_items
purchase_order_items 1--N purchase_receipts

warehouses 1--N stock_transfers(source)
warehouses 1--N stock_transfers(destination)
stock_transfers 1--N stock_transfer_items

products 1--N return_items
companies 1--N alerts
companies 1--N audit_logs
```

## 4. PostgreSQL Schema

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE company_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE warehouse_status AS ENUM ('active', 'inactive');
CREATE TYPE movement_type AS ENUM (
  'SALE', 'PURCHASE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT',
  'ADJUSTMENT', 'DAMAGE', 'EXPIRED', 'OPENING_STOCK', 'SALE_CANCELLED'
);
CREATE TYPE purchase_status AS ENUM (
  'draft', 'pending', 'approved', 'partially_received', 'completed', 'cancelled'
);
CREATE TYPE transfer_status AS ENUM (
  'created', 'approved', 'dispatched', 'received', 'completed', 'cancelled'
);
CREATE TYPE adjustment_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'posted');
CREATE TYPE alert_type AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'NEAR_EXPIRY', 'EXPIRED', 'DAMAGED');
CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved');

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(180) NOT NULL,
  logo_url text,
  address text,
  tax_number varchar(80),
  phone varchar(40),
  email varchar(180),
  currency char(3) NOT NULL DEFAULT 'USD',
  timezone varchar(80) NOT NULL DEFAULT 'UTC',
  subscription_plan varchar(80) NOT NULL DEFAULT 'starter',
  status company_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tax_number)
);

CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name varchar(180) NOT NULL,
  branch_code varchar(40) NOT NULL,
  address text,
  phone varchar(40),
  email varchar(180),
  manager_user_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, branch_code)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  email varchar(180) NOT NULL,
  full_name varchar(180) NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, email)
);

ALTER TABLE branches
  ADD CONSTRAINT fk_branch_manager
  FOREIGN KEY (manager_user_id) REFERENCES users(id);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  name varchar(80) NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  UNIQUE (company_id, name)
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(120) NOT NULL UNIQUE,
  description text
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id),
  PRIMARY KEY (user_id, role_id, branch_id)
);

CREATE TABLE warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid REFERENCES branches(id),
  name varchar(180) NOT NULL,
  warehouse_code varchar(40) NOT NULL,
  location text,
  is_central boolean NOT NULL DEFAULT false,
  status warehouse_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, warehouse_code),
  CHECK ((is_central = true AND branch_id IS NULL) OR (is_central = false AND branch_id IS NOT NULL))
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  parent_id uuid REFERENCES categories(id),
  name varchar(160) NOT NULL,
  slug varchar(180) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, slug)
);

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name varchar(160) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, name)
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name varchar(180) NOT NULL,
  contact_person varchar(180),
  email varchar(180),
  phone varchar(40),
  address text,
  tax_number varchar(80),
  balance numeric(18,4) NOT NULL DEFAULT 0,
  payment_terms varchar(120),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, name)
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  name varchar(220) NOT NULL,
  sku varchar(80) NOT NULL,
  barcode varchar(120),
  qr_code varchar(240),
  category_id uuid REFERENCES categories(id),
  brand_id uuid REFERENCES brands(id),
  supplier_id uuid REFERENCES suppliers(id),
  unit_of_measure varchar(40) NOT NULL DEFAULT 'unit',
  buying_price numeric(18,4) NOT NULL DEFAULT 0,
  selling_price numeric(18,4) NOT NULL DEFAULT 0,
  wholesale_price numeric(18,4) NOT NULL DEFAULT 0,
  tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  discount_rate numeric(7,4) NOT NULL DEFAULT 0,
  image_url text,
  description text,
  minimum_stock numeric(18,4) NOT NULL DEFAULT 0,
  reorder_level numeric(18,4) NOT NULL DEFAULT 0,
  batch_tracking boolean NOT NULL DEFAULT false,
  expiry_tracking boolean NOT NULL DEFAULT false,
  serial_tracking boolean NOT NULL DEFAULT false,
  allow_negative_stock boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, sku),
  UNIQUE (company_id, barcode)
);

CREATE TABLE product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  product_id uuid NOT NULL REFERENCES products(id),
  batch_number varchar(120) NOT NULL,
  manufacturing_date date,
  expiry_date date,
  received_quantity numeric(18,4) NOT NULL DEFAULT 0,
  remaining_quantity numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_id, batch_number)
);

CREATE TABLE inventory_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid REFERENCES branches(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES product_batches(id),
  current_quantity numeric(18,4) NOT NULL DEFAULT 0,
  reserved_quantity numeric(18,4) NOT NULL DEFAULT 0,
  incoming_quantity numeric(18,4) NOT NULL DEFAULT 0,
  damaged_quantity numeric(18,4) NOT NULL DEFAULT 0,
  expired_quantity numeric(18,4) NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_quantity >= 0),
  CHECK (reserved_quantity >= 0),
  CHECK (incoming_quantity >= 0),
  CHECK (damaged_quantity >= 0),
  CHECK (expired_quantity >= 0),
  UNIQUE (company_id, warehouse_id, product_id, batch_id)
);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid REFERENCES branches(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES product_batches(id),
  quantity numeric(18,4) NOT NULL,
  before_quantity numeric(18,4) NOT NULL,
  after_quantity numeric(18,4) NOT NULL,
  movement_type movement_type NOT NULL,
  reference_type varchar(80) NOT NULL,
  reference_id uuid,
  reference_number varchar(120),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity <> 0)
);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid REFERENCES branches(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  po_number varchar(80) NOT NULL,
  status purchase_status NOT NULL DEFAULT 'draft',
  subtotal numeric(18,4) NOT NULL DEFAULT 0,
  tax_total numeric(18,4) NOT NULL DEFAULT 0,
  discount_total numeric(18,4) NOT NULL DEFAULT 0,
  grand_total numeric(18,4) NOT NULL DEFAULT 0,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  cancelled_by uuid REFERENCES users(id),
  cancelled_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, po_number)
);

CREATE TABLE purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  batch_number varchar(120),
  expiry_date date,
  ordered_quantity numeric(18,4) NOT NULL,
  received_quantity numeric(18,4) NOT NULL DEFAULT 0,
  unit_cost numeric(18,4) NOT NULL,
  tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  discount_rate numeric(7,4) NOT NULL DEFAULT 0,
  line_total numeric(18,4) NOT NULL DEFAULT 0,
  CHECK (ordered_quantity > 0),
  CHECK (received_quantity >= 0)
);

CREATE TABLE stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  transfer_number varchar(80) NOT NULL,
  source_branch_id uuid REFERENCES branches(id),
  source_warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  destination_branch_id uuid REFERENCES branches(id),
  destination_warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  status transfer_status NOT NULL DEFAULT 'created',
  requested_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  dispatched_by uuid REFERENCES users(id),
  received_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  dispatched_at timestamptz,
  received_at timestamptz,
  completed_at timestamptz,
  UNIQUE (company_id, transfer_number),
  CHECK (source_warehouse_id <> destination_warehouse_id)
);

CREATE TABLE stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  transfer_id uuid NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES product_batches(id),
  requested_quantity numeric(18,4) NOT NULL,
  dispatched_quantity numeric(18,4) NOT NULL DEFAULT 0,
  received_quantity numeric(18,4) NOT NULL DEFAULT 0,
  CHECK (requested_quantity > 0)
);

CREATE TABLE inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid REFERENCES branches(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  adjustment_number varchar(80) NOT NULL,
  reason varchar(80) NOT NULL,
  status adjustment_status NOT NULL DEFAULT 'draft',
  notes text,
  requested_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  posted_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  posted_at timestamptz,
  UNIQUE (company_id, adjustment_number)
);

CREATE TABLE inventory_adjustment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  adjustment_id uuid NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES product_batches(id),
  quantity_delta numeric(18,4) NOT NULL,
  CHECK (quantity_delta <> 0)
);

CREATE TABLE inventory_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid REFERENCES branches(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  return_number varchar(80) NOT NULL,
  return_type varchar(40) NOT NULL CHECK (return_type IN ('customer', 'supplier')),
  supplier_id uuid REFERENCES suppliers(id),
  sale_id uuid,
  status varchar(40) NOT NULL DEFAULT 'posted',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, return_number)
);

CREATE TABLE inventory_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  return_id uuid NOT NULL REFERENCES inventory_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES product_batches(id),
  quantity numeric(18,4) NOT NULL,
  condition varchar(40) NOT NULL DEFAULT 'sellable',
  CHECK (quantity > 0)
);

CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid REFERENCES branches(id),
  warehouse_id uuid REFERENCES warehouses(id),
  product_id uuid REFERENCES products(id),
  batch_id uuid REFERENCES product_batches(id),
  alert_type alert_type NOT NULL,
  status alert_status NOT NULL DEFAULT 'open',
  message text NOT NULL,
  threshold_quantity numeric(18,4),
  actual_quantity numeric(18,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid REFERENCES users(id),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  branch_id uuid REFERENCES branches(id),
  actor_user_id uuid REFERENCES users(id),
  action varchar(120) NOT NULL,
  entity_type varchar(120) NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Required Indexes

```sql
CREATE INDEX idx_branches_company ON branches(company_id);
CREATE INDEX idx_warehouses_company_branch ON warehouses(company_id, branch_id);
CREATE INDEX idx_products_company_search ON products(company_id, name, sku, barcode);
CREATE INDEX idx_products_barcode ON products(company_id, barcode) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_parent ON categories(company_id, parent_id);
CREATE INDEX idx_inventory_lookup ON inventory_balances(company_id, warehouse_id, product_id, batch_id);
CREATE INDEX idx_inventory_branch_product ON inventory_balances(company_id, branch_id, product_id);
CREATE UNIQUE INDEX uq_inventory_no_batch
  ON inventory_balances(company_id, warehouse_id, product_id)
  WHERE batch_id IS NULL;
CREATE UNIQUE INDEX uq_inventory_with_batch
  ON inventory_balances(company_id, warehouse_id, product_id, batch_id)
  WHERE batch_id IS NOT NULL;
CREATE INDEX idx_stock_movements_report ON stock_movements(company_id, branch_id, warehouse_id, product_id, created_at DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements(company_id, reference_type, reference_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(company_id, supplier_id, created_at DESC);
CREATE INDEX idx_transfers_status ON stock_transfers(company_id, status, created_at DESC);
CREATE INDEX idx_batches_expiry ON product_batches(company_id, product_id, expiry_date);
CREATE INDEX idx_alerts_open ON alerts(company_id, branch_id, status, alert_type) WHERE status = 'open';
CREATE INDEX idx_audit_entity ON audit_logs(company_id, entity_type, entity_id, created_at DESC);
```

## 5. Backend Architecture

### Django Apps

```text
backend/
  config/
  apps/
    identity/
      models.py serializers.py views.py services.py permissions.py
    tenancy/
      models.py middleware.py repositories.py
    catalog/
      models.py serializers.py views.py services.py importers.py
    inventory/
      models.py serializers.py views.py services.py repositories.py selectors.py locks.py
    purchasing/
      models.py serializers.py views.py services.py
    transfers/
      models.py serializers.py views.py services.py
    returns/
      models.py serializers.py views.py services.py
    alerts/
      models.py tasks.py services.py channels.py
    reports/
      views.py services.py exports.py
    audit/
      models.py middleware.py services.py
```

### Layering

- Views: authentication, request parsing, response formatting
- Serializers/DTOs: validation, type coercion, payload contracts
- Services: business workflows, transaction boundaries, permissions
- Repositories/selectors: tenant-safe query construction
- Models: database schema and constraints
- Tasks: asynchronous alerting, email/SMS/push, scheduled expiry checks

### Transaction Pattern

```python
from django.db import transaction

@transaction.atomic
def post_stock_change(*, company_id, branch_id, warehouse_id, product_id, batch_id, delta, movement_type, user, reference):
    inventory = (
        InventoryBalance.objects
        .select_for_update()
        .get(
            company_id=company_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            batch_id=batch_id,
        )
    )

    before = inventory.current_quantity
    after = before + delta
    if after < 0:
        raise InsufficientStockError(product_id=product_id, available=before, requested=abs(delta))

    inventory.current_quantity = after
    inventory.version += 1
    inventory.save(update_fields=["current_quantity", "version", "updated_at"])

    StockMovement.objects.create(
        company_id=company_id,
        branch_id=branch_id,
        warehouse_id=warehouse_id,
        product_id=product_id,
        batch_id=batch_id,
        quantity=delta,
        before_quantity=before,
        after_quantity=after,
        movement_type=movement_type,
        reference_type=reference.type,
        reference_id=reference.id,
        reference_number=reference.number,
        created_by=user,
    )

    return inventory
```

## 6. API Documentation

### API Standards

- Base path: `/api/v1`
- Auth: `Authorization: Bearer <access_token>`
- Pagination: `page`, `page_size`
- Sorting: `sort=name,-created_at`
- Search: `search=term`
- Tenant: `company_id` from JWT; `branch_id` from JWT active branch or explicit query when authorized
- Response envelope:

```json
{
  "data": {},
  "meta": {
    "request_id": "req_123",
    "page": 1,
    "page_size": 25,
    "total": 240
  }
}
```

### Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Issue access and refresh tokens |
| POST | `/auth/refresh` | Rotate access token |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/auth/me` | Current user, company, branches, permissions |
| POST | `/auth/switch-branch` | Set active branch |

Login request:

```json
{
  "email": "manager@example.com",
  "password": "secret",
  "company_code": "ACME"
}
```

Login response:

```json
{
  "data": {
    "access_token": "jwt",
    "refresh_token": "jwt",
    "expires_in": 900,
    "user": {
      "id": "uuid",
      "name": "Store Manager",
      "company_id": "uuid",
      "active_branch_id": "uuid",
      "permissions": ["inventory.read", "inventory.adjust"]
    }
  }
}
```

### Product and Catalog APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/products` | List products with search/filter/sort |
| POST | `/products` | Create product |
| GET | `/products/{id}` | Product detail |
| PATCH | `/products/{id}` | Update product |
| DELETE | `/products/{id}` | Soft delete product |
| POST | `/products/import` | CSV upload |
| GET | `/products/export` | CSV export |
| POST | `/products/{id}/barcode` | Generate barcode |
| GET | `/products/scan/{barcode}` | Barcode lookup |
| GET | `/categories` | Nested category tree |
| POST | `/categories` | Create category |
| GET | `/brands` | List brands |
| POST | `/brands` | Create brand |

Create product request:

```json
{
  "name": "Paracetamol 500mg",
  "sku": "MED-PARA-500",
  "barcode": "6291000000012",
  "category_id": "uuid",
  "brand_id": "uuid",
  "supplier_id": "uuid",
  "unit_of_measure": "box",
  "buying_price": "3.2500",
  "selling_price": "5.0000",
  "wholesale_price": "4.3000",
  "tax_rate": "15.0000",
  "minimum_stock": "20.0000",
  "reorder_level": "50.0000",
  "batch_tracking": true,
  "expiry_tracking": true,
  "serial_tracking": false,
  "opening_stock": {
    "branch_id": "uuid",
    "warehouse_id": "uuid",
    "quantity": "100.0000",
    "batch_number": "BATCH-2026-05",
    "expiry_date": "2027-05-01"
  }
}
```

If opening stock is provided during product creation, the backend must create the product, create or lock the target inventory balance, increase stock, and insert an `OPENING_STOCK` movement in the same transaction. Updating a product later must not silently rewrite stock; later quantity changes must go through adjustment, purchase receiving, transfer, sale, or return workflows.

### Inventory APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/inventory` | Current inventory balances |
| GET | `/inventory/{product_id}` | Product stock by branch/warehouse/batch |
| POST | `/inventory/opening-stock` | Post opening stock |
| POST | `/inventory/adjustments` | Create adjustment |
| POST | `/inventory/adjustments/{id}/submit` | Submit for approval |
| POST | `/inventory/adjustments/{id}/approve` | Manager approval |
| POST | `/inventory/adjustments/{id}/post` | Apply approved adjustment |
| GET | `/stock-movements` | Immutable stock ledger |

Adjustment request:

```json
{
  "warehouse_id": "uuid",
  "reason": "counting_error",
  "notes": "Cycle count correction",
  "items": [
    {
      "product_id": "uuid",
      "batch_id": "uuid",
      "quantity_delta": "-2.0000"
    }
  ]
}
```

### Purchasing APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/suppliers` | Supplier list |
| POST | `/suppliers` | Create supplier |
| GET | `/suppliers/{id}/history` | Purchase and return history |
| GET | `/purchase-orders` | List purchase orders |
| POST | `/purchase-orders` | Create draft PO |
| POST | `/purchase-orders/{id}/submit` | Submit PO |
| POST | `/purchase-orders/{id}/approve` | Approve PO |
| POST | `/purchase-orders/{id}/receive` | Partial/full receiving |
| POST | `/purchase-orders/{id}/cancel` | Cancel PO |

Receive purchase request:

```json
{
  "warehouse_id": "uuid",
  "received_at": "2026-05-14T10:00:00Z",
  "items": [
    {
      "purchase_order_item_id": "uuid",
      "product_id": "uuid",
      "received_quantity": "25.0000",
      "batch_number": "BATCH-2026-05",
      "manufacturing_date": "2026-05-01",
      "expiry_date": "2027-05-01"
    }
  ]
}
```

### Transfer APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/transfers` | List transfers |
| POST | `/transfers` | Create transfer |
| POST | `/transfers/{id}/approve` | Approve transfer |
| POST | `/transfers/{id}/dispatch` | Decrease source inventory |
| POST | `/transfers/{id}/receive` | Increase destination inventory |
| POST | `/transfers/{id}/cancel` | Cancel transfer |

Create transfer request:

```json
{
  "source_warehouse_id": "uuid",
  "destination_warehouse_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "batch_id": "uuid",
      "requested_quantity": "10.0000"
    }
  ]
}
```

### Reports APIs

| Method | Endpoint | Filters |
| --- | --- | --- |
| GET | `/reports/current-stock` | branch, warehouse, category, brand, search |
| GET | `/reports/stock-valuation` | branch, warehouse, valuation_method |
| GET | `/reports/stock-movements` | date_from, date_to, type, product |
| GET | `/reports/low-stock` | branch, warehouse |
| GET | `/reports/out-of-stock` | branch, warehouse |
| GET | `/reports/expiry` | date_from, date_to, status |
| GET | `/reports/damaged-stock` | branch, warehouse |
| GET | `/reports/supplier-purchases` | supplier, date_from, date_to |
| GET | `/reports/transfers` | status, date_from, date_to |
| GET | `/reports/sales-analytics` | date_from, date_to, product, category |

### Alerts APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/alerts` | List alerts |
| POST | `/alerts/{id}/acknowledge` | Acknowledge |
| POST | `/alerts/{id}/resolve` | Resolve |
| GET | `/alerts/summary` | Dashboard counts |

## 7. Inventory Workflows

### Sale

1. POS sends sale checkout request.
2. API validates branch, cashier permissions, shift, and product availability.
3. Service opens transaction.
4. Each inventory row is locked with `SELECT FOR UPDATE`.
5. FEFO/FIFO allocation chooses sellable batch if batch/expiry tracking is enabled.
6. Expired batches are rejected.
7. Inventory quantity decreases.
8. `SALE` stock movement is inserted.
9. Sale, payments, receipt, and drawer changes are committed atomically.
10. WebSocket event updates dashboards and terminals.

### Sale Cancellation

1. Validate sale exists, belongs to same company/branch, and is cancellable.
2. Open transaction and lock affected inventory rows.
3. Restore quantities to original warehouse and batch.
4. Insert `SALE_CANCELLED` or `RETURN` movement.
5. Mark sale voided once with reason and user.

### Purchase Receiving

1. Validate PO is approved and not cancelled/completed.
2. Validate received quantity does not exceed remaining quantity.
3. Create or update product batch.
4. Lock destination inventory row.
5. Increase current quantity.
6. Insert `PURCHASE` movement.
7. Update PO item received quantity.
8. Update PO status to `partially_received` or `completed`.
9. Increase supplier balance by received value.

### Transfer

```text
CREATE -> APPROVE -> DISPATCH -> RECEIVE -> COMPLETE
```

Dispatch:

- Lock source inventory.
- Block if source stock is insufficient.
- Decrease source inventory.
- Insert `TRANSFER_OUT` movement.

Receive:

- Lock destination inventory.
- Increase destination inventory.
- Insert `TRANSFER_IN` movement.
- Complete when all dispatched quantities are received.

### Adjustment

```text
DRAFT -> SUBMITTED -> APPROVED -> POSTED
```

Rules:

- Cashiers cannot adjust stock.
- Adjustments require manager approval.
- Approved adjustment cannot be edited.
- Posting inserts movement records for every item.
- Negative result is blocked unless product explicitly allows negative stock and user has override permission.

## 8. Sequence Diagrams

### Sale Stock Deduction

```text
POS UI -> Sales API: POST /sales/checkout
Sales API -> Auth: validate JWT and permissions
Sales API -> InventoryService: reserve/deduct items
InventoryService -> PostgreSQL: BEGIN
InventoryService -> PostgreSQL: SELECT inventory FOR UPDATE
InventoryService -> PostgreSQL: UPDATE inventory_balances
InventoryService -> PostgreSQL: INSERT stock_movements
Sales API -> PostgreSQL: INSERT sale, items, payments
Sales API -> PostgreSQL: COMMIT
Sales API -> WebSocket: inventory.updated
Sales API -> POS UI: receipt response
```

### Purchase Receiving

```text
User -> Purchase API: POST /purchase-orders/{id}/receive
Purchase API -> PermissionService: purchase.receive
Purchase API -> PurchaseService: receive items
PurchaseService -> PostgreSQL: BEGIN
PurchaseService -> PostgreSQL: LOCK purchase order
PurchaseService -> InventoryService: increase inventory
InventoryService -> PostgreSQL: LOCK inventory rows
InventoryService -> PostgreSQL: INSERT stock movements
PurchaseService -> PostgreSQL: UPDATE supplier balance
PurchaseService -> PostgreSQL: COMMIT
Purchase API -> User: updated PO
```

### Transfer

```text
Manager -> Transfer API: create transfer
Approver -> Transfer API: approve transfer
Warehouse -> Transfer API: dispatch
TransferService -> InventoryService: source delta negative
Receiving Branch -> Transfer API: receive
TransferService -> InventoryService: destination delta positive
TransferService -> Transfer API: complete transfer
```

## 9. Permission Matrix

| Permission | Super Admin | Company Admin | Inventory Manager | Warehouse Manager | Branch Manager | Cashier | Auditor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| company.manage | Yes | No | No | No | No | No | Read |
| branch.manage | Yes | Yes | No | No | Read | No | Read |
| warehouse.manage | Yes | Yes | Yes | Yes | Read | No | Read |
| product.read | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| product.create | Yes | Yes | Yes | No | No | No | No |
| product.update | Yes | Yes | Yes | No | No | No | No |
| inventory.read | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| inventory.adjust | Yes | Yes | Yes | No | No | No | No |
| inventory.adjust.approve | Yes | Yes | Yes | Yes | Yes | No | No |
| purchase.create | Yes | Yes | Yes | Yes | No | No | Read |
| purchase.approve | Yes | Yes | Yes | No | Yes | No | Read |
| purchase.receive | Yes | Yes | Yes | Yes | No | No | Read |
| transfer.create | Yes | Yes | Yes | Yes | Yes | No | Read |
| transfer.approve | Yes | Yes | Yes | Yes | Yes | No | Read |
| transfer.dispatch | Yes | Yes | Yes | Yes | No | No | Read |
| transfer.receive | Yes | Yes | Yes | Yes | Yes | No | Read |
| sale.create | Yes | Yes | No | No | Yes | Yes | Read |
| report.view | Yes | Yes | Yes | Yes | Yes | No | Yes |
| audit.view | Yes | Yes | No | No | No | No | Yes |

## 10. Frontend Architecture

### Application Structure

```text
src/
  app/
    router.tsx
    queryClient.ts
    permissions.ts
  api/
    httpClient.ts
    products.ts
    inventory.ts
    purchases.ts
    transfers.ts
    reports.ts
  stores/
    authStore.ts
    tenantStore.ts
    uiStore.ts
  features/
    dashboard/
    products/
    inventory/
    adjustments/
    purchases/
    suppliers/
    transfers/
    reports/
    alerts/
  components/
    DataTable/
    BarcodeScanner/
    Form/
    Filters/
    PermissionGate.tsx
```

### UI Requirements

- Dashboard: current stock value, low-stock count, expiry alerts, transfer queue, purchase receiving queue
- Inventory table: server-side pagination, search, category/brand/warehouse filters, barcode lookup, quantity badges
- Product screen: product form, barcode generation, pricing, tracking toggles, image upload
- Barcode scanning: hardware scanner input support, camera scanning fallback, scan history, invalid barcode feedback
- Adjustment screen: draft lines, reason, approval status, manager approval controls
- Purchase screen: PO builder, supplier selector, tax/discount totals, partial receiving
- Transfer screen: source/destination selectors, status timeline, dispatch and receive quantities
- Supplier page: balances, purchase history, returns, payment terms
- Reports: filter panels, export CSV/PDF, saved filters, date range presets
- Alerts: dashboard widget, severity filters, acknowledge/resolve actions

### React Query Keys

```ts
["products", companyId, filters]
["inventory", companyId, branchId, warehouseId, filters]
["stock-movements", companyId, filters]
["purchase-orders", companyId, filters]
["transfers", companyId, filters]
["alerts", companyId, branchId, status]
```

## 11. Reporting Design

### Current Stock

Source: `inventory_balances` joined to products, warehouses, branches.

Required filters:

- company
- branch
- warehouse
- category
- brand
- supplier
- search

### Stock Valuation

Valuation options:

- weighted average: inventory quantity multiplied by moving average cost
- FIFO: sum remaining batch quantities by receipt cost
- latest cost: current quantity multiplied by latest purchase cost

### Movement Report

Source: `stock_movements`.

Rules:

- Never derived from current inventory.
- Always filter by company.
- Branch filter required for branch-limited users.
- Export must preserve filters and include generated-by metadata.

## 12. Alerts and Notifications

### Low Stock

Condition:

```text
current_quantity <= product.reorder_level
```

Alert generation:

- Synchronous check after each stock mutation for affected product/location
- Scheduled reconciliation job every 15 minutes
- Deduplicate open alerts by company, branch, warehouse, product, alert type

### Expiry

Rules:

- Near expiry threshold defaults to 30 days, configurable by company/category
- Expired batches are excluded from sellable stock
- Expiry worker runs daily and after receiving tracked batches

Channels:

- Dashboard and WebSocket
- Email via Celery
- SMS provider integration
- Push notifications

## 13. Security Considerations

- Enforce company isolation in all querysets and repository methods.
- Never trust company or branch IDs from the client without checking JWT authorization.
- Use object-level permission checks for cross-branch access.
- Use short-lived JWT access tokens and rotated refresh tokens.
- Store password hashes with Argon2 or bcrypt.
- Rate-limit auth, barcode lookup, and exports.
- Log failed permission attempts.
- Use immutable stock movements and audit logs.
- Require approval for stock adjustments and purchase approvals.
- Validate CSV imports in staging tables before committing catalog changes.
- Scan uploaded files and store in private object storage.
- Mask tax numbers and sensitive supplier data where roles require it.

## 14. Performance and Scalability

### Database

- Partition `stock_movements` by month or quarter for high-volume tenants.
- Add composite indexes matching report filters.
- Use read replicas for reporting when eventual consistency is acceptable.
- Use materialized views for valuation summaries if reports exceed SLA.
- Keep transaction scopes short and deterministic.

### API

- Server-side pagination for all list endpoints.
- Default page size should be 50-100 rows with a hard maximum of 200 rows per request.
- Data tables must render bounded pages with sticky headers, horizontal scroll for wide inventory data, and vertical scroll constrained to the viewport.
- Search, filter, and sort must be server-side for products, stock movements, purchases, transfers, suppliers, and reports.
- CSV/PDF/Excel exports for thousands of rows must run asynchronously and should not depend on the currently rendered table page.
- Cursor pagination for stock movements and audit logs.
- Cache static catalog filters in Redis.
- Use ETags for product detail and category tree responses.
- Generate large exports asynchronously.

### Real Time

- Publish inventory updates after commit.
- WebSocket payloads should contain changed product, warehouse, branch, and new quantities.
- POS clients should refetch authoritative stock before final checkout.

## 15. Reliability Rules

- All inventory writes use `transaction.atomic`.
- All affected inventory rows use `select_for_update`.
- Movement creation happens in the same transaction as balance update.
- Retry transient deadlocks with bounded exponential backoff.
- Use idempotency keys for checkout, receiving, adjustment posting, and transfers.
- Reconciliation jobs compare stock movements against inventory balances.
- Failed alert notifications do not rollback stock operations.

## 16. Edge Cases

- Duplicate barcode in same company: reject.
- Same barcode in different company: allowed.
- Product marked inactive with existing stock: hide from sale, allow transfer/adjustment/reporting.
- Supplier deleted with purchase history: soft delete only.
- Partial purchase receiving with batch tracking: require batch details for tracked products.
- Transfer dispatched but partially received: track remaining in transit.
- Expired item scanned in POS: block sale and show replacement batches if available.
- Negative stock override: require product flag plus explicit permission and audit reason.
- Branch-limited user requests another branch: return 403.
- CSV import contains mixed company data: reject whole file or isolate rows in validation errors.
- Concurrent checkout for last item: first transaction commits, second receives insufficient stock.
- Return to damaged condition: increase damaged quantity, not sellable current quantity.
- Deleted category with products: block delete or require reassignment.

## 17. Deployment Recommendations

- Run API, worker, scheduler, and WebSocket services as separate containers.
- Use PostgreSQL 15+ with automated backups, PITR, and encrypted storage.
- Use Redis for cache, Celery broker, idempotency locks, and WebSocket fanout.
- Use object storage for product images and import/export files.
- Enable structured JSON logs and distributed tracing.
- Use blue/green or rolling deployments.
- Run migrations separately before application rollout.
- Maintain staging environment with production-like data volume.
- Add SLOs: API p95 under 2 seconds, checkout p95 under 500 ms excluding payment gateway.

## 18. Best Practices Checklist

- [ ] Every tenant table has `company_id`.
- [ ] Every branch-scoped query enforces branch authorization.
- [ ] Every stock change creates exactly one or more stock movement records.
- [ ] Stock movements and audit logs are immutable.
- [ ] No destructive deletes for history-bearing records.
- [ ] All stock writes are transactional.
- [ ] All checkout, receive, transfer, and adjustment endpoints support idempotency keys.
- [ ] All report exports include filters, company, branch, user, and timestamp metadata.
- [ ] All approval workflows record approver and timestamp.
- [ ] Reconciliation jobs run on a schedule and alert on discrepancies.
