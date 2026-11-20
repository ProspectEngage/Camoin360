import unittest

from backend.app.testing_support import temporary_database
from backend.app.services.client_users import create_client_user, list_client_users
from backend.app.services.organizations import (
    create_organization,
    delete_organization,
    get_organization,
    list_manual_organizations,
    list_organizations,
    sync_organizations,
    update_organization,
    upsert_organization,
)


class OrganizationServiceTest(unittest.TestCase):
    def test_usage_metadata_survives_portal_user_creation_and_partial_edits(self):
        organization = create_organization({"organization_name": "Usage Client", "number_of_users": 12, "usage_type": "both"})
        create_client_user({"organization_id": organization.id, "name": "Jane", "username": "usage@example.com", "password": "secure-password", "role": "user"})
        updated = update_organization(organization.id, {"city": "Boston"})
        self.assertEqual(updated.number_of_users, 12)
        self.assertEqual(updated.usage_type, "both")
        self.assertEqual(updated.user_count, 1)
        self.assertEqual(list_manual_organizations(), [updated])
        cleared = update_organization(organization.id, {"number_of_users": None, "usage_type": None})
        self.assertIsNone(cleared.number_of_users)
        self.assertIsNone(cleared.usage_type)

    def test_usage_metadata_zero_and_classification_can_be_updated(self):
        organization = create_organization({"organization_name": "Usage Client"})
        self.assertIsNone(organization.number_of_users)
        self.assertIsNone(organization.usage_type)
        for usage in ("prospecting", "bre", "both"):
            updated = update_organization(organization.id, {"number_of_users": 0, "usage_type": usage})
            self.assertEqual(get_organization(organization.id), updated)
            self.assertEqual(updated.number_of_users, 0)
            self.assertEqual(updated.usage_type, usage)

    def test_usage_schema_rejects_invalid_counts_and_usage(self):
        from pydantic import ValidationError
        from backend.app.schemas.organization import OrganizationCreate, OrganizationUpdate
        for values in ({"number_of_users": -1}, {"number_of_users": 1.5}, {"number_of_users": True}, {"usage_type": "unknown"}):
            with self.assertRaises(ValidationError):
                OrganizationCreate(organization_name="Usage Client", **values)
            with self.assertRaises(ValidationError):
                OrganizationUpdate(**values)

    def setUp(self):
        self.database_patch = temporary_database()
        self.database_patch.start()

    def tearDown(self):
        self.database_patch.stop()

    def test_creates_manual_organization_without_dynamics_account(self):
        created = create_organization(
            {
                "organization_name": "Manual Capital",
                "city": "Albany",
                "state": "NY",
                "contract_expiration": "2027-06-30",
            }
        )

        self.assertTrue(created.dynamics_account_id.startswith("manual-"))
        self.assertEqual(created.organization_name, "Manual Capital")
        self.assertEqual(created.user_count, 0)
        self.assertEqual(list_organizations(), [created])

    def test_lists_only_manual_organizations(self):
        manual = create_organization(
            {
                "organization_name": "Manual Capital",
                "city": "Albany",
                "state": "NY",
                "contract_expiration": None,
            }
        )
        upsert_organization(
            {
                "account_id": "dynamics-account-1",
                "client_name": "Dynamics Capital",
                "city": "Boston",
                "state": "MA",
                "users": 0,
                "contract_expiration": None,
            }
        )

        self.assertEqual(list_manual_organizations(), [manual])
        self.assertEqual(len(list_organizations()), 2)

    def test_creates_and_updates_organization_table_records(self):
        created = upsert_organization(
            {
                "account_id": "account-1",
                "client_name": "Example Capital",
                "city": "Albany",
                "state": "NY",
                "users": 1,
                "contract_expiration": "2027-06-30",
            }
        )

        updated = upsert_organization(
            {
                "account_id": "account-1",
                "client_name": "Example Capital Partners",
                "city": "Troy",
                "state": "NY",
                "users": 2,
                "contract_expiration": "2028-06-30",
            }
        )

        self.assertEqual(created.id, updated.id)
        self.assertEqual(updated.organization_name, "Example Capital Partners")
        self.assertEqual(updated.user_count, 0)
        self.assertEqual(len(list_organizations()), 1)

    def test_syncs_multiple_dynamics_organizations(self):
        organizations = sync_organizations(
            [
                {
                    "account_id": "account-1",
                    "client_name": "Alpha",
                    "city": "",
                    "state": "NY",
                    "users": 0,
                    "contract_expiration": None,
                },
                {
                    "account_id": "account-2",
                    "client_name": "Beta",
                    "city": "Boston",
                    "state": "MA",
                    "users": 3,
                    "contract_expiration": None,
                },
            ]
        )

        self.assertEqual([organization.organization_name for organization in organizations], ["Alpha", "Beta"])
        self.assertEqual(len(list_organizations()), 2)

    def test_updates_organization_fields(self):
        organization = upsert_organization(
            {
                "account_id": "account-1",
                "client_name": "Example Capital",
                "city": "Albany",
                "state": "NY",
                "users": 0,
                "contract_expiration": None,
            }
        )

        updated = update_organization(
            organization.id,
            {
                "organization_name": "Example Capital Partners",
                "city": "Troy",
                "state": "NY",
                "contract_expiration": "2028-06-30",
            },
        )

        self.assertEqual(updated.organization_name, "Example Capital Partners")
        self.assertEqual(updated.city, "Troy")
        self.assertEqual(updated.contract_expiration, "2028-06-30")
        self.assertEqual(get_organization(organization.id), updated)

    def test_deletes_organization_and_linked_users(self):
        organization = upsert_organization(
            {
                "account_id": "account-1",
                "client_name": "Example Capital",
                "city": "Albany",
                "state": "NY",
                "users": 0,
                "contract_expiration": None,
            }
        )
        create_client_user(
            {
                "organization_id": organization.id,
                "name": "Jane Client",
                "username": "jane@example.com",
                "password": "secure-password",
                "role": "user",
            }
        )

        delete_organization(organization.id)

        self.assertEqual(list_organizations(), [])
        self.assertEqual(list_client_users(), [])
