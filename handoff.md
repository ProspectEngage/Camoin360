# Camoin 360 employee handoff

This guide helps employees move familiar work from Power Apps into Camoin 360. It describes the screens currently present in the app, what each one is for, and which actions change data. Screen names below match the navigation labels. Features and data availability depend on the modules assigned to your account and on connected data sources.

## Get started

1. Sign in with your Camoin 360 account. Use **Open dashboard** on the sign-in page to choose a module assigned to you: **Sophie Maintenance**, **Prospecting**, **Consulting**, **Management**, or **Admin**.
2. Use the left navigation to move between sections *within* a module. The Management navigation has expandable groups. On smaller screens, open its menu to see the sections.
3. To change modules, use the **Dashboard** selector at the bottom of the sidebar. On a smaller screen, open the navigation menu first. It lists the modules assigned to your account and remembers your last choice. A saved `/management/...` link opens Management when you have access to it. If a module is missing, ask a Camoin 360 administrator to check your assigned modules.
4. Check the date or filter controls at the top of a report before comparing its numbers with Power Apps or Dynamics. **Reporting period** applies to charts and totals on that Management page; different pages can have different filters.

Camoin 360 reads many operational records from Dynamics. Some screens also use Seamless, Leadfeeder, Google Analytics/Search Console, QuickBooks, or public economic data. A blank chart or source warning can mean the source has no data for the selected filters or has not connected successfully; it does not by itself mean a record was removed.

## Where to do common work

| If you used Power Apps to… | Open in Camoin 360 | What to do there |
| --- | --- | --- |
| Check account completeness or update account fields through enrichment | Sophie Maintenance → **Data Quality** | Search and filter accounts, inspect missing fields, select accounts and fields, review the confirmation, then run enrichment. |
| Review likely duplicate Dynamics accounts | Sophie Maintenance → **Duplicate Accounts** | Filter possible pairs and compare records before taking any deletion action. |
| See account counts by sector | Sophie Maintenance → **Summary Analytics** | Review the sector cards, chart, and count table. |
| Check enrichment usage and run history | Sophie Maintenance → **Seamless** | Review credits, throughput, alerts, audit history, and the next batch; run enrichment when appropriate. |
| Find or maintain Dynamics marketing lists | Prospecting → **Marketing** | Search lists, narrow by creation date, inspect members, and use available list actions. |
| Review website visitor companies | Prospecting → **Leadfeeder Visits** | Filter companies, inspect details and notes, and mark review status. |
| Maintain ProspectEngage client organizations or users | Prospecting → **PE Clients** | Find organizations, inspect contracts and linked users, and use the add/edit controls. |
| Review sales, fees, marketing, projects, or surveys | **Management** | Open the matching report in the groups below and set its reporting period. |
| Track software and data subscriptions | Management → **Software Inventory** | Search, filter, export, add, edit, or delete service records. |
| Grant Camoin 360 access | Admin → **Users** | Create users and assign their modules; update or remove accounts as needed. |

## Sophie Maintenance

Use this module for Dynamics account quality and the Seamless enrichment workflow.

| Tab | Purpose and main controls |
| --- | --- |
| **Seamless** | Operations home for enrichment. Shows weekly credits used and remaining, total credits, account processing and update counts, usage trends, alerts, pipeline categories, and run history. **Preview Next Batch** shows upcoming work; **Run Enrichment** starts an update workflow. Audit tables can be exported to CSV. |
| **Data Quality** | Search Dynamics accounts and review fields such as account name, location, sector, description, and website. Filters, column search/sort, quality indicators, and account previews help find records needing attention. Select accounts and the fields to update, then review the confirmation before running enrichment. This can change Dynamics records. |
| **Duplicate Accounts** | Shows possible duplicate account pairs with confidence and location/sector filters. Compare record completeness, mark or review pairs, and decide which record should remain. The delete flow permanently removes the chosen Dynamics account, so verify the pair and record details first. |
| **Summary Analytics** | Read-only overview of Dynamics account totals by sector. Cards, a bar chart, and a count table help answer how the account base is distributed. |

## Prospecting

Use this module for marketing audiences, visitor review, and ProspectEngage client administration.

| Tab | Purpose and main controls |
| --- | --- |
| **Marketing** | Browse Dynamics marketing lists. Search by list, filter by creation dates, inspect the accounts and contacts in a list, and use the list actions shown on each row. Deleting a list is a data-changing action with a confirmation step. |
| **Conversion Analysis** | Compare how marketing lists convert companies to prospects. It shows conversion rate, companies per prospect, year comparisons, PE versus other lead generation, and client rollups. Review the displayed classification and exclusion rules when interpreting results. |
| **Prospects** | Review qualified ProspectEngage leads from Dynamics. Search, filter by client, status, and date, refresh, and export the visible records. |
| **Leadfeeder Visits** | Groups website visits by company. Use the summary cards and filters to find high-intent or incomplete visitor records. Open a company to review visits, notes, and status; mark it **Reviewed**, **Follow-Up Needed**, or **Ignored**. **Create Prospect**, **Match Existing Account**, and **Send to AI Prospecting** are currently disabled future actions. |
| **PE Clients** | Maintains ProspectEngage client organizations, contract expiration dates, and linked users. Search and sort organizations; view details; add or edit organizations; manage user records and passwords; refresh and export the organization list. The **Revenue tracking** tab records effective-dated subscription changes and actual payments received, with MRR, ARR, and period reports. These controls can change stored records. |

## Management

Management brings reporting and selected operational tools together. Start with **Overview** for shortcuts to Marketing and Software Inventory. Its main summary data area currently says that its reporting source is not available, so use the individual sections for working reports.

Most chart pages have a **Reporting period** control for all dates, a year/quarter/month, or a custom date range. Use **Clear period** to reset that page. Each Management page also has an **AI Analyst** question box that receives the current page name, description, and selected period as context. Treat its responses as assistance for reading a report and verify important figures in the charts or source records.

### Financials & Economy

| Tab | Purpose and how to use it |
| --- | --- |
| **Economic Indicators** | Read external economic context: consumer sentiment, GDP growth, Treasury yields, and the U.S. house price index. Use it to put Camoin activity alongside broader conditions; it is not a Dynamics account list. |
| **Company Financials** | Review QuickBooks financial trends such as monthly sales, net income, cash/current ratio, owner equity, and debt measures. Refresh the source when needed. The analysis dialog summarizes the visible reporting period; source access depends on the QuickBooks connection. |
| **Service Line Financials** | Compare monthly **Fee for Camoin** on contracted projects by primary service line. Refresh, filter the period, and open the analysis dialog for summaries and illustrative projections. These are contracted fees, not invoiced or recognized revenue. |

### Sales & Prospects

| Tab | Purpose and how to use it |
| --- | --- |
| **Sales Outlook** | See annual contracted Camoin fees and monthly counts of projects created in Dynamics. Search the project detail records when investigating a trend. |
| **Sales Outlook - RFP** | Review annual proposal value, monthly won RFP fees and counts, and won non-bid fees. Proposal dates and actual close dates drive different charts, so compare like periods. The trend line on annual proposals is fitted history, not a forecast. |
| **Contract Backlog** | Compare monthly **Total Project Fee** and **Fee for Camoin** by contract date. Use the reporting period to narrow the displayed contract values. |
| **RFP Overall Success Rate** | Review quarterly win rates by value and by count, with a service-line selector. The value rate weights larger proposals more heavily; the count rate weights each decided proposal equally. |
| **ProspectEngage Leads** | Track qualified leads sent to PE clients. Search, filter by client, sort, review lead status and dates, refresh, and export the visible leads. |
| **PE Clients** | Review and change subscription prices and status, record received payments, and compare recurring revenue with actual cash received. Select a year or month for historical figures. Client organizations and users remain in Prospecting → PE Clients. |

### Marketing

| Tab | Purpose and how to use it |
| --- | --- |
| **Marketing Overview** | Review website visitor trends and target-industry engagement. Choose the traffic window and refresh the connected marketing source when needed. |
| **Service Line Marketing** | Examine marketing performance by service line, including traffic and SEO measures such as clicks, impressions, average search position, and click-through rate. Use its service-line and source controls to investigate a campaign. |
| **Marketing Source** | Break down Google Analytics website visits by source, service line, and month. Use the three filters to see which channels drive traffic to each service line. This page also has its own refresh control. |

### Operations

| Tab | Purpose and how to use it |
| --- | --- |
| **Service Lines & Projects** | Review new project counts, contract and proposal amounts, and project trends from Dynamics. Use it for operational volume and timing, rather than individual account editing. |
| **Employee Productivity** | Review workload and billed activity by employee. Filter to an employee and billing category, then compare the charts for the selected period. |
| **Client Surveys** | Search completed Dynamics project surveys and filter by project manager, principal, primary service line, year, or survey date. The chart and table support follow-up on client feedback; this screen is for review. |
| **Software Inventory** | Find software and data subscriptions by search and status, sort the list, and export it. **Add Service**, **Edit**, and **Delete** change the inventory; the edit form includes ownership, vendor, renewal, access, cost, and notes fields. Check the record before saving or deleting. |

## Consulting

Consulting includes **Service Lines & Projects** (Dynamics projects, proposals, and contracted fees), **Employee Productivity** (Harvest hours and billable activity), and **Client Surveys** (completed Dynamics project surveys). Projects and productivity each retain their own reporting period while switching tabs. Surveys have their own record filters.

## Admin

**Users** is the current Admin screen. Administrators can create Camoin 360 accounts, assign access to the five modules, update user details and module access, reset passwords, and delete eligible accounts. Employees who cannot see a module should ask an administrator to review the checkboxes on their user record. Admin access controls which Camoin 360 screens appear; it does not change the underlying Dynamics data by itself.

## Before making a data change

- **Read-only reports:** Most Management charts, Summary Analytics, and Conversion Analysis are for review. **Refresh** reloads source data; it does not edit a Dynamics record.
- **Actions that change records:** Enrichment runs, duplicate deletion, marketing-list deletion, PE client/user edits, software inventory edits, and Admin user changes are operational actions. Read the screen's preview or confirmation and verify the target before submitting.
- **If numbers differ from Power Apps:** Match the date range, filters, source system, and metric definition first. For example, contracted fees, proposal value, won fees, and QuickBooks sales answer different questions.
- **If a screen is empty or unavailable:** Clear filters, check the source status or refresh option, and confirm that your account has the right module. The Management **Overview** summary is not a complete working report yet.
