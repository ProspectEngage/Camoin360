import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { API_BASE_URL, getApiErrorMessage, getAuthHeaders, handleUnauthorized } from "../auth";
import { EmptyState, ModalTitle, subtleTableHeadCellSx } from "./UiPrimitives";

const API_URL = `${API_BASE_URL}/pe-revenue`;
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const blankSubscription = () => ({ organization_id: "", plan_name: "", amount: "", billing_frequency: "monthly", status: "active", effective_from: today(), effective_to: "" });
const blankPayment = () => ({ organization_id: "", amount: "", received_on: today(), period_start: today().slice(0, 7) + "-01", period_end: today(), reference: "" });

function Metric({ label, value, help }) {
  return <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, minWidth: 0 }}>
    <Typography color="text.secondary" variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase" }}>{label}</Typography>
    <Typography color="primary.main" variant="h5" sx={{ fontWeight: 800, my: 0.5 }}>{value}</Typography>
    <Typography color="text.secondary" variant="body2">{help}</Typography>
  </Paper>;
}

export default function PERevenue({ organizations = [] }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("");
  const [section, setSection] = useState("subscriptions");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [subscriptionForm, setSubscriptionForm] = useState(null);
  const [paymentForm, setPaymentForm] = useState(null);
  const [historyOrganization, setHistoryOrganization] = useState("");

  async function loadReport() {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const response = await axios.get(API_URL, { headers: getAuthHeaders(), params: { year, ...(month ? { month } : {}) } });
      setReport(response.data);
    } catch (exc) {
      if (!handleUnauthorized(exc)) setError(getApiErrorMessage(exc, "Unable to load PE revenue."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReport(); }, [year, month]);

  const clients = useMemo(() => (report?.clients || []).filter((client) =>
    client.organization_name.toLowerCase().includes(search.trim().toLowerCase())
  ), [report, search]);
  const payments = useMemo(() => (report?.payments || []).filter((payment) =>
    (report?.clients || []).find((client) => client.organization_id === payment.organization_id)?.organization_name
      ?.toLowerCase().includes(search.trim().toLowerCase())
  ), [report, search]);
  const nameFor = (id) => report?.clients?.find((client) => client.organization_id === id)?.organization_name || `Organization ${id}`;

  function openChange(client) {
    const latest = (report?.subscription_history || [])
      .filter((version) => version.organization_id === client.organization_id)
      .sort((first, second) => second.effective_from.localeCompare(first.effective_from))[0];
    const effectiveFrom = latest?.effective_from > today() ? latest.effective_from : today();
    setSubscriptionForm({
      ...blankSubscription(), organization_id: client.organization_id,
      plan_name: latest?.plan_name || "", amount: latest ? String(latest.amount_cents / 100) : "",
      billing_frequency: latest?.billing_frequency || "monthly", status: latest?.status || "active",
      effective_from, effective_to: latest?.effective_to || "",
    });
    setFormError("");
  }

  async function submit(event, kind) {
    event.preventDefault();
    const form = kind === "subscription" ? subscriptionForm : paymentForm;
    setSaving(true);
    setFormError("");
    try {
      const payload = kind === "subscription"
        ? { ...form, organization_id: Number(form.organization_id), effective_to: form.effective_to || null }
        : { ...form, organization_id: Number(form.organization_id) };
      await axios.post(`${API_URL}/${kind === "subscription" ? "subscriptions" : "payments"}`,
        payload,
        { headers: getAuthHeaders() });
      setSubscriptionForm(null);
      setPaymentForm(null);
      await loadReport();
    } catch (exc) {
      if (!handleUnauthorized(exc)) setFormError(getApiErrorMessage(exc, "Unable to save revenue record."));
    } finally {
      setSaving(false);
    }
  }

  const organizationOptions = organizations.length ? organizations : (report?.clients || []).map((client) => ({ id: client.organization_id, organization_name: client.organization_name }));
  const history = (report?.subscription_history || []).filter((version) => String(version.organization_id) === String(historyOrganization));

  return <Stack spacing={2.5}>
    <Alert severity="info">Subscriptions show normalized recurring revenue. Payments show cash recorded as received; no payment is inferred from a plan.</Alert>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
      <TextField select size="small" label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))} sx={{ minWidth: 120 }}>
        {Array.from({ length: 11 }, (_, index) => currentYear + 1 - index).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Month" value={month} onChange={(event) => setMonth(event.target.value)} sx={{ minWidth: 160 }}>
        <MenuItem value="">Full year</MenuItem>
        {Array.from({ length: 12 }, (_, index) => <MenuItem key={index} value={index + 1}>{new Date(2024, index).toLocaleString("en-US", { month: "long" })}</MenuItem>)}
      </TextField>
      <Typography color="text.secondary" variant="body2">Recurring figures as of {report?.as_of || "selected period"}; receipts within the period.</Typography>
      <Button onClick={loadReport} disabled={loading}>Refresh revenue</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {loading && !report ? <Box textAlign="center" py={5}><CircularProgress /></Box> : <>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
        <Metric label="MRR" value={money(report?.mrr)} help="Active plans, monthly equivalent" />
        <Metric label="ARR" value={money(report?.arr)} help="MRR × 12" />
        <Metric label="Paying clients" value={report?.active_paying_clients || 0} help="Active plans with a positive price" />
        <Metric label="Payments received" value={money(report?.receipts)} help={month ? "Selected month" : "Selected year"} />
      </Box>
      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1.5} p={2}>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {[["subscriptions", "Subscriptions"], ["payments", "Payments"], ["breakdown", "Monthly breakdown"]].map(([key, label]) =>
              <Button key={key} variant={section === key ? "contained" : "outlined"} onClick={() => setSection(key)}>{label}</Button>)}
          </Stack>
          {section === "subscriptions" && <Button variant="contained" onClick={() => { setSubscriptionForm(blankSubscription()); setFormError(""); }}>Add billing change</Button>}
          {section === "payments" && <Button variant="contained" onClick={() => { setPaymentForm(blankPayment()); setFormError(""); }}>Record payment</Button>}
        </Stack>
        {section !== "breakdown" && <TextField label="Search clients" size="small" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ mx: 2, mb: 2, width: { xs: "calc(100% - 32px)", sm: 320 } }} />}
        {section === "subscriptions" && (clients.length ? <TableContainer><Table size="small" sx={{ minWidth: 850 }}>
          <TableHead><TableRow>{["Client", "Plan", "Price", "Frequency", "Status", "Monthly equivalent", "Annual equivalent", "History"].map((label) => <TableCell key={label} sx={subtleTableHeadCellSx}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{clients.map((client) => <TableRow key={client.organization_id}>
            <TableCell>{client.organization_name}</TableCell><TableCell>{client.subscription?.plan_name || "Not set"}</TableCell>
            <TableCell>{client.subscription ? money(client.subscription.amount_cents / 100) : "—"}</TableCell>
            <TableCell>{client.subscription?.billing_frequency || "—"}</TableCell><TableCell>{client.subscription?.status || "Unconfigured"}</TableCell>
            <TableCell>{money(client.monthly_equivalent)}</TableCell><TableCell>{money(client.annual_equivalent)}</TableCell>
            <TableCell><Stack direction="row"><Button size="small" onClick={() => openChange(client)}>Change</Button><Button size="small" onClick={() => setHistoryOrganization(client.organization_id)}>History</Button></Stack></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer> : <EmptyState title="No clients found" description="Add a client organization or try another search." icon="database" />)}
        {section === "payments" && (payments.length ? <TableContainer><Table size="small" sx={{ minWidth: 760 }}>
          <TableHead><TableRow>{["Received", "Client", "Amount", "Period", "Reference"].map((label) => <TableCell key={label} sx={subtleTableHeadCellSx}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{payments.map((payment) => <TableRow key={payment.id}><TableCell>{payment.received_on}</TableCell><TableCell>{nameFor(payment.organization_id)}</TableCell><TableCell>{money(payment.amount_cents / 100)}</TableCell><TableCell>{payment.period_start} – {payment.period_end}</TableCell><TableCell>{payment.reference || "—"}</TableCell></TableRow>)}</TableBody>
        </Table></TableContainer> : <EmptyState title="No payments recorded" description="Record a received payment to include it in cash totals." icon="database" />)}
        {section === "breakdown" && <TableContainer><Table size="small" sx={{ minWidth: 600 }}>
          <TableHead><TableRow>{["Month", "MRR", "ARR", "Paying clients", "Payments received"].map((label) => <TableCell key={label} sx={subtleTableHeadCellSx}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{(report?.monthly_breakdown || []).map((row) => <TableRow key={row.month}><TableCell>{row.month}</TableCell><TableCell>{money(row.mrr)}</TableCell><TableCell>{money(row.arr)}</TableCell><TableCell>{row.active_paying_clients}</TableCell><TableCell>{money(row.receipts)}</TableCell></TableRow>)}</TableBody>
        </Table></TableContainer>}
      </Paper>
    </>}
    <Dialog open={!!subscriptionForm} onClose={() => !saving && setSubscriptionForm(null)} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={(event) => submit(event, "subscription")}>
        <ModalTitle onClose={() => setSubscriptionForm(null)} subtitle="Changes take effect on the start date; prior versions remain in history.">Add billing change</ModalTitle>
        <DialogContent dividers><Stack spacing={2}>{formError && <Alert severity="error">{formError}</Alert>}
          <TextField select required label="Client" value={subscriptionForm?.organization_id || ""} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, organization_id: event.target.value })}>{organizationOptions.map((client) => <MenuItem key={client.id} value={client.id}>{client.organization_name}</MenuItem>)}</TextField>
          <TextField required label="Plan / tier" value={subscriptionForm?.plan_name || ""} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, plan_name: event.target.value })} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required fullWidth type="number" label="Price (USD)" inputProps={{ min: 0, step: "0.01" }} value={subscriptionForm?.amount || ""} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, amount: event.target.value })} />
            <TextField select fullWidth label="Billing frequency" value={subscriptionForm?.billing_frequency || "monthly"} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, billing_frequency: event.target.value })}><MenuItem value="monthly">Monthly</MenuItem><MenuItem value="annual">Annual</MenuItem></TextField>
          </Stack>
          <TextField select label="Status" value={subscriptionForm?.status || "active"} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, status: event.target.value })}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem><MenuItem value="canceled">Canceled</MenuItem></TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required fullWidth type="date" label="Effective from" InputLabelProps={{ shrink: true }} value={subscriptionForm?.effective_from || ""} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, effective_from: event.target.value })} />
            <TextField fullWidth type="date" label="End date (optional)" InputLabelProps={{ shrink: true }} value={subscriptionForm?.effective_to || ""} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, effective_to: event.target.value })} />
          </Stack>
        </Stack></DialogContent><DialogActions><Button onClick={() => setSubscriptionForm(null)} disabled={saving}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>Save change</Button></DialogActions>
      </Box>
    </Dialog>
    <Dialog open={!!paymentForm} onClose={() => !saving && setPaymentForm(null)} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={(event) => submit(event, "payment")}>
        <ModalTitle onClose={() => setPaymentForm(null)} subtitle="Only actual received payments are included in cash totals.">Record payment</ModalTitle>
        <DialogContent dividers><Stack spacing={2}>{formError && <Alert severity="error">{formError}</Alert>}
          <TextField select required label="Client" value={paymentForm?.organization_id || ""} onChange={(event) => setPaymentForm({ ...paymentForm, organization_id: event.target.value })}>{organizationOptions.map((client) => <MenuItem key={client.id} value={client.id}>{client.organization_name}</MenuItem>)}</TextField>
          <TextField required type="number" label="Amount received (USD)" inputProps={{ min: 0.01, step: "0.01" }} value={paymentForm?.amount || ""} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
          <TextField required type="date" label="Date received" InputLabelProps={{ shrink: true }} value={paymentForm?.received_on || ""} onChange={(event) => setPaymentForm({ ...paymentForm, received_on: event.target.value })} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required fullWidth type="date" label="Period start" InputLabelProps={{ shrink: true }} value={paymentForm?.period_start || ""} onChange={(event) => setPaymentForm({ ...paymentForm, period_start: event.target.value })} />
            <TextField required fullWidth type="date" label="Period end" InputLabelProps={{ shrink: true }} value={paymentForm?.period_end || ""} onChange={(event) => setPaymentForm({ ...paymentForm, period_end: event.target.value })} />
          </Stack>
          <TextField label="Reference (optional)" value={paymentForm?.reference || ""} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} />
        </Stack></DialogContent><DialogActions><Button onClick={() => setPaymentForm(null)} disabled={saving}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>Record payment</Button></DialogActions>
      </Box>
    </Dialog>
    <Dialog open={!!historyOrganization} onClose={() => setHistoryOrganization("")} fullWidth maxWidth="sm">
      <ModalTitle onClose={() => setHistoryOrganization("")} subtitle="Effective-dated subscription history">{nameFor(historyOrganization)}</ModalTitle>
      <DialogContent dividers>{history.length ? history.map((version) => <Box key={version.id} py={1}>
        <Typography fontWeight={700}>{version.plan_name} · {money(version.amount_cents / 100)} / {version.billing_frequency}</Typography>
        <Typography color="text.secondary" variant="body2">{version.status} · {version.effective_from} to {version.effective_to || "open end"}</Typography>
      </Box>) : <Typography>No subscription history yet.</Typography>}</DialogContent>
    </Dialog>
  </Stack>;
}
