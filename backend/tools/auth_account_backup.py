"""Standalone public-key account backup. Safe to copy to an existing instance.

Dependencies: Python and cryptography (already in backend requirements).
Never imports application modules, reads environment secrets, or contacts a DB.
"""

import argparse
import base64
from datetime import datetime, timezone
import getpass
import hashlib
import json
import os
from pathlib import Path
import secrets
import stat
import sys
import tempfile

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


FORMAT = "camoin360-auth-backup-v1"
# Account mappings should be small. Bound memory use on the live web instance.
MAX_SOURCE_BYTES = 8 * 1024 * 1024
MAX_BACKUP_BYTES = 32 * 1024 * 1024


class OperatorError(ValueError):
    """Only fixed, nonsensitive error codes may reach the CLI."""


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        # argparse normally echoes arbitrary arguments, including malformed input.
        raise OperatorError("invalid_arguments")


def read_file(path, *, limit=MAX_BACKUP_BYTES, private=False):
    """No symlinks, devices, or unbounded reads; no path in error messages."""
    try:
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(descriptor, "rb") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode):
                raise OperatorError("regular_file_required")
            if private and (info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077):
                raise OperatorError("private_file_permissions_required")
            if info.st_size > limit:
                raise OperatorError("file_too_large")
            payload = stream.read(limit + 1)
            if len(payload) > limit:
                raise OperatorError("file_too_large")
            return payload
    except OSError:
        raise OperatorError("file_unreadable") from None


def secure_directory(path):
    try:
        info = Path(path).stat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
            raise OperatorError("private_output_directory_required")
    except OSError:
        raise OperatorError("private_output_directory_required") from None


def write_new_file(path, payload):
    """Publish a complete 0600 file atomically, without replacing ANY existing path."""
    path = Path(path)
    secure_directory(path.parent)
    temporary = None
    try:
        descriptor, temporary = tempfile.mkstemp(prefix=".c360-backup-", dir=path.parent)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.link(temporary, path)  # Atomic no-clobber publication, including symlinks.
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    except FileExistsError:
        raise OperatorError("output_already_exists") from None
    except OSError:
        raise OperatorError("output_write_failed") from None
    finally:
        if temporary is not None:
            os.unlink(temporary)


def read_passphrase(path=None):
    if path is not None:
        phrase = read_file(path, private=True, limit=4096).rstrip(b"\r\n")
    else:
        if not sys.stdin.isatty():
            raise OperatorError("secure_passphrase_input_required")
        phrase = getpass.getpass("Backup key passphrase (hidden): ").encode()
    if len(phrase) < 12:
        raise OperatorError("passphrase_too_short")
    return phrase


def require_offline_operator():
    if os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID") or os.getenv("RENDER_INSTANCE_ID"):
        raise OperatorError("private_key_operations_must_run_off_render")


def generate_keys(private_path, public_path, passphrase):
    if len(passphrase) < 12:
        raise OperatorError("passphrase_too_short")
    if Path(private_path).absolute() == Path(public_path).absolute():
        raise OperatorError("distinct_key_paths_required")
    # Check destinations before generating or publishing either key.
    for path in (private_path, public_path):
        secure_directory(Path(path).parent)
        if os.path.lexists(path):
            raise OperatorError("output_already_exists")
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.BestAvailableEncryption(passphrase))
    public = key.public_key().public_bytes(serialization.Encoding.PEM,
                                           serialization.PublicFormat.SubjectPublicKeyInfo)
    write_new_file(private_path, private)
    write_new_file(public_path, public)


def _b64(value):
    return base64.b64encode(value).decode("ascii")


def _unb64(value):
    return base64.b64decode(value, validate=True)


def capture_source(source):
    """Two independent reads detect in-place writes and atomic replacements.

    Final captures still require an operator account-write freeze. Reads can
    update atime under filesystem policy but never write source contents.
    """
    try:
        before = os.stat(source, follow_symlinks=False)
        first = read_file(source, limit=MAX_SOURCE_BYTES)
        second = read_file(source, limit=MAX_SOURCE_BYTES)
        after = os.stat(source, follow_symlinks=False)
        signature = lambda item: (item.st_dev, item.st_ino, item.st_size, item.st_mtime_ns, item.st_ctime_ns)
        if first != second or signature(before) != signature(after):
            raise OperatorError("source_changed_during_capture")
        return first
    except OSError:
        raise OperatorError("source_unreadable") from None


def export_snapshot(*, source, public_key_path, output, instance_id, environment=None):
    environment = os.environ if environment is None else environment
    actual_instance = environment.get("RENDER_INSTANCE_ID")
    if not isinstance(instance_id, str) or not instance_id.strip():
        raise OperatorError("instance_identity_required")
    if actual_instance and actual_instance != instance_id:
        raise OperatorError("instance_identity_mismatch")
    try:
        public = serialization.load_pem_public_key(read_file(public_key_path, limit=65536))
        if not isinstance(public, rsa.RSAPublicKey) or public.key_size < 3072:
            raise OperatorError("rsa_3072_public_key_required")
        raw = capture_source(source)
        # Preserve original bytes, even corrupt JSON, for recovery/forensics.
        # Semantic validation is exclusively the Stage 1 migration helper's job.
        content = json.dumps({
            "format": FORMAT, "captured_at": datetime.now(timezone.utc).isoformat(),
            "instance_id": instance_id, "service_id": environment.get("RENDER_SERVICE_ID"),
            "revision": environment.get("RENDER_GIT_COMMIT"), "source_path": str(Path(source).absolute()),
            "source_sha256": hashlib.sha256(raw).hexdigest(), "source_bytes": _b64(raw),
        }).encode()
        aes_key, nonce = secrets.token_bytes(32), secrets.token_bytes(12)
        wrapped = public.encrypt(aes_key, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),
                                                       algorithm=hashes.SHA256(), label=FORMAT.encode()))
        encrypted = AESGCM(aes_key).encrypt(nonce, content, FORMAT.encode())
        envelope = json.dumps({"format": FORMAT, "wrapped_key": _b64(wrapped),
                               "nonce": _b64(nonce), "ciphertext": _b64(encrypted)}).encode()
        if len(envelope) > MAX_BACKUP_BYTES:
            raise OperatorError("file_too_large")
        write_new_file(output, envelope)
    except OperatorError:
        raise
    except Exception:
        raise OperatorError("backup_encryption_failed") from None
    return {"status": "encrypted_backup_created", "source_bytes": len(raw)}


def decrypt_snapshot(path, private_key_path, passphrase):
    """Return decrypted bytes/manifest in memory only. Never log the result."""
    try:
        key = serialization.load_pem_private_key(read_file(private_key_path, private=True, limit=65536),
                                                  password=passphrase)
        if not isinstance(key, rsa.RSAPrivateKey) or key.key_size < 3072:
            raise OperatorError("rsa_3072_private_key_required")
        envelope = json.loads(read_file(path))
        if set(envelope) != {"format", "wrapped_key", "nonce", "ciphertext"} or envelope["format"] != FORMAT:
            raise OperatorError("invalid_backup_format")
        aes_key = key.decrypt(_unb64(envelope["wrapped_key"]), padding.OAEP(
            mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=FORMAT.encode()))
        content = AESGCM(aes_key).decrypt(_unb64(envelope["nonce"]), _unb64(envelope["ciphertext"]), FORMAT.encode())
        manifest = json.loads(content)
        raw = _unb64(manifest.pop("source_bytes"))
        if (manifest["format"] != FORMAT or len(raw) > MAX_SOURCE_BYTES
                or hashlib.sha256(raw).hexdigest() != manifest["source_sha256"]):
            raise OperatorError("backup_integrity_failed")
        return raw, manifest
    except OperatorError:
        raise
    except Exception:
        raise OperatorError("backup_decryption_or_integrity_failed") from None


def main(argv=None):
    try:
        parser = SafeParser(description=__doc__)
        commands = parser.add_subparsers(dest="command", required=True, parser_class=SafeParser)
        keygen = commands.add_parser("keygen", help="Generate encrypted private key on the operator workstation")
        keygen.add_argument("--private-key", required=True)
        keygen.add_argument("--public-key", required=True)
        keygen.add_argument("--passphrase-file")
        export = commands.add_parser("export", help="Encrypt a stable copy without changing the source")
        export.add_argument("--source", required=True)
        export.add_argument("--public-key", required=True)
        export.add_argument("--output", required=True)
        export.add_argument("--instance-id", required=True)
        args = parser.parse_args(argv)
        if args.command == "keygen":
            require_offline_operator()
            phrase = read_passphrase(args.passphrase_file)
            if args.passphrase_file is None and getpass.getpass("Confirm passphrase (hidden): ").encode() != phrase:
                raise OperatorError("passphrase_confirmation_mismatch")
            generate_keys(args.private_key, args.public_key, phrase)
            report = {"status": "backup_keys_created"}
        else:
            report = export_snapshot(source=args.source, public_key_path=args.public_key,
                                     output=args.output, instance_id=args.instance_id)
        print(json.dumps(report))
        return 0
    except KeyboardInterrupt:
        print(json.dumps({"status": "interrupted"}))
        return 130
    except Exception as exc:
        reason = str(exc) if isinstance(exc, OperatorError) else "operation_failed"
        print(json.dumps({"status": "error", "reason": reason}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
