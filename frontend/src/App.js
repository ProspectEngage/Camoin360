import { lazy, Suspense, useEffect, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import {
  clearAuthToken,
  getAllowedDashboardViews,
  getAuthToken,
  getCurrentUser,
  getDefaultDashboardView,
  getPreferredAllowedDashboardView,
  loginUser,
  onUnauthorized,
  savePreferredDashboardView,
} from "./auth";
import LegalPage from "./legalPages";
import Login from "./login";

const AdminDashboard = lazy(() => import("./adminDashboard"));
const LandingPage = lazy(() => import("./landingPage"));
const QuickBooksSettings = lazy(() => import("./QuickBooksSettings"));
const ConsultingDashboard = lazy(() => import("./consultingDashboard"));
const ManagementDashboard = lazy(() => import("./managementDashboard"));
const ProspectingDashboard = lazy(() => import("./prospectingDashboard"));

function LoadingView() {
  return (
    <Box component="main" role="status" aria-label="Loading dashboard" sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
      <CircularProgress size={28} aria-hidden="true" />
      <Typography>Loading dashboard…</Typography>
    </Box>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getAuthToken()));
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  const [dashboardView, setDashboardView] = useState(() => getPreferredAllowedDashboardView(getCurrentUser()));

  useEffect(() => {
    return onUnauthorized(() => {
      setIsLoggedIn(false);
      setCurrentUser(null);
    });
  }, []);

  async function handleLogin(credentials, nextDashboardView) {
    const user = await loginUser(credentials);
    const allowedDashboardViews = getAllowedDashboardViews(user);
    const requestedManagementView = /^\/management(?:\/|$)/.test(window.location.pathname) &&
      allowedDashboardViews.some((option) => option.value === "management");
    const resolvedDashboardView = requestedManagementView
      ? "management"
      : allowedDashboardViews.some((option) => option.value === nextDashboardView)
        ? nextDashboardView
        : getDefaultDashboardView(user);

    savePreferredDashboardView(resolvedDashboardView);
    setCurrentUser(user);
    setDashboardView(resolvedDashboardView);
    setIsLoggedIn(true);
  }

  function handleLogout() {
    clearAuthToken();
    setIsLoggedIn(false);
    setCurrentUser(null);
  }

  if (window.location.pathname === "/terms") {
    return <LegalPage type="terms" />;
  }

  if (window.location.pathname === "/privacy") {
    return <LegalPage type="privacy" />;
  }

  if (isLoggedIn) {
    if (window.location.pathname === "/settings/integrations/quickbooks") {
      return (
        <Suspense fallback={<LoadingView />}>
          <QuickBooksSettings onLogout={handleLogout} />
        </Suspense>
      );
    }

    const allowedDashboardViews = getAllowedDashboardViews(currentUser);
    const requestedManagementView = /^\/management(?:\/|$)/.test(window.location.pathname) &&
      allowedDashboardViews.some((option) => option.value === "management");
    const resolvedDashboardView = requestedManagementView
      ? "management"
      : allowedDashboardViews.some((option) => option.value === dashboardView)
      ? dashboardView
      : getDefaultDashboardView(currentUser);

    const Dashboard = {
      admin: AdminDashboard,
      management: ManagementDashboard,
      prospecting: ProspectingDashboard,
      consulting: ConsultingDashboard,
    }[resolvedDashboardView] || LandingPage;

    return (
      <Suspense fallback={<LoadingView />}>
        <Dashboard onLogout={handleLogout} />
      </Suspense>
    );
  }

  return <Login onLogin={handleLogin} />;
}
