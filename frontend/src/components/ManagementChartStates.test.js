import React, { act } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import SalesOutlook from "./SalesOutlook";
import SalesOutlookRfp from "./SalesOutlookRfp";
import ContractBacklogSelected from "./ContractBacklogSelected";
import RfpOverallSuccessRate from "./RfpOverallSuccessRate";
import ServiceLineFinancials from "./ServiceLineFinancials";

window.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("axios");
jest.mock("../auth", () => ({
  API_BASE_URL: "http://localhost", getAuthHeaders: () => ({}),
  handleUnauthorized: () => false, getApiErrorMessage: (_error, fallback) => fallback,
}));
jest.mock("recharts", () => {
  const Chart = ({ data, children }) => <div data-chart={JSON.stringify(data)}>{children}</div>;
  return {
    ResponsiveContainer: ({ children }) => children, LineChart: Chart, BarChart: Chart,
    CartesianGrid: () => null, Legend: () => null, Line: () => null, Bar: () => null,
    XAxis: () => null, YAxis: () => null,
    Tooltip: ({ labelFormatter, formatter }) => <div data-tooltip>
      {labelFormatter?.("2025-04")}{JSON.stringify(formatter?.(1234567.89, "Fee for Camoin"))}
    </div>,
  };
});
const row = { year: "2025", month_key: "2025-04", monthKey: "2025-04", amount: 100, projects: 2,
  total_project_fee: 100, fee_for_camoin: 80, consulting: 80 };
const cases = [
  [SalesOutlook, { annual_contracts: [row], monthly_projects: [row], project_details: [] }, "Projects created per month (count)"],
  [SalesOutlookRfp, { annual_proposals: [row], monthly_contracts: [row] }, "Annual proposal value (USD)"],
  [ContractBacklogSelected, { monthly_totals: [row] }, "Monthly contracted project fees (USD)"],
  [RfpOverallSuccessRate, { series: [{ year: "2025", quarter: "2", period: "2025 Q2", won: 1, lost: 1, won_fee: 25, decided_fee: 100 }] }, "RFP win rate by count"],
  [ServiceLineFinancials, { months: [row], service_lines: [{ key: "consulting", label: "Consulting" }], record_counts: {} }, "Consulting — contracted fees (USD)"],
];
let container, root;
beforeEach(() => {
  axios.get.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test.each(cases)("%p announces loading, explains a failure, and retries successfully", async (Component, data, title) => {
  let rejectRequest;
  axios.get.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
  await act(async () => root.render(<Component />));
  expect(container.querySelector('[role="status"]').textContent).toContain("Loading");
  expect(container.querySelector("[data-chart]")).toBeNull();
  await act(async () => rejectRequest(new Error("Offline")));
  expect(container.textContent).toContain("ask your administrator to check the Dynamics connection");
  expect(container.querySelector("[data-chart]")).toBeNull();
  axios.get.mockResolvedValue({ data });
  const retry = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Try again");
  await act(async () => retry.click());
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain(title);
  expect(container.textContent).not.toContain("Unable to load");
  expect(container.querySelector('[role="status"]')).toBeNull();
});

test.each(cases)("%p explains unmatched date selections without an empty chart", async (Component, data) => {
  axios.get.mockResolvedValue({ data });
  await act(async () => root.render(<Component filters={{ year: "2030" }} />));
  expect(container.textContent).toContain("Widen or clear the date filters");
  expect(container.querySelector("[data-chart]")).toBeNull();
});

test("win rates distinguish no decisions from zero wins and weight totals by denominators", async () => {
  axios.get.mockResolvedValue({ data: { series: [
    { year: "2025", period: "2025 Q1", quarter: "1", won: 0, lost: 0, open: 8, won_fee: 0, decided_fee: 0 },
    { year: "2025", period: "2025 Q2", quarter: "2", won: 0, lost: 2, won_fee: 0, decided_fee: 100 },
    { year: "2025", period: "2025 Q3", quarter: "3", won: 6, lost: 2, won_fee: 600, decided_fee: 900 },
  ] } });
  await act(async () => root.render(<RfpOverallSuccessRate filters={{ quarter: "1" }} />));
  expect(container.textContent.match(/Not available/g)).toHaveLength(2);
  await act(async () => root.render(<RfpOverallSuccessRate filters={{ quarter: "2" }} />));
  expect(container.textContent.match(/0\.0%/g)).toHaveLength(2);
  await act(async () => root.render(<RfpOverallSuccessRate />));
  expect(container.textContent.match(/60\.0%/g)).toHaveLength(2);
});

test("service-line refresh failures identify retained data and allow recovery", async () => {
  axios.get.mockResolvedValue({ data: cases[4][1] });
  await act(async () => root.render(<ServiceLineFinancials />));
  axios.get.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Refresh").click());
  expect(container.textContent).toContain("Previously loaded data is shown below");
  expect(container.querySelector("[data-chart]")).not.toBeNull();
  await act(async () => Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Try again").click());
  expect(container.textContent).not.toContain("Previously loaded data");
});

test("RFP fee tooltips show the full currency amount and month/year", async () => {
  axios.get.mockResolvedValue({ data: cases[1][1] });
  await act(async () => root.render(<SalesOutlookRfp />));
  const tooltips = Array.from(container.querySelectorAll("[data-tooltip]"));
  expect(tooltips.some((node) => node.textContent.includes("April 2025") && node.textContent.includes("$1,234,567.89"))).toBe(true);
});
