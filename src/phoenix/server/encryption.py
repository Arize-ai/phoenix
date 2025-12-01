"""Encryption utilities for sensitive data storage using Fernet.

Encrypts sensitive configuration data (API keys, OAuth tokens, credentials) stored in
the Phoenix database using Fernet (AES-128-CBC + HMAC-SHA256).

Security:
- Encryption key is derived from PHOENIX_SECRET using PBKDF2-HMAC-SHA256
- When PHOENIX_SECRET is set (required: 32 bytes, alphanumeric), security comes from
  the secret's entropy (~2^165 bits). The KDF parameters (600K iterations, fixed salt)
  provide domain separation and meet OWASP guidelines, but don't meaningfully strengthen
  security against brute force given the high-entropy input.
- When PHOENIX_SECRET is absent (installations without authentication), encryption uses
  a deterministic key from empty password. Suitable for development/trusted environments.

Threat model:
- Protects: Database backups/dumps when PHOENIX_SECRET is properly set
- Does not protect: Compromise of both database and PHOENIX_SECRET

Limitations:
- Secret key rotation requires manual re-encryption of all data
- Same secret across installations = same encryption key
"""

import base64

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from starlette.datastructures import Secret

# Salt for key derivation (public, hardcoded)
# Provides domain separation to ensure encryption keys differ from other keys that might
# be derived from PHOENIX_SECRET (e.g., JWT signing keys). Installations with identical
# secrets will derive identical encryption keys.
_ENCRYPTION_KEY_DERIVATION_SALT = b"phoenix-database-encryption-a5d354120d50240ac80b74f56d09b363"

# PBKDF2 iteration count
# Uses OWASP's 2022 recommendation (600K iterations) for password hashing. With Phoenix's
# high-entropy secrets, iterations don't meaningfully improve security, but meet standards.
# Reference: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
# Note: Changing this breaks backward compatibility (requires re-encryption of all data).
_PBKDF2_ITERATIONS = 600_000

# Fernet key length (32 bytes required by spec)
_FERNET_KEY_LENGTH = 32

# Fernet token structure constants
_FERNET_VERSION_BYTE = 0x80  # Fernet tokens always start with version byte 0x80
_FERNET_MIN_TOKEN_SIZE = (
    57  # Minimum decoded size: version(1) + timestamp(8) + IV(16) + ciphertext(>=1) + HMAC(32)
)


class EncryptionService:
    """Service for encrypting and decrypting sensitive data."""

    def __init__(self, secret: Secret | None = None) -> None:
        """Initialize encryption service."""
        # Validate and initialize Fernet
        try:
            self._fernet = Fernet(self._derive_encryption_key(secret))
        except Exception as e:
            raise ValueError(f"Failed to initialize encryption: {e}") from e

    @staticmethod
    def _derive_encryption_key(secret: Secret | None) -> bytes:
        """Derive Fernet-compatible key from secret using PBKDF2-HMAC-SHA256.

        If secret is None/empty, derives a deterministic key from empty password.
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=_FERNET_KEY_LENGTH,
            salt=_ENCRYPTION_KEY_DERIVATION_SALT,
            iterations=_PBKDF2_ITERATIONS,
        )
        key_bytes = kdf.derive(str(secret or "").encode("utf-8"))
        # Fernet expects base64-encoded key
        return base64.urlsafe_b64encode(key_bytes)

    def encrypt(self, data: bytes) -> bytes:
        """Encrypt bytes to bytes."""
        if not data:
            raise ValueError("Cannot encrypt empty bytes")

        try:
            return self._fernet.encrypt(data)
        except Exception as e:
            raise ValueError(f"Encryption failed: {e}") from e

    def decrypt(self, ciphertext: bytes) -> bytes:
        """Decrypt bytes to bytes."""
        if not ciphertext:
            raise ValueError("Cannot decrypt empty bytes")

        try:
            return self._fernet.decrypt(ciphertext)
        except InvalidToken as e:
            raise ValueError("Decryption failed: invalid token or wrong key") from e
        except Exception as e:
            raise ValueError(f"Decryption failed: {e}") from e


def is_encrypted(blob: bytes) -> bool:
    """Heuristic check for Fernet tokens based on structure (not cryptographic verification).

    Checks: base64 encoding, minimum length (76 bytes), version byte (0x80).
    May have false positives; false negatives are rare for actual Fernet data.
    """
    # Minimum base64-encoded Fernet token length: 57 bytes * 4/3 ≈ 76 chars
    min_base64_length = (_FERNET_MIN_TOKEN_SIZE * 4 + 2) // 3  # 76
    if len(blob) < min_base64_length:
        return False

    # Check for base64 encoding and proper decoded length
    if blob.endswith(b"=="):
        padding = 2
    elif blob.endswith(b"="):
        padding = 1
    else:
        padding = 0

    expected_decoded_len = (len(blob) * 3) // 4 - padding
    if expected_decoded_len < _FERNET_MIN_TOKEN_SIZE:
        return False

    # Verify Fernet version byte (first byte after base64 decode must be 0x80)
    try:
        first_bytes = base64.urlsafe_b64decode(blob[:4])
        return first_bytes[0] == _FERNET_VERSION_BYTE
    except Exception:
        # If we can't decode the first 4 characters, it's not valid base64
        return False
