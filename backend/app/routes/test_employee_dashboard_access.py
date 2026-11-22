import unittest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from backend.app import main
from backend.app.routes.auth import require_user


class EmployeeDashboardAccessTest(unittest.TestCase):
    def setUp(self):
        self.user = {"role": "user", "modules": ["consulting"], "email": "consultant@example.com"}
        self.token_patch = patch.object(main, "get_user_from_token", side_effect=lambda _: self.user)
        self.token_patch.start()
        main.app.dependency_overrides[require_user] = lambda: self.user
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        self.token_patch.stop()
        main.app.dependency_overrides.clear()

    def test_shared_reads_require_authentication(self):
        for path in main.SHARED_READ_MODULES:
            self.assertEqual(self.client.get(path).status_code, 401)

    def test_consulting_does_not_grant_finance_or_write_access(self):
        headers = {"Authorization": "Bearer employee"}
        for path in ("/company-financials", "/management/sales-outlook", "/software-subscriptions"):
            self.assertEqual(self.client.get(path, headers=headers).status_code, 403)
        self.assertEqual(self.client.post("/productivity/projects", headers=headers).status_code, 403)

    def test_consulting_can_read_surveys_but_maintenance_cannot(self):
        with patch("backend.app.routes.surveys.get_completed_surveys", new=AsyncMock(return_value={"surveys": []})):
            self.assertEqual(self.client.get("/surveys/completed", headers={"Authorization": "Bearer employee"}).status_code, 200)
            self.user["modules"] = ["main"]
            self.assertEqual(self.client.get("/surveys/completed", headers={"Authorization": "Bearer employee"}).status_code, 403)

    def test_consulting_project_data_reaches_employee(self):
        payload = {"months": [{"month": "2026-11", "projects": 7}]}
        with patch("backend.app.routes.marketing.get_project_creation_metrics", new=AsyncMock(return_value=payload)):
            response = self.client.get("/productivity/projects", headers={"Authorization": "Bearer employee"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), payload)

    def test_consulting_hours_reach_employee(self):
        payload = {"employees": [{"name": "Consultant", "hours": 24}], "sync": {"status": "idle", "is_stale": False}}
        with patch("backend.app.routes.marketing.get_employee_weekly_hours", return_value=payload):
            response = self.client.get("/productivity/employee-hours", headers={"Authorization": "Bearer employee"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), payload)

    def test_pe_leads_are_shared_only_with_prospecting_and_management(self):
        payload = {"data": [{"name": "Qualified lead"}], "count": 1}
        with patch("backend.app.routes.accounts.get_pe_qualified_leads", new=AsyncMock(return_value=payload)):
            for module in ("prospecting", "management", "consulting", "main"):
                self.user["modules"] = [module]
                response = self.client.get("/pe-qualified-leads", headers={"Authorization": "Bearer employee"})
                self.assertEqual(response.status_code, 200 if module in ("prospecting", "management") else 403)
                if response.status_code == 200:
                    self.assertEqual(response.json(), payload)
