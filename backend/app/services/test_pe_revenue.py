import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from .pe_revenue import build_report
from ..routes.auth import require_user
from ..routes.pe_revenue import PaymentCreate, SubscriptionCreate, require_revenue_access, router
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient


class PERevenueReportTest(unittest.TestCase):
    def test_monthly_annual_status_history_and_cash_are_separate(self):
        organizations = [
            {"id": 1, "organization_name": "Monthly client"},
            {"id": 2, "organization_name": "Annual client"},
        ]
        versions = [
            {"organization_id": 1, "effective_from": date(2025, 1, 1), "effective_to": None,
             "amount_cents": 10000, "billing_frequency": "monthly", "status": "active"},
            {"organization_id": 1, "effective_from": date(2025, 7, 1), "effective_to": None,
             "amount_cents": 15000, "billing_frequency": "monthly", "status": "active"},
            {"organization_id": 1, "effective_from": date(2025, 11, 1), "effective_to": None,
             "amount_cents": 15000, "billing_frequency": "monthly", "status": "canceled"},
            {"organization_id": 2, "effective_from": date(2025, 1, 1), "effective_to": None,
             "amount_cents": 120000, "billing_frequency": "annual", "status": "active"},
        ]
        payments = [
            {"organization_id": 1, "amount_cents": 10000, "received_on": date(2025, 3, 3)},
            {"organization_id": 2, "amount_cents": 120000, "received_on": date(2025, 8, 9)},
        ]

        march = build_report(organizations, versions, payments, 2025, 3)
        self.assertEqual(march["mrr"], Decimal("200.00"))
        self.assertEqual(march["arr"], Decimal("2400.00"))
        self.assertEqual(march["receipts"], Decimal("100"))
        self.assertEqual(march["active_paying_clients"], 2)

        august = build_report(organizations, versions, payments, 2025, 8)
        self.assertEqual(august["mrr"], Decimal("250.00"))
        self.assertEqual(august["receipts"], Decimal("1200"))

        november = build_report(organizations, versions, payments, 2025, 11)
        self.assertEqual(november["mrr"], Decimal("100.00"))
        self.assertEqual(november["active_paying_clients"], 1)
        self.assertEqual(november["receipts"], Decimal("0"))
        self.assertEqual(november["monthly_breakdown"][2]["mrr"], Decimal("200.00"))

    def test_validation_and_module_access(self):
        with self.assertRaises(ValueError):
            SubscriptionCreate(organization_id=1, plan_name=" ", amount=10,
                               billing_frequency="monthly", status="active", effective_from=date(2025, 1, 1))
        with self.assertRaises(ValueError):
            PaymentCreate(organization_id=1, amount=10, received_on=date(2025, 1, 1),
                          period_start=date(2025, 2, 1), period_end=date(2025, 1, 1))
        for module in ("prospecting", "management"):
            self.assertTrue(require_revenue_access({"role": "user", "modules": [module]}))
        with self.assertRaises(HTTPException) as error:
            require_revenue_access({"role": "user", "modules": ["consulting"]})
        self.assertEqual(error.exception.status_code, 403)

    def test_http_endpoints_enforce_access_and_validate_input(self):
        app = FastAPI()
        app.include_router(router)
        with TestClient(app) as client, patch(
            "backend.app.routes.pe_revenue.list_revenue_data", return_value=([], [], [])
        ):
            self.assertEqual(client.get("/pe-revenue").status_code, 401)
            app.dependency_overrides[require_user] = lambda: {"role": "user", "modules": ["consulting"]}
            self.assertEqual(client.get("/pe-revenue").status_code, 403)
            app.dependency_overrides[require_user] = lambda: {"role": "user", "modules": ["management"]}
            response = client.get("/pe-revenue?year=2025&month=3")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["mrr"], 0.0)
            self.assertEqual(client.post("/pe-revenue/payments", json={
                "organization_id": 1, "amount": -1, "received_on": "2025-03-01",
                "period_start": "2025-03-01", "period_end": "2025-03-31",
            }).status_code, 422)


if __name__ == "__main__":
    unittest.main()
