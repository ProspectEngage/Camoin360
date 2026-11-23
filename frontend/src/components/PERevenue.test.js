import React, { act } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import PERevenue from "./PERevenue";

jest.mock("axios");
jest.mock("../auth", () => ({
  API_BASE_URL: "http://localhost:8000",
  getApiErrorMessage: () => "Request failed",
  getAuthHeaders: () => ({ Authorization: "Bearer test" }),
  handleUnauthorized: () => false,
}));

window.IS_REACT_ACT_ENVIRONMENT = true;

test("shows recurring and received revenue separately with subscription history", async () => {
  axios.get.mockResolvedValue({ data: {
    as_of: "2026-11-22", mrr: 100, arr: 1200, active_paying_clients: 1, receipts: 25,
    clients: [{ organization_id: 1, organization_name: "Example Client", monthly_equivalent: 100,
      annual_equivalent: 1200, subscription: { plan_name: "Standard", amount_cents: 120000, billing_frequency: "annual", status: "active" } }],
    payments: [{ id: 7, organization_id: 1, amount_cents: 2500, received_on: "2026-11-10", period_start: "2026-11-01", period_end: "2026-11-30", reference: "Check 7" }],
    subscription_history: [{ id: 3, organization_id: 1, plan_name: "Standard", amount_cents: 120000,
      billing_frequency: "annual", status: "active", effective_from: "2026-01-01", effective_to: null }],
    monthly_breakdown: [{ month: "2026-11", mrr: 100, arr: 1200, active_paying_clients: 1, receipts: 25 }],
  } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PERevenue />));
    expect(axios.get).toHaveBeenCalledWith("http://localhost:8000/pe-revenue", expect.objectContaining({ headers: { Authorization: "Bearer test" } }));
    expect(container.textContent).toContain("$100.00");
    expect(container.textContent).toContain("$1,200.00");
    expect(container.textContent).toContain("$25.00");
    expect(container.textContent).toContain("Standard");
    await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Payments").click());
    expect(container.textContent).toContain("Check 7");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
