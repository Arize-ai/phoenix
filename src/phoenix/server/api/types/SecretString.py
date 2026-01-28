import strawberry
from starlette.datastructures import Secret

SecretString = strawberry.scalar(
    Secret,
    name="SecretString",
    description="A secret string value.",
    serialize=lambda v: str(v),
    parse_value=lambda v: Secret(v),
)
