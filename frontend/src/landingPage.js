import DashboardShell from "./components/DashboardShell";
import { useEffect, useState } from "react";
import { Stack } from "@mui/material";

import DataQualityTable from "./components/DataQualityTable";
import DuplicateAccounts from "./components/DuplicateAccounts";
import MetricsDashboard from "./components/MetricsDashboard";
import SummaryAnalytics from "./components/SummaryAnalytics";
import { API_BASE_URL, getAuthHeaders } from "./auth";
import { prefetch } from "./apiClient";

const views = {
  seamless: {
    label: "Seamless",
    icon: "sync",
    route: "/dashboard",
    title: "Sophie Maintenance",
    description:
      "Live view of weekly Seamless credit consumption and enrichment throughput across the Dynamics pipeline.",
  },
  dataQuality: {
    label: "Data Quality",
    icon: "checklist",
    route: "/dashboard/data-quality",
    title: "Data Quality",
    description:
      "Review Dynamics account fields used for enrichment quality: name, state or province, sector, description, and website.",
  },
  duplicateAccounts: {
    label: "Duplicate Accounts",
    icon: "duplicate",
    route: "/dashboard/duplicate-accounts",
    title: "Duplicate Accounts",
    description: "Find and review possible duplicate Dynamics account records before enrichment updates.",
  },
  summaryAnalytics: {
    label: "Summary Analytics",
    icon: "chart",
    route: "/dashboard/summary-analytics",
    title: "Summary Analytics",
    description: "See how many Dynamics accounts belong to each sector with cards, a bar chart, and a count table.",
  }
};


const prefetchUrls = {
  seamless: `${API_BASE_URL}/metrics`,
  dataQuality: `${API_BASE_URL}/accounts/data-quality`,
  duplicateAccounts: `${API_BASE_URL}/accounts/duplicates`,
  summaryAnalytics: `${API_BASE_URL}/accounts/summary-analytics`,
};


function getViewForPath(pathname) {
  const matchingView = Object.entries(views).find(([_viewKey, view]) => view.route === pathname);

  return matchingView?.[0] || "seamless";
}

export default function LandingPage({ onLogout, moduleSwitcher }) {
  const [activeView, setActiveView] = useState(() => getViewForPath(window.location.pathname));

  function navigateToView(viewKey) {
    setActiveView(viewKey);

    const nextRoute = views[viewKey].route;
    if (window.location.pathname !== nextRoute) {
      window.history.pushState({}, "", nextRoute);
    }
  }

  function prefetchView(viewKey) {
    prefetch(prefetchUrls[viewKey], {
      headers: getAuthHeaders(),
      params: viewKey === "dataQuality" ? { limit: 100000 } : undefined,
      timeout: viewKey === "dataQuality" ? 5 * 60 * 1000 : undefined,
      ttl: viewKey === "summaryAnalytics" ? 10 * 60 * 1000 : 5 * 60 * 1000,
    });
  }

  useEffect(() => {
    function handlePopState() {
      setActiveView(getViewForPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <DashboardShell module="maintenance" label="Sophie Maintenance" views={views} activeView={activeView} onNavigate={navigateToView} onLogout={onLogout} onPrefetch={prefetchView} moduleSwitcher={moduleSwitcher}>
      <Stack spacing={3}>


              {activeView === "seamless" && <MetricsDashboard />}
              {activeView === "dataQuality" && <DataQualityTable />}
              {activeView === "duplicateAccounts" && <DuplicateAccounts />}
              {activeView === "summaryAnalytics" && <SummaryAnalytics />}
            </Stack>
    </DashboardShell>
  );
}
