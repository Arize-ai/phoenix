import strawberry
from pydantic import SecretStr


@strawberry.input
class GenerativeCredentialInput:
    env_var_name: str
    """The name of the environment variable to set."""
    value: SecretStr
    """The value of the environment variable to set."""
