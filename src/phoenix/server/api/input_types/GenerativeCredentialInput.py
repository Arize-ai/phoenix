import strawberry
from pydantic import SecretStr

from phoenix.server.api.redaction import Redacted


@strawberry.input
class GenerativeCredentialInput:
    env_var_name: str
    """The name of the environment variable to set."""
    value: Redacted[SecretStr]
    """The value of the environment variable to set."""
