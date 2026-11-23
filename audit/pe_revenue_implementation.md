# PE Clients revenue tracking: review notes

## What changed

- Added **Revenue tracking** to the existing Prospecting → PE Clients screen and **PE Clients** to the Management navigation. Existing organization and user management remains in Prospecting.
- Added effective-dated subscription versions and received-payment records linked to local PE client organizations. Billing history is retained; an organization with billing history cannot be deleted.
- Added MRR, ARR, active paying client, and cash receipt summaries; year/month selection; subscription, payment, and monthly breakdown tables; and forms for billing changes and received payments.
- New `/pe-revenue` endpoints require Prospecting or Management module access. Payment dates and amounts, subscription prices and dates, and organization IDs are validated by the API.

## Revenue definitions

- MRR is the sum of active monthly prices plus active annual prices divided by 12, as of the selected date. ARR uses the unrounded MRR times 12.
- Cash receipts sum recorded payments by **date received**. Subscription values never create payment entries.
- A new billing change starts today or later. Earlier versions remain unchanged. The latest version may be corrected while its start date is today or in the future.
- Historical payment amounts remain reportable after a subscription is canceled.

## Verification

- Backend revenue and existing service tests: `backend/.venv/bin/python -m unittest backend.app.services.test_pe_revenue backend.app.services.test_quickbooks backend.app.services.test_service_line_metrics -q`
- Frontend PE Clients, revenue, and Management tests: `CI=true npm test -- --watch=false --runInBand PERevenue.test.js PEClients.test.js managementDashboard.test.js` from `frontend/`.
- Production frontend build: `CI=true npm run build` from `frontend/`.
- Desktop and narrow-screen screenshots use synthetic preview data: [desktop](pe_revenue_desktop.png), [narrow screen](pe_revenue_mobile.png).

## Environment note

The app initializes the new PostgreSQL tables at startup. A local database was unavailable during this change, so the new SQL was not exercised against a running PostgreSQL instance. Run a staging smoke test of one subscription change, one payment, and a historical period before production use.
