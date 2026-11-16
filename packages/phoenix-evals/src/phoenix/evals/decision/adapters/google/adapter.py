from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from ....exceptions import PhoenixDecisionRefusal
from ....llm.prompts import PromptLike
from ...registries import register_provider
from ...types import BaseDecisionAdapter, ClassificationCriterion
from .factories import create_google_client

_QUESTION_NAME = "label"
# The Decisions API rejects a choice question without instructions.
_CHOICE_INSTRUCTIONS = "Select the single best label for the input."
_SAFETY_CODES = frozenset(
    {"safety", "other", "blocklist", "prohibited_content", "image_safety", "content_blocked"}
)


@register_provider(
    provider="google",
    client_factory=create_google_client,
    dependencies=["google-genai"],
)
class GoogleDecisionAdapter(BaseDecisionAdapter):
    """Adapter for Google's Gemini Decisions API (e.g. ``gemini-decision-1``).

    A classification is routed through a single ``choice`` question whose criteria are the
    labels, so the result carries a label and the label probabilities (as metadata) but no
    explanation, since decision models are decision-only. The API has no roles, so the prompt
    is flattened to a single plain-text ``input`` by the base adapter.
    """

    @classmethod
    def client_name(cls) -> str:
        return "google"

    @staticmethod
    def _build_choice_question(
        name: str,
        labels: Union[List[str], Dict[str, str]],
        instructions: Optional[str],
    ) -> Tuple[str, Dict[str, Any]]:
        # ``criteria`` maps every label to its description, or to "" when it has no description.
        criteria: Dict[str, str] = (
            {label: description or "" for label, description in labels.items()}
            if isinstance(labels, dict)
            else {label: "" for label in labels}
        )
        # Gemini keys ``questions`` by name (a map), so the name is returned as the dict key
        # rather than carried inside the question (where OpenAI's Decisions API puts it).
        return name, {
            "type": "choice",
            "instructions": instructions or _CHOICE_INSTRUCTIONS,
            "criteria": criteria,
        }

    @staticmethod
    def _usage_dict(response: Any) -> Optional[Dict[str, Any]]:
        usage = getattr(response, "usage", None)
        if usage is None:
            return None
        return {
            "input_tokens": getattr(usage, "total_input_tokens", None),
            "output_tokens": getattr(usage, "total_output_tokens", None),
        }

    def _answer_to_label_metadata(self, answer: Any) -> Dict[str, Any]:
        # Gemini already reports probabilities as a label -> probability dict, so no
        # normalization is needed. The response carries no model id, so the request model is used.
        metadata: Dict[str, Any] = {
            "probabilities": dict(getattr(answer, "probabilities", None) or {}),
            "model_id": self.model,
        }
        confidence = getattr(answer, "confidence", None)
        if confidence is not None:
            metadata["confidence"] = confidence
        return {"label": answer.choice, "metadata": metadata}

    @staticmethod
    def _raise_if_blocked(response: Any) -> None:
        """Re-raise a successful-but-blocked response (populated ``prompt_feedback``) as a refusal.

        A safety block can arrive as a 200 whose ``answers`` is empty and whose
        ``prompt_feedback.block_reason`` is set, rather than as an HTTP 400; this catches that path
        so the block surfaces as a refusal instead of a missing-answer ``KeyError``.
        """
        feedback = getattr(response, "prompt_feedback", None)
        reason = getattr(feedback, "block_reason", None) if feedback is not None else None
        if reason is not None:
            message = getattr(feedback, "block_reason_message", None)
            detail = f": {message}" if message else ""
            raise PhoenixDecisionRefusal(
                f"The decision model refused to classify (block reason '{reason}'{detail})."
            )

    def _to_result(self, response: Any) -> Dict[str, Any]:
        self._raise_if_blocked(response)
        result = self._answer_to_label_metadata(response.answers[_QUESTION_NAME])
        usage = self._usage_dict(response)
        if usage is not None:
            result["usage"] = usage
        return result

    def _to_results(self, response: Any, names: List[str]) -> Dict[str, Any]:
        self._raise_if_blocked(response)
        results = [
            {"name": name, **self._answer_to_label_metadata(response.answers[name])}
            for name in names
        ]
        return {"results": results, "usage": self._usage_dict(response)}

    @staticmethod
    def _raise_if_refusal(exc: Any) -> None:
        """Re-raise a Gemini input-safety 400 as a refusal; leave any other error to propagate."""
        details = getattr(exc, "details", None)
        error = details.get("error", {}) if isinstance(details, dict) else {}
        code = error.get("code") if isinstance(error, dict) else None
        if isinstance(code, str) and code in _SAFETY_CODES:
            raise PhoenixDecisionRefusal(
                f"The decision model refused to classify (safety block '{code}')."
            ) from exc

    def _create(self, prompt: PromptLike, questions: Dict[str, Any], **kwargs: Any) -> Any:
        from google.genai.errors import ClientError

        try:
            return self.client.decisions.create(
                model=self.model, input=self._to_input(prompt), questions=questions, **kwargs
            )
        except ClientError as exc:
            self._raise_if_refusal(exc)
            raise

    async def _acreate(self, prompt: PromptLike, questions: Dict[str, Any], **kwargs: Any) -> Any:
        from google.genai.errors import ClientError

        try:
            return await self.client.aio.decisions.create(
                model=self.model, input=self._to_input(prompt), questions=questions, **kwargs
            )
        except ClientError as exc:
            self._raise_if_refusal(exc)
            raise

    def generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = dict([self._build_choice_question(_QUESTION_NAME, labels, None)])
        return self._to_result(self._create(prompt, questions, **kwargs))

    async def async_generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = dict([self._build_choice_question(_QUESTION_NAME, labels, None)])
        return self._to_result(await self._acreate(prompt, questions, **kwargs))

    def generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Sequence[ClassificationCriterion],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = dict(
            self._build_choice_question(c["name"], c["labels"], c.get("instructions"))
            for c in criteria
        )
        response = self._create(prompt, questions, **kwargs)
        return self._to_results(response, [c["name"] for c in criteria])

    async def async_generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Sequence[ClassificationCriterion],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        questions = dict(
            self._build_choice_question(c["name"], c["labels"], c.get("instructions"))
            for c in criteria
        )
        response = await self._acreate(prompt, questions, **kwargs)
        return self._to_results(response, [c["name"] for c in criteria])
