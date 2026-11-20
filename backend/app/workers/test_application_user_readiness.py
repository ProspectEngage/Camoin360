"""Stage 2B rehearsal using synthetic accounts and disposable local PostgreSQL.

Readiness probes document existing limitations without changing production code.
No test reads the repository or production users.json.
"""

import copy
import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch
from uuid import uuid4

import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo
import pytest

from backend.app import database
from backend.app.services import application_users as users
from backend.app.services.application_user_migration import decode_legacy_snapshot, reconcile_legacy_accounts
from backend.app.services.test_application_users import pg, legacy
from backend.app.workers import application_user_migration as review
from backend.app.workers.test_application_user_migration import keys, PASSPHRASE, target
from backend.tools import auth_account_backup as backup


def synthetic_sources():
    admin = legacy("operator@synthetic.invalid", id="legacy-operator", organization_id=1,
                   modules=["main", "prospecting", "management", "admin"])
    member = legacy("member@synthetic.invalid", id=17, role="user", organization_id=3, modules=["main"])
    no_id = legacy("idless@synthetic.invalid", role="user", modules=["prospecting"])
    del no_id["idless@synthetic.invalid"]["id"]
    del no_id["idless@synthetic.invalid"]["organization_id"]
    return [{**admin, **member}, {**copy.deepcopy(admin), **no_id}]


def migrate_synthetic(tmp_path, keys, pg):
    paths = []
    originals = []
    for index, source in enumerate(synthetic_sources(), 1):
        source_path = tmp_path / f"instance-{index}.json"
        raw = json.dumps(source, indent=2).encode()
        source_path.write_bytes(raw)
        encrypted = tmp_path / f"instance-{index}.backup"
        backup.export_snapshot(source=source_path, public_key_path=keys[1], output=encrypted,
                               instance_id=f"synthetic-instance-{index}", environment={})
        paths.append(encrypted)
        originals.append((source_path, raw))
    snapshots = review.load_snapshots(paths, keys[0], PASSPHRASE, expected_instances=2)
    report, accounts = review.reconciliation_report(snapshots, default_organization_id=47)
    assert report["status"] == "ready"
    assert report["duplicate_emails"] == 1
    assert len(accounts) == 3
    dry_run = review.review_database(accounts, **target(pg))
    assert dry_run["status"] == "ready" and dry_run["read_only"]
    assert users.list_users() == []
    assert users.import_accounts(accounts) == 3
    assert review.review_database(accounts, verifying=True, **target(pg))["status"] == "verified"
    for source_path, raw in originals:
        assert source_path.read_bytes() == raw
    return accounts, paths, originals


def post_migration_changes():
    new = users.create_user(name="New synthetic account", email="new@synthetic.invalid",
                            password="new-synthetic-password", organization_id=8, modules=["management"])
    users.update_user("member@synthetic.invalid", password="changed-synthetic-password", modules=["prospecting"])
    users.delete_user("idless@synthetic.invalid")
    return new


def test_full_migration_and_code_rollback_keep_post_migration_changes(pg, keys, tmp_path):
    original, paths, sources = migrate_synthetic(tmp_path, keys, pg)
    admin = users.authenticate("operator@synthetic.invalid", "existing-password")
    assert admin.role == "admin" and admin.has_module("management")
    member = users.get_user("member@synthetic.invalid")
    assert member.id == "17" and type(member.legacy_id) is int
    assert member.organization_id == 3
    assert users.get_user("idless@synthetic.invalid").organization_id == 47
    created = post_migration_changes()
    assert users.authenticate(created.email, "new-synthetic-password") == created
    assert users.authenticate("member@synthetic.invalid", "changed-synthetic-password") is not None
    assert users.authenticate("member@synthetic.invalid", "existing-password") is None
    stale = review.review_database(original, verifying=True, **target(pg))
    assert stale["status"] == "blocked"  # A pre-cutover snapshot is now obsolete.
    assert stale["unexpected_accounts"] == stale["missing_accounts"] == 1
    # Model code rollback retaining the same PG store using a fresh interpreter.
    child = subprocess.run([sys.executable, "-B", "-c", """
import os
from backend.app import database
database.DATABASE_URL = os.environ['TEST_DATABASE_URL']
from backend.app.services.application_users import authenticate, get_user
assert authenticate('operator@synthetic.invalid', 'existing-password').role == 'admin'
assert authenticate('new@synthetic.invalid', 'new-synthetic-password') is not None
assert authenticate('member@synthetic.invalid', 'changed-synthetic-password').modules == ('prospecting',)
assert authenticate('member@synthetic.invalid', 'existing-password') is None
assert get_user('idless@synthetic.invalid') is None
print('synthetic_rollback_verified')
"""], env={**os.environ, "TEST_DATABASE_URL": pg}, capture_output=True, text=True)
    assert child.returncode == 0
    assert child.stdout.strip() == "synthetic_rollback_verified"
    raw, _ = backup.decrypt_snapshot(paths[0], keys[0], PASSPHRASE)
    recovered = tmp_path / "separate-recovery.json"
    backup.write_new_file(recovered, raw)
    assert recovered.read_bytes() == sources[0][1]
    stale_records = reconcile_legacy_accounts([decode_legacy_snapshot(raw)], default_organization_id=47)
    assert created.email not in {a.email for a in stale_records}
    assert review.review_database(stale_records, verifying=True, **target(pg))["status"] == "blocked"
    for path, raw in sources:
        assert path.read_bytes() == raw


def test_latest_pg_backup_restore_preserves_new_users_changes_and_deletions(pg, keys, tmp_path):
    migrate_synthetic(tmp_path, keys, pg)
    post_migration_changes()
    latest = users.list_users()
    info = conninfo_to_dict(pg)
    schema = target(pg)["expected_schema"]
    environment = {**os.environ, "PGHOST": info["host"], "PGPORT": info["port"],
                   "PGUSER": info["user"], "PGDATABASE": info["dbname"]}
    dump_path = tmp_path / "synthetic-latest.dump"
    dumped = subprocess.run(["/usr/lib/postgresql/14/bin/pg_dump", "--format=custom", "--no-owner",
                             "--no-privileges", "--schema", schema, "--file", str(dump_path)],
                            env=environment, capture_output=True, text=True)
    assert dumped.returncode == 0
    restored_database = "auth_restore_" + uuid4().hex
    with psycopg.connect(pg, autocommit=True) as connection:
        connection.execute(f'CREATE DATABASE "{restored_database}"')
    try:
        restored = subprocess.run(["/usr/lib/postgresql/14/bin/pg_restore", "--exit-on-error", "--no-owner",
                                   "--no-privileges", "--dbname", restored_database, str(dump_path)],
                                  env=environment, capture_output=True, text=True)
        assert restored.returncode == 0
        restored_url = make_conninfo(**{**info, "dbname": restored_database})
        with patch.object(database, "DATABASE_URL", restored_url):
            assert users.list_users() == latest
            assert users.authenticate("new@synthetic.invalid", "new-synthetic-password") is not None
            assert users.authenticate("member@synthetic.invalid", "changed-synthetic-password") is not None
            assert users.get_user("idless@synthetic.invalid") is None
        verification = review.review_database(latest, database_url=restored_url,
                                               expected_database=restored_database, expected_schema=schema, verifying=True)
        assert verification["status"] == "verified"
    finally:
        with psycopg.connect(pg, autocommit=True) as connection:
            connection.execute(f'DROP DATABASE "{restored_database}"')


def test_probe_snapshot_inventory_does_not_bind_service_or_freshness(pg, keys, tmp_path):
    source = tmp_path / "synthetic.json"
    source.write_text(json.dumps(legacy()))
    paths = []
    for number in (1, 2):
        output = tmp_path / f"unrelated-{number}.backup"
        backup.export_snapshot(source=source, public_key_path=keys[1], output=output,
                               instance_id=f"not-in-approved-inventory-{number}",
                               environment={"RENDER_SERVICE_ID": "unrelated-synthetic-service",
                                            "RENDER_GIT_COMMIT": "unrelated-revision"})
        paths.append(output)
    # Existing API has no approved-ID/service/revision/age parameters. This is a
    # demonstrated review limitation, not evidence that these inputs are safe.
    snapshots = review.load_snapshots(paths, keys[0], PASSPHRASE, expected_instances=2)
    report, _ = review.reconciliation_report(snapshots, default_organization_id=47)
    assert report["status"] == "ready"


def test_weakened_named_check_constraints_are_rejected(pg):
    with database.get_database_connection() as connection:
        connection.execute("ALTER TABLE application_users DROP CONSTRAINT application_users_normalized_email")
        connection.execute("ALTER TABLE application_users ADD CONSTRAINT application_users_normalized_email CHECK (TRUE)")
    with pytest.raises(backup.OperatorError, match="schema_incompatible"):
        review.review_database(reconcile_legacy_accounts([legacy()], default_organization_id=1), **target(pg))


@pytest.mark.parametrize("value", [None, "1", 0])
def test_legacy_organization_fallback_values_require_explicit_reconciliation(value):
    # Legacy code accepts/falls back for these values; Stage 1 deliberately refuses
    # them rather than silently changing an organization's association.
    with pytest.raises(ValueError):
        reconcile_legacy_accounts([legacy(organization_id=value)], default_organization_id=47)
