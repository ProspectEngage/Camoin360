"""Synthetic backups and disposable PostgreSQL only. No production snapshots."""

import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
from unittest.mock import patch

import psycopg
from psycopg.conninfo import conninfo_to_dict
import pytest

from backend.app import database
from backend.app.services import application_users as users
from backend.app.services.application_user_migration import reconcile_legacy_accounts
from backend.app.services.test_application_users import pg, legacy  # Reuse isolated Stage 1 fixture.
from backend.app.workers import application_user_migration as review
from backend.tools import auth_account_backup as backup


PASSPHRASE = b"synthetic-backup-passphrase"


@pytest.fixture(scope="module")
def keys(tmp_path_factory):
    directory = tmp_path_factory.mktemp("auth-backup-keys")
    directory.chmod(0o700)
    private, public = directory / "private.pem", directory / "public.pem"
    backup.generate_keys(private, public, PASSPHRASE)
    return private, public


@pytest.fixture
def snapshot(tmp_path, keys):
    tmp_path.chmod(0o700)
    raw = json.dumps(legacy(), indent=2).encode() + b"\n"
    source, output = tmp_path / "source.json", tmp_path / "instance.backup"
    source.write_bytes(raw)
    backup.export_snapshot(source=source, public_key_path=keys[1], output=output,
                           instance_id="synthetic-instance-a", environment={})
    return source, output, raw


def args(command, snapshot, keys, tmp_path):
    phrase = tmp_path / "passphrase"
    if not phrase.exists():
        phrase.write_bytes(PASSPHRASE)
        phrase.chmod(0o600)
    return [command, "--snapshot", str(snapshot), "--expected-instances", "1", "--private-key", str(keys[0]),
            "--passphrase-file", str(phrase), "--default-organization-id", "1"]


def target(pg):
    info = conninfo_to_dict(pg)
    return {"database_url": pg, "expected_database": info["dbname"],
            "expected_schema": info["options"].split("=", 1)[1]}


def accounts(source=None):
    return reconcile_legacy_accounts([source or legacy()], default_organization_id=1)


def test_encrypted_round_trip_preserves_all_source_bytes_and_private_metadata(snapshot, keys):
    source, encrypted, raw = snapshot
    before = source.stat()
    restored, manifest = backup.decrypt_snapshot(encrypted, keys[0], PASSPHRASE)
    assert restored == raw == source.read_bytes()
    assert source.stat().st_mtime_ns == before.st_mtime_ns
    assert manifest["source_sha256"] == hashlib.sha256(raw).hexdigest()
    assert manifest["instance_id"] == "synthetic-instance-a"
    assert stat.S_IMODE(encrypted.stat().st_mode) == 0o600
    assert stat.S_IMODE(keys[0].stat().st_mode) == 0o600
    ciphertext = encrypted.read_bytes()
    for secret in [b"jane@example.com", b"Existing User", legacy()["jane@example.com"]["password"].encode()]:
        assert secret not in ciphertext


def test_standalone_export_runs_without_application_modules(tmp_path, keys):
    tmp_path.chmod(0o700)
    script = tmp_path / "standalone.py"
    shutil.copyfile(backup.__file__, script)
    source = tmp_path / "users.json"
    source.write_text(json.dumps(legacy()))
    environment = {k: v for k, v in os.environ.items() if k not in {"PYTHONPATH", "RENDER_INSTANCE_ID"}}
    result = subprocess.run([sys.executable, "-B", str(script), "export", "--source", str(source),
                             "--public-key", str(keys[1]), "--output", str(tmp_path / "backup"),
                             "--instance-id", "synthetic-instance"], cwd=tmp_path,
                            env=environment, capture_output=True, text=True, check=True)
    assert json.loads(result.stdout)["status"] == "encrypted_backup_created"
    assert result.stderr == ""
    assert "jane@example.com" not in result.stdout


def test_export_checks_actual_instance_identity_without_touching_source(snapshot, keys, tmp_path):
    source, _, raw = snapshot
    with pytest.raises(backup.OperatorError, match="instance_identity_mismatch"):
        backup.export_snapshot(source=source, public_key_path=keys[1], output=tmp_path / "different",
                               instance_id="wrong", environment={"RENDER_INSTANCE_ID": "actual"})
    assert source.read_bytes() == raw
    assert not (tmp_path / "different").exists()


def test_export_refuses_overwriting_original_or_existing_backup(snapshot, keys):
    source, encrypted, raw = snapshot
    for output in [source, encrypted]:
        original = output.read_bytes()
        with pytest.raises(backup.OperatorError, match="output_already_exists"):
            backup.export_snapshot(source=source, public_key_path=keys[1], output=output,
                                   instance_id="synthetic", environment={})
        assert output.read_bytes() == original
    assert source.read_bytes() == raw


def test_symlinks_and_insecure_destinations_fail_closed(snapshot, keys, tmp_path):
    source, _, raw = snapshot
    link = tmp_path / "source-link"
    link.symlink_to(source)
    with pytest.raises(backup.OperatorError):
        backup.capture_source(link)
    public_directory = tmp_path / "insecure"
    public_directory.mkdir(mode=0o755)
    with pytest.raises(backup.OperatorError, match="private_output_directory_required"):
        backup.export_snapshot(source=source, public_key_path=keys[1], output=public_directory / "backup",
                               instance_id="synthetic", environment={})
    assert source.read_bytes() == raw


def test_changed_source_is_not_exported(snapshot):
    source, _, _ = snapshot
    with patch.object(backup, "read_file", side_effect=[b"first", b"changed"]):
        with pytest.raises(backup.OperatorError, match="source_changed_during_capture"):
            backup.capture_source(source)


def test_interrupted_export_does_not_publish_partial_backup(snapshot, keys, tmp_path):
    source, _, raw = snapshot
    output = tmp_path / "interrupted"
    with patch.object(backup.os, "link", side_effect=KeyboardInterrupt):
        with pytest.raises(KeyboardInterrupt):
            backup.export_snapshot(source=source, public_key_path=keys[1], output=output,
                                   instance_id="synthetic", environment={})
    assert not output.exists()
    assert not list(tmp_path.glob(".c360-backup-*"))
    assert source.read_bytes() == raw


@pytest.mark.parametrize("raw", [b"corrupted-json", b'{"same": {}, "same": {}}', b"[]"])
def test_corrupted_json_is_preserved_encrypted_but_blocked_for_migration(raw, keys, tmp_path):
    tmp_path.chmod(0o700)
    source, output = tmp_path / "source", tmp_path / "backup"
    source.write_bytes(raw)
    backup.export_snapshot(source=source, public_key_path=keys[1], output=output,
                           instance_id="synthetic", environment={})
    assert backup.decrypt_snapshot(output, keys[0], PASSPHRASE)[0] == raw
    with pytest.raises(backup.OperatorError, match="snapshot_json_invalid_or_duplicate_keys"):
        review.load_snapshots([output], keys[0], PASSPHRASE, expected_instances=1)


def test_wrong_passphrase_tampering_and_bad_private_permissions(snapshot, keys, tmp_path):
    _, encrypted, _ = snapshot
    with pytest.raises(backup.OperatorError):
        backup.decrypt_snapshot(encrypted, keys[0], b"wrong-test-passphrase")
    envelope = json.loads(encrypted.read_bytes())
    envelope["ciphertext"] = envelope["ciphertext"][::-1]
    corrupted = tmp_path / "tampered"
    corrupted.write_text(json.dumps(envelope))
    with pytest.raises(backup.OperatorError):
        backup.decrypt_snapshot(corrupted, keys[0], PASSPHRASE)
    bad_private = tmp_path / "readable-private.pem"
    bad_private.write_bytes(keys[0].read_bytes())
    bad_private.chmod(0o644)
    with pytest.raises(backup.OperatorError, match="private_file_permissions_required"):
        backup.decrypt_snapshot(encrypted, bad_private, PASSPHRASE)


def test_snapshot_inventory_rejects_missing_and_duplicate_instances(snapshot, keys):
    _, encrypted, _ = snapshot
    with pytest.raises(backup.OperatorError, match="snapshot_inventory_count_mismatch"):
        review.load_snapshots([encrypted], keys[0], PASSPHRASE, expected_instances=2)
    with pytest.raises(backup.OperatorError, match="duplicate_or_missing_instance_identity"):
        review.load_snapshots([encrypted, encrypted], keys[0], PASSPHRASE, expected_instances=2)


def test_missing_source_does_not_create_an_empty_store(keys, tmp_path):
    source = tmp_path / "missing-users.json"
    output = tmp_path / "not-a-backup"
    with pytest.raises(backup.OperatorError, match="source_unreadable"):
        backup.export_snapshot(source=source, public_key_path=keys[1], output=output,
                               instance_id="synthetic", environment={})
    assert not source.exists()
    assert not output.exists()
    report, reconciled = review.reconciliation_report([{}], default_organization_id=1)
    assert report["status"] == "blocked"
    assert reconciled is None


def test_reconciliation_reports_duplicate_emails_and_conflicting_records_without_identifiers():
    source = legacy()
    report, reconciled = review.reconciliation_report([source, copy.deepcopy(source)], default_organization_id=1)
    assert report["duplicate_emails"] == 1
    assert report["status"] == "ready"
    assert len(reconciled) == 1
    conflict = legacy(role="user")
    report, reconciled = review.reconciliation_report([source, conflict], default_organization_id=1)
    assert report["differing_records"] == 1
    assert report["status"] == "blocked"
    assert reconciled is None
    assert report["issues"][0]["positions"] == [{"snapshot": 1, "record": 1}, {"snapshot": 2, "record": 1}]
    assert "jane@example.com" not in json.dumps(report)
    assert "stable-legacy-id" not in json.dumps(report)
    assert source["jane@example.com"]["password"] not in json.dumps(report)


def test_reconciliation_reports_id_collisions_and_invalid_records():
    report, _ = review.reconciliation_report([legacy(), legacy("other@example.com")], default_organization_id=1)
    assert report["conflicting_ids"] == 1
    assert report["status"] == "blocked"
    report, _ = review.reconciliation_report([legacy(password="not-a-hash")], default_organization_id=1)
    assert report["invalid_records"] == 1


@pytest.mark.parametrize("change", [{"name": "bad\x00text"}, {"modules": ["bad\ud800text"]},
                                     {"id": "bad\x00id"}, {"password": "bad\x00salt:" + "0" * 64}])
def test_dry_run_blocks_text_that_postgresql_cannot_store(change):
    report, reconciled = review.reconciliation_report([legacy(**change)], default_organization_id=1)
    assert report["invalid_records"] == 1
    assert report["status"] == "blocked"
    assert reconciled is None


def test_empty_database_dry_run_uses_only_read_only_queries(pg):
    with patch.object(database, "initialize_database", side_effect=AssertionError("Initializer forbidden")), \
            patch.object(users, "import_accounts", side_effect=AssertionError("Import forbidden")):
        report = review.review_database(accounts(), **target(pg))
    assert report["status"] == "ready"
    assert report["read_only"] is True
    assert report["missing_accounts"] == 1
    assert users.list_users() == []


def test_post_import_verification_includes_hash_and_legacy_password_compatibility(pg):
    expected = accounts()
    users.import_accounts(expected)
    report = review.review_database(expected, verifying=True, **target(pg))
    assert report["status"] == "verified"
    assert report["matching_accounts"] == 1
    assert report["hash_mismatches"] == report["unsupported_hashes"] == 0
    assert users.authenticate("jane@example.com", "existing-password") is not None


def test_two_instance_capture_cli_dry_run_and_post_import_verification(pg, snapshot, keys, tmp_path, capsys, monkeypatch):
    source_a, encrypted_a, raw_a = snapshot
    source_b, encrypted_b = tmp_path / "second-source.json", tmp_path / "second.backup"
    mapping = {**legacy(), **legacy("second@example.com", id="second-id", role="user")}
    raw_b = json.dumps(mapping).encode()
    source_b.write_bytes(raw_b)
    backup.export_snapshot(source=source_b, public_key_path=keys[1], output=encrypted_b,
                           instance_id="synthetic-instance-b", environment={})
    snapshots = review.load_snapshots([encrypted_a, encrypted_b], keys[0], PASSPHRASE, expected_instances=2)
    report, merged = review.reconciliation_report(snapshots, default_organization_id=1)
    assert report["duplicate_emails"] == 1
    assert report["unique_accounts"] == 2
    monkeypatch.setenv("SYNTHETIC_REVIEW_URL", pg)
    command = args("dry-run", encrypted_a, keys, tmp_path)
    command[command.index("--expected-instances") + 1] = "2"
    command.extend(["--snapshot", str(encrypted_b), "--database-url-env", "SYNTHETIC_REVIEW_URL",
                    "--expected-database", target(pg)["expected_database"],
                    "--expected-schema", target(pg)["expected_schema"]])
    assert review.main(command) == 0
    dry_run = json.loads(capsys.readouterr().out)
    assert dry_run["missing_accounts"] == 2
    assert dry_run["read_only"] is True
    assert users.list_users() == []
    users.import_accounts(merged)  # Synthetic local rehearsal, never a CLI apply.
    command[0] = "verify"
    assert review.main(command) == 0
    verification = json.loads(capsys.readouterr().out)
    assert verification["status"] == "verified"
    assert verification["matching_accounts"] == 2
    assert source_a.read_bytes() == raw_a
    assert source_b.read_bytes() == raw_b


def test_verification_detects_missing_extra_and_differing_account_fields(pg):
    expected = accounts()
    assert review.review_database(expected, verifying=True, **target(pg))["status"] == "blocked"
    users.import_accounts(expected)
    users.create_user(name="Other", email="other@example.com", password="synthetic-password", organization_id=1)
    with database.get_database_connection() as connection:
        connection.execute("""UPDATE application_users SET name = 'Changed', role = 'user', organization_id = 2,
                           modules = '{}', password_hash = 'bad' WHERE email = ?""", (expected[0].email,))
    report = review.review_database(expected, verifying=True, **target(pg))
    assert report["status"] == "blocked"
    for key in ["unexpected_accounts", "name_mismatches", "role_mismatches", "organization_mismatches",
                "permission_mismatches", "hash_mismatches", "unsupported_hashes"]:
        assert report[key] == 1


def test_verification_rejects_reassigned_ids_and_wrong_database_or_schema(pg):
    expected = accounts()
    users.import_accounts(expected)
    with database.get_database_connection() as connection:
        connection.execute("UPDATE application_users SET id = 'reassigned'")
    assert review.review_database(expected, verifying=True, **target(pg))["identity_mismatches"] == 1
    for setting in ["expected_database", "expected_schema"]:
        with pytest.raises(backup.OperatorError, match="identity_mismatch"):
            review.review_database(expected, **{**target(pg), setting: "wrong"})


def test_dry_run_detects_incompatible_schema_without_creating_or_repairing_it(pg):
    with database.get_database_connection() as connection:
        connection.execute("ALTER TABLE application_users DROP CONSTRAINT application_users_email_key")
    with pytest.raises(backup.OperatorError, match="schema_incompatible"):
        review.review_database(accounts(), **target(pg))
    with database.get_database_connection() as connection:
        connection.execute("DROP TABLE application_auth_bootstrap")
        connection.execute("DROP TABLE application_users")
    with pytest.raises(backup.OperatorError, match="schema_missing"):
        review.review_database(accounts(), **target(pg))
    with psycopg.connect(pg) as connection:
        assert connection.execute("SELECT to_regclass('application_users')").fetchone()[0] is None


def test_interrupted_real_import_rolls_back_all_accounts(pg):
    def interrupted():
        yield accounts()[0]
        raise KeyboardInterrupt
    with pytest.raises(KeyboardInterrupt):
        users.import_accounts(interrupted())
    assert users.list_users() == []


def test_conflicting_real_import_rolls_back_without_mutating_previous_accounts(pg):
    existing = accounts()
    users.import_accounts(existing)
    attempted = accounts(legacy("new@example.com", id="new")) + accounts(legacy(role="user"))
    with pytest.raises(users.AccountConflict):
        users.import_accounts(attempted)
    assert users.list_users() == existing


def test_recovery_is_explicit_exact_and_never_overwrites(snapshot, keys, tmp_path, capsys):
    source, encrypted, raw = snapshot
    command = args("recover", encrypted, keys, tmp_path)
    destination = tmp_path / "recovered.json"
    assert review.main(command + ["--output", str(destination)]) == 2
    assert not destination.exists()
    assert review.main(command + ["--output", str(destination), "--allow-plaintext-recovery"]) == 0
    assert destination.read_bytes() == raw
    assert stat.S_IMODE(destination.stat().st_mode) == 0o600
    assert review.main(command + ["--output", str(source), "--allow-plaintext-recovery"]) == 2
    assert source.read_bytes() == raw
    output = capsys.readouterr()
    assert "jane@example.com" not in output.out + output.err
    assert legacy()["jane@example.com"]["password"] not in output.out + output.err


def test_cli_never_echoes_malformed_arguments_or_driver_errors(snapshot, keys, tmp_path, capsys, monkeypatch):
    _, encrypted, _ = snapshot
    assert review.main(["--arbitrary-secret-material"]) == 2
    command = args("dry-run", encrypted, keys, tmp_path) + ["--database-url-env", "SYNTHETIC_REVIEW_URL",
                "--expected-database", "synthetic", "--expected-schema", "public"]
    monkeypatch.setenv("SYNTHETIC_REVIEW_URL", "synthetic-password-and-url")
    with patch.object(review.psycopg, "connect", side_effect=RuntimeError("driver leaked synthetic-password-and-url")):
        assert review.main(command) == 2
    output = capsys.readouterr()
    for secret in ["arbitrary-secret-material", "synthetic-password-and-url", "jane@example.com"]:
        assert secret not in output.out + output.err
    assert output.err == ""


def test_private_key_operations_blocked_on_render(monkeypatch, capsys):
    monkeypatch.setenv("RENDER", "true")
    assert review.main(["reconcile"]) == 2
    assert backup.main(["keygen", "--private-key", "unused", "--public-key", "unused"]) == 2
    assert "private_key_operations_must_run_off_render" in capsys.readouterr().out


def test_interactive_password_check_uses_legacy_verifier_without_disclosure(snapshot, keys, tmp_path, capsys):
    _, encrypted, _ = snapshot
    with patch.object(sys.stdin, "isatty", return_value=True), \
            patch.object(review.getpass, "getpass", side_effect=["jane@example.com", "existing-password"]):
        assert review.main(args("check-password", encrypted, keys, tmp_path)) == 0
    output = capsys.readouterr()
    assert json.loads(output.out)["password_verified"] is True
    assert "jane@example.com" not in output.out
    assert "existing-password" not in output.out
