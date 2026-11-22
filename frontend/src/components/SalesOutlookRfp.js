import { ChartEmpty, ChartError, ChartLoading, formatChartCurrency, formatChartMonth } from "./ChartFeedback";
import { filterReportingRows } from "../reportingPeriod";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Box, Paper, Typography } from "@mui/material";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { API_BASE_URL, getApiErrorMessage, getAuthHeaders, handleUnauthorized } from "../auth";

const API_URL = `${API_BASE_URL}/management/sales-outlook-rfp`;
const MONTH_WIDTH = 44;
const tooltipStyle = { contentStyle: { border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 } };

const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  currency: "USD", maximumFractionDigits: 0, notation: Math.abs(Number(value)) >= 1000000 ? "compact" : "standard", style: "currency",
}).format(Number(value || 0));

function MonthTick({ x, y, payload }) {
  const [year, month] = String(payload?.value || "").split("-");
  const label = month ? new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, { month: "short" }) : "";
  return <g transform={`translate(${x},${y})`}><text fill="#475569" fontSize="10" textAnchor="middle"><tspan x="0" dy="12">{label}</tspan><tspan fontWeight="700" x="0" dy="15">{year}</tspan></text></g>;
}

function ChartCard({ children, description, title, empty }) {
  return <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, minWidth: 0, p: { xs: 2, md: 2.5 } }}>
    <Typography fontWeight={800}>{title}</Typography><Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">{description}</Typography>{empty ? <ChartEmpty /> : children}
  </Paper>;
}

function addLinearTrend(rows) {
  if (!rows.length) return [];
  const count = rows.length;
  const sumX = rows.reduce((sum, _row, index) => sum + index, 0);
  const sumY = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const sumXY = rows.reduce((sum, row, index) => sum + index * Number(row.amount || 0), 0);
  const sumXX = rows.reduce((sum, _row, index) => sum + index * index, 0);
  const denominator = count * sumXX - sumX * sumX;
  const slope = denominator ? (count * sumXY - sumX * sumY) / denominator : 0;
  const intercept = (sumY - slope * sumX) / count;
  return rows.map((row, index) => ({ ...row, trend: Math.max(0, intercept + slope * index) }));
}

function MonthlyBar({ color, data, dataKey, name, valueFormatter = (value) => Number(value).toLocaleString() }) {
  if (!data.length) return <ChartEmpty label="contract data" />;
  return <Box sx={{ height: 340, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
    <Box sx={{ height: 325, minWidth: "100%", width: `${Math.max(data.length * MONTH_WIDTH, 900)}px` }}>
      <ResponsiveContainer height="100%" width="100%"><BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 14 }}>
        <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month_key" height={54} interval={0} tick={<MonthTick />} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickFormatter={valueFormatter} width={78} />
        <Tooltip {...tooltipStyle} formatter={(value) => [valueFormatter === formatCurrency ? formatChartCurrency(value) : valueFormatter(value), name]} labelFormatter={formatChartMonth} />
        <Bar dataKey={dataKey} fill={color} maxBarSize={32} name={name} radius={[4, 4, 0, 0]} />
      </BarChart></ResponsiveContainer>
    </Box>
  </Box>;
}

export default function SalesOutlookRfp({ filters } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    axios.get(API_URL, { headers: getAuthHeaders() }).then((response) => { if (active) setData(response.data); }).catch((requestError) => {
      if (active && !handleUnauthorized(requestError)) setError(getApiErrorMessage(requestError, "Unable to load RFP sales outlook from Dynamics."));
    });
    return () => { active = false; };
  }, [requestVersion]);
  const monthly = useMemo(() => filterReportingRows(data?.monthly_contracts, filters), [data, filters]);
  const annualProposals = useMemo(() => addLinearTrend(filterReportingRows(data?.annual_proposals, filters)), [data, filters]);
  if (error) return <ChartError message={error} onRetry={() => setRequestVersion((version) => version + 1)} />;
  if (!data) return <ChartLoading label="RFP sales outlook" />;

  return <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
    <ChartCard title="Annual proposal value (USD)" empty={!annualProposals.length} description="Fee for Camoin grouped by Date Proposed since 2016. Annual totals remain whole-year values. The dotted line is a fitted trend, not a forecast.">
      <Box sx={{ height: 340 }}><ResponsiveContainer height="100%" width="100%"><LineChart data={annualProposals} margin={{ top: 12, right: 24, bottom: 8, left: 14 }}>
        <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="year" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} width={78} />
        <Tooltip {...tooltipStyle} labelFormatter={(year) => `Proposal year: ${year}`} formatter={(value, name) => [formatChartCurrency(value), name]} />
        <Line dataKey="amount" dot={{ r: 4 }} activeDot={{ r: 6 }} name="Fee for Camoin (USD)" stroke="#0f766e" strokeWidth={3} type="monotone" />
        <Line dataKey="trend" dot={false} name="Trend" stroke="#64748b" strokeDasharray="7 6" strokeWidth={2.5} type="linear" />
      </LineChart></ResponsiveContainer></Box>
    </ChartCard>
    <ChartCard title="Monthly won RFP fees (USD)" description="Monthly Fee for Camoin for won RFP opportunities by Actual Close Date, since 2020. RFP opportunities have a Date Proposed."><MonthlyBar color="#2563eb" data={monthly} dataKey="rfp_signed_amount" name="Fee for Camoin (USD)" valueFormatter={formatCurrency} /></ChartCard>
    <ChartCard title="Monthly RFP wins (count)" description="Monthly count of won RFP opportunities by Actual Close Date, since 2020. RFP opportunities have a Date Proposed."><MonthlyBar color="#0f766e" data={monthly} dataKey="rfp_contracts_won" name="RFP Contracts Won" /></ChartCard>
    <ChartCard title="Monthly won non-bid fees (USD)" description="Monthly Fee for Camoin for won opportunities without a Date Proposed, grouped by Actual Close Date since 2020."><MonthlyBar color="#7c3aed" data={monthly} dataKey="non_bid_signed_amount" name="Fee for Camoin (USD)" valueFormatter={formatCurrency} /></ChartCard>
  </Box>;
}
