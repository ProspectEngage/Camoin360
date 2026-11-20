import React, { act } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import PEClients, { filterAndSortClients } from "./PEClients";
import { getCached } from "../apiClient";

window.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("axios");
jest.mock("../apiClient", () => ({ getCached: jest.fn(), invalidateApiCache: jest.fn() }));
jest.mock("../auth", () => ({ API_BASE_URL: "http://localhost", getAuthHeaders: () => ({ Authorization: "Bearer test" }), handleUnauthorized: jest.fn(() => false), getApiErrorMessage: (_error, fallback) => fallback }));
const organization = { id: 1, organization_name: "Example", city: "Boston", state: "MA", user_count: 2, number_of_users: 12, usage_type: "both", contract_expiration: null };
let root, container;
beforeEach(() => {
  jest.clearAllMocks();
  getCached.mockImplementation((url) => Promise.resolve({ data: { data: url.endsWith("/users") ? [] : [organization] } }));
  axios.get.mockResolvedValue({ data: { data: [] } });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = () => act(async () => root.render(<PEClients />));
const click = async (label) => {
  const node = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === label);
  expect(node).toBeTruthy(); await act(async () => node.click());
};
const input = async (label, value) => {
  const node = Array.from(document.querySelectorAll('input')).reverse().find((el) => el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent.startsWith(label));
  expect(node).toBeTruthy(); await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); });
};
const chooseUsage = async (label) => {
  const select = Array.from(document.querySelectorAll('[role="dialog"] [role="combobox"]')).pop();
  await act(async () => select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  const option = Array.from(document.querySelectorAll('[role="option"]')).find((node) => node.textContent === label);
  expect(option).toBeTruthy(); await act(async () => option.click());
};
it('edits usage and user count separately from linked portal accounts', async () => {
  axios.patch.mockResolvedValue({ data: { ...organization, number_of_users: 0, usage_type: 'bre' } });
  await render();
  expect(container.textContent).toContain('Number of Users'); expect(container.textContent).toContain('Portal Accounts'); expect(container.textContent).toContain('Both');
  await click('Edit'); await input('Number of users', '0'); await chooseUsage('BRE'); await click('Save Organization');
  expect(axios.patch.mock.calls[0][1]).toEqual(expect.objectContaining({ number_of_users: 0, usage_type: 'bre' }));
  expect(axios.patch.mock.calls[0][1]).not.toHaveProperty('user_count');
  expect(container.textContent).toContain('BRE');
});
it('creates an organization with user count and clears unknown metadata on edit', async () => {
  axios.post.mockResolvedValue({ data: { ...organization, id: 2, organization_name: 'New Client', number_of_users: 5, usage_type: 'prospecting' } });
  await render(); await click('Add Organization');
  await input('Organization name', 'New Client'); await input('Number of users', '5'); await chooseUsage('Prospecting'); await click('Create Organization');
  expect(axios.post.mock.calls[0][1]).toEqual(expect.objectContaining({ number_of_users: 5, usage_type: 'prospecting' }));
  axios.patch.mockResolvedValue({ data: { ...organization, number_of_users: null, usage_type: null } });
  await click('Edit'); await input('Number of users', ''); await chooseUsage('Not set'); await click('Save Organization');
  expect(axios.patch.mock.calls[0][1]).toEqual(expect.objectContaining({ number_of_users: null, usage_type: null }));
});

const clients = [
  { organization_name: "Zeta Systems", city: "New York", state: "NY", user_count: 2, contract_expiration: null },
  { organization_name: "Alpha Consulting", city: "Boston", state: "MA", user_count: 7, contract_expiration: "2027-06-01" },
  { organization_name: "Blue Group", city: "Albany", state: "NY", user_count: 7, contract_expiration: "2026-11-01" },
];

test("searches client names and locations without changing source order", () => {
  expect(filterAndSortClients(clients, "  ny ", "name_asc").map((client) => client.organization_name))
    .toEqual(["Blue Group", "Zeta Systems"]);
  expect(filterAndSortClients(clients, "Boston", "name_asc").map((client) => client.organization_name))
    .toEqual(["Alpha Consulting"]);
  expect(clients[0].organization_name).toBe("Zeta Systems");
});

test("sorts by user count or earliest contract, putting unset contracts last", () => {
  expect(filterAndSortClients(clients, "", "users_desc").map((client) => client.organization_name))
    .toEqual(["Alpha Consulting", "Blue Group", "Zeta Systems"]);
  expect(filterAndSortClients(clients, "", "expiration_asc").map((client) => client.organization_name))
    .toEqual(["Blue Group", "Alpha Consulting", "Zeta Systems"]);
});

test("opens a client through its explicit View action", async () => {
  getCached.mockImplementation((url) => Promise.resolve({ data: { data: url.endsWith("/users") ? [] : [{ ...clients[0], id: 1 }] } }));

  await act(async () => root.render(<PEClients />));
  expect(getCached).toHaveBeenCalledTimes(1);
  expect(getCached).toHaveBeenCalledWith("http://localhost/organizations", expect.any(Object));
  const viewButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "View");
  expect(viewButton).toBeTruthy();
  await act(async () => viewButton.click());
  expect(getCached).toHaveBeenCalledTimes(2);
  expect(getCached).toHaveBeenCalledWith("http://localhost/users", expect.any(Object));
  expect(container.textContent).toContain("Back to Organizations");
  expect(container.textContent).toContain("Zeta Systems");
  await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Back to Organizations").click());
  await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "View").click());
  expect(getCached).toHaveBeenCalledTimes(2);
  await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Refresh users").click());
  expect(getCached).toHaveBeenCalledWith("http://localhost/users", expect.objectContaining({ force: true }));
  expect(getCached).toHaveBeenCalledTimes(3);
});
