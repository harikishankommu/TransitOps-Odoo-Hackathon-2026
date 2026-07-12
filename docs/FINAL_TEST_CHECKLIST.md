# TransitOps Final Test Checklist

Run these commands first:

```powershell
npm run typecheck
npm run check
npm run dev
```

## Authentication and Security

- [ ] Signup accepts valid data and rejects duplicate email addresses.
- [ ] Login accepts the correct password and rejects incorrect credentials.
- [ ] Disabled accounts cannot log in.
- [ ] Missing, malformed, and expired JWTs return authorization errors.
- [ ] Login/signup rate limiting returns HTTP 429 after repeated attempts.
- [ ] Invalid JSON returns HTTP 400 rather than HTTP 500.
- [ ] An unapproved cross-origin request is rejected.
- [ ] `/api/health` returns `status: ok`.

## Responsive Layout

Test at 360px, 390px, 768px, 1024px, 1280px, and 1440px.

- [ ] Mobile menu button opens the sidebar.
- [ ] Overlay, close button, navigation, and Escape close the mobile sidebar.
- [ ] Desktop sidebar remains fixed and visible.
- [ ] Header text does not overflow.
- [ ] Main content is not hidden behind the sidebar.
- [ ] Tables scroll inside their containers rather than widening the page.
- [ ] Modals remain usable and vertically scrollable.
- [ ] Charts resize without clipping.
- [ ] Top and bottom content spacing is visible.

## End-to-End Operational Workflow

- [ ] Create or select an available vehicle.
- [ ] Create or select an available driver with a valid licence.
- [ ] Create a draft trip.
- [ ] Dispatch the trip and verify vehicle/driver become `ON_TRIP`.
- [ ] Complete the trip and verify both become `AVAILABLE`.
- [ ] Verify automatic fuel record creation.
- [ ] Start maintenance and verify vehicle becomes `IN_SHOP`.
- [ ] Complete maintenance and verify vehicle becomes `AVAILABLE`.
- [ ] Verify automatic maintenance expense creation.
- [ ] Verify dashboard and reports reflect the changes.
- [ ] Verify notification badge and notification actions.

## Role Access

- [ ] Admin can access every module.
- [ ] Fleet Manager can access fleet, maintenance, finance, and reports as intended.
- [ ] Dispatcher can access operational vehicle/driver/trip workflows.
- [ ] Safety Officer can access driver and safety workflows.
- [ ] Financial Analyst can access fuel, expenses, and financial reports.
- [ ] Driver cannot open administrative modules.
- [ ] Direct API requests are rejected when the role is unauthorized.

## Production Build

```powershell
npm run build
npm start
```

- [ ] Application loads from the production build.
- [ ] Refreshing a frontend page returns the React application.
- [ ] API 404 responses remain JSON.
- [ ] Static assets receive long-lived cache headers.
- [ ] `dist/index.html` remains no-cache.
- [ ] SIGINT or SIGTERM closes the server cleanly.
