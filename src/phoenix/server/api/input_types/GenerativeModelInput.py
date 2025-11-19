from typing import TYPE_CHECKING, Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.exceptions import BadRequest, CustomGraphQLError
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

if TYPE_CHECKING:
    from phoenix.server.api.helpers.playground_clients import PlaygroundStreamingClient


@strawberry.input
class GenerativeModelBultinProviderInput:
    provider_key: GenerativeProviderKey
    name: str
    """ The name of the model. Or the Deployment Name for Azure OpenAI models. """
    base_url: Optional[str] = UNSET
    """ The base URL to use for the model. """
    endpoint: Optional[str] = UNSET
    """ The endpoint to use for the model. Only required for Azure OpenAI models. """
    api_version: Optional[str] = UNSET
    """ The API version to use for the model. """
    region: Optional[str] = UNSET
    """ The region to use for the model. """
    custom_headers: Optional[JSON] = UNSET
    """ Custom headers to use for the model. """
    credentials: Optional[list[GenerativeCredentialInput]] = UNSET

    def get_playground_client(self) -> "PlaygroundStreamingClient":
        from phoenix.server.api.helpers.playground_clients import PlaygroundClientCredential

        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(self.provider_key, self.name)
        if llm_client_class is None:
            raise BadRequest(f"Unknown LLM provider: '{self.provider_key.value}'")
        try:
            # Convert GraphQL credentials to PlaygroundCredential objects
            playground_credentials = None
            if self.credentials:
                playground_credentials = [
                    PlaygroundClientCredential(env_var_name=cred.env_var_name, value=cred.value)
                    for cred in self.credentials
                ]

            return llm_client_class(
                model=self,
                credentials=playground_credentials,
            )
        except CustomGraphQLError:
            raise
        except Exception as error:
            raise BadRequest(
                f"Failed to connect to LLM API for {self.provider_key.value} {self.name}: "
                f"{str(error)}"
            )


@strawberry.input
class GenerativeModelCustomProviderInput:
    provider_id: Optional[GlobalID] = UNSET
    model_name: Optional[str] = UNSET
    """The name of the model. Not the deployment name for Azure."""
    extra_headers: Optional[JSON] = UNSET
    """Extra headers to use for the requests. """


@strawberry.input(one_of=True)
class GenerativeModelInput:
    builtin: Optional[GenerativeModelBultinProviderInput] = UNSET
    custom: Optional[GenerativeModelCustomProviderInput] = UNSET

    def __post_init__(self) -> None:
        if sum(map(bool, [self.custom, self.builtin])) != 1:
            raise ValueError("Exactly one of custom or builtin must be provided")
