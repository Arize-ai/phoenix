"""Encryption utilities for sensitive data storage using Fernet.

Security Model:
---------------
This module provides encryption-at-rest for sensitive configuration data and secrets
stored in the Phoenix database. The encryption uses Fernet (symmetric encryption based
on AES-128-CBC with HMAC authentication).

Key Derivation:
- The encryption key is derived from the Phoenix server's secret using PBKDF2-HMAC-SHA256
- A fixed public salt is used (see _ENCRYPTION_KEY_DERIVATION_SALT below)
- The salt doesn't need to be secret; its purpose is to prevent rainbow table attacks
  against the password/secret, and to ensure different installations derive different keys
- 100,000 iterations are used (OWASP recommended minimum as of 2023)

Threat Model:
- Protects against: Database dumps falling into unauthorized hands
- Does NOT protect against: Attackers who have access to both the database AND the server secret
- Key rotation: Changing the server secret will make existing encrypted data unreadable.
  There is currently no key rotation mechanism - this is a known limitation.

Usage:
- All encryption/decryption should go through the EncryptionService class
- Never store plaintext sensitive data in the database
- The is_encrypted() heuristic is a best-effort validation, not cryptographic proof
"""

import base64

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from starlette.datastructures import Secret

# Salt for key derivation
# This is intentionally public and hardcoded. Each Phoenix installation will derive
# a different key based on their unique server secret. The salt prevents rainbow
# table attacks and ensures key uniqueness across installations.
_ENCRYPTION_KEY_DERIVATION_SALT = b"phoenix-database-encryption-a5d354120d50240ac80b74f56d09b363"

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
        """Derive Fernet-compatible key from secret using PBKDF2-HMAC-SHA256."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,  # 32 bytes for Fernet
            salt=_ENCRYPTION_KEY_DERIVATION_SALT,
            iterations=100000,  # OWASP recommended minimum
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
    """Heuristic check to determine if a blob appears to be a Fernet-encrypted token.

    IMPORTANT: This is a best-effort validation, NOT cryptographic verification.
    It checks for structural characteristics of Fernet tokens:
    - Base64 encoding
    - Minimum length (Fernet tokens are at least 57 bytes decoded, ~76 bytes base64)
    - Version byte (0x80)

    False positives: Random data that happens to match the pattern
    False negatives: Should be rare if the data is actually Fernet-encrypted

    Args:
        blob: The bytes to check

    Returns:
        True if the blob appears to be Fernet-encrypted, False otherwise
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
