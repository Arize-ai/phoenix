from typing import Any, Dict, List, Optional, Sequence, Union

from ....exceptions import PhoenixDecisionRefusal
from ....llm.prompts import MessageRole, PromptLike, normalize_role
from ...registries import register_provider
from ...types import BaseDecisionAdapter, ClassificationCriterion
from .factories import create_openai_client, get_openai_rate_limit_errors

_QUESTION_NAME = "label"
# The Decisions API rejects a choice question without instructions.
_CHOICE_INSTRUCTIONS = "Select the single best label for the input."


def _message_texts(content: Any) -> List[str]:
    """Non-empty text pieces of a message's content, dropping non-text (e.g. image) parts."""
    if isinstance(content, str):
        return [content] if content else []
    if isinstance(content, list):
        return [
            part["text"]
            for part in content
            if isinstance(part, dict) and part.get("type") == "text" and part.get("text")
        ]
    return []


@register_provider(
    provider="openai",
    client_factory=create_openai_client,
    get_rate_limit_errors=get_openai_rate_limit_errors,
    dependencies=["openai"],
)
class OpenAIDecisionAdapter(BaseDecisionAdapter):
    """Adapter for OpenAI's Decisions API (e.g. ``gpt-6-luna``).

    A classification is routed through a single ``choice`` question whose options are the
    labels, so the result carries a label and the label probabilities (as metadata) but no
    explanation, since decision models are decision-only.
    """

    @classmethod
    def client_name(cls) -> str:
        return "openai"

    def _to_input(self, prompt: PromptLike) -> Any:
        if isinstance(prompt, str):
            return prompt
        messages: List[Dict[str, Any]] = []
        for message in prompt:
            role = normalize_role(message.get("role") or MessageRole.USER).value
            part_type = "output_text" if role == MessageRole.AI.value else "input_text"
            parts = [
                {"type": part_type, "text": text} for text in _message_texts(message.get("content"))
            ]
            if parts:
                messages.append({"role": role, "content": parts})
        return messages

    @staticmethod
    def _build_choice_question(
        name: str, labels: Union[List[str], Dict[str, str]], instructions: Optional[str]
    ) -> Dict[str, Any]:
        criteria: Dict[str, Any] = (
            dict(labels) if isinstance(labels, dict) else {label: None for label in labels}
        )
        choices: List[Dict[str, Any]] = []
        for value, description in criteria.items():
            choice: Dict[str, Any] = {"value": value}
            if description is not None:
                choice["description"] = description
            choices.append(choice)
        return {
            "type": "choice",
            "name": name,
            "instructions": instructions or _CHOICE_INSTRUCTIONS,
            "choices": choices,
        }

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
    def _answer_to_label_metadata(answer: Any, model: Any) -> Dict[str, Any]:
        if getattr(answer, "type", None) == "refusal":
            name = getattr(answer, "name", None)
            raise PhoenixDecisionRefusal(
                f"The decision model refused to classify (question '{name}')."
            )
        # OpenAI reports probabilities as a list of {value, probability}; flatten to a
        # value -> probability dict so metadata matches the other decision adapters.
        probabilities = {
            getattr(option, "value", None): getattr(option, "probability", None)
            for option in (getattr(answer, "probabilities", None) or [])
        }
        metadata: Dict[str, Any] = {"probabilities": probabilities, "model_id": model}
        confidence = getattr(answer, "confidence", None)
        if confidence is not None:
            metadata["confidence"] = confidence
        return {"label": answer.choice, "metadata": metadata}

    @classmethod
    def _to_result(cls, response: Any) -> Dict[str, Any]:
        result = cls._answer_to_label_metadata(response.answers[0], response.model)
        usage = cls._usage_dict(response)
        if usage is not None:
            result["usage"] = usage
        return result

    @classmethod
    def _to_results(cls, response: Any, names: List[str]) -> Dict[str, Any]:
        by_name = {getattr(answer, "name", None): answer for answer in response.answers}
        results: List[Dict[str, Any]] = []
        for name in names:
            answer = by_name[name]
            results.append({"name": name, **cls._answer_to_label_metadata(answer, response.model)})
        return {"results": results, "usage": cls._usage_dict(response)}

    def generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        response = self.client.decisions.create(
            model=self.model,
            input=self._to_input(prompt),
            questions=[self._build_choice_question(_QUESTION_NAME, labels, None)],
            **kwargs,
        )
        return self._to_result(response)

    async def async_generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        response = await self.client.decisions.create(
            model=self.model,
            input=self._to_input(prompt),
            questions=[self._build_choice_question(_QUESTION_NAME, labels, None)],
            **kwargs,
        )
        return self._to_result(response)

    def generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Sequence[ClassificationCriterion],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = [
            self._build_choice_question(c["name"], c["labels"], c.get("instructions"))
            for c in criteria
        ]
        response = self.client.decisions.create(
            model=self.model, input=self._to_input(prompt), questions=questions, **kwargs
        )
        return self._to_results(response, [c["name"] for c in criteria])

    async def async_generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Sequence[ClassificationCriterion],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = [
            self._build_choice_question(c["name"], c["labels"], c.get("instructions"))
            for c in criteria
        ]
        response = await self.client.decisions.create(
            model=self.model, input=self._to_input(prompt), questions=questions, **kwargs
        )
        return self._to_results(response, [c["name"] for c in criteria])
