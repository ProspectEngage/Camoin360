import { useState } from "react";
import { Stack } from "@mui/material";
import DashboardShell from "./components/DashboardShell";
import DashboardDateFilters, { EMPTY_DATE_FILTERS } from "./components/DashboardDateFilters";
import ProductivityProjects from "./components/ProductivityProjects";
import EmployeeProductivity from "./components/EmployeeProductivity";
import SurveyComponent from "./components/SurveyComponent";

const views = {
  projects: { label: "Service Lines & Projects", description: "Project volumes, proposals, and contracted fees from Dynamics." },
  productivity: { label: "Employee Productivity", description: "Consulting hours and billable activity from Harvest." },
  surveys: { label: "Client Surveys", description: "Completed Dynamics project surveys and client feedback." },
};

export default function ConsultingDashboard({ onLogout, moduleSwitcher }) {
  const [activeView, setActiveView] = useState("projects");
  const [periods, setPeriods] = useState({});
  const filters = periods[activeView] || EMPTY_DATE_FILTERS;
  return (
    <DashboardShell module="consulting" label="Consulting" views={views} activeView={activeView} onNavigate={setActiveView} onLogout={onLogout} moduleSwitcher={moduleSwitcher}>
      <Stack spacing={3}>

        {activeView !== "surveys" && <DashboardDateFilters value={filters} onChange={(value) => setPeriods((current) => ({ ...current, [activeView]: value }))} />}
        {activeView === "projects" && <ProductivityProjects filters={filters} />}
        {activeView === "productivity" && <EmployeeProductivity filters={filters} />}
        {activeView === "surveys" && <SurveyComponent />}
      </Stack>
    </DashboardShell>
  );
}
