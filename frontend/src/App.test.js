import React, { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { clearAuthToken, getAuthToken, getAllowedDashboardViews, getPreferredAllowedDashboardView, savePreferredDashboardView } from "./auth";

window.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("./auth", () => ({
  clearAuthToken: jest.fn(),
  getAllowedDashboardViews: jest.fn(() => [{ value: "management" }]),
  getAuthToken: jest.fn(() => "test-token"),
  getCurrentUser: () => ({ role: "admin" }),
  getDefaultDashboardView: () => "management",
  getPreferredAllowedDashboardView: jest.fn(() => "management"),
  loginUser: jest.fn(),
  onUnauthorized: () => () => {},
  savePreferredDashboardView: jest.fn(),
}));
jest.mock("./managementDashboard", () => ({ onLogout, moduleSwitcher }) => <>{moduleSwitcher?.(false)}<button onClick={onLogout}>Management dashboard loaded</button></>);
jest.mock("./adminDashboard", () => () => <div>Admin dashboard loaded</div>);
jest.mock("./consultingDashboard", () => () => <div>Consulting dashboard loaded</div>);
jest.mock("./prospectingDashboard", () => () => <div>Prospecting dashboard loaded</div>);
jest.mock("./landingPage", () => () => <div>Landing page loaded</div>);
jest.mock("./QuickBooksSettings", () => () => <div>QuickBooks settings loaded</div>);
jest.mock("./login", () => () => <div>Login page</div>);
jest.mock("./legalPages", () => ({ type }) => <div>Legal {type}</div>);

beforeEach(() => {
  jest.clearAllMocks();
  getAuthToken.mockReturnValue("test-token");
  getAllowedDashboardViews.mockReturnValue([{ value: "management" }]);
  getPreferredAllowedDashboardView.mockReturnValue("management");
});

test("shows a loading indicator until the selected dashboard is ready", async () => {
  window.history.replaceState({}, "", "/management");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    act(() => root.render(<App />));
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading dashboard");

    await act(async () => {});
    expect(container.textContent).toContain("Management dashboard loaded");
    expect(container.querySelector('[role="status"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState({}, "", "/");
  }
});

test.each([
  ["admin", "/", "Admin dashboard loaded"],
  ["consulting", "/", "Consulting dashboard loaded"],
  ["prospecting", "/", "Prospecting dashboard loaded"],
  ["landing", "/", "Landing page loaded"],
  ["management", "/settings/integrations/quickbooks", "QuickBooks settings loaded"],
  ["admin", "/management", "Management dashboard loaded"],
  ["management", "/terms", "Legal terms"],
  ["management", "/privacy", "Legal privacy"],
  ["disallowed", "/", "Management dashboard loaded"],
])("preserves view selection for %s at %s", async (view, path, expected) => {
  getAllowedDashboardViews.mockReturnValue([
    { value: "admin" }, { value: "management" }, { value: "consulting" },
    { value: "prospecting" }, { value: "landing" },
  ]);
  getPreferredAllowedDashboardView.mockReturnValue(view);
  window.history.replaceState({}, "", path);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain(expected);
  } finally {
    await act(async () => root.unmount());
    window.history.replaceState({}, "", "/");
  }
});

test("a lazy-loaded dashboard can log out and return to login", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<App />));
    await act(async () => container.querySelector("button").click());
    expect(clearAuthToken).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("Login page");
  } finally {
    await act(async () => root.unmount());
  }
});

test("switches from Management to another permitted dashboard without signing out", async () => {
  getAllowedDashboardViews.mockReturnValue([
    { value: "management", label: "Management" },
    { value: "prospecting", label: "Prospecting" },
  ]);
  window.history.replaceState({}, "", "/management/pe-clients");
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<App />));
    const selector = container.querySelector('[role="combobox"]');
    expect(selector.textContent).toContain("Management");
    await act(async () => {
      selector.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(Array.from(document.querySelectorAll('[role="option"]'), (option) => option.textContent)).toEqual(["Management", "Prospecting"]);
    await act(async () => document.querySelector('[role="option"][data-value="prospecting"]').click());
    expect(container.textContent).toContain("Prospecting dashboard loaded");
    expect(window.location.pathname).toBe("/");
    expect(savePreferredDashboardView).toHaveBeenCalledWith("prospecting");
    expect(clearAuthToken).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    window.history.replaceState({}, "", "/");
  }
});

test("unauthenticated visitors see login", async () => {
  getAuthToken.mockReturnValue(null);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<App />));
    expect(container.textContent).toBe("Login page");
    expect(container.querySelector('[role="status"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});
