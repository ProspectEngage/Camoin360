"""Offline reconciliation, read-only database review, and explicit recovery.

There is deliberately no import/apply command. Never import FastAPI or invoke
initialize_database/get_database_connection from these operator operations.
"""

import getpass
import json
import os
import sys

import psycopg
from psycopg.rows import dict_row

from backend.tools.auth_account_backup import (
    OperatorError, SafeParser, decrypt_snapshot, read_passphrase,
    require_offline_operator, write_new_file,
)
from ..services.application_user_migration import decode_legacy_snapshot, reconcile_legacy_accounts
from ..services.application_users import (
    AccountConflict, ApplicationUser, _COLUMNS, accounts_match, normalize_email,
    validate_password_hash, verify_password,
)


def reconciliation_report(snapshots, *, default_organization_id):
    """Only counts and 1-based source/record positions leave this function.

    No email, ID value, name, hash fingerprint, or source manifest is disclosed.
    Stage 1 remains the authority for account validation and reconciliation.
    """
    report = {"status": "ready", "snapshot_count": len(snapshots), "record_count": 0,
              "unique_accounts": 0, "duplicate_emails": 0, "differing_records": 0,
              "conflicting_ids": 0, "invalid_records": 0, "issues": []}
    by_email, by_id = {}, {}
    for source_index, snapshot in enumerate(snapshots, 1):
        for record_index, (email, record) in enumerate(snapshot.items(), 1):
            report["record_count"] += 1
            position = {"snapshot": source_index, "record": record_index}
            try:
                account = reconcile_legacy_accounts([{email: record}],
                                                    default_organization_id=default_organization_id)[0]
            except (ValueError, TypeError, KeyError):
                report["invalid_records"] += 1
                report["issues"].append({"kind": "invalid_record", "position": position})
                continue
            previous = by_email.get(account.email)
            if previous:
                report["duplicate_emails"] += 1
                if not accounts_match(previous[0], account):
                    report["differing_records"] += 1
                    report["issues"].append({"kind": "differing_record",
                                              "positions": [previous[1], position]})
            else:
                by_email[account.email] = (account, position)
            if account.legacy_id is not None:
                previous_id = by_id.get(account.id)
                if previous_id and previous_id[0] != account.email:
                    report["conflicting_ids"] += 1
                    report["issues"].append({"kind": "conflicting_id",
                                              "positions": [previous_id[1], position]})
                else:
                    by_id[account.id] = (account.email, position)
    report["unique_accounts"] = len(by_email)
    try:
        accounts = reconcile_legacy_accounts(snapshots, default_organization_id=default_organization_id)
        if not accounts:
            report["status"] = "blocked"
            report["issues"].append({"kind": "no_accounts"})
            accounts = None
    except (ValueError, TypeError, KeyError):
        report["status"] = "blocked"
        accounts = None
    return report, accounts


def load_snapshots(paths, private_key, passphrase, *, expected_instances):
    if expected_instances < 1 or len(paths) != expected_instances:
        raise OperatorError("snapshot_inventory_count_mismatch")
    snapshots, instances = [], set()
    for path in paths:
        raw, manifest = decrypt_snapshot(path, private_key, passphrase)
        identity = manifest.get("instance_id")
        if not isinstance(identity, str) or not identity or identity in instances:
            raise OperatorError("duplicate_or_missing_instance_identity")
        instances.add(identity)
        try:
            snapshots.append(decode_legacy_snapshot(raw))
        except (ValueError, TypeError):
            raise OperatorError("snapshot_json_invalid_or_duplicate_keys") from None
    return snapshots


def _schema_compatible(connection, expected_database, expected_schema):
    identity = connection.execute("""
        SELECT current_database() AS database,
               n.nspname AS schema, c.oid AS relation
        FROM (SELECT to_regclass('application_users') AS oid) t
        LEFT JOIN pg_class c ON c.oid = t.oid
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
    """).fetchone()
    if identity["database"] != expected_database:
        raise OperatorError("database_identity_mismatch")
    if identity["relation"] is None:
        raise OperatorError("application_users_schema_missing")
    if identity["schema"] != expected_schema:
        raise OperatorError("schema_identity_mismatch")
    from ..application_users_schema import AuthSchemaError, verify_application_users_schema
    try:
        verify_application_users_schema(connection, expected_schema=expected_schema)
    except AuthSchemaError:
        raise OperatorError("application_users_schema_incompatible") from None


def compare_accounts(expected, actual, *, verifying=False):
    expected_by_email = {account.email: account for account in expected}
    actual_by_email = {account.email: account for account in actual}
    actual_by_id = {account.id: account for account in actual}
    report = {"status": "verified" if verifying else "ready", "expected_accounts": len(expected),
              "database_accounts": len(actual), "matching_accounts": 0, "missing_accounts": 0,
              "unexpected_accounts": len(set(actual_by_email) - set(expected_by_email)),
              "identity_mismatches": 0, "email_mismatches": 0, "name_mismatches": 0,
              "role_mismatches": 0, "organization_mismatches": 0, "permission_mismatches": 0,
              "hash_mismatches": 0, "unsupported_hashes": 0}
    for account in actual:
        if normalize_email(account.email) != account.email:
            report["email_mismatches"] += 1
        try:
            validate_password_hash(account.password_hash)
        except ValueError:
            report["unsupported_hashes"] += 1
    for expected_account in expected:
        stored = actual_by_email.get(expected_account.email)
        collision = actual_by_id.get(expected_account.id) if expected_account.legacy_id is not None else None
        if collision and collision.email != expected_account.email:
            report["identity_mismatches"] += 1
        if stored is None:
            report["missing_accounts"] += 1
            continue
        if accounts_match(expected_account, stored):
            report["matching_accounts"] += 1
            continue
        if (type(expected_account.legacy_id) is not type(stored.legacy_id)
                or expected_account.legacy_id != stored.legacy_id
                or (expected_account.legacy_id is not None and expected_account.id != stored.id)):
            report["identity_mismatches"] += 1
        for name, field in [("name_mismatches", "name"), ("role_mismatches", "role"),
                            ("organization_mismatches", "organization_id"), ("permission_mismatches", "modules"),
                            ("hash_mismatches", "password_hash")]:
            report[name] += getattr(expected_account, field) != getattr(stored, field)
    problems = sum(value for key, value in report.items()
                   if key.endswith("mismatches") or key in {"unexpected_accounts", "unsupported_hashes"})
    if problems or (verifying and report["missing_accounts"]):
        report["status"] = "blocked"
    return report


def review_database(accounts, *, database_url, expected_database, expected_schema, verifying=False):
    """SELECT-only, consistent-snapshot review. Never invokes the app initializer."""
    if not database_url or not expected_database or not expected_schema:
        raise OperatorError("explicit_database_target_required")
    try:
        with psycopg.connect(database_url, row_factory=dict_row, autocommit=True, connect_timeout=5) as connection:
            with connection.transaction():
                connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
                connection.execute("SET LOCAL statement_timeout = '10s'")
                connection.execute("SET LOCAL lock_timeout = '1s'")
                _schema_compatible(connection, expected_database, expected_schema)
                rows = connection.execute(f"SELECT {_COLUMNS} FROM application_users ORDER BY email").fetchall()
                actual = [ApplicationUser.from_row(row) for row in rows]
                report = compare_accounts(accounts, actual, verifying=verifying)
                report["read_only"] = connection.execute("SHOW transaction_read_only").fetchone()["transaction_read_only"] == "on"
                return report
    except OperatorError:
        raise
    except Exception:
        # libpq errors may contain URLs or SQL parameter details.
        raise OperatorError("database_review_failed") from None


def main(argv=None):
    try:
        require_offline_operator()
        parser = SafeParser(description=__doc__)
        commands = parser.add_subparsers(dest="command", required=True, parser_class=SafeParser)
        for command in ("reconcile", "dry-run", "verify", "check-password", "recover"):
            sub = commands.add_parser(command)
            sub.add_argument("--snapshot", action="append", required=True)
            sub.add_argument("--expected-instances", type=int, required=True)
            sub.add_argument("--private-key", required=True)
            sub.add_argument("--passphrase-file")
            sub.add_argument("--default-organization-id", type=int, required=True)
            if command in {"dry-run", "verify"}:
                sub.add_argument("--database-url-env", required=True, help="Name of a securely supplied environment variable")
                sub.add_argument("--expected-database", required=True)
                sub.add_argument("--expected-schema", required=True)
            if command == "recover":
                sub.add_argument("--output", required=True)
                sub.add_argument("--allow-plaintext-recovery", action="store_true", required=True)
        args = parser.parse_args(argv)
        if args.default_organization_id < 1:
            raise OperatorError("valid_default_organization_required")
        phrase = read_passphrase(args.passphrase_file)
        snapshots = load_snapshots(args.snapshot, args.private_key, phrase, expected_instances=args.expected_instances)
        report, accounts = reconciliation_report(snapshots, default_organization_id=args.default_organization_id)
        if accounts is None:
            print(json.dumps(report))
            return 1
        if args.command in {"dry-run", "verify"}:
            report = review_database(accounts, database_url=os.environ.get(args.database_url_env),
                                     expected_database=args.expected_database, expected_schema=args.expected_schema,
                                     verifying=args.command == "verify")
        elif args.command == "check-password":
            if not sys.stdin.isatty():
                raise OperatorError("secure_password_input_required")
            email = normalize_email(getpass.getpass("Account email (hidden): "))
            password = getpass.getpass("Existing account password (hidden): ")
            account = next((a for a in accounts if a.email == email), None)
            verified = bool(account and verify_password(password, account.password_hash))
            report = {"status": "verified" if verified else "blocked", "password_verified": verified}
        elif args.command == "recover":
            if len(args.snapshot) != 1:
                raise OperatorError("single_snapshot_recovery_required")
            raw, _ = decrypt_snapshot(args.snapshot[0], args.private_key, phrase)
            write_new_file(args.output, raw)
            report = {"status": "recovery_copy_created", "account_count": len(accounts)}
        print(json.dumps(report))
        return 1 if report["status"] == "blocked" else 0
    except KeyboardInterrupt:
        print(json.dumps({"status": "interrupted"}))
        return 130
    except Exception as exc:
        reason = str(exc) if isinstance(exc, OperatorError) else "operation_failed"
        print(json.dumps({"status": "error", "reason": reason}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
