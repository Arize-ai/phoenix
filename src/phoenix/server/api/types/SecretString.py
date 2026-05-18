import strawberry
from pydantic import SecretStr

secret_string_scalar_definition = strawberry.scalar(
    name="SecretString",
    description="A secret string value.",
    serialize=lambda v: v.get_secret_value() if isinstance(v, SecretStr) else str(v),
    parse_value=lambda v: SecretStr(v),
)
