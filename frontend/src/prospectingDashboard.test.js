import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ProspectingDashboard from "./prospectingDashboard";
import { prefetch } from "./apiClient";

window.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("./components/MarketingLists", () => () => <div>Marketing panel</div>);
jest.mock("./components/MarketingListConversionAnalysis", () => () => <div>Conversion panel</div>);
jest.mock("./components/PEClients", () => () => <div>PE clients panel</div>);
jest.mock("./apiClient", () => ({ prefetch: jest.fn() }));
jest.mock("./auth", () => ({ API_BASE_URL: "http://localhost", getAuthHeaders: () => ({ Authorization: "Bearer test" }) }));
let root, container;
beforeEach(() => {
  jest.clearAllMocks();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it('keeps Marketing, Conversion Analysis and PE Clients accessible without retired tabs', async () => {
  await act(async () => root.render(<ProspectingDashboard />));
  const nav = container.querySelector('nav');
  expect(Array.from(nav.querySelectorAll('button')).map((node) => node.textContent)).toEqual(['Marketing', 'Conversion Analysis', 'PE Clients']);
  for (const button of nav.querySelectorAll('button')) {
    await act(async () => button.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
  }
  expect(prefetch.mock.calls.map(([url]) => url)).toEqual(['http://localhost/marketing-lists', 'http://localhost/marketing-lists/conversion-analysis/summary']);
  expect(container.textContent).toContain('Marketing panel');
  for (const [label, panel] of [['Conversion Analysis', 'Conversion panel'], ['PE Clients', 'PE clients panel']]) {
    const button = Array.from(nav.querySelectorAll('button')).find((node) => node.textContent === label);
    await act(async () => button.click());
    expect(container.querySelector('main').textContent).toContain(panel);
  }
  expect(prefetch.mock.calls.every(([url]) => !url.includes('leadfeeder'))).toBe(true);
});
