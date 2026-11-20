import React, { act } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import PEClients from "./PEClients";
import { getCached } from "../apiClient";

window.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("axios");
jest.mock("../apiClient", () => ({ getCached: jest.fn(), invalidateApiCache: jest.fn() }));
jest.mock("../auth", () => ({ API_BASE_URL: "http://localhost", getAuthHeaders: () => ({ Authorization: "Bearer test" }), handleUnauthorized: jest.fn(() => false), getApiErrorMessage: (_error, fallback) => fallback }));
const organization = { id: 1, organization_name: "Example", city: "Boston", state: "MA", user_count: 2, number_of_users: 12, usage_type: "both", contract_expiration: null };
let root, container;
beforeEach(() => {
  jest.clearAllMocks();
  getCached.mockResolvedValue({ data: { data: [organization] } });
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
  await render(); await click('Actions');
  const add = Array.from(document.querySelectorAll('[role="menuitem"]')).find((node) => node.textContent === 'Add Organization');
  await act(async () => add.click());
  await input('Organization name', 'New Client'); await input('Number of users', '5'); await chooseUsage('Prospecting'); await click('Create Organization');
  expect(axios.post.mock.calls[0][1]).toEqual(expect.objectContaining({ number_of_users: 5, usage_type: 'prospecting' }));
  axios.patch.mockResolvedValue({ data: { ...organization, number_of_users: null, usage_type: null } });
  await click('Edit'); await input('Number of users', ''); await chooseUsage('Not set'); await click('Save Organization');
  expect(axios.patch.mock.calls[0][1]).toEqual(expect.objectContaining({ number_of_users: null, usage_type: null }));
});
