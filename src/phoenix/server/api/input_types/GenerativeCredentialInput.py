import strawberry


@strawberry.input
class GenerativeCredentialInput:
    env_var_name: str
    """The name of the environment variable to set."""
    value: str
    """The value of the environment variable to set."""
