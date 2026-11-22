# Week 3 / Task 08 handoff

Implementation and automated verification are complete. **Screenshot capture and
team approval of metric definitions remain outstanding.** No PR was created,
following the earlier instruction to skip pull requests.

## Five improved components

| Component | Changes |
| --- | --- |
| Sales Outlook | Annual contracted fees explicitly labeled USD; monthly project counts correctly labeled by creation date; years on each month tick; full-value currency tooltip; annual filter-grain explanation; loading/error/retry and per-chart empty states. |
| RFP Sales Outlook | Annual proposal title corrected; won fees and counts distinguished; date basis and non-bid classification explained; fitted trend labeled; full currency tooltip; month/year ticks; loading/error/retry and per-chart empty states. |
| Contract Backlog | Labels now identify monthly Total Project Fee and Fee for Camoin; explains that these are not remaining backlog or recognized revenue; readable compact axis with exact tooltip amounts; loading/error/retry and empty states. |
| RFP Success Rate | Value/count names replace symbols; denominators and proposal-quarter grouping explained; keyboard-focusable definition tooltips; rates shown to one decimal; undefined rates displayed as unavailable; error/retry and loading guidance. |
| Service Line Financials | Contracted-fee titles and USD units; month/year ticks and expanded date/currency tooltips; record count clearly marked before filtering; empty/loading/retry states; failed refresh identifies retained data as previously loaded. |

Shared `ChartFeedback.js` provides consistent loading, empty, error/recovery, and
formatting behavior. Management navigation descriptions were aligned with the
underlying metrics. No dependencies or backend calculations changed.

## Verification

- `npm run build --prefix frontend`: compiled successfully.
- Initial JavaScript remains **148.39 kB gzip**; Management changes remain deferred.
- `CI=true npm test --prefix frontend -- --watchAll=false --runInBand --runTestsByPath src/components/ManagementChartStates.test.js src/components/ReportingCharts.test.js src/managementDashboard.test.js src/reportingPeriod.test.js src/App.test.js`: **5 suites, 54 tests passed**.
- Coverage includes all five components' loading/error/retry and unmatched-period
  behavior, weighted win rates, no-decisions vs. zero-wins, retained data after
  refresh failure, full currency tooltips, date filters, and navigation.
- `git diff --check`: passed.
- The earlier full-suite run had eight independently reproduced baseline failures
  in DataQualityTable. This task did not modify that component or its tests.

## Visual review handoff

The sample preview serves the actual production build with synthetic fixture
responses and a visible sample-data banner. It never contacts Dynamics. Build,
then start it from the repository root:

```sh
npm run build --prefix frontend
node audit/week3/preview-server.cjs
```

Open `http://127.0.0.1:8765/management/sales-outlook`, or the corresponding paths
`sales-outlook-rfp`, `contract-backlog-selected`, `rfp-overall-success-rate`, and
`service-line-financials`. Append `?state=empty`, `?state=error`, or
`?state=loading` to review status messages.

`python3 audit/week3/capture_screenshots.py` is prepared to save five desktop,
five narrow-screen, and three status images under `screenshots/`. It uses the
installed macOS Google Chrome path; adapt that path on other systems. **No images
were produced or visually approved in this environment**: both cached testing
Chrome and installed Chrome aborted at launch (installed Chrome exit -6), while
the computer-use service reported an unavailable browser access host. The capture
script therefore still needs a successful run on a working browser installation.

Review layout, year labels, chart scrolling, tooltip readability, and recovery
buttons at desktop and narrow widths before visual sign-off.

## Metric approval

[Metric definitions and review questions](metric_definitions.md) document the
actual source fields and calculations. Approval is explicitly pending: a team
member must confirm the populations, date bases, currency assumptions, and missing
value rules. No approval has been inferred from code or tests.
