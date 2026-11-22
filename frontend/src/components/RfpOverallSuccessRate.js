import { ChartEmpty, ChartError, ChartLoading } from "./ChartFeedback";
import { matchesReportingPeriod } from "../reportingPeriod";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Tooltip, Typography } from "@mui/material";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { API_BASE_URL, getApiErrorMessage, getAuthHeaders, handleUnauthorized } from "../auth";
import { FullWidthFilterRow } from "./UiPrimitives";

const percent = (value) => value == null ? "Not available" : `${Number(value).toFixed(1)}%`;
const ALL_SERVICE_LINES = "all";

export default function RfpOverallSuccessRate({ filters }) {
  const [metrics, setMetrics] = useState({ series: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestVersion, setRequestVersion] = useState(0);
  const [serviceLine, setServiceLine] = useState(ALL_SERVICE_LINES);

  useEffect(() => {
    let active = true;
    setError("");
    setLoading(true);
    axios.get(`${API_BASE_URL}/management/rfp-success-rate`, { headers: getAuthHeaders() })
      .then((response) => { if (active) setMetrics(response.data || { series: [] }); })
      .catch((requestError) => {
        if (!handleUnauthorized(requestError) && active) {
          setError(getApiErrorMessage(requestError, "Unable to load RFP success rates from Dynamics."));
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestVersion]);

  const data = useMemo(() => {
    const matchingRows = (metrics.series || []).filter(
        (row) =>
          matchesReportingPeriod(row, filters) &&
          (serviceLine === ALL_SERVICE_LINES || row.service_line === serviceLine)
      );
    const byPeriod = new Map();
    matchingRows.forEach((row) => {
      const period = byPeriod.get(row.period) || {
        period: row.period, year: row.year, quarter: row.quarter,
        won: 0, lost: 0, open: 0, won_fee: 0, decided_fee: 0,
      };
      ["won", "lost", "open", "won_fee", "decided_fee"].forEach((key) => {
        period[key] += Number(row[key] || 0);
      });
      byPeriod.set(row.period, period);
    });
    return Array.from(byPeriod.values()).map((row) => ({
      ...row,
      count_success_rate: row.won + row.lost ? (row.won / (row.won + row.lost)) * 100 : null,
      dollar_success_rate: row.decided_fee ? (row.won_fee / row.decided_fee) * 100 : null,
    }));
  }, [filters, metrics.series, serviceLine]);

  const overall = useMemo(() => {
    const totals = data.reduce((sum, row) => ({
      won: sum.won + row.won, decided: sum.decided + row.won + row.lost,
      wonFee: sum.wonFee + row.won_fee, decidedFee: sum.decidedFee + row.decided_fee,
    }), { won: 0, decided: 0, wonFee: 0, decidedFee: 0 });
    return {
      dollarRate: totals.decidedFee ? totals.wonFee / totals.decidedFee * 100 : null,
      rfpRate: totals.decided ? totals.won / totals.decided * 100 : null,
    };
  }, [data]);

  if (loading) return <ChartLoading label="RFP win rates" />;
  if (error) return <ChartError message={error} onRetry={() => setRequestVersion((version) => version + 1)} />;

  return (
    <Stack spacing={2.5}>
      {data.length > 0 && (overall.dollarRate === null || overall.rfpRate === null) ? <Alert severity="info">A win rate is not available when there are no decided RFPs or the decided fee total is zero. Open opportunities are excluded.</Alert> : null}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2.5 }}>
          <Tooltip arrow title="Dollar-based win rate: the Fee for Camoin value of won RFPs divided by the total value of won and lost RFPs. Larger proposals have more influence on this rate.">
            <Typography component="span" tabIndex={0} color="text.secondary" sx={{ borderBottom: "1px dotted", cursor: "help" }} variant="overline">RFP win rate by value</Typography>
          </Tooltip>
          <Typography color="primary.main" sx={{ fontSize: "2.35rem", fontWeight: 800, lineHeight: 1.1, mt: 0.75 }}>
            {percent(overall.dollarRate)}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
            Won fees ÷ won and lost fees, for the selected period
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2.5 }}>
          <Tooltip arrow title="Count-based win rate: the number of won RFPs divided by the total number of won and lost RFPs. Every proposal counts equally regardless of value.">
            <Typography component="span" tabIndex={0} color="text.secondary" sx={{ borderBottom: "1px dotted", cursor: "help" }} variant="overline">RFP win rate by count</Typography>
          </Tooltip>
          <Typography color="secondary.main" sx={{ fontSize: "2.35rem", fontWeight: 800, lineHeight: 1.1, mt: 0.75 }}>
            {percent(overall.rfpRate)}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
            Won RFPs ÷ won and lost RFPs, for the selected period
          </Typography>
        </Paper>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography color="text.primary" fontWeight={800}>Quarterly RFP win rates (%)</Typography>
            <Typography color="text.secondary" variant="body2">
              Quarterly win rates (%) grouped by Date Proposed, not close date. Open opportunities are excluded; missing fees are excluded from the value calculation. Date filters select whole proposal quarters.
            </Typography>
          </Box>
          <FullWidthFilterRow>
            <FormControl size="small">
              <InputLabel id="rfp-service-line-filter-label">Service line</InputLabel>
              <Select
                label="Service line"
                labelId="rfp-service-line-filter-label"
                onChange={(event) => setServiceLine(event.target.value)}
                value={serviceLine}
              >
                <MenuItem value={ALL_SERVICE_LINES}>All service lines</MenuItem>
                {(metrics.service_lines || []).map((line) => <MenuItem key={line} value={line}>{line}</MenuItem>)}
              </Select>
            </FormControl>
          </FullWidthFilterRow>
        </Stack>
        {data.length ? (
          <Box sx={{ height: 360, minWidth: 0 }}>
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={data} margin={{ top: 12, right: 24, bottom: 12, left: 4 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} tickMargin={10} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={percent} width={48} />
                <ChartTooltip labelFormatter={(period) => `Proposal quarter: ${period}`} formatter={(value, name) => [percent(value), name]} />
                <Legend verticalAlign="top" height={36} />
                <Line dataKey="dollar_success_rate" name="Win rate by value" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line dataKey="count_success_rate" name="Win rate by count" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Box sx={{ alignItems: "center", display: "flex", height: 240, justifyContent: "center" }}>
            <ChartEmpty label="RFP win-rate data" />
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
