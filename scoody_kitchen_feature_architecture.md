# Scoody Kitchen / Pet Platform — Feature Architecture & Build Plan

## 1. Purpose

This document defines the **architecture and build approach** for the Scoody Kitchen / Pet Platform project.

We are **not implementing the features yet**.

The goal is to first create a clear technical design document and then review the system **one feature at a time**.

The agreed development direction is:

> **Backend first → API contract → MCP/AI integration where required → Frontend**

Each feature will be designed independently, but all features must follow the same architectural standards.

---

# 2. Existing System Context

The uploaded project already contains three major backend-oriented areas:

```text
scoody_kitchen/
│
├── pet-platform-backend/
│   ├── FastAPI application
│   ├── PostgreSQL / SQLAlchemy
│   ├── Alembic migrations
│   ├── Authentication
│   ├── Products
│   ├── Inventory
│   ├── Cart
│   ├── Orders
│   ├── Payments
│   ├── Pets
│   ├── Doctors
│   ├── Consultations
│   └── Admin
│
├── pet-platform-mcp-server/
│   ├── MCP server
│   └── MCP tools for platform operations
│
├── chatbot-service/
│   ├── AI agents
│   ├── Supervisor
│   ├── RAG
│   ├── Redis memory
│   ├── MCP client
│   └── Chat / voice / image APIs
│
└── frontend/
    └── React / Vite application
```

The backend already follows an important separation:

```text
API Router
    ↓
Service
    ↓
Database / external provider
```

The architecture document will preserve this separation instead of putting business logic directly inside route handlers.

---

# 3. Overall Platform Architecture

```text
                         ┌───────────────────┐
                         │     Frontend      │
                         │   React + Vite    │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │   API Gateway /   │
                         │     FastAPI       │
                         └─────────┬─────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
       ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
       │ Core Domain │      │ Commerce    │      │ Healthcare  │
       │             │      │             │      │             │
       │ Auth        │      │ Products    │      │ Doctors     │
       │ Users       │      │ Inventory   │      │ Consults    │
       │ Pets        │      │ Cart        │      │ Health      │
       └──────┬──────┘      │ Orders      │      │ Records     │
              │             │ Payments    │      └──────┬──────┘
              │             └──────┬──────┘             │
              └────────────────────┼────────────────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │    PostgreSQL     │
                         └───────────────────┘

                                   ▲
                                   │
                         ┌─────────┴─────────┐
                         │   MCP Server      │
                         │ Platform Tools    │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │  Chatbot Service  │
                         │ Agents + RAG      │
                         │ Memory + MCP      │
                         └───────────────────┘
```

---

# 4. Feature-by-Feature Architecture Strategy

We will not design the entire implementation in one pass.

Each feature follows this process:

```text
1. Define business purpose
        ↓
2. Define actors and permissions
        ↓
3. Define domain model
        ↓
4. Define database tables
        ↓
5. Define relationships
        ↓
6. Define API endpoints
        ↓
7. Define request schemas
        ↓
8. Define response schemas
        ↓
9. Define service/business logic
        ↓
10. Define repository/database operations
        ↓
11. Define validation
        ↓
12. Define authorization
        ↓
13. Define transactions / consistency
        ↓
14. Define caching if required
        ↓
15. Define external integrations
        ↓
16. Define error handling
        ↓
17. Define security requirements
        ↓
18. Define edge cases
        ↓
19. Define test strategy
        ↓
20. Approve architecture
        ↓
21. Move to next feature
```

Only after the backend architecture of the feature is approved do we design its frontend.

---

# 5. Feature Order

The initial feature sequence is:

```text
Feature 01 → Authentication & Identity
Feature 02 → User Profile
Feature 03 → Pets
Feature 04 → Categories
Feature 05 → Products
Feature 06 → Inventory
Feature 07 → Cart
Feature 08 → Checkout & Orders
Feature 09 → Payments
Feature 10 → Shipping & Tracking
Feature 11 → Doctor Discovery
Feature 12 → Doctor / Clinic Management
Feature 13 → Consultation Booking
Feature 14 → Pet Health Records
Feature 15 → Notifications
Feature 16 → Admin
Feature 17 → MCP Platform Tools
Feature 18 → AI Chatbot
Feature 19 → RAG / Knowledge
Feature 20 → Multimodal AI
```

The order can be changed when dependencies require it.

---

# 6. Standard Backend Architecture

Every normal backend feature should follow:

```text
                    HTTP Request
                         │
                         ▼
                ┌─────────────────┐
                │     Router      │
                │   API Layer     │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │    Schema       │
                │ Validation      │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │    Service      │
                │ Business Logic  │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │   Repository    │
                │ Data Access     │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │   PostgreSQL    │
                └─────────────────┘
```

### Responsibilities

#### Router

Responsible for:

- HTTP methods
- URL paths
- dependency injection
- authentication dependencies
- request/response schemas
- HTTP status codes

The router should not contain complicated business rules.

#### Schema

Responsible for:

- request validation
- response serialization
- type contracts
- input normalization

#### Service

Responsible for:

- business rules
- workflows
- transaction boundaries
- coordinating repositories
- external service calls
- domain-level validation

#### Repository / Data Access

Responsible for:

- database queries
- inserts
- updates
- deletes
- relationship loading

#### Model

Responsible for:

- database representation
- relationships
- constraints
- indexes

---

# 7. Cross-Cutting Components

These components support multiple features.

## Authentication

```text
app/core/security.py
app/dependencies/auth.py
app/api/auth.py
app/services/auth_service.py
```

Used by:

- users
- pets
- cart
- orders
- consultations
- doctors
- admin
- MCP/internal services

## Database

```text
app/core/database.py
app/models/
app/migrations/
```

## Configuration

```text
app/core/config.py
```

All secrets and environment-specific values must remain outside source code.

## Cache

```text
app/core/cache.py
```

Redis/cache should be introduced only where it provides a clear benefit.

Examples:

- authentication revocation
- frequently accessed public data
- rate limiting
- temporary state

## Rate Limiting

```text
app/core/limiter.py
```

Sensitive endpoints should have appropriate limits.

## Pagination

```text
app/core/pagination.py
app/schemas/pagination.py
```

All collection endpoints should use a consistent pagination and metadata contract.

---

# 8. Feature 01 — Authentication & Identity

## 8.1 Goal

Authentication establishes:

- user identity
- account creation
- login
- session/token management
- logout
- account activation
- role information
- authorization foundation

This feature is the foundation for almost every other feature.

---

# 9. Authentication Actors

The system currently has multiple role concepts.

The architecture should treat roles as authorization attributes rather than separate authentication systems.

Example:

```text
User
 ├── CUSTOMER
 ├── DOCTOR
 └── ADMIN
```

The authentication mechanism remains shared.

Authorization determines what each role can access.

---

# 10. Authentication Architecture

```text
                         Client
                           │
                           ▼
                    ┌──────────────┐
                    │ Auth Router  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Auth Service │
                    └──────┬───────┘
                           │
              ┌────────────┼─────────────┐
              │            │             │
              ▼            ▼             ▼
        Magic Link     Google OAuth   Phone OTP
              │            │             │
              └────────────┼─────────────┘
                           ▼
                    ┌──────────────┐
                    │ User Model   │
                    └──────┬───────┘
                           │
                           ▼
                     PostgreSQL

After authentication:

User
 ↓
Access Token
 ↓
Authentication Dependency
 ↓
Current User
 ↓
Role Authorization
 ↓
Protected Feature
```

---

# 11. Current Authentication Components

The uploaded backend already contains:

```text
app/api/auth.py
app/services/auth_service.py
app/schemas/auth.py
app/models/user.py
app/models/refresh_token.py
app/models/magic_link_token.py
app/dependencies/auth.py
app/core/security.py
```

It currently supports or contains infrastructure for:

- registration through magic-link flow
- login magic link
- magic-link verification
- Google authentication
- access tokens
- refresh tokens
- logout
- current-user retrieval
- user profile update
- avatar upload
- phone verification / OTP-related flows
- role-based authorization

Therefore, the architecture document should describe this as an existing capability to be reviewed and standardized, not something to blindly recreate.

---

# 12. Authentication API Boundary

The authentication API should conceptually expose:

```text
POST   /auth/register
POST   /auth/magic-link
GET    /auth/magic-link/verify
POST   /auth/magic-link/verify-token
POST   /auth/magic-link/verify-code

POST   /auth/google

POST   /auth/logout
POST   /auth/refresh

GET    /auth/me
PATCH  /auth/me

POST   /auth/upload-avatar
POST   /auth/firebase/verify-phone
POST   /auth/request-otp
```

The exact endpoint contract will be reviewed before implementation.

---

# 13. Authentication Data Model

Core entities:

```text
User
 │
 ├── RefreshToken
 │
 ├── MagicLinkToken
 │
 └── future authentication providers / verification records
```

Conceptual User:

```text
User
├── id
├── email
├── first_name
├── last_name
├── phone
├── profile_image_url
├── role
├── auth_provider
├── is_email_verified
├── is_phone_verified
├── is_active
└── timestamps
```

Authentication-specific temporary state should not be mixed into the main user table when a separate table is more appropriate.

For example:

```text
User
   │
   ├── RefreshToken
   │
   └── MagicLinkToken
```

---

# 14. Token Architecture

The system uses:

```text
Access Token
+
Refresh Token
```

Conceptually:

```text
Login
 │
 ▼
Create Access Token
 │
 ├── short lifetime
 └── used for API authorization

Create Refresh Token
 │
 ├── longer lifetime
 └── used to obtain new access token
```

The backend also maintains server-side refresh-token records so individual refresh sessions can be revoked.

Access-token revocation can use the cache/blacklist mechanism.

---

# 15. Authentication Request Flow

Example: magic-link login.

```text
Client
  │
  │ POST /auth/magic-link
  ▼
Auth Router
  │
  ▼
Auth Service
  │
  ├── normalize email
  ├── find/create user
  ├── generate verification token/code
  ├── store hashed/temporary credential
  └── send email
  │
  ▼
Email Service
```

Verification:

```text
Client
  │
  │ verification token/code
  ▼
Auth Router
  │
  ▼
Auth Service
  │
  ├── validate token/code
  ├── check expiration
  ├── prevent replay
  ├── mark identity verified
  └── create token pair
  │
  ▼
Access + Refresh Tokens
```

---

# 16. Authorization Architecture

Authentication answers:

> Who is the user?

Authorization answers:

> What is the user allowed to do?

Architecture:

```text
Request
  ↓
get_current_user()
  ↓
Current User
  ↓
require_role()
 / require_roles()
  ↓
Protected endpoint
```

Examples:

```text
CUSTOMER
 ├── own profile
 ├── own pets
 ├── own cart
 ├── own orders
 └── own consultations

DOCTOR
 ├── doctor profile
 ├── availability
 ├── assigned consultations
 └── permitted health records

ADMIN
 ├── platform management
 ├── products
 ├── orders
 ├── doctors
 └── system administration
```

Ownership checks are still required even when the user is authenticated.

Authentication must never be treated as proof that the user owns the requested resource.

---

# 17. Authentication Security Requirements

Before implementation approval, the architecture must enforce:

- secure password/token handling where passwords are used
- short-lived access tokens
- refresh-token expiration
- refresh-token revocation
- token rotation where appropriate
- secure HTTP-only cookies when cookie authentication is used
- HTTPS in production
- rate limiting
- verification-code expiration
- verification-code replay protection
- generic responses where account enumeration is a risk
- strict role authorization
- resource ownership validation
- no secrets in logs
- no raw tokens in application logs
- internal service authentication separated from end-user authentication

---

# 18. Internal Service Authentication

The project contains internal services:

```text
chatbot-service
        │
        ▼
pet-platform-mcp-server
        │
        ▼
pet-platform-backend
```

These should not authenticate like a normal customer.

Use a separate internal-service trust model:

```text
Chatbot Service
       │
       │ short-lived internal credential
       ▼
Backend
       │
       ▼
verify_internal_service()
```

The same principle applies to MCP.

Internal credentials must be:

- short lived
- signed
- issuer restricted
- secret protected
- rejected when expired
- rejected when signature validation fails

---

# 19. Authentication Error Model

All features should eventually use a consistent error format.

Conceptual structure:

```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Authentication required",
    "details": null
  }
}
```

Possible authentication codes:

```text
INVALID_CREDENTIALS
AUTHENTICATION_REQUIRED
INVALID_TOKEN
TOKEN_EXPIRED
TOKEN_REVOKED
ACCOUNT_INACTIVE
EMAIL_NOT_VERIFIED
INVALID_VERIFICATION_CODE
VERIFICATION_CODE_EXPIRED
INSUFFICIENT_PERMISSIONS
```

The final error contract will be standardized across the whole backend.

---

# 20. Authentication Testing Strategy

Tests should cover:

### Registration

```text
valid registration
duplicate email
invalid email
invalid input
rate limit
```

### Magic Link

```text
request link
verify valid token
expired token
invalid token
replayed token
invalid verification code
rate limiting
```

### Tokens

```text
valid access token
expired access token
invalid signature
wrong token type
revoked token
missing token
refresh token
revoked refresh token
expired refresh token
```

### Authorization

```text
customer → customer resource
customer → another customer's resource
doctor → doctor resource
customer → doctor-only endpoint
admin → admin endpoint
```

### Internal Services

```text
valid internal credential
expired credential
invalid issuer
invalid signature
missing configuration
```

---

# 21. How We Will Build Each Future Feature

After authentication, every feature will use the same design template.

For example, Products:

```text
PRODUCT FEATURE

1. Business requirements
2. Actors
3. Product domain model
4. Product database tables
5. Category relationship
6. Product image relationship
7. Inventory relationship
8. Search requirements
9. API endpoints
10. Request schemas
11. Response schemas
12. Service logic
13. Repository queries
14. Pagination
15. Filtering
16. Sorting
17. Caching
18. Authorization
19. Validation
20. Error handling
21. Performance
22. Security
23. Tests
24. Frontend contract
```

We will repeat this structure for every feature.

---

# 22. Backend → MCP → Frontend Strategy

Not every feature needs MCP.

Normal business features:

```text
Frontend
   ↓
FastAPI
   ↓
Service
   ↓
Database
```

AI-driven features:

```text
Frontend
   ↓
Chatbot Service
   ↓
Agent / Supervisor
   ↓
MCP Client
   ↓
MCP Server
   ↓
Backend APIs / Services
   ↓
Database / external providers
```

MCP should be used as a controlled tool interface for AI agents, not as a replacement for the core backend API.

---

# 23. Development Sequence

The project documentation will progress in this order:

```text
PHASE A — Core Backend Architecture
    │
    ├── Authentication
    ├── User Profile
    └── Pets

PHASE B — Commerce
    │
    ├── Categories
    ├── Products
    ├── Inventory
    ├── Cart
    ├── Orders
    ├── Payments
    └── Shipping

PHASE C — Healthcare
    │
    ├── Doctor Discovery
    ├── Doctor Management
    ├── Availability
    ├── Consultations
    └── Health Records

PHASE D — Platform Services
    │
    ├── Notifications
    ├── Admin
    └── Internal APIs

PHASE E — AI Platform
    │
    ├── MCP
    ├── Chatbot
    ├── Agents
    ├── RAG
    ├── Memory
    └── Multimodal AI

PHASE F — Frontend
    │
    └── Build frontend against approved backend contracts
```

---

# 24. Important Rule for This Document

We will **not jump to frontend implementation** while backend architecture is still unclear.

For each feature:

```text
Understand
   ↓
Architect
   ↓
Review
   ↓
Approve
   ↓
Document
   ↓
Implement later
```

This prevents the frontend from forcing incorrect backend contracts.

---

# 25. Current Status

## Completed in this document

- Overall system architecture
- Feature sequencing
- Standard backend architecture
- Cross-cutting components
- Feature 01 — Authentication & Identity architecture
- Authentication data model
- Authentication API boundary
- Token architecture
- Authorization architecture
- Internal service authentication
- Security requirements
- Testing strategy
- Backend → MCP → Frontend strategy

## Next feature

**Feature 02 — User Profile**

The next discussion should focus only on:

```text
User Profile
├── Domain model
├── Database fields
├── Profile ownership
├── Profile APIs
├── Update flow
├── Avatar handling
├── Phone/email verification relationship
├── Validation
├── Authorization
├── Error handling
├── Security
└── Tests
```

After the User Profile architecture is agreed upon, we move to **Feature 03 — Pets**.
