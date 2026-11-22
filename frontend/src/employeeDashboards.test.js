import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ConsultingDashboard from "./consultingDashboard";
import ProspectingDashboard from "./prospectingDashboard";
window.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("./components/ProductivityProjects", () => ({ filters }) => <div data-projects>{filters.year}</div>);
jest.mock("./components/EmployeeProductivity", () => ({ filters }) => <div data-hours>{filters.year}</div>);
jest.mock("./components/SurveyComponent", () => () => <div>Survey records</div>);
jest.mock("./components/PEQualifiedLeads", () => () => <div>Qualified lead records</div>);
jest.mock("./components/MarketingLists", () => () => <div>Marketing lists</div>);
jest.mock("./components/MarketingListConversionAnalysis", () => () => null);
jest.mock("./components/LeadfeederVisits", () => () => null);
jest.mock("./components/PEClients", () => () => null);
jest.mock("./components/DashboardDateFilters", () => ({
  __esModule: true, EMPTY_DATE_FILTERS: { year: "all" },
  default: ({ value, onChange }) => <button onClick={() => onChange({ ...value, year: "2025" })}>Select year</button>,
}));
let root, container;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function click(label) {
  await act(async () => Array.from(container.querySelectorAll("button, a")).find((item) => item.textContent === label).click());
}
test("consulting reports retain independent periods and navigate on mobile", async () => {
  await act(async () => root.render(<ConsultingDashboard />));
  expect(container.querySelector('[data-projects]').textContent).toBe("all");
  await click("Select year");
  await click("Employee Productivity");
  expect(container.querySelector('[data-hours]').textContent).toBe("all");
  await click("Service Lines & Projects");
  expect(container.querySelector('[data-projects]').textContent).toBe("2025");
  await act(async () => container.querySelector('[aria-label="Open navigation"]').click());
  expect(container.querySelector('[aria-label="Close navigation"]').getAttribute('aria-expanded')).toBe("true");
  await click("Client Surveys");
  expect(container.textContent).toContain("Survey records");
  expect(container.querySelector('[aria-label="Open navigation"]')).not.toBeNull();
});
test("prospects loads the real qualified lead panel", async () => {
  await act(async () => root.render(<ProspectingDashboard />));
  await click("Prospects");
  expect(container.textContent).toContain("Qualified lead records");
  expect(container.textContent).not.toContain("Connect the prospecting source");
});
