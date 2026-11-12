from typing import Any, Dict, List, Optional, Sequence, Union

from ....llm.prompts import PromptLike
from ...registries import register_provider
from ...types import BaseDecisionAdapter, ClassificationCriterion
from .factories import create_typesafe_client, get_typesafe_rate_limit_errors

_QUESTION_NAME = "label"


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

    def _build_choice(self, labels: Union[List[str], Dict[str, str]], instructions: Optional[str]):
        from typesafe_sdk import Choice

        criteria: Dict[str, Optional[str]] = (
            dict(labels) if isinstance(labels, dict) else {label: None for label in labels}
        )
        if instructions is not None:
            return Choice(criteria=criteria, instructions=instructions)
        return Choice(criteria=criteria)

    @staticmethod
    def _usage_dict(response: Any) -> Optional[Dict[str, Any]]:
        usage = getattr(response, "usage", None)
        if usage is None:
            return None
        return {
            "input_tokens": getattr(usage, "input_tokens", None),
            "output_tokens": getattr(usage, "output_tokens", None),
        }

    @staticmethod
    def _answer_metadata(answer: Any, model: Any) -> Dict[str, Any]:
        metadata: Dict[str, Any] = {"probabilities": answer.probabilities, "model_id": model}
        confidence = getattr(answer, "confidence", None)
        if confidence is not None:
            metadata["confidence"] = confidence
        return metadata

    @classmethod
    def _to_result(cls, response: Any) -> Dict[str, Any]:
        answer = response.choices[_QUESTION_NAME]
        result: Dict[str, Any] = {
            "label": answer.choice,
            "metadata": cls._answer_metadata(answer, response.model),
        }
        usage = cls._usage_dict(response)
        if usage is not None:
            result["usage"] = usage
        return result

    @classmethod
    def _to_results(cls, response: Any, names: List[str]) -> Dict[str, Any]:
        results: List[Dict[str, Any]] = []
        for name in names:
            answer = response.choices[name]
            results.append(
                {
                    "name": name,
                    "label": answer.choice,
                    "metadata": cls._answer_metadata(answer, response.model),
                }
            )
        return {"results": results, "usage": cls._usage_dict(response)}

    def generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Sequence[ClassificationCriterion],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = {
            c["name"]: self._build_choice(c["labels"], c.get("instructions")) for c in criteria
        }
        response = self.client.system_one(
            state=self._to_input(prompt), questions=questions, model=self.model, **kwargs
        )
        return self._to_results(response, [c["name"] for c in criteria])

    async def async_generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Sequence[ClassificationCriterion],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = {
            c["name"]: self._build_choice(c["labels"], c.get("instructions")) for c in criteria
        }
        response = await self.client.system_one(
            state=self._to_input(prompt), questions=questions, model=self.model, **kwargs
        )
        return self._to_results(response, [c["name"] for c in criteria])

    def generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = {_QUESTION_NAME: self._build_choice(labels, None)}
        response = self.client.system_one(
            state=self._to_input(prompt), questions=questions, model=self.model, **kwargs
        )
        return self._to_result(response)

    async def async_generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = {_QUESTION_NAME: self._build_choice(labels, None)}
        response = await self.client.system_one(
            state=self._to_input(prompt), questions=questions, model=self.model, **kwargs
        )
        return self._to_result(response)
