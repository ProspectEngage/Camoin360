"""Local PE subscription history and recorded cash receipts (USD cents)."""

from calendar import monthrange
from datetime import date
from decimal import Decimal

from ..database import get_database_connection


def cents(amount: Decimal) -> int:
    return int(amount * 100)


def _organization_exists(connection, organization_id: int) -> bool:
    return connection.execute(
        "SELECT 1 FROM organizations WHERE id = ? AND dynamics_account_id LIKE 'manual-%'", (organization_id,)
    ).fetchone() is not None


def add_subscription(organization_id: int, values: dict):
    """Append a version, allowing correction of the latest current/future version."""
    with get_database_connection() as connection:
        if not _organization_exists(connection, organization_id):
            raise LookupError("Organization not found")
        latest = connection.execute(
            "SELECT id, effective_from FROM pe_subscription_versions WHERE organization_id = ? ORDER BY effective_from DESC LIMIT 1 FOR UPDATE",
            (organization_id,),
        ).fetchone()
        effective_from = values["effective_from"]
        if latest:
            if effective_from < latest["effective_from"]:
                raise ValueError("A new billing change must start after the latest version")
            if effective_from < date.today():
                raise ValueError("Changes to an existing subscription must start today or later")
            if effective_from == latest["effective_from"]:
                return connection.execute(
                    """UPDATE pe_subscription_versions SET plan_name = ?, amount_cents = ?,
                           billing_frequency = ?, status = ?, effective_to = ? WHERE id = ?
                       RETURNING id, organization_id, plan_name, amount_cents, billing_frequency,
                                 status, effective_from, effective_to, created_at""",
                    (values["plan_name"].strip(), cents(values["amount"]), values["billing_frequency"],
                     values["status"], values.get("effective_to"), latest["id"]),
                ).fetchone()
        row = connection.execute(
            """
            INSERT INTO pe_subscription_versions
                (organization_id, plan_name, amount_cents, billing_frequency, status, effective_from, effective_to)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id, organization_id, plan_name, amount_cents, billing_frequency, status,
                      effective_from, effective_to, created_at
            """,
            (organization_id, values["plan_name"].strip(), cents(values["amount"]),
             values["billing_frequency"], values["status"], effective_from, values.get("effective_to")),
        ).fetchone()
    return row


def add_payment(organization_id: int, values: dict):
    with get_database_connection() as connection:
        if not _organization_exists(connection, organization_id):
            raise LookupError("Organization not found")
        return connection.execute(
            """
            INSERT INTO pe_payments
                (organization_id, amount_cents, received_on, period_start, period_end, reference)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id, organization_id, amount_cents, received_on, period_start,
                      period_end, reference, created_at
            """,
            (organization_id, cents(values["amount"]), values["received_on"],
             values["period_start"], values["period_end"], values.get("reference", "").strip()),
        ).fetchone()


def list_revenue_data():
    with get_database_connection() as connection:
        organizations = connection.execute(
            "SELECT id, organization_name FROM organizations WHERE dynamics_account_id LIKE 'manual-%' ORDER BY LOWER(organization_name)"
        ).fetchall()
        versions = connection.execute(
            """SELECT id, organization_id, plan_name, amount_cents, billing_frequency, status,
                      effective_from, effective_to, created_at
               FROM pe_subscription_versions WHERE organization_id IN
                   (SELECT id FROM organizations WHERE dynamics_account_id LIKE 'manual-%')
               ORDER BY organization_id, effective_from"""
        ).fetchall()
        payments = connection.execute(
            """SELECT id, organization_id, amount_cents, received_on, period_start, period_end,
                      reference, created_at FROM pe_payments WHERE organization_id IN
                   (SELECT id FROM organizations WHERE dynamics_account_id LIKE 'manual-%')
               ORDER BY received_on DESC, id DESC"""
        ).fetchall()
    return organizations, versions, payments


def _active_version(versions: list[dict], as_of: date):
    eligible = [row for row in versions if row["effective_from"] <= as_of]
    if not eligible:
        return None
    current = max(eligible, key=lambda row: row["effective_from"])
    if current["effective_to"] and as_of > current["effective_to"]:
        return None
    return current


def build_report(organizations, versions, payments, year: int, month: int | None = None):
    today = date.today()
    as_of = date(year, month, monthrange(year, month)[1]) if month else date(year, 12, 31)
    if year == today.year and (month is None or month == today.month):
        as_of = min(as_of, today)
    by_organization = {}
    for version in versions:
        by_organization.setdefault(version["organization_id"], []).append(version)
    clients = []
    mrr = Decimal(0)
    paying = 0
    for organization in organizations:
        current = _active_version(by_organization.get(organization["id"], []), as_of)
        monthly = Decimal(0)
        if current and current["status"] == "active":
            monthly = Decimal(current["amount_cents"]) / (1200 if current["billing_frequency"] == "annual" else 100)
            mrr += monthly
            paying += current["amount_cents"] > 0
        clients.append({
            "organization_id": organization["id"],
            "organization_name": organization["organization_name"],
            "subscription": current,
            "monthly_equivalent": round(monthly, 2),
            "annual_equivalent": round(monthly * 12, 2),
        })
    selected_payments = [row for row in payments if row["received_on"].year == year
                         and (month is None or row["received_on"].month == month)]
    receipts_cents = sum(row["amount_cents"] for row in selected_payments)
    breakdown = []
    for number in range(1, 13):
        month_end = date(year, number, monthrange(year, number)[1])
        if year == today.year and number == today.month:
            month_end = min(month_end, today)
        month_mrr = Decimal(0)
        month_paying = 0
        for organization in organizations:
            current = _active_version(by_organization.get(organization["id"], []), month_end)
            if current and current["status"] == "active" and current["amount_cents"] > 0:
                month_mrr += Decimal(current["amount_cents"]) / (1200 if current["billing_frequency"] == "annual" else 100)
                month_paying += 1
        breakdown.append({"month": f"{year}-{number:02d}", "mrr": round(month_mrr, 2),
                          "arr": round(month_mrr * 12, 2), "active_paying_clients": month_paying,
                          "receipts": Decimal(sum(p["amount_cents"] for p in payments
                                                  if p["received_on"].year == year and p["received_on"].month == number)) / 100})
    return {"year": year, "month": month, "as_of": as_of, "mrr": round(mrr, 2),
            "arr": round(mrr * 12, 2), "active_paying_clients": paying,
            "receipts": Decimal(receipts_cents) / 100, "clients": clients,
            "payments": selected_payments, "monthly_breakdown": breakdown,
            "subscription_history": versions}
