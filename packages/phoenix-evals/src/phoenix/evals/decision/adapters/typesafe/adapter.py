from typing import Any, Dict, List, Optional, Union

from ....llm.prompts import PromptLike
from ...registries import register_provider
from ...types import (
    BaseDecisionAdapter,
    ClassificationCriterion,
    ClassificationFailure,
    ClassificationMetadata,
    ClassificationResponse,
    ClassificationResult,
    Name,
    TokenUsage,
)
from .factories import create_typesafe_client, get_typesafe_rate_limit_errors


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

    def _build_choice(self, labels: Dict[str, Optional[str]], instructions: Optional[str]) -> Any:
        from typesafe_sdk import Choice

        criteria = dict(labels)
        if instructions is not None:
            return Choice(criteria=criteria, instructions=instructions)
        return Choice(criteria=criteria)

    @staticmethod
    def _usage_dict(response: Any) -> TokenUsage:
        usage = getattr(response, "usage", None)
        return TokenUsage(
            input_tokens=getattr(usage, "input_tokens", 0) or 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0,
        )

    @staticmethod
    def _answer_metadata(answer: Any, model: Any) -> ClassificationMetadata:
        metadata: ClassificationMetadata = {
            "probabilities": answer.probabilities,
            "model_id": model,
        }
        confidence = getattr(answer, "confidence", None)
        if confidence is not None:
            metadata["confidence"] = confidence
        return metadata

    @classmethod
    def _to_results(cls, response: Any, names: List[str]) -> ClassificationResponse:
        results: Dict[Name, Union[ClassificationResult, ClassificationFailure]] = {}
        for name in names:
            if name not in response.choices:
                results[name] = ClassificationFailure(
                    kind="error",
                    reason=f"The model returned no answer for criterion '{name}'.",
                    metadata={"model_id": response.model},
                )
                continue
            answer = response.choices[name]
            results[name] = ClassificationResult(
                label=answer.choice,
                metadata=cls._answer_metadata(answer, response.model),
            )
        return ClassificationResponse(results=results, usage=cls._usage_dict(response))

    def generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Dict[Name, ClassificationCriterion],
        **kwargs: Any,
    ) -> ClassificationResponse:
        questions = {
            name: self._build_choice(c["labels"], c.get("instruction"))
            for name, c in criteria.items()
        }
        response = self.client.system_one(
            state=self._to_input(prompt), questions=questions, model=self.model, **kwargs
        )
        return self._to_results(response, list(criteria))

    async def async_generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Dict[Name, ClassificationCriterion],
        **kwargs: Any,
    ) -> ClassificationResponse:
        questions = {
            name: self._build_choice(c["labels"], c.get("instruction"))
            for name, c in criteria.items()
        }
        response = await self.client.system_one(
            state=self._to_input(prompt), questions=questions, model=self.model, **kwargs
        )
        return self._to_results(response, list(criteria))
