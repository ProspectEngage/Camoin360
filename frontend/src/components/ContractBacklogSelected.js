import { ChartEmpty, ChartError, ChartLoading, formatChartCurrency } from "./ChartFeedback";
import { filterReportingRows } from "../reportingPeriod";
import { useEffect, useState } from "react";
import axios from "axios";
import { Box, Paper, Typography } from "@mui/material";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { API_BASE_URL, getApiErrorMessage, getAuthHeaders, handleUnauthorized } from "../auth";

const formatMonth = (monthKey) => {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" })
    .format(new Date(year, month - 1, 1));
};

export default function ContractBacklogSelected({ filters } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    axios.get(`${API_BASE_URL}/management/contract-backlog`, { headers: getAuthHeaders() })
      .then((response) => { if (active) setData(response.data); })
      .catch((requestError) => {
        if (active && !handleUnauthorized(requestError)) {
          setError(getApiErrorMessage(requestError, "Unable to load contract backlog from Dynamics."));
        }
      });
    return () => { active = false; };
  }, [requestVersion]);

  if (error) return <ChartError message={error} onRetry={() => setRequestVersion((version) => version + 1)} />;
  if (!data) return <ChartLoading label="contract fees" />;

  return (
    <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: { xs: 2, md: 2.5 } }}>
      <Typography fontWeight={800}>Monthly contracted project fees (USD)</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
        Total Project Fee and Fee for Camoin grouped by Contract Date. These are contracted amounts, not outstanding backlog or recognized revenue.
      </Typography>
      {!filterReportingRows(data.monthly_totals, filters).length ? <ChartEmpty label="contract fee data" /> : <Box sx={{ height: 380, minWidth: 0 }}>
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={filterReportingRows(data.monthly_totals, filters)} margin={{ top: 12, right: 24, bottom: 8, left: 14 }}>
            <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month_key" tick={{ fontSize: 12 }} tickFormatter={formatMonth} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `$${Number(value / 1000).toLocaleString()}k`} width={78} />
            <Tooltip formatter={(value, name) => [formatChartCurrency(value), name]} labelFormatter={formatMonth} />
            <Legend verticalAlign="top" height={36} />
            <Line dataKey="total_project_fee" name="Total project fee (USD)" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} type="monotone" />
            <Line dataKey="fee_for_camoin" name="Fee for Camoin (USD)" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </Box>}
    </Paper>
  );
}
