import strawberry

from phoenix.server.api.types.SecretString import SecretString


@strawberry.input
class GenerativeCredentialInput:
    env_var_name: str
    """The name of the environment variable to set."""
    value: SecretString
    """The value of the environment variable to set."""
