"""Cross-replica redaction for transient payloads.

The active redactor is exposed via a `ContextVar` (`current_redactor`), bound
per HTTP request by `RedactorMiddleware` from `app.state.redactor`. Access via
`get_redactor()` — it raises `RedactorNotBoundError` if nothing is bound, so a
missing middleware or a call from a background task / thread pool fails loudly
instead of silently passing plaintext secrets through.

The `Redactor` key is derived from `PHOENIX_SECRET` via PBKDF2, so redacted
tokens issued by one replica are decryptable by any other replica sharing the
same secret. A domain-separating salt keeps the redaction key distinct from
`EncryptionService`'s DB-persistence key.
"""

import base64
from contextvars import ContextVar

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from starlette.datastructures import Secret

# Domain separation: redaction keys must not equal DB-encryption keys even when
# derived from the same PHOENIX_SECRET.
_REDACTION_KEY_DERIVATION_SALT = b"phoenix-redaction-2a7f1d9b4e6c8a0f2d3b5c7e9a1f4b6d"
_PBKDF2_ITERATIONS = 600_000
_FERNET_KEY_LENGTH = 32
# Leading U+E000 (Private Use Area) sentinel ensures the prefix cannot collide
# with any normal user-submitted text.
_REDACTED_PREFIX = "\ue000[REDACTED]"


class Redactor:
    """Symmetric redact/unredact keyed off PHOENIX_SECRET."""

    def __init__(self, secret: Secret) -> None:
        self._fernet = Fernet(self._derive_key(secret))

    @staticmethod
    def _derive_key(secret: Secret) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=_FERNET_KEY_LENGTH,
            salt=_REDACTION_KEY_DERIVATION_SALT,
            iterations=_PBKDF2_ITERATIONS,
        )
        key_bytes = kdf.derive(str(secret).encode("utf-8"))
        return base64.urlsafe_b64encode(key_bytes)

    def redact(self, data: str) -> str:
        if not data:
            return data
        token = self._fernet.encrypt(data.encode("utf-8")).decode("ascii")
        return f"{_REDACTED_PREFIX}{token}"

    def unredact(self, token: str) -> str:
        if not token or not token.startswith(_REDACTED_PREFIX):
            return token
        payload = token[len(_REDACTED_PREFIX) :]
        return self._fernet.decrypt(payload.encode("ascii")).decode("utf-8")


# No default — access via `get_redactor()` which raises if unbound.
current_redactor: ContextVar[Redactor] = ContextVar("current_redactor")


class RedactorNotBoundError(RuntimeError):
    """Raised when `current_redactor` is accessed outside a bound context.

    A bound context is any code path that runs under `RedactorMiddleware`.
    This error usually indicates either missing middleware registration or
    a call from a background task / thread pool that didn't copy the
    request's context. We fail loudly rather than pass through: silent
    pass-through would leak plaintext secrets on the wire.
    """


def get_redactor() -> Redactor:
    """Return the `Redactor` bound to the current request context.

    Raises:
        RedactorNotBoundError: if no redactor is bound. Indicates a missing
            `RedactorMiddleware` or a call from outside an HTTP request.
    """
    try:
        return current_redactor.get()
    except LookupError as e:
        raise RedactorNotBoundError(
            "No Redactor is bound to the current context. Ensure RedactorMiddleware "
            "is registered, or invoke through an HTTP request (not a background "
            "task or thread pool that did not copy the request's context)."
        ) from e
