import strawberry
from starlette.datastructures import Secret

SecretString = Secret

secret_string_scalar_definition = strawberry.scalar(
    name="SecretString",
    description="A secret string value.",
    serialize=lambda v: str(v),
    parse_value=lambda v: Secret(v),
)
