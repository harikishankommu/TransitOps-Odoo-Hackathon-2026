# TransitOps — Fleet Operations Management Platform

> A role-based, full-stack fleet operations platform built for the Odoo Hackathon 2026.

TransitOps brings vehicles, drivers, trips, maintenance, fuel, expenses, reports, notifications, and administrative controls into one connected system. The project is designed to replace fragmented spreadsheets and manual fleet workflows with a single operational dashboard.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Our Solution](#our-solution)
3. [Core Features](#core-features)
4. [User Roles and Access](#user-roles-and-access)
5. [Technology Stack](#technology-stack)
6. [System Architecture](#system-architecture)
7. [Project Structure](#project-structure)
8. [Important Business Workflows](#important-business-workflows)
9. [Database Model](#database-model)
10. [Installation and Local Setup](#installation-and-local-setup)
11. [All Important Commands Used](#all-important-commands-used)
12. [Environment Variables](#environment-variables)
13. [Running the Project](#running-the-project)
14. [Build and Production Run](#build-and-production-run)
15. [Testing and Validation](#testing-and-validation)
16. [API Overview](#api-overview)
17. [Security Design](#security-design)
18. [Git and GitHub Workflow](#git-and-github-workflow)
19. [Deployment Notes](#deployment-notes)
20. [Demo Flow](#demo-flow)
21. [Troubleshooting](#troubleshooting)
22. [Known Limitations](#known-limitations)
23. [Future Improvements](#future-improvements)
24. [Author](#author)

---

## Problem Statement

Fleet operations are often managed using separate spreadsheets, phone calls, paper records, and disconnected tools. This creates several practical problems:

- A vehicle may be assigned to more than one trip.
- A driver with an expired licence may be assigned accidentally.
- A vehicle under maintenance may still appear available for dispatch.
- Cargo may exceed the selected vehicle's maximum capacity.
- Fuel and maintenance expenses may be recorded inconsistently.
- Management may not have a real-time view of fleet utilization, cost, revenue, or operational risk.
- Different employees may access or modify information outside their responsibility.
- Important events such as licence expiry, overdue maintenance, or long-running trips may be missed.

The main challenge is therefore to build a centralized fleet operations system that connects operational data and enforces business rules automatically.

---

## Our Solution

TransitOps is a full-stack fleet operations platform with role-based access control.

The application connects the complete fleet lifecycle:

```text
Vehicle and Driver Registration
        ↓
Trip Planning
        ↓
Dispatch Validation
        ↓
Active Trip
        ↓
Trip Completion
        ↓
Fuel and Revenue Recording
        ↓
Maintenance and Expense Tracking
        ↓
Dashboard, Reports, and Notifications
```

The system does not only store data. It also validates operational rules before allowing important actions.

Examples:

- A vehicle must be `AVAILABLE` before dispatch.
- A driver must be `AVAILABLE` and must have a valid licence.
- Cargo weight cannot exceed the vehicle's maximum load capacity.
- Dispatch changes the assigned vehicle and driver to `ON_TRIP`.
- Trip completion restores both resources to `AVAILABLE`.
- A vehicle entering maintenance changes to `IN_SHOP`.
- Completing or cancelling maintenance restores the vehicle to `AVAILABLE`.
- Automatically created financial records are protected from unsafe manual editing.
- Notifications are generated for important operational risks.

---

## Core Features

### 1. Authentication and User Management

- User registration and login
- Password hashing using bcrypt
- JWT-based authentication
- Session validation using `/auth/me`
- Account activation and deactivation
- Administrator-controlled role management
- Protection against disabling or demoting the final active administrator

### 2. Role-Based Access Control

TransitOps validates permissions at two levels:

```text
Frontend permission checks
        +
Backend route authorization
```

Hiding a button in the frontend is not treated as sufficient security. Sensitive backend routes also use authentication and role validation.

### 3. Vehicle Management

- Create, view, search, filter, sort, and paginate vehicles
- Edit vehicle information
- Unique registration-number validation
- Vehicle type, model, fuel type, region, capacity, odometer, and cost tracking
- Vehicle status lifecycle:
  - `AVAILABLE`
  - `ON_TRIP`
  - `IN_SHOP`
  - `RETIRED`
- Safe retirement workflow
- Protection against deleting vehicles with operational history
- Complete vehicle history for trips, maintenance, fuel, and expenses

### 4. Driver Management

- Create, view, search, filter, sort, and paginate drivers
- Unique licence-number validation
- Licence category and expiry tracking
- Driver contact, region, and safety score
- Driver status lifecycle:
  - `AVAILABLE`
  - `ON_TRIP`
  - `OFF_DUTY`
  - `SUSPENDED`
- Suspend and activate workflows
- Protection against suspending a driver during an active trip
- Optional linking between a Driver user account and a driver profile
- Complete driver trip history

### 5. Trip and Dispatch Management

- Create and edit draft trips
- Source and destination
- Vehicle and driver assignment
- Cargo description and cargo weight
- Planned distance and start time
- Revenue and notes
- Search, filters, sorting, and pagination
- Trip lifecycle:
  - `DRAFT`
  - `DISPATCHED`
  - `COMPLETED`
  - `CANCELLED`

Dispatch validation includes:

```text
Vehicle is AVAILABLE
Driver is AVAILABLE
Driver licence is valid
Driver is not suspended
Driver is not off duty
Cargo is within capacity
Vehicle is not double-booked
Driver is not double-booked
```

Trip completion includes:

- Actual distance
- Final odometer
- Fuel consumed
- Final revenue
- Completion notes
- Automatic vehicle and driver release
- Automatic fuel-log creation when fuel is recorded

### 6. Maintenance Management

- Schedule maintenance for available vehicles
- Maintenance type, provider, dates, description, cost, and odometer
- Search, filters, sorting, and pagination
- Maintenance details page
- Complete and cancel workflows
- Duplicate active maintenance prevention
- Automatic vehicle status transition to `IN_SHOP`
- Vehicle restoration to `AVAILABLE` after completion or cancellation
- Automatic maintenance expense creation
- Admin-only deletion rules for safe records

### 7. Fuel Management

- Manual fuel-log creation
- Optional trip linkage
- Fuel quantity
- Price per litre
- Total fuel cost
- Odometer reading
- Fuel station
- Receipt number
- Date and notes
- Search, filters, sorting, and pagination
- Duplicate receipt and duplicate transaction protection
- Protection for automatically generated trip fuel records

### 8. Expense Management

- Manual operational expense tracking
- Optional vehicle and trip linkage
- Supported expense categories:
  - Toll
  - Parking
  - Maintenance
  - Permit
  - Driver allowance
  - Repair
  - Insurance
  - Other
- Amount, date, description, and receipt number
- Protected automatically generated maintenance expenses
- Edit and delete controls for permitted manual records

### 9. Dashboard and Analytics

- Role-aware operational dashboard
- Vehicle status distribution
- Trip status distribution
- Revenue-versus-expense trends
- Fleet utilization
- Available vehicles and drivers
- Active and draft trips
- Fuel and maintenance costs
- Recent trips
- Recent maintenance activity
- Recent system activity
- Driver licence alerts

### 10. Reports

- Vehicle report
- Financial report
- Fuel report
- Maintenance report
- Driver report
- Date filtering
- Vehicle and driver filtering
- CSV export
- Print-friendly report layout

### 11. Notifications

- All, unread, and read tabs
- Notification-type filtering
- Pagination
- Mark one notification as read
- Mark all notifications as read
- Delete one notification
- Clear read notifications
- Sidebar unread badge synchronization
- Automated duplicate-safe alerts for:
  - Expired licences
  - Licences expiring soon
  - Overdue maintenance
  - Long-running workshop records
  - High-odometer milestones
  - Overdue draft trips
  - Long-running dispatched trips

---

## User Roles and Access

| Role | Main Responsibilities |
|---|---|
| `ADMIN` | Full access, user management, all modules, system oversight |
| `FLEET_MANAGER` | Vehicles, maintenance, fleet cost data, reports |
| `DISPATCHER` | Vehicles, drivers, trip planning, dispatch operations |
| `SAFETY_OFFICER` | Drivers, licence compliance, suspension workflows, safety reports |
| `FINANCIAL_ANALYST` | Fuel, expenses, financial analytics, reports |
| `DRIVER` | Own assigned trips, trip completion, personal notifications |

The `ADMIN` role is handled as a universal role in the permission utility.

---

## Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Lucide React

### Backend

- Node.js
- Express
- TypeScript
- JWT authentication
- bcrypt password hashing

### Data Layer

- JSON-based persistent development database
- In-memory object access with file persistence
- Data-integrity validation
- Automatic migration and corruption backup support

### Tooling

- TypeScript compiler
- `tsx` for development execution
- `esbuild` for server production bundling
- npm scripts for development, validation, build, and start

---

## System Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                      │
│                                                         │
│ Pages → Components → Auth Context → apiFetch Utility   │
│                                                         │
│ Frontend permissions control visible modules/actions    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ HTTP / JSON
                        │ Authorization: Bearer <JWT>
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Express Backend                      │
│                                                         │
│ server.ts                                               │
│   └── /api router                                       │
│         ├── Authentication middleware                   │
│         ├── Role authorization                          │
│         ├── Request validation                          │
│         ├── Operations service                          │
│         └── Notification service                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 Database Manager                        │
│                                                         │
│ Users, Vehicles, Drivers, Trips, Maintenance, Fuel,    │
│ Expenses, Activity Logs, and Notifications              │
│                                                         │
│ Stored locally in src/server/db.json                     │
└─────────────────────────────────────────────────────────┘
```

### Important entry-point note

This project does **not** require:

```text
src/server/index.ts
```

The actual application entry point is the root-level file:

```text
server.ts
```

This is confirmed by the npm scripts:

```json
"dev": "tsx server.ts",
"build": "vite build && esbuild server.ts ...",
"start": "node dist/server.cjs"
```

Therefore, the missing `src/server/index.ts` is not an error.

---

## Project Structure

```text
TransitOps-Odoo-Hackathon-2026/
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── VehicleFormModal.tsx
│   │   ├── DriverFormModal.tsx
│   │   ├── TripFormModal.tsx
│   │   ├── CompleteTripModal.tsx
│   │   ├── MaintenanceFormModal.tsx
│   │   ├── CompleteMaintenanceModal.tsx
│   │   ├── FuelLogFormModal.tsx
│   │   └── ExpenseFormModal.tsx
│   │
│   ├── context/
│   │   └── AuthContext.tsx
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── VehiclesPage.tsx
│   │   ├── VehicleDetailsPage.tsx
│   │   ├── DriversPage.tsx
│   │   ├── DriverDetailsPage.tsx
│   │   ├── TripsPage.tsx
│   │   ├── TripDetailsPage.tsx
│   │   ├── MaintenancePage.tsx
│   │   ├── MaintenanceDetailsPage.tsx
│   │   ├── FuelExpensesPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── UsersPage.tsx
│   │   └── NotificationsPage.tsx
│   │
│   ├── server/
│   │   ├── database.ts
│   │   ├── db.json
│   │   ├── routers/
│   │   │   └── api.ts
│   │   ├── services/
│   │   │   ├── operations.ts
│   │   │   └── notificationService.ts
│   │   └── utils/
│   │       └── auth.ts
│   │
│   ├── utils/
│   │   ├── api.ts
│   │   └── permissions.ts
│   │
│   ├── App.tsx
│   └── types.ts
│
├── server.ts
├── vite.config.ts
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Important Business Workflows

### Trip Workflow

```text
DRAFT
  ├── Dispatch → DISPATCHED
  │                  ├── Complete → COMPLETED
  │                  └── Cancel   → CANCELLED
  └── Cancel   → CANCELLED
```

Resource transitions:

```text
Before Dispatch:
Vehicle = AVAILABLE
Driver  = AVAILABLE

After Dispatch:
Vehicle = ON_TRIP
Driver  = ON_TRIP

After Completion or Dispatched-Trip Cancellation:
Vehicle = AVAILABLE
Driver  = AVAILABLE
```

### Maintenance Workflow

```text
Vehicle AVAILABLE
        ↓
Start Maintenance
        ↓
Vehicle IN_SHOP
Maintenance IN_PROGRESS
        ├── Complete → COMPLETED + Vehicle AVAILABLE
        └── Cancel   → CANCELLED + Vehicle AVAILABLE
```

### Driver Safety Workflow

```text
AVAILABLE or OFF_DUTY
        ↓
Suspend
        ↓
SUSPENDED
        ↓
Activate after licence validation
        ↓
AVAILABLE
```

### Vehicle Lifecycle

```text
AVAILABLE
  ├── Trip Dispatch → ON_TRIP
  ├── Maintenance   → IN_SHOP
  └── Retirement    → RETIRED
```

---

## Database Model

The database contains these main collections:

```text
users
vehicles
drivers
trips
maintenance_logs
fuel_logs
expenses
activity_logs
notifications
```

### Important relationships

```text
Driver.user_id        → User.id
Trip.vehicle_id       → Vehicle.id
Trip.driver_id        → Driver.id
Maintenance.vehicle_id→ Vehicle.id
FuelLog.vehicle_id    → Vehicle.id
FuelLog.trip_id       → Trip.id
Expense.vehicle_id    → Vehicle.id
Expense.trip_id       → Trip.id
Notification.user_id  → User.id
```

The development database is stored in:

```text
src/server/db.json
```

This file is ignored by Git so local operational data and test records are not pushed accidentally.

---

## Installation and Local Setup

### Prerequisites

Install:

- Git
- A recent Node.js LTS release
- npm
- Visual Studio Code or another editor

Check the installation:

```powershell
node -v
npm -v
git --version
```

### 1. Clone the repository

```powershell
git clone https://github.com/harikishankommu/TransitOps-Odoo-Hackathon-2026.git
```

### 2. Enter the project folder

```powershell
cd TransitOps-Odoo-Hackathon-2026
```

Example local path used during development:

```powershell
cd C:\Users\kommu\OneDrive\Desktop\Odoo\TransitOps-Odoo-Hackathon-2026
```

### 3. Install dependencies

Normal installation:

```powershell
npm install
```

Installation command used when a full development dependency installation was required:

```powershell
npm install --include=dev --no-audit --no-fund --progress=false
```

### 4. Verify npm connectivity when installation has problems

```powershell
npm ping
```

Expected result:

```text
npm notice PING https://registry.npmjs.org/
npm notice PONG
```

### 5. Verify and repair the npm cache

```powershell
npm cache verify
```

### 6. Create the local environment file

PowerShell:

```powershell
Copy-Item .env.example .env
```

Command Prompt:

```cmd
copy .env.example .env
```

Linux or macOS:

```bash
cp .env.example .env
```

### 7. Generate a secure JWT secret

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy the generated value into `.env`.

Example:

```env
JWT_SECRET=place-the-generated-random-secret-here
```

Never commit the real `.env` file.

---

## All Important Commands Used

### Development

```powershell
npm run dev
```

### TypeScript validation

```powershell
npm run typecheck
```

### Lint command

The project currently maps linting to TypeScript validation:

```powershell
npm run lint
```

### Complete build validation

```powershell
npm run check
```

### Production build

```powershell
npm run build
```

### Production start

```powershell
npm start
```

### Remove the generated build

```powershell
npm run clean
```

### Git status

```powershell
git status
```

### See changed file names

```powershell
git diff --name-only
```

### Inspect a specific file before committing

```powershell
git diff -- src/App.tsx
```

### View recent commits

```powershell
git log --oneline -5
```

### Stage all intended files

```powershell
git add -A
```

For safer phase-based commits, stage only the required files:

```powershell
git add src/App.tsx src/pages/DashboardPage.tsx src/pages/ReportsPage.tsx
```

### Create a commit

```powershell
git commit -m "describe the completed change"
```

### Push to GitHub

```powershell
git push origin main
```

### Confirm a clean repository

```powershell
git status
```

Expected:

```text
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

---

## Environment Variables

The `.env.example` file contains:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
JWT_EXPIRES_IN=8h
```

### `PORT`

The port used by the Node.js server.

```env
PORT=3000
```

### `NODE_ENV`

Local development:

```env
NODE_ENV=development
```

Production:

```env
NODE_ENV=production
```

### `JWT_SECRET`

A secret used to sign and verify JWT access tokens.

Requirements enforced by the application:

```text
Must exist
Must contain at least 32 characters
Must not contain the placeholder text "replace-with"
```

### `JWT_EXPIRES_IN`

JWT session lifetime.

Example:

```env
JWT_EXPIRES_IN=8h
```

---

## Running the Project

Start the development server:

```powershell
npm run dev
```

The root `server.ts` file is used as the application entry point.

Open the local URL printed in the terminal. Depending on the server configuration, the application commonly runs through port `3000`.

Example:

```text
http://localhost:3000
```

Keep the terminal open while using the application.

Stop the server with:

```text
Ctrl + C
```

---

## Build and Production Run

### 1. Validate TypeScript

```powershell
npm run typecheck
```

### 2. Build the frontend and backend

```powershell
npm run build
```

The build performs:

```text
Clean dist/
→ TypeScript validation
→ Vite frontend build
→ esbuild server bundle
```

Generated output:

```text
dist/
├── frontend assets
└── server.cjs
```

### 3. Start the production build

```powershell
npm start
```

---

## Testing and Validation

Before every Git commit, run:

```powershell
npm run typecheck
npm run check
npm run dev
```

### Authentication tests

```text
✓ Valid login works
✓ Invalid password is rejected
✓ Disabled user is rejected
✓ Protected endpoints reject missing tokens
✓ Expired or invalid tokens are rejected
```

### Vehicle tests

```text
✓ Create a vehicle
✓ Duplicate registration is rejected
✓ Negative odometer is rejected
✓ Vehicle can be edited
✓ Vehicle with history cannot be deleted
✓ Active vehicle cannot be retired
```

### Driver tests

```text
✓ Create a driver
✓ Duplicate licence is rejected
✓ Invalid safety score is rejected
✓ Expired licence cannot be AVAILABLE
✓ ON_TRIP driver cannot be suspended
✓ Driver history loads correctly
```

### Trip lifecycle test

```text
Create DRAFT trip
→ Dispatch
→ Vehicle becomes ON_TRIP
→ Driver becomes ON_TRIP
→ Complete
→ Vehicle becomes AVAILABLE
→ Driver becomes AVAILABLE
→ Fuel log is generated
```

### Maintenance lifecycle test

```text
Start maintenance
→ Vehicle becomes IN_SHOP
→ Complete or cancel maintenance
→ Vehicle becomes AVAILABLE
```

### Fuel and expense tests

```text
✓ Add a manual fuel record
✓ Duplicate receipt is rejected
✓ Invalid odometer is rejected
✓ Add a manual expense
✓ Protected automatic records cannot be modified unsafely
```

### Notification tests

```text
✓ Unread badge loads
✓ Mark one notification as read
✓ Mark all notifications as read
✓ Delete a notification
✓ Clear read notifications
✓ Badge updates after changes
```

### Browser tests

Press:

```text
F12
```

Check:

```text
Console
Network
```

Successful API responses commonly use:

```text
200 OK
201 Created
204 No Content
```

Expected validation and authorization responses may include:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
```

Unexpected server failures appear as:

```text
500 Internal Server Error
```

---

## API Overview

All application API routes use the prefix:

```text
/api
```

### Authentication

```text
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Users

```text
GET   /api/users
GET   /api/users/:id
PATCH /api/users/:id/role
PATCH /api/users/:id/status
```

### Vehicles

```text
GET    /api/vehicles
GET    /api/vehicles/available
GET    /api/vehicles/:id
GET    /api/vehicles/:id/history
POST   /api/vehicles
PUT    /api/vehicles/:id
PATCH  /api/vehicles/:id/retire
DELETE /api/vehicles/:id
```

### Drivers

```text
GET    /api/drivers
GET    /api/drivers/available
GET    /api/drivers/linkable-users
GET    /api/drivers/:id
GET    /api/drivers/:id/history
POST   /api/drivers
PUT    /api/drivers/:id
PATCH  /api/drivers/:id/suspend
PATCH  /api/drivers/:id/activate
DELETE /api/drivers/:id
```

### Trips

```text
GET    /api/trips
GET    /api/trips/:id
POST   /api/trips
PUT    /api/trips/:id
POST   /api/trips/:id/dispatch
POST   /api/trips/:id/complete
POST   /api/trips/:id/cancel
DELETE /api/trips/:id
```

### Maintenance

```text
GET    /api/maintenance
GET    /api/maintenance/:id
POST   /api/maintenance
POST   /api/maintenance/:id/complete
POST   /api/maintenance/:id/cancel
DELETE /api/maintenance/:id
```

### Fuel and Expenses

```text
GET    /api/fuel
POST   /api/fuel
PUT    /api/fuel/:id
DELETE /api/fuel/:id

GET    /api/expenses
POST   /api/expenses
PUT    /api/expenses/:id
DELETE /api/expenses/:id
```

### Dashboard and Reports

```text
GET /api/dashboard
GET /api/reports
```

The report endpoint accepts date, vehicle, driver, and report-type filters.

### Notifications

```text
GET    /api/notifications
GET    /api/notifications/count
PATCH  /api/notifications/:id/read
POST   /api/notifications/read-all
DELETE /api/notifications/:id
DELETE /api/notifications/read
```

The exact endpoint names should always be confirmed from `src/server/routers/api.ts` after future changes.

---

## Security Design

### Password protection

Passwords are not stored directly.

```text
Plain password
      ↓
bcrypt hashing
      ↓
password_hash stored in database
```

### JWT security

Tokens are signed using:

```text
Algorithm: HS256
Issuer: transitops
Audience: transitops-web
Default expiry: 8 hours
```

The backend validates:

- Signature
- Issuer
- Audience
- Token type
- Subject
- Role
- User existence
- Account active status

### Safe user serialization

The API returns a safe user object without:

```text
password_hash
```

### Backend role checks

Sensitive routes use:

```ts
authenticateJWT
requireRole([...allowedRoles])
```

### Environment protection

The following are ignored by Git:

```text
.env
.env.*
```

The example file remains committable:

```text
.env.example
```

### Runtime database protection

The local development database is ignored:

```text
src/server/db.json
```

### Current security limitation

The frontend stores the access token in `localStorage`. This is simple for a hackathon project, but a production system should consider secure, HTTP-only cookies and CSRF protection.

Further production hardening should include:

- Secure headers
- Login rate limiting
- Explicit CORS allowlist
- Request-size limits
- Centralized error middleware
- Structured audit logging
- HTTPS-only cookies
- PostgreSQL or another production database
- Automated dependency and vulnerability scanning

---

## Git and GitHub Workflow

### Normal development cycle

```text
Make changes
→ Run typecheck
→ Run build check
→ Test in browser
→ Check git status
→ Stage intended files
→ Commit
→ Push
```

Commands:

```powershell
npm run typecheck
npm run check
npm run dev
```

After browser testing:

```powershell
git status
git add <files>
git commit -m "meaningful commit message"
git push origin main
git status
```

### Phase commit messages used during development

```text
feat: complete driver management module
feat: complete trip lifecycle and dispatch management
feat: complete maintenance management module
fix: connect maintenance details navigation
feat: complete fuel and expense management module
feat: add dashboard reports notifications and analytics
```

### Repository

```text
https://github.com/harikishankommu/TransitOps-Odoo-Hackathon-2026
```

---

## Deployment Notes

### Build command

```powershell
npm run build
```

### Start command

```powershell
npm start
```

### Required production environment variables

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<secure-random-secret>
JWT_EXPIRES_IN=8h
```

### Persistent data warning

The current project uses a JSON file database.

This is acceptable for:

- Local development
- Hackathon demonstrations
- Small single-instance demos

It is not suitable for:

- Multiple backend instances
- High concurrent traffic
- Ephemeral file systems
- Strong transactional requirements
- Production-grade backup and recovery

For deployment, the hosting platform must provide persistent disk storage for the database file.

For a production implementation, migrate to:

```text
PostgreSQL
```

Recommended production architecture:

```text
React frontend
      ↓
Express REST API
      ↓
PostgreSQL
      ↓
Object storage for uploaded documents or receipts
```

---

## Overall Flow

A clear demonstration can follow this order.

### 1. Login and role control

- Login as an administrator.
- Show that modules are visible based on role.
- Briefly show Users & Roles.

### 2. Register operational resources

- Create or open a vehicle.
- Create or open a driver.
- Show licence validation and current status.

### 3. Create a trip

- Create a draft trip.
- Select an available vehicle and driver.
- Enter cargo and route details.
- Show cargo-capacity validation.

### 4. Dispatch the trip

- Open the trip details page.
- Dispatch the trip.
- Show:
  - Trip → `DISPATCHED`
  - Vehicle → `ON_TRIP`
  - Driver → `ON_TRIP`

### 5. Complete the trip

- Enter actual distance, fuel, final odometer, and revenue.
- Complete the trip.
- Show:
  - Trip → `COMPLETED`
  - Vehicle → `AVAILABLE`
  - Driver → `AVAILABLE`
  - Fuel log created automatically

### 6. Maintenance

- Start maintenance for an available vehicle.
- Show vehicle changing to `IN_SHOP`.
- Complete maintenance.
- Show vehicle returning to `AVAILABLE`.
- Show maintenance expense creation.

### 7. Analytics and notifications

- Open the dashboard.
- Show charts, revenue, expenses, and fleet status.
- Open reports and export CSV.
- Open notifications and update the unread badge.

### 8. Final value statement

TransitOps provides one connected operational system where every vehicle, driver, trip, maintenance event, fuel refill, expense, report, and alert follows controlled business rules.

---

## Troubleshooting

### npm registry check

```powershell
npm ping
```

### npm cache verification

```powershell
npm cache verify
```

### Reinstall dependencies

PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

Only remove `package-lock.json` when dependency recovery is necessary.

### Full development dependency installation

```powershell
npm install --include=dev --no-audit --no-fund --progress=false
```

### TypeScript errors

```powershell
npm run typecheck
```

Read the first reported error before fixing later errors because one incorrect type can generate several secondary messages.

### Build errors

```powershell
npm run check
```

### View button does not open a details page

Check that `App.tsx` contains:

```text
The details-page import
The selected record ID state
The view-details handler
The conditional details-page render
The onViewDetails callback passed to the list page
```

### JWT secret error

Error:

```text
JWT_SECRET must be configured in .env and contain at least 32 characters.
```

Fix:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Then place the generated secret in `.env`.

### Port already in use

Change:

```env
PORT=3001
```

Then restart:

```powershell
npm run dev
```

### Git does not show expected files

```powershell
git status
git diff --name-only
```

Confirm that files were extracted into the correct project folder.

---

## Known Limitations

- The project currently uses a local JSON database.
- The project is designed primarily for a single backend instance.
- Access tokens are stored in browser local storage.
- The current responsive layout still requires a complete final mobile audit.
- Automated unit and integration test coverage can be expanded.
- Receipt files and vehicle documents are represented as metadata, not a complete object-storage workflow.
- Real-time GPS tracking is not implemented.
- Email, SMS, and push-notification delivery are not implemented.
- PDF export is not included; reports support CSV and browser printing.
- Production rate limiting and secure-header middleware remain part of final hardening.

---

## Future Improvements

- PostgreSQL migration
- Prisma or another database ORM
- Redis-backed sessions and rate limiting
- Secure HTTP-only cookie authentication
- Live GPS vehicle tracking
- Route optimization
- Predictive maintenance
- Fuel-theft and anomaly detection
- Automated invoice and receipt OCR
- Cloud object storage
- Email, SMS, and push alerts
- Mobile application for drivers
- Multi-tenant organization support
- Automated unit, integration, and end-to-end tests
- Docker and CI/CD deployment
- PDF reporting
- Real-time WebSocket dashboard updates

---

## Author

**Kommu Hari Kishan**

- B.Tech Mathematics and Computing
- Indian Institute of Technology Patna
- GitHub: [harikishankommu](https://github.com/harikishankommu)

---

## Repository

```text
https://github.com/harikishankommu/TransitOps-Odoo-Hackathon-2026
```

---

## Final Note

TransitOps was built phase by phase, with each module validated before being committed. The project focuses on operational correctness, role-based security, clear state transitions, and connected analytics rather than only presenting static dashboard screens.

The central idea is:

```text
Every fleet action should update all connected resources safely,
and every user should access only the operations required by their role.
```
