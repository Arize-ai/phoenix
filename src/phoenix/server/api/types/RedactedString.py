from typing import NewType

import strawberry

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.redaction import RedactorNotBoundError, get_redactor

# NewType (not an alias) so StrawberryConfig.scalar_map can distinguish this
# from a plain `str` and wire the custom serialize/parse_value below.
RedactedString = NewType("RedactedString", str)


def _parse_value(v: object) -> str:
    try:
        return get_redactor().unredact(str(v))
    except RedactorNotBoundError:
        # Don't swallow — this is a configuration bug, not a user input problem.
        raise
    except Exception:
        raise BadRequest(
            "Invalid redacted string. Please fetch the correct redacted value from the server."
        )


redacted_string_scalar_definition = strawberry.scalar(
    name="RedactedString",
    description=(
        "A string encrypted on output and decrypted on input using a key derived from "
        "the deployment seed and PHOENIX_SECRET. Values remain valid across replicas "
        "and restarts while both are unchanged."
    ),
    serialize=lambda v: get_redactor().redact(str(v)),
    parse_value=_parse_value,
)
