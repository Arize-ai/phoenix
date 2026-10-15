from typing import Any, Dict, List, Optional, Union, cast

from ....llm.prompts import PromptLike
from ...registries import register_provider
from ...types import BaseDecisionAdapter
from .factories import create_typesafe_client, get_typesafe_rate_limit_errors

_CLASSIFICATION_INSTRUCTIONS = (
    "Read the prompt in the state and answer it by selecting exactly one of the choices."
)


@register_provider(
    provider="typesafe",
    client_factory=create_typesafe_client,
    get_rate_limit_errors=get_typesafe_rate_limit_errors,
    dependencies=["typesafe-sdk"],
)
class TypeSafeDecisionAdapter(BaseDecisionAdapter):
    """Adapter for TypeSafe's decision models (e.g. Jev).

    A classification is routed through a single ``choice`` question whose options are the
    labels, so the result carries a label and the label probabilities (as metadata) but no
    explanation, since decision models are decision-only.
    """

    @classmethod
    def client_name(cls) -> str:
        return "typesafe"

    def _build_questions(self, labels: Union[List[str], Dict[str, str]]) -> Dict[str, Any]:
        from typesafe_sdk import Choice

        # When labels is a dict it maps each label to its description (the evaluator produces
        # this from `{label: (score, description)}` choices); pass those descriptions straight
        # to Jev as the choice criteria. A list carries no descriptions, so each is None.
        criteria: Dict[str, Optional[str]] = (
            dict(labels) if isinstance(labels, dict) else {label: None for label in labels}
        )
        return {"label": Choice(instructions=_CLASSIFICATION_INSTRUCTIONS, criteria=criteria)}

    @staticmethod
    def _to_result(response: Any) -> Dict[str, Any]:
        answer = response.choices["label"]
        return {
            "label": answer.choice,
            "metadata": {
                "probabilities": answer.probabilities,
                "model_id": response.model,
            },
        }

    def generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = self._build_questions(labels)
        response = self.client.system_one(
            state=cast(Any, prompt), questions=questions, model=self.model
        )
        return self._to_result(response)

    async def async_generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = self._build_questions(labels)
        response = await self.client.system_one(
            state=cast(Any, prompt), questions=questions, model=self.model
        )
        return self._to_result(response)
