# Dynamics Enrichment Service

This repo has a FastAPI backend and a React frontend for the Sophie Maintenance dashboard.

**Current authentication:** application login uses PostgreSQL only. Existing JSON
login accounts are intentionally abandoned; do not import or reconcile them.
Use the [fresh-account deployment procedure](#postgresql-authentication-fresh-account-deployment)
below. Earlier Stage 1/2/2B migration plans are historical and superseded.

## Backend Files

- `backend/app/main.py` creates the FastAPI app, enables CORS for the React dev server, and registers route modules.
- `backend/app/routes/auth.py` owns authentication API routes:
  - `POST /auth/signup`
  - `POST /auth/login`
- `backend/app/routes/metrics.py` owns the dashboard metrics API:
  - `GET /metrics`
- `backend/app/routes/accounts.py` owns account enrichment/update routes.
- `backend/app/services/users.json` is an inactive legacy artifact, ignored by Git and never read by authentication.

## Frontend Files

- `frontend/src/App.js` switches between login, signup, and dashboard views.
- `frontend/src/auth.js` calls the backend auth API and stores the auth token in `localStorage`.
- `frontend/src/login.js` renders the login form.
- `frontend/src/signup.js` renders the signup form.
- `frontend/src/components/MetricsDashboard.js` renders dashboard metrics and sends the auth token with metrics requests.
- `frontend/src/components/SoftwareInventory.js` renders the Software Inventory table, filters, forms, detail drawer, CSV export, and delete workflow.

The frontend does not need separate route files unless you want real browser URLs such as `/login`, `/signup`, and `/dashboard`. The current setup keeps page switching inside `App.js`.

## Local Development

Run the backend:

```bash
backend/.venv/bin/uvicorn backend.app.main:app --reload
```

Run the frontend:

```bash
cd frontend
npm start
```

By default, the frontend calls `http://localhost:8000`. To use a different backend URL, start the frontend with `REACT_APP_API_BASE_URL` set.

Signup requires a password with at least 8 characters.

## QuickBooks Company Financials

The management dashboard's Company Financials view reads QuickBooks Online sandbox reports through the authenticated backend endpoint:

```http
GET /company-financials
```

Set these values in the repo `.env` file to connect a sandbox company:

```bash
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REFRESH_TOKEN=
QUICKBOOKS_REALM_ID=
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_MINOR_VERSION=75
QUICKBOOKS_FINANCIALS_START_YEAR=2021
```

The service refreshes the OAuth access token, loads monthly ProfitAndLoss and BalanceSheet reports, and normalizes them into the existing chart fields for sales, net income, cash, liquidity, equity, leverage, and return on assets.

## Software Inventory

The Software Inventory feature tracks software and data subscriptions used by the management dashboard. The frontend calls the authenticated `/software-subscriptions` API and manages search, filtering, sorting, pagination, detail display, CSV export, and CRUD workflows.

### Fields

Required fields:

- `name`: Software or data subscription name. Used as the primary display label and default sort field.
- `category`: Functional category, such as `GIS / Mapping`, `Labor Market Data`, or `Design Tools`. Used for search, filtering, sorting, CSV export, and detail display.
- `department`: Department responsible for the subscription. Used for search, filtering, missing-info checks, CSV export, and detail display.
- `point_of_contact`: Internal owner for the subscription. Displayed as `Owner` in the UI.
- `billing_frequency`: Billing cadence. Typical values are `Monthly`, `Quarterly`, `Annual`, `One-Time`, or `Other`.
- `renewal_date`: Exact renewal date in `YYYY-MM-DD` format. Used for renewal-risk highlighting.
- `renewal_time_frame`: Human-readable renewal window, such as `Annual - July`. Used for filtering and fallback renewal sorting.
- `vendor_rep`: Vendor or vendor representative. Displayed as `Vendor` in the UI.
- `status`: Subscription status. Must be one of `Active`, `Pending Renewal`, `Needs Review`, or `Cancelled`.

Optional fields:

- `description`: Longer description of the subscription and how it is used.
- `assigned_users`: Users, teams, seats, or access notes.
- `cost_2024_2025`: Historical yearly cost for 2024-2025.
- `cost_2025_2026`: Historical yearly cost for 2025-2026.
- `cost_2026_2027`: Current annual cost. If users enter monthly cost in the UI, this field is annualized before saving.
- `subscribed_since`: Free-text subscription start year or date.
- `notes`: Operational notes, renewal context, vendor issues, or cleanup items.
- `created_at`: Server-managed created timestamp.
- `updated_at`: Server-managed last updated timestamp.

### Cost Calculations

The UI clearly separates `Monthly Billing Cost` from `Annual Billing Cost`.

- If a monthly cost is entered and annual cost is blank, the UI calculates the annualized cost as `monthly cost * 12` and saves that value as `cost_2026_2027`.
- If an annual cost is entered and monthly cost is blank, the current monthly cost displayed in the table is calculated as `annual cost / 12`.
- Users cannot submit both monthly and annual current cost fields at the same time.
- Cost fields must be valid numbers and cannot be negative.

### Renewal-Risk Rules

Renewal risk is calculated from `renewal_date` against the user's current date.

- `Expired`: renewal date is before today.
- `Renews <=30d`: renewal date is today or within 30 days.
- `Renews <=60d`: renewal date is within 31-60 days.
- `Renews <=90d`: renewal date is within 61-90 days.
- `On Track`: renewal date is more than 90 days away.
- `Missing Date`: no valid renewal date is available.

Rows are highlighted for expired, 30-day, 60-day, and 90-day renewal windows. The detail drawer also shows a renewal-risk chip.

### API Endpoints

All `/software-subscriptions` endpoints require the normal authenticated user dependency. Frontend requests include the auth headers from `frontend/src/auth.js`.

#### List subscriptions

```http
GET /software-subscriptions?limit=1000
```

`limit` is optional, defaults to `1000`, and must be between `1` and `5000`.

Example response:

```json
{
  "count": 1,
  "data": [
    {
      "id": 1,
      "name": "ArcGIS Online",
      "description": "Cloud mapping and spatial analysis platform used for project maps and data visualization.",
      "category": "GIS / Mapping",
      "department": "Operations",
      "point_of_contact": "Operations",
      "assigned_users": "Planning and analyst team",
      "cost_2024_2025": 2800,
      "cost_2025_2026": 3100,
      "cost_2026_2027": 3300,
      "billing_frequency": "Annual",
      "renewal_date": "2026-07-01",
      "renewal_time_frame": "Annual - July",
      "vendor_rep": "Esri Customer Success",
      "subscribed_since": "2018",
      "status": "Active",
      "notes": "Confirm named-user allocation before the next renewal.",
      "created_at": "2026-07-20 12:00:00",
      "updated_at": "2026-07-20 12:00:00"
    }
  ]
}
```

#### Create subscription

```http
POST /software-subscriptions
Content-Type: application/json
```

Example request:

```json
{
  "name": "Example Data Platform",
  "description": "Research dataset used for market analysis.",
  "category": "Market Data",
  "department": "Research",
  "point_of_contact": "Research Director",
  "assigned_users": "Research team",
  "cost_2024_2025": 1000,
  "cost_2025_2026": 1250,
  "cost_2026_2027": 1500,
  "billing_frequency": "Annual",
  "renewal_date": "2027-06-01",
  "renewal_time_frame": "Annual - June",
  "vendor_rep": "Vendor Account Manager",
  "subscribed_since": "2025",
  "status": "Active",
  "notes": "Review seat count before renewal."
}
```

Example response: `201 Created`

```json
{
  "id": 5,
  "name": "Example Data Platform",
  "description": "Research dataset used for market analysis.",
  "category": "Market Data",
  "department": "Research",
  "point_of_contact": "Research Director",
  "assigned_users": "Research team",
  "cost_2024_2025": 1000,
  "cost_2025_2026": 1250,
  "cost_2026_2027": 1500,
  "billing_frequency": "Annual",
  "renewal_date": "2027-06-01",
  "renewal_time_frame": "Annual - June",
  "vendor_rep": "Vendor Account Manager",
  "subscribed_since": "2025",
  "status": "Active",
  "notes": "Review seat count before renewal.",
  "created_at": "2026-07-20 12:00:00",
  "updated_at": "2026-07-20 12:00:00"
}
```

#### Get one subscription

```http
GET /software-subscriptions/{subscription_id}
```

Returns one subscription response object. Returns `404` when the subscription id does not exist.

#### Update part of a subscription

```http
PATCH /software-subscriptions/{subscription_id}
Content-Type: application/json
```

Example request:

```json
{
  "status": "Pending Renewal",
  "renewal_date": "2026-08-01",
  "notes": "New pricing requested from vendor."
}
```

Example response: `200 OK`

```json
{
  "id": 5,
  "name": "Example Data Platform",
  "description": "Research dataset used for market analysis.",
  "category": "Market Data",
  "department": "Research",
  "point_of_contact": "Research Director",
  "assigned_users": "Research team",
  "cost_2024_2025": 1000,
  "cost_2025_2026": 1250,
  "cost_2026_2027": 1500,
  "billing_frequency": "Annual",
  "renewal_date": "2026-08-01",
  "renewal_time_frame": "Annual - June",
  "vendor_rep": "Vendor Account Manager",
  "subscribed_since": "2025",
  "status": "Pending Renewal",
  "notes": "New pricing requested from vendor.",
  "created_at": "2026-07-20 12:00:00",
  "updated_at": "2026-07-20 12:15:00"
}
```

#### Replace a subscription

```http
PUT /software-subscriptions/{subscription_id}
Content-Type: application/json
```

Uses the same request body as create. Returns the full updated subscription object.

#### Delete a subscription

```http
DELETE /software-subscriptions/{subscription_id}
```

Returns `204 No Content` on success. Returns `404` when the subscription id does not exist.

### Manual QA Checklist

- Create: open Software Inventory, click `Add Subscription`, verify required-field errors show beside fields, create a valid subscription, and confirm it appears in the table without refresh.
- Read: open a row detail view and confirm name, vendor, category, department, owner, status, billing frequency, monthly cost, annualized cost, renewal date, notes, created timestamp, and updated timestamp are shown.
- Update: edit an existing subscription, change text, status, costs, billing frequency, and renewal date, save, and verify the table and detail drawer reflect the changes.
- Delete: delete a subscription, confirm the dialog names the record and warns the action cannot be undone, verify success feedback, and confirm the row disappears without refresh.
- Search: search by software name, vendor, category, department, and notes.
- Filtering: test status, category, department, billing frequency, renewal timeframe, and missing-info quick filters.
- Sorting: sort by software name, vendor, category, monthly cost, annual cost, renewal date, and status in both directions.
- Pagination: change page size, move between pages, and confirm active filters and sort order remain applied.
- CSV export: apply filters, click `Export CSV`, and confirm the file includes only filtered records with escaped commas, quotes, and multiline notes.
- Renewal highlighting: verify expired, within 30 days, within 60 days, within 90 days, missing date, and on-track records display the correct chip and row highlighting.
- Mobile layout: test the inventory page and detail drawer at a narrow viewport; confirm filters stack, text does not overlap, and actions remain usable.
- Desktop layout: test at a wide viewport; confirm table scrolling, sticky header, pagination, CSV export, detail drawer, and dialogs behave correctly.

## Power Automate account enrichment

Configure a Power Automate flow with a Dataverse **When a row is added** trigger for
Accounts, followed by an HTTP action:

```text
Method: POST
URL: https://<backend-url>/accounts/enrich-one/{accountid}
Headers:
  x-api-key: <POWER_AUTOMATE_API_KEY>
  Content-Type: application/json
Body: empty
```

The endpoint reads the Account, skips it when `cr73c_enrichmentattempted` is already
true, and otherwise fills only blank fields before marking the attempt complete. It
returns JSON containing `status`, `fields_updated`, and `skipped_reason`.

Set these backend environment variables: `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`,
`DYNAMICS_SCOPE`, `DYNAMICS_API_URL`, and `SEAMLESS_API_KEY`. Set
`POWER_AUTOMATE_API_KEY` for machine access using the `x-api-key` header. Machine
access is rejected when this variable is unset or empty. This authentication applies
only to `POST /accounts/enrich-one/{accountid}`; other Account endpoints still require
user authentication. Authenticated users with Sophie Maintenance access can also
call this endpoint with their normal Bearer token. If an Authorization header is
supplied, it must pass the normal user-token and module checks.

The backend endpoint is prepared for a future flow; no automatic Account
enrichment flow is included in this repository. `enrich_one_account()` treats the
attempt flag as a completed provider attempt, with missing company name as an
explicit non-retryable exception. Infrastructure failures remain eligible for
resubmission:

| Outcome | Sets `cr73c_enrichmentattempted` to true? |
| --- | --- |
| Account retrieval fails | No |
| Already attempted | No new write; existing flag remains true |
| Account has no name | Yes, if the metadata PATCH succeeds |
| `SEAMLESS_API_KEY` missing | No; returns failed |
| Weekly credit limit reached | No |
| Credit-budget check raises | No; returns failed without calling Seamless |
| Seamless lookup raises | No; returns failed |
| Post-lookup usage or response-balance recording raises | Logged; provider outcome continues unchanged |
| No matching company | Yes, if the metadata PATCH succeeds |
| Matching company, no blank fields to fill | Yes, if the metadata PATCH succeeds |
| Matching company, blank fields updated | Yes, in the same PATCH as field updates |
| Final Dynamics PATCH fails | No confirmed write; a transport failure may have an uncertain outcome |

Completed attempts require a confirmed Dynamics PATCH including both
`cr73c_enrichmentattempted` and `cr73c_enrichmentlastattemptedon` in UTC, alongside
any field updates. Both fields exist in the deployed Account table. A Dynamics
400 is no longer retried without the timestamp; any write failure returns failed.

Local usage and credit-balance JSON writes are best-effort operational telemetry;
failure after a provider response does not invalidate enrichment. A failed
preflight credit-budget check stops enrichment conservatively, because the
backend cannot establish whether another request is within the limit. The
automatic path does not write the separate `metrics_tracker.json` update history.

### Durable automatic enrichment history

Accepted `POST /accounts/enrich-one/{accountid}` requests now write a separate
PostgreSQL `account_enrichment_history` row before Account/provider processing.
The existing idempotent database initializer creates this additive table and its
Account, completion, open-attempt, and Account-created-on indexes. Rejected
authentication requests do not create receipts. No new migration framework is
required.

Each UUID identifies one request, including duplicate deliveries. The row records
Account identity/name/`createdon` when known; UTC received, started, and completed
timestamps; the exact backend status; a structured reason and sanitized failure
category/message; Seamless search activity; confirmed updated logical fields;
and an explicit `completion_uncertain` flag for Dynamics transport failures.
Account IDs remain text to preserve the endpoint's existing accepted input
contract. `status` and `completed_at` are null until there is a terminal outcome.

Provider telemetry counts actual HTTP search attempts, including the existing
name-only fallback (one or two searches), and is checkpointed after each search
settles. It does not change invocation-level credit accounting. A
`no_updates_needed` result with zero searches is an unpaid preflight decision;
the same result with searches means a paid lookup added no fields. Duplicate
`skipped_already_attempted` rows never replace earlier attempts and must be
excluded when selecting an Account's meaningful outcome for future Home metrics.
Fields are recorded only after Dynamics confirms its PATCH, never merely because
the provider supplied them. No field values, raw responses, credentials,
authentication headers, exception strings, or stack traces are stored.

History writes are best effort, use worker threads and bounded database connection,
statement, and lock waits, and log only a fixed tracking-gap warning on failure.
They do not retry enrichment, call Seamless again, change the HTTP response, or
disable enrichment if history persistence fails. A later checkpoint/completion
can insert the same request row if receipt persistence failed. A failed final
write can leave an open row even after successful enrichment.

Cancellation preserves an open attempt rather than inventing a terminal result.
A hard process exit can lose the latest telemetry or completion checkpoint;
open-attempt counters are therefore partial observations, not proof that the
provider was never called. PostgreSQL and Dynamics/provider operations are not
one transaction: a lost Dynamics PATCH response remains unconfirmed even if the
write committed. The history does not infer success from the Dynamics attempted
flag or reconstruct older outcomes. Home must represent such tracking gaps and
uncertainty explicitly. The history step adds no Home UI, count aggregation, retry
scheduler, or Power Automate changes.

The future flow must inspect the returned `status`: enrichment failures currently
return HTTP 200 with `status: failed`. No retry scheduling or queue is provided.
If Dynamics commits a PATCH but its response is lost, the backend returns failed
because completion was not confirmed. A later request rereads the Account and
skips it if the attempt flag is already true. Concurrent requests can still both
pass the initial flag check, and read-then-write updates can race with human edits.
Use a small, sequential controlled test before broader automation.

For a local call:

```bash
curl -X POST "http://localhost:8000/accounts/enrich-one/<accountid>" \
  -H "x-api-key: $POWER_AUTOMATE_API_KEY" \
  -H "Content-Type: application/json"
```

## Sophie Maintenance Account observation and counts (Home Step 2)

`maintenance_observations.py` supplies reusable refresh services and PostgreSQL-only
snapshot readers. It does not add the Home frontend, `/maintenance/home`, a
scheduler, Power Automate changes, enrichment calls, or Dynamics writes.

The existing additive database initializer creates:

- `maintenance_account_observations`: Account ID/name/UTC creation time, observed
  attempt flag/last-attempt time, and UTC first/last observation times. Indexed by
  creation, observation, and attempt state. This is a bounded operational set,
  not an Account mirror.
- `maintenance_total_account_snapshot`: last valid total, fetched time, and source.
- `maintenance_account_creation_counts`: reporting date, exact UTC count interval,
  last valid count/fetched time, and whether the reporting day is complete.
- `maintenance_sync_state`: independent discovery/total/count refresh status,
  tracking start, coverage start, watermark, in-progress interval/paging cursor,
  request/row counts, successful refresh time, and sanitized errors.

### Invocation and freshness

In a configured backend worker or an explicitly invoked maintenance job:

```python
from backend.app.services.maintenance_observations import refresh_maintenance_observations

# Async caller; required DATABASE_URL and Dynamics OAuth environment must be configured.
result = await refresh_maintenance_observations()
```

Individual async services are `refresh_account_discovery`,
`refresh_total_account_count`, and `refresh_account_creation_counts`. Synchronous
`read_count_snapshots` and `read_recent_account_observations` read only PostgreSQL;
an async API can run them in a worker thread. Never invoke the refresh orchestrator
from a browser request. The existing OAuth token cache is reused. PostgreSQL
snapshots, due checks, and session advisory locks coordinate refreshes across
workers; no process-local cache is treated as authoritative.

Recommended future invocation: discovery every 1–2 minutes, today's count every
2–5 minutes, and total count hourly. Defaults skip successful discovery for 120
seconds, refresh today's count after 180 seconds, and refresh the total after
3600 seconds. Completed reporting days are persisted and reused. Counts default
to 14 days and support up to 30; a day first captured while open is finalized on
the next day's refresh. The week count sums Monday through today's cached daily
counts, avoiding another Dynamics request. Missing/incomplete prerequisite days
produce an unknown week total, never a fabricated zero.

### Discovery and coverage

Discovery selects only `accountid`, `name`, `createdon`,
`cr73c_enrichmentattempted`, and `cr73c_enrichmentlastattemptedon`. Every query has
an explicit half-open creation-time filter and deterministic
`createdon asc,accountid asc` ordering. Pagination uses `odata.maxpagesize`, not
`$top`/`$skip`, and follows the server cursor unchanged with the same page size.
Continuation URLs must match the configured Dynamics origin, Account path,
selected fields, ordering, and fixed interval; credentials and unbounded or
foreign continuation queries are rejected. Only the validated paging cursor is
persisted, not headers or HTTP response bodies; snapshot readers omit it.

First discovery establishes `tracking_started_at` and bootstraps the last 14 New
York calendar days, including today. Defaults allow 10 pages of 500 rows per
refresh. Each page's upserts and resume cursor commit together. Only completing
the fixed interval advances the watermark; partial budgets and failures preserve
confirmed coverage and report `coverage_complete=false`. Subsequent invocations
resume unfinished intervals, then catch up if budget remains. Completed intervals
overlap the preceding watermark by five minutes. A restarted worker can resume
without replaying the entire bootstrap.

Observations are retained for 30 days and capped at 50,000 rows by default. Hitting
the cap pauses progress with an explicit incomplete state; it does not silently
discard Accounts from the interval being covered. A backlog older than retention
reports `discovery_retention_gap` without jumping the watermark. An operator must
then choose a larger bounded retention/cap or explicitly establish a new tracking
baseline and acknowledge the gap. Bootstrap coverage is not historical enrichment
coverage. Attempt metadata reflects its last observation and is not continuously
resynchronized outside discovery overlap. Backdated imports or Accounts becoming
visible beyond the overlap can require an explicit bounded reconciliation; this
is not an audit/change-tracking feed.

### Count queries and reporting boundaries

Total count uses `RetrieveTotalRecordCount` for logical table `account`, never
`$count=true` or Account enumeration. This is the Dataverse snapshot (potentially
up to 24 hours old when fetched), not an instantaneous live total. The snapshot
reader returns fetched time, source, and refresh staleness separately.

Creation counts use per-day FetchXML `count(accountid)` aggregates with explicit
`createdon >= start` and `createdon < end` filters. New York local midnights are
converted independently to UTC, handling 23/25-hour DST days and Monday-start
weeks. Today's interval ends at the refresh reference time; completed days use
their full reporting-day boundaries. No raw-datetime grouping is used.

Dataverse aggregate-limit errors split the interval into nonoverlapping halves.
There is a shared 64-request budget per creation-count refresh. Only a completely
counted day replaces its snapshot; partial sums are never stored. If splitting
cannot resolve a bulk import concentrated into a one-second interval, coverage
remains incomplete and the old valid snapshot remains. No fallback downloads
Account rows. Historical counts describe rows available in Dynamics when sampled;
they cannot reconstruct previously deleted Accounts. Persisted complete-day
counts are snapshots, not a live deletion-adjusted series; `force=True` supports
an explicit bounded reconciliation.

### Receipt presence, failures, and configuration

The observation reader joins `account_enrichment_history` by Account ID for
receipt presence. It returns facts, not final enrichment display statuses. An
overdue-no-request flag requires fresh complete discovery coverage, creation
after forward tracking began, and no recorded receipt after the grace period.
The grace clock uses the later of creation or first observation, avoiding
immediate alarms for late discovery. Default grace is 300 seconds. Historical
bootstrap Accounts and stale/incomplete coverage are not declared missed delivery.
No observed receipt is not an enrichment failure, and Step 1 history-write gaps
still remain possible.

All configuration uses `MAINTENANCE_<SETTING>` environment variables, validated
within bounds. Available settings are `BOOTSTRAP_DAYS`, `RETENTION_DAYS`,
`MAX_OBSERVATIONS`, `PAGE_SIZE`, `MAX_DISCOVERY_PAGES`, `OVERLAP_SECONDS`,
`DISCOVERY_SECONDS`, `PENDING_GRACE_SECONDS`, `TODAY_SECONDS`, `TOTAL_SECONDS`, and
`MAX_COUNT_REQUESTS`. Retention must cover the bootstrap window. Refreshes bound
Dynamics requests, use 20-second HTTP timeouts, and bound PostgreSQL connection,
statement, and lock waits. PostgreSQL operations run in worker threads.

Dynamics failure preserves valid snapshots and stores only sanitized error codes.
Missing snapshots stay unknown; successful zero counts remain distinguishable.
PostgreSQL failure stops refresh safely. Cancellation and clock regression do not
advance unconfirmed discovery coverage. No API keys, bearer tokens, unnecessary
Account fields, Seamless data, or raw responses are stored or logged by these
services. Home Step 3 must expose freshness, tracking gaps, and incomplete coverage.
Scheduling, production query validation, final status mapping, and the Home API/UI
remain future work.

## Sophie Maintenance Home API (Home Step 3)

`GET /maintenance/home` requires the existing user Bearer authentication and
`main` module access (including existing administrator access). Power Automate
`x-api-key` authentication does not authorize this route. All `/maintenance`
paths are covered by the existing module middleware, and the router also has a
`require_module("main")` dependency.

Query parameters:

- `days`: 7–30, default 14; controls the daily chart range.
- `view`: `recent` (default) or `attention`.
- `limit`: 1–100, default 25.
- `cursor`: opaque, bounded continuation token returned as `next_cursor`.

The response consists of:

- `reporting`: timezone, Monday week start, tracking/coverage start timestamps,
  and whether discovery coverage is complete and fresh.
- `metrics.total_dynamics_accounts`: value (nullable), source, fetched timestamp,
  source-age caveat (24 hours at fetch), and staleness. No valid snapshot means
  unknown, never an invented zero.
- `metrics.new_accounts_today` / `new_accounts_this_week`: nullable cached counts.
- `metrics.enrichment_success_rate`: nullable percentage, successful and known
  terminal unique Account counts, observed Account count, `this_week` period,
  `observed_new_accounts` scope, and coverage flag.
- `account_creation_by_day`: every requested local reporting date with nullable
  count, completeness/staleness flags, and fetched timestamp. Today's count is
  known through its snapshot cutoff even though the day is not complete. An
  incomplete historical day returns null. A confirmed zero remains zero.
- `recent_accounts`: Account ID/name/creation timestamp, display status and label,
  underlying meaningful backend status, provider-call facts, confirmed logical
  fields and friendly labels, fixed result summary, and attention boolean.
  Provider-call facts are null when no meaningful history exists.
- `next_cursor`: next page token or null.
- `freshness`: generation time, 45-second cache TTL, total snapshot age,
  discovery refresh times/watermark/lag/coverage, count refresh times/staleness,
  and best-effort history tracking limitations.
- `warnings`: fixed readable notices about missing/stale counts, incomplete
  observation coverage, partial-week tracking, dependency on a separate worker,
  and possible enrichment-history persistence gaps. Raw errors and paging
  cookies are not returned.

### One authoritative evidence mapping

The PostgreSQL status expression is shared by table rows, attention filtering,
and success-rate aggregation:

| Persisted evidence | Display status | Attention |
| --- | --- | --- |
| `updated` | Enriched | No |
| `no_updates_needed`, no provider call | No paid enrichment needed | No |
| `no_updates_needed`, provider called | Completed — no fields added | No |
| `no_match`, provider called | No usable match | Yes |
| `no_match`, `missing_company_name` reason | Needs attention — missing company name | Yes |
| `failed` | Failed | Yes |
| `failed`, completion uncertain | Failed — update unconfirmed | Yes |
| `skipped_credit_limit` | Credit limit | Yes |
| Open meaningful attempt | Processing | No |
| Open attempt past configured processing grace | Processing — delayed | Yes |
| No receipt, within creation/first-observation grace | Pending | No |
| No receipt past grace, eligible fresh forward coverage | Needs attention — no Sophie request observed | Yes |
| Duplicate-only, unsupported outcome, or insufficient older coverage | History unavailable | No |

The latest non-duplicate attempt is selected by receipt timestamp, then durable
ID. A newer open meaningful attempt supersedes an earlier completed one.
`skipped_already_attempted` never hides a meaningful result. The Dynamics
attempted flag is never used to infer success. No derived statuses are written.
Missing requests are delivery observations, not enrichment failures. Processing
is delayed after 900 seconds by default, configurable via
`MAINTENANCE_PROCESSING_GRACE_SECONDS` (60–86400). No-receipt grace uses Step 2's
`MAINTENANCE_PENDING_GRACE_SECONDS`, measured from the later of creation and
first observation. Attention requires no Alert Center or new alert persistence.

This week's success numerator includes Enriched and No paid enrichment needed.
The denominator includes all known meaningful terminal outcomes, including paid
lookups adding no fields, no usable match, missing name, failures, and credit
limits. Paid lookups adding no fields are **not successes**: they completed but
did not deliver missing data. Pending, processing (including delayed), missing
requests, and unavailable/duplicate-only history are excluded. Each observed
Account contributes once. A zero denominator returns null. These are outcomes
for observed new Accounts, not a promise of complete historical enrichment
coverage. Coverage is false if discovery is stale/incomplete or tracking began
after the reporting week started, or the retained observation window does not
cover the week.

Only persisted confirmed fields from successful updates are displayed:
Website, Phone, Description, Employees, City, State, Country, Postal Code, and
NAICS. No raw provider data or stored error messages are returned.

### Pagination, caching, errors, and scheduling

The table is a bounded PostgreSQL query over Step 2's retained observations,
with indexed lateral history lookups and server-side attention filtering.
Ordering is creation timestamp descending, then Account ID descending. Cursor
pagination preserves a creation/first-observation upper boundary and a last-row
key; newly discovered Accounts do not shift later pages. Tokens are scoped to
the chart range and view and expire after 24 hours. Outcomes remain live between
pages, so Accounts entering/leaving the attention view can change membership;
pagination is not a frozen history export.

The standard 25-row first page is cached for 45 seconds using `AsyncStaleCache`
with no additional stale-serving period (48 possible range/view combinations).
A cheap PostgreSQL refresh-version read invalidates old cached responses across
web processes when the separate worker commits new refresh state/snapshots.
Other page sizes and continuation pages read PostgreSQL directly. Completion
becomes visible on expiry without changing enrichment or rerunning aggregates;
cache expiration also works across processes. Authorization executes before
cache access. Browser responses use `Cache-Control: private, no-store`.
Invalid cursors return a fixed 400, invalid query bounds return 422, and
PostgreSQL/configuration failures return a fixed sanitized 503 and safe log.

Home never calls Dynamics, Seamless, or a refresh service and never writes to
Dynamics or enrichment history. Snapshot refreshes and observation discovery
remain Step 2 responsibilities. Home does not start a scheduler or a Dynamics
refresh. The separate Step 4 worker below supplies production refreshes; it must
be deployed independently. The Home frontend/navigation are implemented in Step 5 below; durable
history-write gap detection remains a future capability.

## Sophie Maintenance production refresh worker (Home Step 4)

### Deployment evidence and process separation

The repository documents the local Uvicorn target `backend.app.main:app`. The
web module initializes PostgreSQL at import and starts the existing newsletter
scheduler in FastAPI's lifespan. Newsletter also has an independent module/Render
Cron Job command rooted at `backend`. There is no committed Render Blueprint,
Procfile, Dockerfile, production web start command, or prior maintenance worker.
The live web service's exact startup settings must be checked in Render; they
cannot be established from this checkout. The normal module target from a
`backend` root would be `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; from
a repository root it would be `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`.
No web startup/lifespan or newsletter scheduling behavior was changed by Step 4.

The maintenance worker is an independent Python process with no HTTP server,
FastAPI import, newsletter scheduler, enrichment invocation, or Seamless import.
It loads the existing dotenv locations before database/auth configuration,
initializes the additive PostgreSQL schema with bounded connection/statement/
lock waits, and calls the existing Step 2 services.

Repository-root commands:

```sh
python -m backend.app.workers.maintenance_refresh
python -m backend.app.workers.maintenance_refresh --once
```

From the `backend` directory (recommended Render Root Directory):

```sh
python -m app.workers.maintenance_refresh
python -m app.workers.maintenance_refresh --once
```

`--once` runs one bounded **due** cycle without forcing refreshes or bypassing
locks/page/request budgets. It exits 0 for successful/no-due work or another
worker owning the cycle, 1 for incomplete/failed work, and 2 for invalid settings.
A lock skip is not proof of complete coverage: validate the saved/API state.
Repeated bounded invocations can resume a large bootstrap, but do not use a
tight shell retry loop. No production refresh was executed during development.

### Configuration and refresh cadence

Use the backend's existing `DATABASE_URL` and Dynamics application credentials:
`TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `DYNAMICS_SCOPE`, `DYNAMICS_API_URL`.
Existing OAuth aliases (`Tenant_ID`, `Application_ID`, `Client_Secret`) remain
supported. The application user needs Account read access and permission to use
the existing count mechanisms. No `SEAMLESS_API_KEY`, Power Automate API key,
user-login secret, frontend setting, or queue/Redis service is needed.

| Setting | Default | Worker validation / purpose |
| --- | --- | --- |
| `MAINTENANCE_REFRESH_INTERVAL_SECONDS` | 60 | 60–300; wait after each cycle, including failures |
| `MAINTENANCE_DISCOVERY_SECONDS` | 120 | Existing Step 2 setting; worker requires at least 60 |
| `MAINTENANCE_TODAY_SECONDS` | 180 | Existing Step 2 setting; worker requires at least 120 |
| `MAINTENANCE_TOTAL_SECONDS` | 3600 | Existing Step 2 setting; worker requires at least 1800 |
| `MAINTENANCE_RECONCILE_SECONDS` | 21600 | 3600–604800; recent completed-day reconciliation |

Step 2's upper bounds and all existing window/page/request/row-cap settings
continue to apply. Invalid values fail startup with a fixed sanitized log and
exit 2; they are never silently interpreted as an aggressive cadence. A longer
base wait rounds refreshes up to the next cycle; the 60-second default matches
the default service cadence targets. Cycle time can add delay. Reporting timezone
is fixed `America/New_York`, with Monday-start weeks and existing DST conversion;
there is no second worker timezone configuration.

The due plan uses persisted refresh timestamps/status and per-date snapshots,
not local in-memory timers. Discovery normally runs every two minutes, today's
count every three minutes, and total count hourly. Failed/incomplete tasks retry
on a later base cycle. Fourteen daily dates are maintained: missing/incomplete
dates bootstrap/finalize as needed; completed days are otherwise reused. Only
the two most recent completed days are eligible for reconciliation every six
hours, using their persisted `fetched_at`. All count work shares the existing
request budget and aggregate interval splitting. No Account enumeration is used
for counts. Older completed days require a deliberate service refresh if later
changes must be reconciled. Home's optional 30-day chart can still show unknown
older dates until those snapshots have been intentionally populated.

### Concurrency, failures, cache signals, and shutdown

A dedicated PostgreSQL session advisory lock (`66360, 4`) protects the whole
cycle, including its due plan. Step 2's individual refresh locks remain in use
for coexistence with manual/service callers. A second worker normally logs a
safe skip, does no remote work, and waits for its next cycle. No permanent lock
or new cursor implementation is introduced. Discovery retains all existing
checkpoint, overlap, watermark, page-budget, retention, and coverage semantics.

Tasks run sequentially: discovery, total, then counts. A Dynamics or unexpected
individual task failure permits unrelated tasks to attempt their own database
preflight and refresh. A recognized PostgreSQL failure aborts the remaining work;
a planning/lock/startup database failure does no Dynamics work. Existing services
preserve valid values and record fixed refresh errors; missing/stale values are
never replaced with invented zeros. Unexpected exceptions and failed startup
initialization take the normal base wait before retrying. Operational logs use
fixed key/value events for start/end, due work, safe lock skips, request/row
counts, coverage, failures, duration, and shutdown. Raw exception text, Account
payloads/names, keys, tokens, and transport request URLs are not logged.

Committed Step 2 refresh metadata and snapshot timestamps form a cheap durable
Home refresh version. The worker logs a changed version; each authenticated Home
request compares it with its local cache version, clears old cache entries, and
uses a versioned key. This works across independent Render processes without
importing the web router into the worker or adding a message broker. No-due
cycles do not update state or change the version. Freshness/coverage changes also
invalidate cached responses. Enrichment-only completion continues to become
visible via the existing 45-second expiry. A version read failure returns a
sanitized 503 rather than serving a falsely healthy cache entry. Neither version
checks nor cache expiry query Dynamics. No new database table is required.

SIGTERM/SIGINT stop new cycles and new tasks. The current cycle gets a 15-second
grace period; if it is still active it is cancelled and awaited so Step 2 records
interruption, closes HTTP connections, and releases its locks. Bounded database
initialization threads are drained too. Signal shutdown exits normally. Render
currently defaults to a 30-second shutdown delay; retain that margin for cleanup
(or explicitly configure a larger delay if tenant validation requires it).
Abrupt SIGKILL cannot run cleanup: PostgreSQL releases session locks, saved
checkpoints survive, and `running` state is retried rather than claimed successful.

### Render setup (instructions only; no live configuration changed)

1. Create a separate **Background Worker**, Python runtime, from the same
   repository and deployment branch as the backend, containing Steps 1–4. The
   current checkout branch is `main`; verify the web service's actual linked
   branch instead of assuming its dashboard settings.
2. Set Root Directory `backend`; Build Command `pip install -r requirements.txt`;
   Start Command `python -m app.workers.maintenance_refresh`. Use a supported
   Python version aligned with the backend (prefer 3.11+). If Root Directory is
   the repository root, use build `pip install -r backend/requirements.txt` and
   start `python -m backend.app.workers.maintenance_refresh`; the root dependency
   file is not the complete backend dependency set.
3. Use the same Render region and exact backend `DATABASE_URL` (prefer its
   internal URL), plus the Dynamics variables above. Share only needed settings
   through an environment group. One worker instance is sufficient; overlapping
   deployments are protected by advisory locks. No HTTP port/health endpoint,
   persistent filesystem disk, Redis, or Seamless secret is needed.
4. Before enabling continuous operation, run the `--once` command from a
   deployment-side shell/one-off job with the same code/environment (or temporarily
   use it as the worker start command). The same code/database initialization and
   safety rules apply. A large initial bootstrap may return incomplete; inspect
   saved coverage and rerun on the normal interval until complete, or deliberately
   address the documented Step 2 row/page/retention limits.
5. Verify fixed logs, saved total/daily snapshots, discovery watermark/cursor,
   refresh status/coverage, and authenticated `/maintenance/home` freshness.
   Confirm expected selected fields/continuation URLs and count support in the
   production tenant. Inspect stale/unknown warnings rather than interpreting
   exit 0 or HTTP 200 alone as complete coverage. Once validated, use the continuous
   start command and monitor worker failures/lag in Render logs/Home freshness.
   Test graceful redeploy/stop. No Power Automate or Dynamics data changes are needed.

References: [Render Background Workers](https://render.com/docs/background-workers)
and [Render deployment and graceful shutdown](https://render.com/docs/deploys).
The Home frontend is implemented in Step 5 below. Durable enrichment-history
gap detection and operator handling of irrecoverable observation coverage gaps
remain future work.

## Sophie Maintenance Home frontend (Step 5)

`/dashboard` opens Home. Maintenance navigation is Home and Enrichment.
`/dashboard/enrichment` is the Account enrichment workspace; `/dashboard/seamless`
and `/dashboard/data-quality` replace browser history with that canonical route.
Retired Duplicate Accounts and Summary Analytics bookmarks redirect to Home.
Duplicate account detection and its account deletion API have been removed.

Home contains four KPI cards, one responsive 14-day creation chart, and the
Recent New Accounts & Enrichment table. It uses authenticated
`GET /maintenance/home?days=14&view=recent&limit=25` through the shared frontend
request/cache helper with a 30-second TTL. Home revalidates on focus and, while
observation coverage is incomplete, every two minutes when visible. The Recent / Needs
Attention toggle resets rows and pagination; Load more uses the opaque backend
cursor. Late responses from an older view are ignored. Normal navigation/refetch
is independent of Dynamics refreshes.

The backend supplies status labels, attention flags, confirmed field labels,
and result summaries; the frontend does not infer enrichment outcomes or
updated fields. Timestamps use the reporting timezone (America/New_York).
Unknown metrics display an em dash; null chart counts create gaps and never
become zero. Snapshot freshness stays subtle on the total card. Stale/incomplete
structured freshness produces one compact information notice; permanent
best-effort history/worker notices do not create a banner on a healthy page.
Skeletons, concise empty states, and sanitized retry errors cover loading and
failures. Narrow screens stack cards and keep table scrolling inside its panel.
No direct Dynamics/Seamless requests or backend behavior changes are introduced.

## Consolidated Enrichment workspace

`/dashboard/enrichment` focuses on Accounts to Enrich, without summary cards.
Recent automatic-enrichment outcomes remain on Home.
The standalone Seamless/Data Quality navigation and dashboards are no longer
rendered. Legacy components/endpoints remain available internally; no provider,
credit accounting, automatic enrichment, or legacy Dynamics fields were deleted.

`GET /maintenance/enrichment/credits` requires the existing main-module access
and reads only existing credit usage/balance data. It returns nullable `remaining`,
`weekly_remaining`, `weekly_limit`, `reported_at`, and `is_stale` (24-hour reported
balance age). It does not load `/metrics`, refresh Account caches, or call providers.
Unknown balances remain unknown; zero is valid. Existing usage-file storage and
its deployment/persistence limitations are unchanged.

Accounts load only after Search Dynamics. The workspace uses the existing live
`GET /accounts/data-quality/search` with `enrichment_fields=true`, 25-row pages,
server-side name/text, canonical missing-information, country/location and sector
filters. No legacy facet cache or Account mirror is loaded. Canonical mode selects
Account identity, location, sector details, and the nine manual targets. It returns
canonical employee/postal/NAICS values and missing keys directly without legacy
field aliases or cache persistence. Other search consumers retain their original
contract. The existing five-bucket completeness score uses canonical Employees;
its tooltip explains that it measures Website/Phone/Description/Employees/location,
not provider eligibility or enrichment outcome. Postal/NAICS gaps are shown
independently in Missing Information.

Each canonical search has a 20-Dataverse-page budget and a 5,000-result paging
window, with deterministic name/Account-ID ordering and same-origin Account-only
continuations. Users must narrow filters beyond those budgets; there is no total
population download or count. Pagination is still page based and may replay earlier
pages; it is not a new cursor search service. Search failures are sanitized/retryable.

The table shows selection, Account, combined Location, Missing Information,
Completeness, and Details. Country is a primary filter; State/Province, City and
Sector sit inside More filters. Selection is page scoped. A compact field selector
and Enrich Selected appear only after selection, with explicit nonempty fields.
Confirm enrichment states the blank-only policy, then calls the existing manual
endpoint. Results show actual per-Account statuses/confirmed fields and partial
failures, with optional outcome details. There are no extra summary cards, charts,
exports, audit dashboards or duplicate activity tables. Durable manual history is
still a separate future task; automatic outcomes remain on Home.

### Selected/manual enrichment field contract

`POST /accounts/enrichment-run` requires nonempty `account_ids` and an explicit,
nonempty `fields_to_update` selection. Supported canonical Dynamics logical fields:
`websiteurl`, `telephone1`, `description`, `numberofemployees`, `address1_city`,
`address1_stateorprovince`, `address1_country`, `address1_postalcode`, and
`cr73c_naicscode`. Unsupported fields and empty selections return HTTP 422 before
any Account/provider processing. The existing field dropdown uses these names;
Data Source is not an enrichment target. `new_employees` and `new_naicstext` remain
legacy Data Quality display/classification fields, not aliases or synchronized
copies of provider-enriched Employees/NAICS. Future consolidated search/table
work must read the canonical fields as well.

Manual enrichment reads all supported Dynamics targets, including Description,
before deciding what is blank. Only explicitly selected blank fields can update;
zero is populated, whitespace is blank. A valid provider employee count becomes a
nonnegative Dynamics integer. Postal codes remain text (including leading zeros).
NAICS accepts only six ASCII digits and writes `cr73c_naicscode` as text. Invalid
or absent optional values are ignored without preventing other selected updates.
Selected blank Description/location fields can justify a manual lookup; the
automatic credit-worthy subset is not applied. No eligible selected blank fields
means `no_updates_needed` with no provider call or usage increment.

The selected endpoint returns aggregate `processed`, `updated`, `skipped`, and
per-Account `results`: `account_id`, `account_name`, `status`, `updated`, confirmed
`fields_updated`, and the compatible `updates` object. Statuses are `updated`,
`no_updates_needed`, `no_match`, `skipped_credit_limit`, and `failed`. Non-updated
outcomes include a fixed `reason`/`reason_code`; failures include sanitized
`error`/`error_category`. Failed writes never return intended fields as confirmed.
Transport write failures include `completion_uncertain=true`; confirmation is
not invented and no new retry behavior is added. A failed legacy audit write does
not erase a confirmed Dynamics update.

Legacy single/all-Account manual callers that omit selection retain their original
seven targets (excluding Postal Code/NAICS); explicit empty selection never means
all fields. Manual provider matching, name-only fallback, one usage increment per
successful adapter invocation, and the batch delay remain unchanged. Automatic
`/accounts/enrich-one`, history, preflight, mappings, retries, and machine auth are
unchanged. Manual durable history remains a separate future task.

### Total Accounts cache-aside fallback

Dynamics remains the Account source of truth. PostgreSQL stores a singleton
`maintenance_total_account_snapshot`, not a copy of the Account population.
The maintenance worker remains the normal proactive refresher. Home reads a
present snapshot immediately, including a stale valid value with freshness
warnings. Only when the total snapshot is missing does the authenticated Home
route call the existing read-only `RetrieveTotalRecordCount` for `account`, save
the singleton snapshot, and return that value in the same response. No Account
records, daily counts, discovery, or enrichment are fetched by this fallback.

A shared 60-second async cache coalesces concurrent fallback requests across
Home views/page sizes within each web process; failed lookups are briefly cached
as well. Independent web processes may each make one initial lookup. A worker
snapshot committed during a race is rechecked before contacting Dynamics.
Successful Dynamics counts (including zero) survive snapshot persistence failure
and remain reusable in memory. Lookup failure returns unknown, never fabricated
zero, with a sanitized warning. No raw errors or credentials are logged. Existing
Home refresh-version invalidation detects committed snapshot writes normally.
A failure of the wider PostgreSQL Home read model still returns its existing
controlled 503; the fallback does not replace observation/history storage.

## Newsletter subscriber snapshots

The Marketing overview includes **Newsletter Subscribers**, sourced from the
Economic Navigator Newsletter (Real Time) Dynamics segment definition
`32d99679-2af5-ef11-be20-7c1e520d6c2f`. The initial observation is **4,293**,
verified against Dynamics on September 23, 2026. It is stored in
`backend/app/data/newsletter_initial_snapshot.json` and inserted into PostgreSQL
idempotently during database initialization. Earlier history is not reconstructed.

The chart shows **one point per month**, using the latest subscriber count
observed in that Eastern calendar month. Each weekly update replaces the current
month's displayed count; counts are never added together. Earlier months retain
their last recorded count. Weekly observations are retained internally so the
schedule remains idempotent and existing history is preserved.

The backend starts a scheduler with the application. It captures one snapshot per
week on Monday at 9 a.m. in `America/New_York`, using the existing
Dynamics credentials. It retries failures hourly and checks for a missing current
week after Monday at 9 a.m. on startup and when the chart is loaded. The actual capture timestamp is
saved; downtime does not create backdated observations for missed weeks.
Snapshots are immutable, and a database primary key prevents duplicate weeks
across workers/restarts. Reading/reloading the chart never overwrites a snapshot.

Deploy both backend and frontend to enable this feature. No new environment
variables are required for an always-running backend. The scheduler runs only
while the backend process is running.

For a Render service that sleeps, create an independent **Cron Job** from this
repository with root directory `backend`, build command
`pip install -r requirements.txt`, and command:

```sh
python -m app.services.newsletter
```

Use schedule `0 13,14 * * 1` (Mondays at 13:00 and 14:00 UTC). Render uses UTC;
these two checks cover 9 a.m. Eastern during both daylight and standard time.
The code skips the early check in winter and skips the second check in summer
once that week's snapshot exists. The running backend retries failed captures
hourly; a cron-only deployment can retry manually after a failure. Give it the backend's `DATABASE_URL`, `TENANT_ID`,
`CLIENT_ID`, `CLIENT_SECRET`, `DYNAMICS_SCOPE`, and `DYNAMICS_API_URL` (or share its
environment group). Choose the same Render region so its internal database URL
is reachable. It is safe to run alongside the in-process scheduler.

References: [Dynamics segment Web API](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/real-time-marketing-api-segment)
and [Render cron jobs](https://render.com/docs/cronjobs).

## Sophie Home Data Health

Home reads persisted Dataverse Account health; it does not calculate scores or
change the Power Automate scoring flows. Account metadata was verified read-only
on October 6, 2026: `cr73c_datahealthscore` is Whole Number; `cr73c_datahealth` is
Choice with Poor `732660000`, Needs Enrichment `732660001`, Good `732660002`,
and Excellent `732660003`.

The existing maintenance worker refreshes the singleton
`maintenance_data_health_snapshot` every 30 minutes by default. Set
`MAINTENANCE_DATA_HEALTH_SECONDS=1800` on the **same existing Render Background
Worker and backend**; supported values are 900–86400 seconds. The worker uses
its existing Dynamics credentials and `DATABASE_URL`. No extra worker or
Seamless key is needed for this refresh. Deploy/restart the backend and existing
worker to initialize the additive table and sync-state allowlist. Validate with
`python -m app.workers.maintenance_refresh --once`; leave the normal continuous
start command unchanged. Do not manually insert production snapshot data.

Refreshes use FetchXML grouped by health Choice, server-side Account counts,
non-null score counts, and score sums. Oversized aggregates are split into
half-open creation-time intervals and combined with a weighted average. Only
one earliest creation timestamp is read; no Account population is downloaded.
A refresh allows at most 256 read requests, four concurrent queries, and 120
seconds. Limit exhaustion, an indivisible bulk-import interval, cancellation,
or unavailable Dynamics preserves the previous snapshot and records a sanitized
failure. Failed worker refreshes back off at least five minutes. PostgreSQL
failure prevents remote work. Advisory locks protect overlapping workers.

The API reads this small snapshot and exposes average score, score coverage,
classified coverage, the four distinct distribution categories, and grouped
KPIs. **Needs Enrichment = Poor + Needs Enrichment**. **Good or Excellent = Good
+ Excellent**. Both percentages divide by Accounts with one of the four valid
classifications; unclassified Accounts never enter these denominators. Average
score divides the score sum by non-null score count. Score-null and unclassified
counts are reported separately because they can differ during backfill. Missing
snapshots are unknown, not zero; zero denominators have null percentages.

Snapshot commits participate in the existing cross-process Home cache version.
The 45-second Home API cache never triggers a Data Health refresh. A snapshot is
stale after two refresh cadences or a failed refresh; last valid values remain
visible. Home contains four health KPI cards, one Account Data Health chart,
and the existing recent/attention Account table. The Needs Enrichment card has
no link because the Enrichment workspace does not yet filter by the same
persisted Data Health Choice definition. The sector chart component/API remain
available internally but are no longer mounted on Home.

## Application account persistence: stage 1 (not a production cutover)

The legacy `/auth` routes still use `backend/app/services/users.json`. This stage
adds an **inactive replacement persistence layer**, not another login endpoint,
dual writes, or a JSON fallback. Do not deploy even this schema-only change before
capturing the production JSON files: a Render deployment can lose them while the
legacy routes are still active. The repository's local file is not a production
backup. No production import or route change is performed by this stage.

### Schema and persistence

`backend/app/application_users_schema.py` adds `application_users` through the
existing additive `initialize_database()` convention. Alembic currently contains
only an unused scaffold. Initialization creates an empty table; it never reads
JSON, imports accounts, or creates an administrator. Repeated initialization
preserves existing rows. There is no automatic downgrade or table drop.

`backend/app/services/application_users.py` supplies transactional creation,
authentication, lookup, listing, updates, deletion, and explicit batch import.
Normalized lowercase emails are unique and checked by PostgreSQL. Row locks
prevent independent concurrent updates from overwriting one another. Commits
finish before success returns; failed batches roll back completely. Public
serialization retains the existing `/auth/users` shape and excludes hashes.
Password verification supports the exact legacy `salt:hex_digest` encoding with
PBKDF2-HMAC-SHA256 and 120000 iterations. No password resets are necessary.

Existing string IDs retain their values. Numeric legacy IDs retain their exact
JSON type in `legacy_id` and get the same value as a textual primary key. Records
without IDs receive a UUID on first import; identical reruns preserve it. Legacy
tokens identify accounts by normalized email, and the existing API exposes no ID
field. Names, hashes, roles, organizations, and module arrays are retained without
granting a union of conflicting permissions. Unknown legacy fields fail validation
so identity or permission metadata cannot be silently discarded.

Organization IDs are positive logical associations, deliberately without a
foreign key to the separate client-management directory. Legacy IDs may refer to
organizations absent from that directory. Import must not manufacture directory
rows, and deleting a directory organization must not delete login identities.
Verify organization mappings during migration review.

`application_auth_configuration.require_auth_configuration()` is a prepared
fail-closed gate requiring an explicit signing key of at least 32 bytes and a
PostgreSQL URL. The next route stage must wire this gate into the actual startup
path and require it in production, including when `RENDER` is set. Provision a
random secret with at least 32 bytes of entropy through Render's secret settings;
never use a development default or generate a different key per process. Validate
that every instance uses the same database and signing key. This stage does not
change the legacy routes' configuration behavior.

### Production capture and reconciliation plan (must precede deployment)

1. Inventory **every** serving Render instance, service, revision, and disk mount.
   Securely capture each current JSON file before any restart, scaling operation,
   or deployment. Arrange an approved account-write freeze for the final capture.
   Inventory creation, password, module, and deletion changes during the freeze;
   take a final snapshot from every instance. Lost files cannot be recovered from
   PostgreSQL backups because application accounts have never been stored there.
2. Read file bytes directly, without importing FastAPI or calling `_load_users()`
   or `_with_admin_user()`; those legacy helpers can modify the file. Never print
   file contents, password hashes, credentials, environment dumps, or tokens.
   Leave every original `users.json` untouched. Treat snapshots as credential
   material: transfer through an authenticated encrypted channel to approved
   encrypted storage outside Render's ephemeral filesystem, with least-privilege
   access and a retention policy. Keep source instance/revision/path/time and
   checksum manifests securely alongside the encrypted originals. Validate that
   a backup can be decrypted and read in an isolated environment.
3. Decode verified copies with `decode_legacy_snapshot()` for duplicate-object-key
   detection; a plain JSON load can silently discard duplicate keys. Pass all decoded mappings to the pure
   `reconcile_legacy_accounts()` helper, supplying an explicitly reviewed default
   organization ID for records missing that field. This helper never reads or
   writes files. It combines identical records and rejects differences in IDs,
   password hashes, name, role, organization, or modules. It also rejects email
   key mismatches and conflicting IDs. Resolve conflicts through an approved
   source-of-truth decision, never newest-file-wins or automatic permission union.
   Reconciliation cannot infer whether an account present on one instance was
   intentionally deleted on another; review available deletion/change history.
4. Rehearse explicit `import_accounts()` on a disposable PostgreSQL database
   using the reviewed snapshot. Imports only insert, never overwrite existing
   accounts, and any conflict rolls back the whole batch. An identical rerun is
   safe. Validate counts and per-account identity, hash equality, role,
   organization, and modules without logging credential fields. Confirm the
   designated administrator is present and test legacy-password login, module
   access, two backend processes, process replacement, and account CRUD.
5. Before production execution, build and review an operator command with
   duplicate-key validation, encrypted-input handling, an explicit target,
   dry-run reporting, and execution approval. No such production CLI or automatic
   migration is provided in this stage. Production execution must use a reviewed
   database target, a backup, least-privilege access, and the approved write freeze.
   Do not infer production inputs or targets from repository defaults.

### Cutover and rollback gates for the next stage

Review and validate the import procedure and rollback rehearsal before editing
the live authentication routes. Then change **all** `/auth` operations and token
user resolution together to this one PostgreSQL store, retaining API contracts,
the legacy password verifier, and current administrator/module authorization.
Remove automatic administrator creation and default credentials from ordinary
reads. Do not add JSON fallback, dual writes, or a second login route. On database
failure, fail closed with a sanitized server error rather than creating an empty
store or reporting an invalid token. Keep `users.json` untouched.

Import approved accounts under the freeze before switching authentication. Before
reopening writes, verify counts/permissions, administrator login, ordinary login,
fresh processes, and shared-instance access. Keep original encrypted snapshots
and a production PostgreSQL backup. Rehearse rollback to a reviewed recovery
build against a **separate durable working copy** of the approved snapshot;
original source files and archived backups must never be overwritten. A legacy
build on a fresh ephemeral filesystem is not a valid rollback. Validate compatible
signing configuration and explicit admin credentials so legacy read-time seeding
cannot change the recovered administrator. Do not reopen account writes until
this rollback path has been demonstrated.

Once PostgreSQL account writes resume, the pre-cutover JSON snapshot is stale.
Prefer rolling back application code while keeping PostgreSQL authentication.
Reverting storage to JSON after that point requires another freeze and an
explicitly reviewed export/reconciliation of all post-cutover changes; do not
silently discard new accounts, deletions, or changed credentials/permissions.

### Local regression checks

Use a disposable **loopback-only** PostgreSQL database and explicitly set
`TEST_DATABASE_URL`. The new tests never fall back to `DATABASE_URL`; they create
and remove unique test schemas only. They use synthetic accounts and never read
the repository's `users.json`.

```bash
TEST_DATABASE_URL=postgresql://localhost/camoin360_auth_test \
  venv/bin/python -m pytest backend/app/services/test_application_users.py -q
```

Coverage includes fresh-process persistence, concurrent unique-email creation,
independent concurrent edits, legacy-password login, permissions, CRUD, empty
reads without seeding, repeated additive schema initialization, legacy-ID
preservation, multi-instance reconciliation conflicts, idempotent imports,
transaction rollback including commit failure, and secret-safe representations
and storage errors. Run later route-contract and recovery rehearsals before
production cutover; these persistence tests do not certify a production migration.

## Application account migration: stage 2 operator tools

Stage 2 prepares backups and read-only verification. It does not switch routes,
restart Render, create production tables, or execute a production import. There
is deliberately **no import/apply CLI command**. Stage 1's explicit import helper
is exercised only with synthetic records in isolated local test schemas.

### Encrypted capture of every live instance

Use `backend/tools/auth_account_backup.py` as a standalone script. It imports no
application modules, so it can be securely copied to an existing Render instance
without deploying Stage 1 or Stage 2. Python and the existing `cryptography`
dependency must be available in that instance's interpreter. Do not install or
redeploy anything automatically if they are missing.

Encryption uses a fresh AES-256-GCM data key and nonce per snapshot, with the data
key wrapped by RSA-3072/OAEP-SHA256. The private key is an encrypted PKCS8 PEM,
protected by a separately managed passphrase. Only the public key goes to Render.
The original file bytes, all account fields (including unknown fields), source
path, instance/service/revision identity, capture time, and source checksum are
inside the encrypted envelope. No plaintext snapshot or temporary plaintext
file is created during export. Console output contains only status and byte count.

Before capture, inventory all serving instances and check the correct source
path. Use **instance-specific SSH targets**, not the default randomly selected
instance and not an ephemeral shell/new one-off instance. The latter does not
contain the live instance's runtime-created file. Render documents instance
selection in [SSH and Shell Access](https://render.com/docs/ssh#connecting-to-a-specific-instance)
and provides [RENDER_INSTANCE_ID](https://render.com/docs/environment-variables#render_instance_id).
Use the same verified instance target for upload, execution, and download.
The exporter refuses an instance ID that differs from its runtime environment.
Authenticated SSH and controlled storage establish source provenance; public-key
encryption by itself does not attest which host created a backup.

Run these commands on the approved operator workstation, from the repository
root. Replace the storage path and SSH target with reviewed values. The storage
path must be on an approved encrypted volume, outside the repository. Do not use
shell tracing (`set -x`), paste secrets into command arguments, print environment
variables, or display decrypted files. `set -eu` stops the example on failures.
The keygen command prompts for a passphrase twice without echoing it.

```bash
set -eu
umask 077
ulimit -c 0
C360_BACKUP_DIR='/approved/encrypted-volume/c360-auth-stage2'
mkdir -m 700 "$C360_BACKUP_DIR"
venv/bin/python backend/tools/auth_account_backup.py keygen \
  --private-key "$C360_BACKUP_DIR/private.pem" \
  --public-key "$C360_BACKUP_DIR/public.pem"

# Repeat this block for EACH inventoried instance, changing instance-01 each time.
C360_RENDER_TARGET='INSTANCE_SPECIFIC_SSH_TARGET_FROM_RENDER'
mkdir -m 700 "$C360_BACKUP_DIR/instance-01"
C360_REMOTE_DIR=$(ssh "$C360_RENDER_TARGET" 'umask 077; mktemp -d /tmp/c360-auth-capture.XXXXXX')
scp backend/tools/auth_account_backup.py "$C360_BACKUP_DIR/public.pem" \
  "$C360_RENDER_TARGET:$C360_REMOTE_DIR/"
ssh "$C360_RENDER_TARGET" \
  "python '$C360_REMOTE_DIR/auth_account_backup.py' export \
    --source '/opt/render/project/src/backend/app/services/users.json' \
    --public-key '$C360_REMOTE_DIR/public.pem' \
    --output '$C360_REMOTE_DIR/accounts.c360backup' \
    --instance-id \"\$RENDER_INSTANCE_ID\""
scp "$C360_RENDER_TARGET:$C360_REMOTE_DIR/accounts.c360backup" \
  "$C360_BACKUP_DIR/instance-01/"
```

The source path above is the usual repository layout; verify it for the deployed
service before execution. No command reads through the auth routes, seeds an
administrator, overwrites `users.json`, or restarts the service. The exporter
reads the source twice and compares inode/size/change timestamps and bytes to
detect concurrent replacement or writes. A final capture still requires an
approved account-write freeze across all instances; capture provisional backups
first, before any disruptive operation. Reads may update filesystem access time.
Files over 8 MiB fail closed to bound memory use on the live service. A failed
capture is not a backup; resolve it without restarting or losing the source.

Outputs require an owner-only directory, are mode 0600, and are published
atomically without replacing existing paths or following source symlinks. If
interrupted before publication, no partial final backup appears. An abrupt kill
may leave a mode-0600 temporary encrypted file; do not treat it as a completed
backup. A backup of corrupted JSON preserves the original bytes but will be
blocked by migration validation. A missing file is an error, never an empty
account mapping or a signal to seed an administrator.

Keep the encrypted backups and key backups in access-controlled approved storage
outside Render, with retention/versioning and a tested restore. Keep the private
key and its passphrase in separate restricted stores. Retain the original files
and encrypted snapshots unchanged. Restrict access to named migration operators;
record access and approvals without recording credentials or account contents.
Do not commit any artifacts. Delete neither source files nor archived originals
as part of this procedure. Remote copies are encrypted, but `/tmp` is still
ephemeral: securely download and validate every capture before relying on it.

### Reconciliation and dry-run commands

Run private-key operations on the operator workstation, not on Render. These
commands prompt for the key passphrase. Automation may instead use a mode-0600,
operator-owned `--passphrase-file` supplied by an approved secret manager. Do not
pass the passphrase itself on the command line or in shell history.

For a two-instance example (repeat `--snapshot` for all inventoried instances):

```bash
venv/bin/python -m backend.app.workers.application_user_migration reconcile \
  --snapshot "$C360_BACKUP_DIR/instance-01/accounts.c360backup" \
  --snapshot "$C360_BACKUP_DIR/instance-02/accounts.c360backup" \
  --expected-instances 2 --private-key "$C360_BACKUP_DIR/private.pem" \
  --default-organization-id 1
```

Supply the reviewed legacy default organization ID, not an assumed value of 1.
`--expected-instances` must match the inventory; snapshots must have distinct
instance identities. The tool does not discover production instances, so the
operator must verify actual inventory membership and capture freshness. It
authenticates/decrypts each envelope in memory, detects duplicate JSON keys, and
uses Stage 1 validation/reconciliation. Unsupported hashes, invalid PostgreSQL
text, unrecognized fields, mismatched email keys, differing records, or ID
collisions block migration. Identical normalized-email records can coalesce.
Reports contain counts and 1-based snapshot/record positions only, never actual
emails, IDs, names, password hashes, or hash fingerprints. Record positions refer
to the order in the captured JSON. Conflicts need an explicitly approved source
decision, including review of intentional deletions; do not merge privileges or
pick the newest file automatically. Originals remain untouched.

To check a reviewed database target, have an approved secret manager inject its
connection string into `C360_REVIEW_DATABASE_URL` without echoing it. Use a
SELECT-only database account. Credentials never appear in CLI arguments.

```bash
venv/bin/python -m backend.app.workers.application_user_migration dry-run \
  --snapshot "$C360_BACKUP_DIR/instance-01/accounts.c360backup" \
  --snapshot "$C360_BACKUP_DIR/instance-02/accounts.c360backup" \
  --expected-instances 2 --private-key "$C360_BACKUP_DIR/private.pem" \
  --default-organization-id 1 --database-url-env C360_REVIEW_DATABASE_URL \
  --expected-database 'REVIEWED_DATABASE_NAME' --expected-schema public
```

The database must already have the Stage 1 schema through a separately approved
schema operation. A missing/incompatible table blocks review; this command never
creates or repairs it. It checks explicit database/schema identity, column types
and nullability, primary/unique keys, and named validated email/ID constraints.
It then reads accounts in one bounded, repeatable-read **READ ONLY** transaction
and compares expected and stored records. Missing accounts represent proposed
inserts during dry-run; different existing accounts, ID collisions, unsupported
stored hashes, or unexpected database accounts block it. Both current and
expected counts are reported. There is no fallback to `DATABASE_URL`, application
startup, DDL, write probe, import, or rollback-only insertion into the target.

A successful dry-run proves the inspected structure and records are compatible;
it does not test INSERT privileges, custom triggers, deployment behavior, backup
completeness, or a production commit. Run an actual import/rollback rehearsal on
an approved disposable database with the reviewed inputs before Stage 3. The
automated suite already rehearses those paths using synthetic data only.

### Password and post-import verification

All hashes are validated against the existing Stage 1 legacy format. No hashes
are re-derived or changed. To confirm an existing password against its captured
hash, use the optional offline interactive command below. Email and password
are both entered without echo; only a success boolean is printed.

```bash
venv/bin/python -m backend.app.workers.application_user_migration check-password \
  --snapshot "$C360_BACKUP_DIR/instance-01/accounts.c360backup" \
  --expected-instances 1 --private-key "$C360_BACKUP_DIR/private.pem" \
  --default-organization-id 1
```

Format compatibility alone cannot prove a user's unknown plaintext password.
The optional check uses the same Stage 1 password verifier; synthetic known-
password tests also verify compatibility without resetting passwords.

After a separately approved future import, rerun the dry-run command with
`verify` in place of `dry-run`. Verification requires exact account counts and
normalized email membership, compares explicit legacy IDs and their JSON types,
names, roles, organization associations, module arrays, and exact password-hash
equality. It flags missing and unexpected records. ID-less JSON cannot predict
generated IDs; their database primary keys remain authoritative and existing
explicit IDs must match exactly. Output contains mismatch counts, not values.
No account data is modified. Keep the account-write freeze until validation and
the designated administrator's login/permissions have been confirmed.

Exit status is 0 for success, 1 for blocked reconciliation/comparison, 2 for
operational/input failure, and 130 for interruption. Errors are fixed codes with
no raw exceptions, connection strings, arguments, or paths. Never enable debugger
locals, SQL parameter logging, tracing, or core dumps around decrypted material.

### Recovery and remaining cutover gates

Rehearse byte-exact recovery into a new, protected working copy on the operator
workstation. This explicitly creates plaintext credential material, so only use
an approved encrypted volume. Existing destinations, including original
`users.json`, cannot be overwritten:

```bash
venv/bin/python -m backend.app.workers.application_user_migration recover \
  --snapshot "$C360_BACKUP_DIR/instance-01/accounts.c360backup" \
  --expected-instances 1 --private-key "$C360_BACKUP_DIR/private.pem" \
  --default-organization-id 1 --allow-plaintext-recovery \
  --output "$C360_BACKUP_DIR/recovery-working-copy.json"
```

This restores exactly one captured source, not a reconciled multi-instance union
and not a production file. Recovery validates JSON/account compatibility first;
corrupt captures require separate forensic recovery, not a live restore. Do not
print, edit, commit, or deploy the recovered copy. A multi-instance rollback needs
a separately reviewed consolidated working copy; the tool deliberately does not
choose winners or reconstruct deleted accounts.

Before Stage 3, obtain real complete instance captures, approve reconciliation
and organization defaults, rehearse migration and recovery with the approved
inputs, verify the designated administrator, confirm common secure signing and
database configuration across instances, and validate the no-data-loss rollback
plan. No production captures or imports have been executed by Stage 2. Do not
change authentication routes until the user approves Stage 3. After PostgreSQL
writes resume, prefer code rollback retaining PostgreSQL; a stale JSON snapshot
cannot safely replace the new source of truth.

Stage 2 regressions:

```bash
TEST_DATABASE_URL=postgresql://localhost/camoin360_auth_test \
  venv/bin/python -m pytest backend/app/workers/test_application_user_migration.py \
  backend/app/services/test_application_users.py -q
```

## Stage 2B readiness review and synthetic rehearsal

Decision: **production capture is conditional, not authorized or verified by this
review; production migration/cutover is NO-GO.** No production account files,
records, or account endpoints were accessed. No Render service was restarted,
scaled, or redeployed. Production authentication code was not changed.

The session had no Render connector, CLI, or API credential. No deployment
manifest in this checkout established the actual service topology. The public
API cannot establish instance count or filesystem layout. Consequently the live
instance count/IDs, deployed revision, runtime/root/start command, source path,
Python/dependencies, disk permissions, database configuration, and account
compatibility are **UNVERIFIED**. The native-runtime example path in Stage 2 is
a candidate, not a confirmed production path. Docker WORKDIR may differ.

| Readiness requirement | Result | Evidence or remaining condition |
| --- | --- | --- |
| Review existing implementation | PASS | Code reviewed; gaps below reproduced with synthetic probes |
| Actual deployed JSON path | UNVERIFIED | No production shell/configuration access; derive from deployed source without importing the app |
| Current production instance count and complete inventory | UNVERIFIED | Operator must record current live IDs, not autoscaling maximum or process concurrency |
| Backup encryption, no-clobber writes, source preservation | PASS locally / UNVERIFIED on Render | Existing synthetic tests; live interpreter, filesystem, SSH/SFTP, and canary still required |
| Preserve valid legacy accounts in PostgreSQL | PASS for synthetic inputs / UNVERIFIED for production | IDs/types, hashes, roles, organization IDs, and module arrays survived import and restore |
| Administrator, organization mapping, and password policy | PASS at persistence level / UNVERIFIED end to end | Administrator route policy and frontend organization behavior need explicit Stage 3 validation |
| Full isolated migration rehearsal | PASS | Two encrypted instance snapshots, reconciliation, read-only dry-run, import, verification, fresh process |
| Rollback after post-migration account changes | PASS for persistence/recovery / FAIL for deployable rollback readiness | Same-PG process and latest dump restore retain changes; PG-aware route rollback build not yet implemented |
| Complete automated production safety gates | FAIL | Inventory binding and constraint-definition gaps reproduced; security findings below |
| Production execution approval/checklist | PASS as a plan / UNVERIFIED for execution | Explicit capture approval and metadata/canary signoff required; no approval inferred |

### Rehearsal evidence and unresolved findings

`backend/app/workers/test_application_user_readiness.py` adds seven checks to the
previous 78: **85 passed** on disposable loopback PostgreSQL 14. Tests used only
synthetic records; encrypted sources were unchanged. They covered a string admin
ID, numeric legacy ID with its original JSON type, an ID-less account, an approved
default organization, and module permissions. Following import, tests created a
new account, changed another account's password/modules, and deleted an account.
A fresh Python process retaining PostgreSQL preserved all changes. A subsequent
`pg_dump`/`pg_restore` into a separate disposable database preserved exact account
records and working passwords. Byte-exact recovery of an old JSON snapshot was
possible, but verification correctly rejected it as stale. This is not a rehearsal
of real Render routes or proof of production RPO/PITR; writes after a backup are
not covered by that backup.

Two passing **diagnostic probes reproduce gaps**, rather than certify safety:

1. `load_snapshots()` checks snapshot count and distinct instance IDs but does
   not bind them to approved instance/service IDs, revision, source path, or a
   freshness window. The exporter check also proves nothing about the intended
   target if passed its own `$RENDER_INSTANCE_ID`. For capture, pass the separately
   inventoried expected ID; the exporter then rejects a different running
   instance. Add machine-checked manifest/inventory/freshness approval before a
   production import. Identical file checksums or a successful reconciliation do
   not prove complete inventory, legitimate deletions, or source provenance.
2. `_schema_compatible()` checks named, validated CHECK constraints, not their
   expressions. Replacing the normalized-email CHECK with `CHECK (TRUE)` retained
   a false-positive `ready` result in the local probe. Compare full constraint
   definitions and inspect defaults, triggers, RLS policies, and target privileges
   before relying on schema verification for cutover. Do not treat current
   dry-run success as sufficient production schema certification.

Additional gates:

- A final freeze must cover ordinary auth reads that can rewrite the built-in
  administrator via `_with_admin_user()`, not just explicit account CRUD. Freeze
  procedures must be separately approved; do not change Render environment
  settings to achieve this, because they can trigger deployment/restart. Take
  provisional encrypted backups first without delaying preservation for cutover.
- An account absent on one instance might have been deleted intentionally or
  never created there. JSON contains no deletion tombstones. Reconciliation unions
  membership and cannot infer intent; approve those differences using available
  audit history/account-owner review before import.
- Existing admin-route access checks the designated email, while module access
  accepts `role == 'admin'`. Preserving an admin role alone does not establish
  management access. Validate the designated identity, role, full modules, and
  password under the planned route adapter, without read-time provisioning.
- Legacy organization handling accepts values such as numeric strings or falls
  back for null/zero; strict migration rejects them. Those cases require approved
  mappings, not silent coercion. `AuthResponse` currently omits organization ID,
  while frontend `saveCurrentUser()` defaults to 1 despite the token carrying the
  actual association. Validate backend/token/frontend consistency in Stage 3.
  Logical IDs are not directory foreign keys: absence from `organizations` is not
  permission to fabricate or reassign directory rows.
- Unknown legacy fields or unsupported types intentionally block import. No
  claim that every real account is compatible can be made before approved capture
  and reconciliation. Existing legacy password format was exercised without reset.
- The prepared secret validator is not wired into live routes; built-in defaults
  remain. Production key strength/sharing, TLS verification, database identity,
  least-privilege roles, encrypted storage, backup retention, and PITR/RPO remain
  unverified. Minimum key length alone does not establish entropy or secure TLS.
- The existing separate client-user response model still includes `password_hash`
  (`backend/app/schemas/client_user.py`). Do not use `/users` for diagnostics or
  backup. This is a separate security defect requiring an authorized fix.
- No PG-aware authentication rollback build or production import/apply CLI exists.
  Code rollback to current legacy routes would return to ephemeral JSON. Never
  restore pre-cutover JSON over post-cutover identities. Retain PostgreSQL or,
  under a new write freeze, recover a verified latest database backup/PITR target.

Only rehearsal tests and this report were added in Stage 2B. Functional migration,
backup, authentication, and frontend implementation were left unchanged.

### Operator checklist and exact commands (not executed on production)

1. **Metadata signoff.** In Render, record service ID, current live instance IDs
   and timestamp, revision, native/Docker runtime, root/start command, actual
   interpreter, disk mounts, and each instance-specific SSH target. Verify SSH
   host fingerprints using Render's published list. Default random SSH targets,
   ephemeral shells, configured maximum instance count, and `WEB_CONCURRENCY`
   are not an inventory. If SSH/SFTP is unavailable, stop; do not redeploy for it.
2. **Configuration-only preflight.** For each inventoried live instance, set the
   values below from reviewed metadata. These example paths are candidates until
   confirmed. Run the following in Bash from the operator workstation. It reads
   deployed Python source as AST only; it never opens or stats `users.json`,
   imports application modules, prints secrets, or calls authentication routes.

```bash
set -euo pipefail
umask 077
ulimit -c 0
C360_RENDER_TARGET='REVIEWED_INSTANCE_SPECIFIC_SSH_TARGET'
C360_EXPECTED_INSTANCE_ID='REVIEWED_LIVE_INSTANCE_ID'
C360_PYTHON='/absolute/reviewed/service/python'
C360_AUTH_FILE='/opt/render/project/src/backend/app/routes/auth.py'
C360_SOURCE_JSON='/opt/render/project/src/backend/app/services/users.json'

# Permit only simple reviewed infrastructure paths in the remote shell command.
[[ "$C360_PYTHON" =~ ^/[A-Za-z0-9_./-]+$ ]]
[[ "$C360_AUTH_FILE" =~ ^/[A-Za-z0-9_./-]+$ ]]
[[ "$C360_SOURCE_JSON" =~ ^/[A-Za-z0-9_./-]+$ ]]
[[ "$C360_EXPECTED_INSTANCE_ID" =~ ^[A-Za-z0-9_-]+$ ]]

ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$C360_RENDER_TARGET" \
  "'$C360_PYTHON' - '$C360_AUTH_FILE' '$C360_SOURCE_JSON' '$C360_EXPECTED_INSTANCE_ID'" <<'PY'
import ast, json, os, pathlib, sys
try:
    auth = pathlib.Path(sys.argv[1]).resolve()
    tree = ast.parse(auth.read_text())
    assignments = {n.targets[0].id: n.value for n in tree.body
                   if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name)}
    expected = {'BASE_DIR': 'Path(__file__).resolve().parent.parent / "services"',
                'USERS_FILE': 'BASE_DIR / "users.json"'}
    layout = all(ast.dump(assignments[k]) == ast.dump(ast.parse(v, mode='eval').body)
                 for k, v in expected.items())
    from cryptography.hazmat.primitives.asymmetric import rsa, padding
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    report = {'instance_matches': os.getenv('RENDER_INSTANCE_ID') == sys.argv[3],
              'source_layout_matches_reviewed_code': layout,
              'candidate_path_matches': str(auth.parent.parent / 'services' / 'users.json') == sys.argv[2],
              'crypto_imports_available': True}
    print(json.dumps(report))
    sys.exit(0 if all(report.values()) else 2)
except Exception:
    print('{"status":"preflight_failed"}')
    sys.exit(2)
PY
```

   Stop on any false result/failure or unexpected deployed code. This does not
   verify account-file existence/readability/size or loaded-process identity;
   source/start-command provenance must be signed off. Do not print module source,
   AST, process arguments, environment dumps, or file contents.
3. **Capture approval.** Obtain explicit approval to read/export the real JSON
   from every recorded instance into the approved encrypted store. The present
   readiness request is not that approval. Record the operator, approved source
   paths/IDs, recipients, storage/key custodians, and retention. Schema changes,
   data import, auth changes, environment updates, scaling, and deploys are excluded.
4. **Key, canary, and provisional capture.** After approval, generate keys once
   using Stage 2 keygen on an approved encrypted workstation volume. Never send
   the private key or passphrase to Render. For each instance, keep the same
   reviewed variables and use a new local directory. These commands supersede
   the self-referential instance-ID argument in the earlier example:

```bash
C360_BACKUP_DIR='/approved/encrypted-volume/c360-auth-stage2b'
mkdir -m 700 "$C360_BACKUP_DIR"
venv/bin/python backend/tools/auth_account_backup.py keygen \
  --private-key "$C360_BACKUP_DIR/private.pem" --public-key "$C360_BACKUP_DIR/public.pem"

# Per instance: change instance-01 on subsequent iterations; do not rerun keygen.
mkdir -m 700 "$C360_BACKUP_DIR/instance-01"
C360_REMOTE_DIR=$(ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$C360_RENDER_TARGET" \
  'umask 077; mktemp -d /tmp/c360-auth-capture.XXXXXX')
[[ "$C360_REMOTE_DIR" =~ ^/tmp/c360-auth-capture\.[A-Za-z0-9]+$ ]]
scp -o BatchMode=yes -o StrictHostKeyChecking=yes backend/tools/auth_account_backup.py \
  "$C360_BACKUP_DIR/public.pem" "$C360_RENDER_TARGET:$C360_REMOTE_DIR/"

# Synthetic canary only: verifies encryption/filesystem/transfer before account capture.
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$C360_RENDER_TARGET" \
  "umask 077; set -C; printf '%s' 'c360-stage2b-canary-v1' > '$C360_REMOTE_DIR/canary.txt'"
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$C360_RENDER_TARGET" \
  "'$C360_PYTHON' '$C360_REMOTE_DIR/auth_account_backup.py' export \
    --source '$C360_REMOTE_DIR/canary.txt' --public-key '$C360_REMOTE_DIR/public.pem' \
    --output '$C360_REMOTE_DIR/canary.backup' --instance-id '$C360_EXPECTED_INSTANCE_ID'"
scp -o BatchMode=yes -o StrictHostKeyChecking=yes "$C360_RENDER_TARGET:$C360_REMOTE_DIR/canary.backup" \
  "$C360_BACKUP_DIR/instance-01/"
venv/bin/python - "$C360_BACKUP_DIR/private.pem" "$C360_BACKUP_DIR/instance-01/canary.backup" <<'PY'
import sys
from backend.tools.auth_account_backup import decrypt_snapshot, read_passphrase
try:
    # stdin carries this script; an operator-owned 0600 secret-manager file is
    # required here so no passphrase is echoed or supplied as an argument value.
    import os
    phrase = read_passphrase(os.environ['C360_PASSPHRASE_FILE'])
    raw, _ = decrypt_snapshot(sys.argv[2], sys.argv[1], phrase)
    assert raw == b'c360-stage2b-canary-v1'
    print('{"status":"canary_verified"}')
except Exception:
    print('{"status":"canary_failed"}')
    sys.exit(2)
PY

# Only after explicit capture approval, successful preflight/canary, and source signoff:
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$C360_RENDER_TARGET" \
  "'$C360_PYTHON' '$C360_REMOTE_DIR/auth_account_backup.py' export \
    --source '$C360_SOURCE_JSON' --public-key '$C360_REMOTE_DIR/public.pem' \
    --output '$C360_REMOTE_DIR/accounts.c360backup' --instance-id '$C360_EXPECTED_INSTANCE_ID'"
scp -o BatchMode=yes -o StrictHostKeyChecking=yes "$C360_RENDER_TARGET:$C360_REMOTE_DIR/accounts.c360backup" \
  "$C360_BACKUP_DIR/instance-01/"
```

   Before the canary verification, have the secret manager supply
   `C360_PASSPHRASE_FILE` as a **file path only**, referring to an operator-owned
   mode-0600 file outside the repository. Keep its value out of transcript dumps.
   If secure secret-file delivery is unavailable, stop rather than echoing the
   passphrase. No dependency installation or service configuration change is
   authorized if preflight fails. Stop on any transfer, 8-MiB source limit,
   encryption, permission, source-change, or no-clobber error. Hard-link and
   directory-fsync support are proven by the canary, not assumed from local tests.
5. **Preservation receipt.** Download and authenticate/decrypt each capture
   immediately; confirm inventory membership, revision, source path, and capture
   freshness through a restricted review, without printing account contents or
   credential values. Existing CLI checks cannot replace this signoff. Keep
   all originals and encrypted copies; do not clean up live account files.
6. **Separate approvals before proceeding.** Approve a final freeze/capture,
   any conflict/deletion/organization decisions, real-snapshot isolated rehearsal,
   target schema verification, and PG-aware recovery-build validation. Fix the
   inventory/schema verification gaps before production migration. Only after
   another explicit Stage 3 approval may authentication routes be modified.
   No production import command is supplied or authorized by this review.

Reproduce the local-only review/rehearsal with an explicitly disposable loopback
database (never a production URL):

```bash
TEST_DATABASE_URL=postgresql://localhost/camoin360_auth_test \
  venv/bin/python -m pytest backend/app/workers/test_application_user_readiness.py \
  backend/app/workers/test_application_user_migration.py \
  backend/app/services/test_application_users.py \
  backend/app/services/test_client_users.py backend/app/routes/test_auth_routes.py -q
```

## PostgreSQL authentication: fresh-account deployment

This is the current procedure and supersedes all earlier preservation/migration
plans above. Existing JSON login accounts and their old sessions are intentionally
abandoned. **Do not import JSON accounts.** Neither `users.json` nor the historical
encrypted-backup utilities are deleted. Authentication never reads those files,
falls back to them, or provisions an administrator during startup or login.
The `client_users` business directory remains separate and unchanged.

### Runtime behavior and configuration

All `/auth` operations and token-user resolution use the shared PostgreSQL
`application_users` service. Normalized email uniqueness is database-enforced.
User IDs are stable and included in signed claims, so deleting and recreating an
email does not reactivate a token issued to the old identity. Permissions are
reloaded from PostgreSQL on each authenticated request. A missing/unavailable
store fails closed; it cannot be replaced by an empty local file.

Login responses retain token/name/email/role/modules and now also return
`organization_id`, fixing the frontend's previous fallback to organization 1.
JWTs are standard three-part HS256 tokens with a fixed algorithm, issuer,
audience, issued-at time, account ID, and 12-hour expiry. The React token parser
was updated accordingly. Old two-part sessions must log in again. Administrators
are authorized by their database role, with all existing module options; no
person's email or credentials are hardcoded. Admin editing/deletion through the
normal account API remains forbidden. Public signup remains disabled.

Required runtime settings:

- `DATABASE_URL`: the reviewed persistent PostgreSQL target shared by every
  backend instance. Review TLS/certificate settings and existing business-service
  privileges; authentication introduces no alternative database URL or SQLite.
- `AUTH_SECRET_KEY`: one securely generated random secret with at least 32 bytes
  of entropy, delivered through a secret manager to every backend instance and
  the bootstrap operator. There is no default or per-process generated key.
  The validator rejects missing, short, whitespace-padded, or trivially repetitive
  values. Length/diversity validation cannot substitute for random generation.
- `AUTH_DATABASE_SCHEMA`: defaults to `public`; set it explicitly when using a
  different reviewed schema/search path. Operator target and runtime must match.
- `CAMOIN360_ORGANIZATION_ID`: optional default association for ordinary new users;
  review it against business ownership. Bootstrap requires its own explicit ID.
- Frontend `REACT_APP_API_BASE_URL`: keep it set to the reviewed production API
  (`https://api.camoin360.com`); build and deploy the JWT-aware frontend with the
  backend during the coordinated authentication cutover.

The durable `application_auth_bootstrap` singleton records completion and a
signing-key digest. Startup validates schema and any existing signing binding;
JWT signing/verification also checks that binding. A backend configured with a
different key cannot issue incompatible sessions. Do not change the key on one
instance or rerun bootstrap to rotate it. Coordinated key rotation requires an
explicitly reviewed binding/configuration change; it invalidates existing sessions.
Only the digest is stored; neither it nor credentials are returned by the API or
printed by operator commands.

### Additive preparation and explicit one-time bootstrap

The commands below are a **future operator runbook**, not commands executed or
authorized against production during implementation. No production records,
schema, bootstrap, configuration, deploy, or push was performed here.

1. Review the intended release and production database/schema identity. Provision
   the shared signing key and database connection through approved secret storage.
   Keep credential values out of command arguments, terminal output, transcripts,
   repository files, SQL-parameter logging, debug locals, and shell tracing.
2. With separate approval for additive auth schema preparation, run the new
   operator command from the reviewed release on an approved workstation/job.
   Have the secret manager populate `CAMOIN360_AUTH_OPERATOR_DATABASE_URL`; it
   must point at the same database/schema used by runtime `DATABASE_URL`.

```bash
venv/bin/python -m backend.app.workers.application_auth_admin prepare-schema \
  --database-url-env CAMOIN360_AUTH_OPERATOR_DATABASE_URL \
  --expected-database REVIEWED_DATABASE_NAME --expected-schema public

venv/bin/python -m backend.app.workers.application_auth_admin verify-schema \
  --database-url-env CAMOIN360_AUTH_OPERATOR_DATABASE_URL \
  --expected-database REVIEWED_DATABASE_NAME --expected-schema public
```

   Preparation creates only the two auth tables and the single-admin unique
   index. It does not call the business initializer, seed business rows, read
   JSON, drop/recreate existing tables, overwrite users, or repair unknown drift.
   Repeated preparation preserves all existing records. If unexpected existing
   auth rows or multiple administrators cause refusal, stop for review; do not
   delete them automatically. Verification reads catalogs only and checks actual
   CHECK expressions/enforcement, required columns/types/nullability/defaults,
   valid immediate primary/unique indexes and their predicates, the bootstrap
   foreign key, and absence of unexpected triggers/rules/RLS. Name-only checks
   are no longer accepted. Runtime startup requires successful verification;
   missing schema/configuration prevents serving authentication.
3. Obtain deployment approval and deploy the reviewed backend and JWT-aware
   frontend in one coordinated authentication maintenance window. No JSON-account
   preservation is required under the new requirements. Avoid routing requests
   between old JSON backends and new PostgreSQL backends during rollout. Startup
   is allowed with no administrator and never creates one; login remains
   unavailable until explicit bootstrap succeeds. Confirm every instance points
   at the intended persistent database and shares the signing key.
4. Obtain explicit approval for the **one-time production administrator write**.
   Supply all five values through the secret manager, without shell defaults:
   `AUTH_SECRET_KEY`, `CAMOIN360_BOOTSTRAP_NAME`, `CAMOIN360_BOOTSTRAP_EMAIL`,
   `CAMOIN360_BOOTSTRAP_PASSWORD`, `CAMOIN360_BOOTSTRAP_ORGANIZATION_ID`.
   The administrator password must contain 8–1024 characters and should be
   randomly generated and stored in the organization's password manager.

```bash
venv/bin/python -m backend.app.workers.application_auth_admin bootstrap-admin \
  --database-url-env CAMOIN360_AUTH_OPERATOR_DATABASE_URL \
  --expected-database REVIEWED_DATABASE_NAME --expected-schema public \
  --confirm-bootstrap
```

   Bootstrap validates the target/schema, serializes concurrent attempts, and
   commits the account and completion/key marker in one transaction. It refuses
   any existing administrator, matching email, or completed marker. A unique
   partial index also prevents duplicate administrators. Repeating the command
   cannot reset a password, replace privileges, or create another administrator.
   Deleting/demoting an administrator does not reset the one-time marker. There
   are no default credentials or public provisioning endpoints. Errors and
   success output contain fixed status/operation values only. Exit 0 means
   committed success; 2 means refused/failed; 130 means interrupted. If the
   result is uncertain, verify login/state rather than deleting rows or forcing
   a retry around the safeguards.
5. Remove bootstrap-specific credentials from the operator environment/job and
   secret delivery scope. They need not exist in the long-running backend.
   Retain runtime `AUTH_SECRET_KEY` and `DATABASE_URL`. Log in through the new
   frontend, create fresh users in Admin, assign their modules, and verify access
   through more than one instance and after a planned restart/deploy. Do not use
   account API responses or logs to print credential material. Protected admin
   password recovery/rotation must be a separate approved operator operation;
   bootstrap cannot be reused as a reset mechanism.

### Rollback and validation

Rollback must retain PostgreSQL authentication and the latest account data. A
rollback to the old JSON implementation would hide all freshly created accounts
and is not a supported recovery strategy. Use database backups/PITR under the
reviewed recovery plan; pre-cutover JSON snapshots contain none of the fresh
accounts. No recovery operation should drop existing business tables.

Local regressions use only disposable loopback PostgreSQL and synthetic
credentials. Auth schema preparation was also tested in a separate schema with
a business sentinel: only auth tables were added and the sentinel was unchanged.
Tests cover HTTP contracts, normalized-email conflicts, module/admin enforcement,
expiry and malformed JWTs, current permission resolution, deleted/recreated
identity isolation, fresh-process/multiple-instance persistence, signing-key
mismatch, empty startup without provisioning, concurrent/one-time bootstrap,
rollback on interruption, and schema/default/index/constraint drift. Historical
backup utility tests remain and do not authorize importing abandoned JSON accounts.

Production target, runtime settings, and deployment revision remain unverified
until the approved operator checks them. Historical snapshot-inventory gaps are
not prerequisites for this fresh-account deployment, because no snapshots are
used by live authentication or bootstrap.
