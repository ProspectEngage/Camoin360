# Management metric definitions — team review required

Status: **Draft derived from implementation; not team-approved.**
No team approval or external message has been sent. Calculations are unchanged,
except undefined aggregate win rates now display “Not available” rather than 0%.

| Component | Definition represented by the code | Date basis and units | Team confirmation needed |
| --- | --- | --- | --- |
| Sales Outlook | Annual sum of `new_feeforcamoin` on projects; monthly count of project records. Project details use the same creation-date population as the monthly count. | Annual fees: `new_contractdate`, since 2020. Monthly counts: `createdon`, since 2021. USD and number of projects. | Confirm that created projects are the intended volume metric. The previous “completed” label was unsupported. Confirm USD assumption. |
| RFP Sales Outlook | Annual proposal fees sum `new_feeforcamoin` for records with `cr73c_dateproposed`. Monthly won RFP fees/counts use won opportunities with a Date Proposed. Won opportunities without that date are classified as non-bid. | Proposals: Date Proposed, since 2016. Wins: `actualclosedate`, since 2020. USD and number of wins. | Approve Date Proposed as the RFP/non-bid classifier and Actual Close Date as the won/signed date. Confirm USD assumption. |
| Contract Backlog view | Monthly sums of `cr73c_totalprojectfee` and `new_feeforcamoin` on projects. Neither field is reduced by work delivered, invoices, or revenue recognized. | `new_contractdate`, since 2022; USD. | Confirm these fee totals are desired. True remaining backlog or recognized revenue requires a separate metric; current chart labels now name the actual fields. Confirm USD assumption. |
| RFP Success Rate | Count rate = won / (won + lost). Value rate = won fees / (won + lost fees). Open records are excluded from both denominators. Missing fees are excluded only from value calculations. Overall rates use summed numerators and denominators, not an average of quarterly percentages. | Quarter of Date Proposed, since 2016; percent, displayed to one decimal. Service-line filter uses the formatted primary service-line label. | Approve proposal-cohort quarters rather than close-date quarters. Approve open/missing-fee treatment. Zero denominator displays “Not available”; zero wins with a positive denominator displays 0.0%. |
| Service Line Financials | Sum of `new_feeforcamoin` by the mapped primary service-line group. Missing fees contribute zero; missing/unmapped service lines or invalid dates are excluded. Source record count is before dashboard date filters. | `new_contractdate`, since 2021; USD. | Approve mapping groups, missing-fee handling, and currency assumption. Contracted fees are not invoiced or recognized revenue. |

Source of truth inspected: `backend/app/services/dynamics.py`, functions
`get_sales_outlook_metrics`, `get_sales_outlook_rfp_metrics`,
`get_contract_backlog_metrics`, `get_rfp_success_rate_metrics`, and
`get_service_line_financial_metrics`.

Date filters retain aggregates whose source period overlaps the selection. They
do not prorate annual, quarterly, or monthly totals to selected days. Annual
proposal/contract charts and quarterly win-rate charts now explain this scope.

RFP trend line: least-squares fit across the displayed annual proposal rows,
clamped to zero. It is labeled a fitted trend, not a forecast.

## Approval record

- Metric owner/reviewer: **pending**
- Decision and requested changes: **pending**
- Approval date: **pending**

Reviewers should confirm each row's population, date basis, currency, and missing
value treatment before signing off. Screenshots use synthetic fixtures and do
not validate production data quality.
