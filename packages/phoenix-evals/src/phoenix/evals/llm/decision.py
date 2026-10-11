from typing import Any, Dict, List, Union, cast

from .prompts import PromptLike

_CLASSIFICATION_INSTRUCTIONS = (
    "Read the prompt in the state and answer it by selecting exactly one of the choices."
)


class Decision:
    """A decision model (e.g. TypeSafe's Jev) used as a classification judge.

    Unlike :class:`LLM`, a decision model only answers typed questions and cannot
    generate free-form text. A classification is routed through a single ``choice``
    question whose options are the labels, so the result carries a label and the
    label probabilities (as metadata) but no explanation.

    Example::

        from phoenix.evals import ClassificationEvaluator
        from phoenix.evals.llm import Decision

        evaluator = ClassificationEvaluator(
            name="sentiment",
            llm=Decision(model="jev-latest"),
            prompt_template="Classify the sentiment: {text}",
            choices=["positive", "negative", "neutral"],
        )
    """

    def __init__(self, *, model: str = "jev-latest", **client_kwargs: Any):
        try:
            from typesafe_sdk import AsyncTypeSafeClient, TypeSafeClient
        except ImportError as e:
            raise ImportError(
                "The typesafe-sdk package is required to use Decision. "
                "Install it with `pip install typesafe-sdk`."
            ) from e

        self.model = model
        self._client = TypeSafeClient(**client_kwargs)
        self._async_client = AsyncTypeSafeClient(**client_kwargs)

    def _build_questions(self, labels: Union[List[str], Dict[str, str]]) -> Dict[str, Any]:
        from typesafe_sdk import Choice

        label_names = list(labels) if isinstance(labels, list) else list(labels.keys())
        criteria = {label: None for label in label_names}
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
        response = self._client.system_one(
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
        response = await self._async_client.system_one(
            state=cast(Any, prompt), questions=questions, model=self.model
        )
        return self._to_result(response)
