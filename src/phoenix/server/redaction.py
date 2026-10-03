"""Cross-replica redaction for transient payloads.

The active redactor is exposed via a `ContextVar` (`current_redactor`), bound
per HTTP request by `RedactorMiddleware` from `app.state.redactor`. Access via
`get_redactor()` — it raises `RedactorNotBoundError` if nothing is bound, so a
missing middleware or a call from a background task / thread pool fails loudly
instead of silently passing plaintext secrets through.

The `Redactor` key is derived from the deployment seed and `PHOENIX_SECRET`,
so redacted values stay valid across replicas and restarts as long as both
are unchanged.

Redacted strings optionally carry the last 4 characters of the plaintext as
a preview, so the UI can hint at which key is stored without revealing the
whole value. The preview is only emitted when the plaintext is at least 32
characters; shorter values get no preview so the leak stays proportionate.
Previews persist wherever redacted strings do (logs, screenshots, support
tickets), so the full secret remains confidential but partial end-of-string
leaks are expected by design.
"""

import base64
from contextvars import ContextVar

from cryptography.fernet import Fernet

_FERNET_KEY_LENGTH = 32

# U+E000 (Private Use Area) as a universal delimiter. Unassigned in Unicode
# and not produced by keyboards/editors, so it can't appear in legitimate
# user-submitted text. Format on the wire is three delimited segments
# followed by the Fernet token:
#   <DELIM>REDACTED<DELIM><preview><DELIM><fernet-token>
# Examples:
#   \ue000REDACTED\ue000\ue000gAAAA...        (preview omitted)
#   \ue000REDACTED\ue000wxyz\ue000gAAAA...    (preview embedded, last 4 chars)
_DELIM = "\ue000"
_MARKER = "REDACTED"
_PREVIEW_TAIL = 4
# Don't include a preview unless the plaintext is at least this long. At 32
# chars the 4-char tail preview leaks 12.5% of the string.
_MIN_LEN_FOR_PREVIEW = 32
_WIRE_PREFIX = f"{_DELIM}{_MARKER}{_DELIM}"


class Redactor:
    """Symmetric redact/unredact with the deployment redaction key."""

    def __init__(self, key: bytes) -> None:
        if len(key) != _FERNET_KEY_LENGTH:
            raise ValueError("redaction key must be 32 bytes")
        self._fernet = Fernet(base64.urlsafe_b64encode(key))

    @staticmethod
    def _build_preview(data: str) -> str:
        """Return the last N chars of plaintext, or empty when not safe/eligible.

        Presentation (ellipsis, dots, mask glyphs) is the frontend's responsibility.
        """
        if len(data) < _MIN_LEN_FOR_PREVIEW:
            return ""
        tail = data[-_PREVIEW_TAIL:]
        # The only character that would break the wire-format parser is the
        # delimiter itself. PUA can't appear in legitimate keys, but guard
        # defensively anyway.
        if _DELIM in tail:
            return ""
        return tail

    def redact(self, data: str) -> str:
        if not data:
            return data
        token = self._fernet.encrypt(data.encode("utf-8")).decode("ascii")
        preview = self._build_preview(data)
        return f"{_WIRE_PREFIX}{preview}{_DELIM}{token}"

    def unredact(self, token: str) -> str:
        if not token.startswith(_WIRE_PREFIX):
            return token
        rest = token[len(_WIRE_PREFIX) :]
        _, sep, payload = rest.partition(_DELIM)
        if not sep or not payload:
            return token
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
