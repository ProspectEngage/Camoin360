# Tasks 06 and 07: page loading and targeted cleanup

## Production bundle measurements

Measured on 2026-11-09 with the installed lockfile dependencies and `npm run build`.
The baseline was built in an isolated temporary copy of `frontend`, restoring
`App.js`, `EmployeeProductivity.js`, and `BillableBreakdownCard.js` from commit
`06ff1c90`. The updated build used the working tree. No dependencies changed.

| JavaScript measurement | Before | After | Change |
| --- | ---: | ---: | ---: |
| Initial entrypoints, bytes | 1,379,502 | 473,120 | -65.7% |
| Initial entrypoints, gzip bytes | 383,010 | 148,388 | -61.3% |
| All chunks, gzip bytes | 383,010 | 426,964 | +11.5% |

Initial files are the `.js` entries in `build/asset-manifest.json`'s `entrypoints`.
Gzip measurements sum the compressed size of each file independently (Python
`gzip.compress` with default settings). All-chunk measurements include every
`build/static/js/*.js` file, excluding source maps. These measure transfer size,
not browser timing. Authenticated visitors also download their selected view.

The original main bundle included 213 Recharts modules. Updated source maps put
all 213 into deferred chunks: `20.ed9a2380` (197), `621.09be396d` (6), and
`911.a4b83ea3` (10). None remain in the initial bundle. The largest deferred
chunk is 126.37 kB gzipped. Splitting adds runtime/shared-chunk overhead, so the
sum of all chunks is larger despite the substantially smaller initial download.

`App.js` now dynamically imports the five dashboard views and QuickBooks settings.
Only the selected view renders, with a Suspense spinner and accessible status
message while its modules load. Login and legal pages remain directly available.
Existing role restrictions, preferred view selection, management URL handling,
and logout behavior are preserved.

## Two-component cleanup

- `EmployeeProductivity`: shares hours/percentage formatting, removes unused
  year/month option constants and state setters, and simplifies request parameters,
  request keys, and callback dependencies. The removed state was always empty;
  reporting-period filters continue to supply the date constraints.
- `BillableBreakdownCard`: uses the same shared formatters, removing duplicate
  formatting functions. Its active year/month controls are retained.

`productivityFormatting.js` preserves the original numeric coercion, locale,
fraction digits, fallback values, and percent suffix exactly. No unused imports
were identified in these two components, so none were removed speculatively.

## Verification

- Both baseline and updated production builds compiled successfully.
- `CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/App.test.js src/components/EmployeeProductivity.test.js src/managementDashboard.test.js src/components/ReportingCharts.test.js`:
  **4 suites, 32 tests passed**.
- App coverage includes the pending/loading transition, every lazy view,
  QuickBooks route, management URL override, disallowed preference fallback,
  legal routes, unauthenticated login, and logout from a lazy dashboard.
- Existing component tests cover reporting filters, polling, refresh, errors,
  chart data, and empty states.
- Full suite before expanding App coverage: **63 passed, 8 failed, 1 skipped**.
  All eight failures are in `DataQualityTable.test.js`; running that file against
  the isolated baseline reproduced **the same eight failures** (7 passed).
  Its tests expect previously automatic account loading while the component now
  starts with an explicit Search Dynamics action. This unrelated issue is not
  changed by these tasks; the entire frontend suite is not green.
- `git diff --check` passed.

No pull request created, as requested.
