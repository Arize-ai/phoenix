"""Model-selection schemas for the agent ``/chat`` and ``/summary`` endpoints.

Each route's request body carries a ``model`` field whose value is the
discriminated union defined below: either a stored custom-provider record
or a Phoenix built-in provider. Variants accept both snake_case Python
attribute names and camelCase JSON aliases.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from typing_extensions import TypeAliasType

from phoenix.db.types.model_provider import ModelProvider


class CustomProviderModelSelection(BaseModel):
    """Chat against a stored custom provider record."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    provider_type: Literal["custom"]
    provider_id: str
    model_name: str


class BuiltInProviderModelSelection(BaseModel):
    """Chat against a Phoenix built-in provider.

    Credentials and connection details (base URL, Azure endpoint, AWS
    region) are resolved from the secret store first and the process
    environment second. ``openai_api_type`` is honoured by the OpenAI and
    Azure OpenAI branches; other providers ignore it.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    provider_type: Literal["builtin"]
    provider: ModelProvider
    model_name: str
    openai_api_type: Literal["chat_completions", "responses"] = "responses"


# TypeAliasType (rather than a plain ``Annotated`` alias) makes pydantic emit the
# union as a named ``AgentModelSelection`` schema component instead of inlining
# the ``oneOf`` at every use site, so generated clients can reference it by name.
AgentModelSelection = TypeAliasType(
    "AgentModelSelection",
    Annotated[
        CustomProviderModelSelection | BuiltInProviderModelSelection,
        Field(discriminator="provider_type"),
    ],
)
