import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";

export function ChartLoading({ label }) {
  return (
    <Box role="status" sx={{ display: "grid", minHeight: 240, placeContent: "center", justifyItems: "center", gap: 2 }}>
      <CircularProgress aria-hidden="true" size={28} />
      <Typography color="text.secondary">Loading {label}…</Typography>
    </Box>
  );
}

export function ChartError({ message, onRetry, retrying = false, stale = false }) {
  return (
    <Alert severity="error" action={<Button color="inherit" disabled={retrying} onClick={onRetry}>{retrying ? "Retrying…" : "Try again"}</Button>}>
      {message} {stale ? "Previously loaded data is shown below. " : ""}
      Try again. If the problem continues, ask your administrator to check the Dynamics connection.
    </Alert>
  );
}

export function ChartEmpty({ label = "data" }) {
  return <Alert severity="info">No {label} matches the selected reporting period. Widen or clear the date filters. If the period is correct, check the source records in Dynamics.</Alert>;
}

export function formatChartMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return value;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1)
    .toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export const formatChartCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value || 0));
