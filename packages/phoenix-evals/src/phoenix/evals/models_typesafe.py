"""Optional TypeSafe System One adapter."""

import json
import math
from typing import TYPE_CHECKING, Any, Dict, Optional

from .llm import PromptLike
from .models import ClassificationResult, EvaluationModel

if TYPE_CHECKING:
    from typesafe_sdk import AsyncTypeSafeClient, SystemOneResponse, TypeSafeClient


class TypeSafeEvaluationModel(EvaluationModel):
    """Use Jev through caller-owned TypeSafe SDK clients.

    Install ``arize-phoenix-evals[typesafe]``. Supply ``client`` for synchronous
    evaluation and ``async_client`` for native asynchronous evaluation, or both.
    Callers manage client lifetime and configure credentials, retries and timeouts
    on the clients. ``model=None`` respects the SDK client's default.

    The full rendered message list is sent as structured state. This preserves
    system instructions and template substitutions. No provider span is created
    here: enable OpenInference TypeSafe instrumentation to trace SDK requests.
    """

    def __init__(
        self,
        *,
        client: Optional["TypeSafeClient"] = None,
        async_client: Optional["AsyncTypeSafeClient"] = None,
        model: Optional[str] = None,
    ) -> None:
        try:
            import typesafe_sdk  # noqa: F401
        except ImportError as exc:
            raise ImportError(
                'Install TypeSafe support with: pip install "arize-phoenix-evals[typesafe]"'
            ) from exc
        if client is None and async_client is None:
            raise ValueError("Supply a TypeSafe client and/or async_client.")
        self.client = client
        self.async_client = async_client
        self.model = model

    def _request(self, prompt: PromptLike, criteria: Dict[str, Optional[str]]) -> Dict[str, Any]:
        # JSON round-tripping preserves all message fields and rejects binary or
        # otherwise non-JSON content instead of silently dropping information.
        state = prompt if isinstance(prompt, str) else {"messages": prompt}
        return {
            "state": json.loads(json.dumps(state, allow_nan=False)),
            "model": self.model,
            "questions": {
                "label": {
                    "type": "choice",
                    "instructions": (
                        "Read the prompt in the state and answer it by selecting "
                        "exactly one of the choices."
                    ),
                    "criteria": criteria,
                }
            },
        }

    @staticmethod
    def _result(response: "SystemOneResponse") -> ClassificationResult:
        from typesafe_sdk import ChoiceAnswer

        answer = response.answers.get("label")
        if not isinstance(answer, ChoiceAnswer):
            raise ValueError("TypeSafe response must contain a choice answer named 'label'.")
        if not math.isfinite(answer.confidence) or not 0 <= answer.confidence <= 1:
            raise ValueError("TypeSafe confidence must be a finite number in [0, 1].")
        metadata: Dict[str, Any] = {
            "model": response.model,
            "confidence": answer.confidence,
            "usage": response.usage.model_dump(mode="json"),
        }
        return ClassificationResult(
            label=answer.choice,
            probabilities=dict(answer.probabilities),
            metadata=metadata,
        )

    def classify(
        self, *, prompt: PromptLike, criteria: Dict[str, Optional[str]]
    ) -> ClassificationResult:
        if self.client is None:
            raise ValueError("Synchronous evaluation requires a TypeSafe client.")
        return self._result(self.client.system_one(**self._request(prompt, criteria)))

    async def async_classify(
        self, *, prompt: PromptLike, criteria: Dict[str, Optional[str]]
    ) -> ClassificationResult:
        if self.async_client is None:
            raise ValueError("Asynchronous evaluation requires a TypeSafe async_client.")
        response = await self.async_client.system_one(**self._request(prompt, criteria))
        return self._result(response)
