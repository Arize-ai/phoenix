import strawberry

from phoenix.db.types.model_provider import (
    GenerativeModelCustomerProviderConfigType,
    ModelsOfType,
    ModelTypeKey,
    ProviderModels,
    sdk_offers_chat,
    servable_model_types,
)
from phoenix.server.api.exceptions import BadRequest

_LABELS: dict[ModelTypeKey, str] = {"chat": "chat", "decision": "decision"}


@strawberry.input(description="A custom provider's models of one type, with their settings.")
class ModelsOfTypeInput:
    names: list[str] = strawberry.field(
        default_factory=list,
        description=(
            "Model names the model menu suggests in place of the built-in list; empty suggests "
            "the built-in models. Not an allowlist: any name the endpoint accepts works."
        ),
    )

    def to_orm(self) -> ModelsOfType:
        return ModelsOfType(names=tuple(self.names))


@strawberry.input(
    description=(
        "A custom provider's models, by type; the endpoint serves a type when it is set. "
        "On a patch, it replaces the stored value as a whole."
    )
)
class ProviderModelsInput:
    chat: ModelsOfTypeInput | None = None
    decision: ModelsOfTypeInput | None = strawberry.field(
        default=None,
        description=(
            "Decision models run over the provider's own SDK's protocol (the OpenAI Decisions "
            "API for OpenAI, System One for TypeSafe), at its base URL, with its API key and "
            "headers."
        ),
    )

    def to_orm(self) -> ProviderModels:
        return ProviderModels(
            chat=self.chat.to_orm() if self.chat else None,
            decision=self.decision.to_orm() if self.decision else None,
        )


def check_servable_model_types(
    config: GenerativeModelCustomerProviderConfigType,
    served: ProviderModels,
) -> None:
    sdk = config.type
    for key in sorted(served.types() - servable_model_types(sdk)):
        raise BadRequest(f"A provider with the {sdk} SDK can't serve {_LABELS[key]} models.")


def check_provider_models(
    config: GenerativeModelCustomerProviderConfigType,
    served: ProviderModels,
) -> None:
    sdk = config.type
    check_servable_model_types(config, served)
    if sdk_offers_chat(sdk) and served.chat is None:
        # Chat execution paths do not check provider.models.chat yet, so chat SDKs cannot
        # disable chat.
        raise BadRequest(f"A provider with the {sdk} SDK always serves chat models.")
    if not served.types():
        raise BadRequest("A provider must serve at least one model type.")
