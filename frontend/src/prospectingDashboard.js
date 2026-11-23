import DashboardShell from "./components/DashboardShell";
import { useState } from "react";
import { Stack } from "@mui/material";

import LeadfeederVisits from "./components/LeadfeederVisits";
import MarketingListConversionAnalysis from "./components/MarketingListConversionAnalysis";
import MarketingLists from "./components/MarketingLists";
import PEClients from "./components/PEClients";
import PEQualifiedLeads from "./components/PEQualifiedLeads";
import { API_BASE_URL, getAuthHeaders } from "./auth";
import { prefetch } from "./apiClient";

const tabs = {
  marketing: {
    label: "Marketing",
    icon: "campaign",
    title: "Marketing",
    description: "Dynamics marketing lists and campaign audiences.",
  },
  marketingConversion: {
    label: "Conversion Analysis",
    icon: "campaign",
    title: "Marketing-List Conversion",
    description:
      "Prospect conversion rates for account marketing lists, rolled up by lead-generation channel and client.",
    parent: "marketing",
  },
  prospects: {
    label: "Prospects",
    icon: "prospects",
    title: "Prospects",
    description: "Qualified ProspectEngage leads from Dynamics, with client, status, date filters, and export.",
  },
  leadfeeder: {
    label: "Leadfeeder Visits",
    icon: "leadfeeder",
    title: "Leadfeeder Visits",
    description: "Website visitor intent records queued for qualification and review.",
  },
  peClients: {
    label: "PE Clients",
    icon: "clients",
    title: "PE Clients",
    description: "ProspectEngage client organizations, users, contract dates, subscriptions, and received payments.",
    parent: "leadfeeder",
  },
};


const prefetchUrls = {
  marketing: `${API_BASE_URL}/marketing-lists`,
  marketingConversion: `${API_BASE_URL}/marketing-lists/conversion-analysis/summary`,
  leadfeeder: `${API_BASE_URL}/leadfeeder-visits`,
};


export default function ProspectingDashboard({ onLogout, moduleSwitcher }) {
  const [activeTab, setActiveTab] = useState("marketing");

  function prefetchTab(tabKey) {
    const url = prefetchUrls[tabKey];
    if (url) {
      prefetch(url, {
        headers: getAuthHeaders(),
        params: tabKey === "marketing" ? { limit: 500 } : undefined,
        ttl: 5 * 60 * 1000,
      });
    }
  }

  return (
    <DashboardShell module="prospecting" label="Prospecting" views={tabs} activeView={activeTab} onNavigate={setActiveTab} onLogout={onLogout} onPrefetch={prefetchTab} moduleSwitcher={moduleSwitcher}>
      <Stack spacing={3}>


              {activeTab === "marketing" && <MarketingLists />}
              {activeTab === "marketingConversion" && <MarketingListConversionAnalysis />}
              {activeTab === "prospects" && <PEQualifiedLeads />}
              {activeTab === "leadfeeder" && <LeadfeederVisits />}
              {activeTab === "peClients" && <PEClients />}
            </Stack>
    </DashboardShell>
  );
}
