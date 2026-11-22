# Week 1 assessment summary

**Date:** October 15, 2026  
**Scope:** Management dashboard (Overview, reporting, PE qualified leads) and Prospecting > PE Clients.  
**Evidence:** Source inspection and three local HTTP/API timing runs. Browser screenshots, network traces, and page-render timings were unavailable.

## Top 10 highest-priority issues

| Rank | Priority | Issue and impact | Recommended action |
| --- | --- | --- | --- |
| 1 | P1 | The shared **Reporting period** control appears on 12 Management chart views, but only RFP Overall Success Rate receives it. That view uses year and quarter; month and date range are ignored. On the other 11 views, including PE, changing the control does not change the charts. | Connect each visible filter to the active view or remove controls that do not apply; show the period actually used. |
| 2 | P1 | PE **All Time** rolls up at most 1,000 prospects without a truncation warning, so counts may be incomplete. | Aggregate all pages on the server or clearly label a limited sample. |
| 3 | P1 | **AI Analyst** says it uses data loaded in the tab, but requests do not include that data. Answers may appear better grounded than they are. | Send a validated data summary or accurately describe the data available to the analyst. |
| 4 | P1 | **PE** means qualified leads in Management but client organizations and portal users in Prospecting; PE Clients is nested under Leadfeeder Visits. | Use distinct names and organize the pages by workflow. |
| 5 | P1 | Management opens on an **unavailable Overview**; Refresh reloads the same empty view. | Make Overview useful or open a working view, and replace the ineffective action. |
| 6 | P2 | Revisiting PE qualified leads triggers another uncached Dynamics request, with no refresh or freshness indicator. | Cache and deduplicate requests by filter; provide an explicit refresh action. |
| 7 | P2 | PE Clients loads both organizations and all users on entry, although the list does not show user details. | Load users when an organization is opened. |
| 8 | P2 | PE chart labels are truncated and crowded; there is no search, export, list, or lead-level drilldown. | Add a sortable client list and drilldown with full labels. |
| 9 | P2 | PE Clients tables have 1,130 px and 970 px minimum widths, causing horizontal scrolling on smaller screens; the organization list lacks search and sort. | Improve narrow-screen actions and add search, sort, and scalable pagination. |
| 10 | P2 | All dashboards are statically bundled into one **1,342,339-byte JavaScript file** (374.31 kB gzip), though its browser impact is unmeasured. | Split dashboard code and compare browser load and interaction times. |

Source locations for these findings are in `managementDashboard.js`, `DashboardDateFilters.js`, `PEQualifiedLeads.js`, `AiChatBox.js`, `PEClients.js`, `App.js`, and the related API routes. Request counts and layout effects are inferred from source, not confirmed in a browser.

## Other friction

- The login selector lists **Consulting** twice. Switching between Management and Prospecting requires signing out.
- Some charts have their own separate filters, which makes the ineffective shared Reporting period control more confusing.

## Local timing summary

The same compiled frontend and backend were used for three sequential localhost runs after a warmup. The frontend was served from `frontend/build`; FastAPI `TestClient` measured route and service work without network transport. These are HTTP/API times, **not page load or render times**.

| Request | Run 1 | Run 2 | Run 3 | Result |
| --- | ---: | ---: | ---: | --- |
| Frontend `/` | 0.57 ms | 0.62 ms | 0.57 ms | 200; 460 B |
| Frontend JavaScript | 1.79 ms | 0.88 ms | 0.87 ms | 200; 1,342,339 B |
| API `/organizations` | 12.28 ms | 1.37 ms | 1.34 ms | 200; empty local data |
| API `/users` | 1.52 ms | 0.96 ms | 0.95 ms | 200; empty local data |
| API `/pe-qualified-leads` | 22.21 ms | 5.25 ms | 5.05 ms | 502; no PE data |

The PE request failed because the environment could not resolve `login.microsoftonline.com` for a Dynamics token. Credentials in `backend/.env` could not be validated. The empty organization and user responses do not indicate performance at production scale. Raw results and the script are in [`timings.json`](timings.json) and [`measure_week1.py`](measure_week1.py).

## Remaining browser evidence

No screenshots or browser network traces were captured because the computer-use service had no available browser or native app. To verify the assessment, capture:

1. Management Overview showing the unavailable panel and Refresh action.
2. Any Management chart view other than RFP Overall Success Rate before and after changing the shared Reporting period. Show that the selected filter changes while the chart stays the same; PE also has an unchanged period label.
3. A PE chart with more than 18 clients, including a tooltip for a truncated name.
4. PE Clients at desktop (1280 × 800) and mobile (390 × 844) widths, showing table overflow.
5. Network traces for first entry and re-entry to both PE views to confirm request counts.

Use three fresh-profile browser runs with a working Dynamics connection and representative data. Record first and largest contentful paint, chart/list ready time, transferred bytes, and endpoint request counts for Management Overview, Management PE, and PE Clients.
