from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.evals import ClassificationEvaluator
from phoenix.evals.llm import DecisionModel


def _response(choice, probabilities, model="mock-evaluation-model"):
    """Build a fake SystemOneResponse exposing `.choices[name]` and `.model`."""
    answer = SimpleNamespace(choice=choice, probabilities=probabilities)
    return SimpleNamespace(model=model, choices={"label": answer})


def _patch_clients(monkeypatch, sync_client=None, async_client=None):
    monkeypatch.setattr(
        "typesafe_sdk.TypeSafeClient", MagicMock(return_value=sync_client or MagicMock())
    )
    monkeypatch.setattr(
        "typesafe_sdk.AsyncTypeSafeClient", MagicMock(return_value=async_client or MagicMock())
    )


def test_routes_a_text_prompt_through_a_single_choice_question(monkeypatch):
    client = MagicMock()
    client.system_one.return_value = _response("incorrect", {"correct": 0.03, "incorrect": 0.97})
    _patch_clients(monkeypatch, sync_client=client)

    decision = DecisionModel(model="jev-latest")
    result = decision.generate_classification("Is 2 + 2 = 5 correct?", ["correct", "incorrect"])

    assert result == {
        "label": "incorrect",
        "metadata": {
            "probabilities": {"correct": 0.03, "incorrect": 0.97},
            "model_id": "mock-evaluation-model",
        },
    }
    assert "explanation" not in result

    client.system_one.assert_called_once()
    _, kwargs = client.system_one.call_args
    assert kwargs["state"] == "Is 2 + 2 = 5 correct?"
    assert kwargs["model"] == "jev-latest"
    question = kwargs["questions"]["label"]
    assert question.criteria == {"correct": None, "incorrect": None}
    assert isinstance(question.instructions, str) and question.instructions


async def test_async_routes_a_text_prompt_through_a_single_choice_question(monkeypatch):
    async_client = MagicMock()
    async_client.system_one = AsyncMock(return_value=_response("correct", {"correct": 0.9}))
    _patch_clients(monkeypatch, async_client=async_client)

    decision = DecisionModel(model="jev-latest")
    result = await decision.async_generate_classification(
        "Is the sky blue?", ["correct", "incorrect"]
    )

    assert result["label"] == "correct"
    assert result["metadata"]["probabilities"] == {"correct": 0.9}
    async_client.system_one.assert_awaited_once()


def test_evaluator_maps_the_chosen_label_to_a_score_without_an_explanation(monkeypatch):
    client = MagicMock()
    client.system_one.return_value = _response("invalid", {"valid": 0.1, "invalid": 0.9})
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(model="jev-latest"),
        prompt_template="is the following question valid: {question}",
        choices={"valid": 1, "invalid": 0},
    )
    [score] = evaluator.evaluate({"question": "asdf"})

    assert score.label == "invalid"
    assert score.score == 0
    assert score.explanation is None
    assert score.metadata["model"] == "jev-latest"
    assert score.metadata["model_id"] == "mock-evaluation-model"
    assert score.metadata["probabilities"] == {"valid": 0.1, "invalid": 0.9}


def test_missing_sdk_raises_a_helpful_error(monkeypatch):
    import builtins

    real_import = builtins.__import__

    def _fail(name, *args, **kwargs):
        if name == "typesafe_sdk":
            raise ImportError("No module named 'typesafe_sdk'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", _fail)
    with pytest.raises(ImportError, match="typesafe-sdk"):
        DecisionModel(model="jev-latest")
