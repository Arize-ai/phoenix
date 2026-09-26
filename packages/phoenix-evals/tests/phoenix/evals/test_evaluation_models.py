import json
import subprocess
import sys
from unittest.mock import AsyncMock, Mock

import pytest

from phoenix.evals import ClassificationEvaluator, ClassificationResult, EvaluationModel
from phoenix.evals.metrics import FaithfulnessEvaluator, HallucinationEvaluator
from phoenix.evals.models_typesafe import TypeSafeEvaluationModel


class FakeModel(EvaluationModel):
    def __init__(self, result):
        self.classify = Mock(return_value=result)
        self.async_classify = AsyncMock(return_value=result)

    def classify(self, *, prompt, criteria): ...

    async def async_classify(self, *, prompt, criteria): ...


def make_evaluator(result, **kwargs):
    return ClassificationEvaluator(
        name="grounding",
        llm=FakeModel(result),
        prompt_template="Judge {output} against {context}",
        choices={"grounded": 0, "hallucinated": 1},
        **kwargs,
    )


@pytest.mark.parametrize("asynchronous", [False, True])
async def test_binary_classification(asynchronous):
    result = ClassificationResult(
        "grounded", {"grounded": 0.85, "hallucinated": 0.15}, {"model": "resolved-jev"}
    )
    evaluator = make_evaluator(result)
    inputs = {"output": "Paris", "context": "France's capital is Paris"}
    scores = await evaluator.async_evaluate(inputs) if asynchronous else evaluator.evaluate(inputs)
    score = scores[0]
    assert score.label == "grounded"
    assert score.score == 0
    assert score.explanation is None
    assert score.metadata["probabilities"] == result.probabilities
    assert score.metadata["model"] == "resolved-jev"
    assert score.kind == "llm"
    assert score.direction == "maximize"
    called = evaluator.llm.async_classify if asynchronous else evaluator.llm.classify
    unused = evaluator.llm.classify if asynchronous else evaluator.llm.async_classify
    called.assert_called_once()
    unused.assert_not_called()
    assert called.call_args.kwargs["criteria"] == {"grounded": None, "hallucinated": None}


@pytest.mark.parametrize("asynchronous", [False, True])
async def test_builtin_hallucination(asynchronous):
    model = FakeModel(ClassificationResult("grounded", {"grounded": 0.85, "hallucinated": 0.15}))
    evaluator = HallucinationEvaluator(llm=model)
    inputs = {"input": "User: What is 2+2?", "output": "4"}
    score = (
        await evaluator.async_evaluate(inputs) if asynchronous else evaluator.evaluate(inputs)
    )[0]
    assert (score.name, score.label, score.score, score.direction) == (
        "hallucination",
        "grounded",
        0,
        "minimize",
    )
    assert score.explanation is None
    called = model.async_classify if asynchronous else model.classify
    assert called.call_args.kwargs["prompt"] == evaluator.prompt_template.render(inputs)


def test_prompt_preserves_rubric_roles_and_all_substitutions():
    model = FakeModel(ClassificationResult("yes"))
    evaluator = ClassificationEvaluator(
        name="custom",
        llm=model,
        prompt_template=[
            {"role": "system", "content": "Rubric: compare to {reference}"},
            {"role": "developer", "content": "Instructions: {instructions}"},
            {"role": "user", "content": "Input {input}; output {output}; context {context}"},
        ],
        choices=["yes", "no"],
    )
    inputs = {
        key: key.upper() for key in ("reference", "instructions", "input", "output", "context")
    }
    score = evaluator.evaluate(inputs)[0]
    prompt = model.classify.call_args.kwargs["prompt"]
    assert prompt == evaluator.prompt_template.render(inputs)
    serialized = json.dumps(prompt)
    assert all(value in serialized for value in inputs.values())
    assert [message["role"] for message in prompt] == ["system", "developer", "user"]
    assert score.score is None


def test_faithfulness_preserves_context_and_input_mapping():
    model = FakeModel(ClassificationResult("faithful"))
    evaluator = FaithfulnessEvaluator(llm=model)
    evaluator.evaluate(
        {"question": "Q", "answer": "A", "documents": "C"},
        input_mapping={"input": "question", "output": "answer", "context": "documents"},
    )
    assert model.classify.call_args.kwargs["prompt"] == evaluator.prompt_template.render(
        {"input": "Q", "output": "A", "context": "C"}
    )


def test_multiclass_preserves_descriptions():
    model = FakeModel(ClassificationResult("fair", {"good": 0.2, "fair": 0.7, "bad": 0.1}))
    evaluator = ClassificationEvaluator(
        name="quality",
        llm=model,
        prompt_template="Rate {output}",
        choices={
            "good": (1, "Fully correct"),
            "fair": (0.5, "Partly correct"),
            "bad": (0, "Wrong"),
        },
    )
    score = evaluator.evaluate({"output": "Something"})[0]
    assert (score.label, score.score, score.explanation) == ("fair", 0.5, None)
    assert model.classify.call_args.kwargs["criteria"] == {
        "good": "Fully correct",
        "fair": "Partly correct",
        "bad": "Wrong",
    }


@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize(
    "result,match",
    [
        (None, "ClassificationResult"),
        (ClassificationResult(""), "invalid label"),
        (ClassificationResult("unknown"), "invalid label"),
        (ClassificationResult("grounded", {}), "exactly"),
        (ClassificationResult("grounded", {"grounded": 1}), "exactly"),
        (
            ClassificationResult("grounded", {"grounded": 1, "hallucinated": 0, "extra": 0}),
            "exactly",
        ),
        *[
            (ClassificationResult("grounded", {"grounded": value, "hallucinated": 0}), "finite")
            for value in [-0.1, 1.1, float("nan"), float("inf"), "0.5", True]
        ],
    ],
)
async def test_invalid_results_raise(result, match, asynchronous):
    evaluator = make_evaluator(result)
    with pytest.raises(ValueError, match=match):
        if asynchronous:
            await evaluator.async_evaluate({"output": "A", "context": "C"})
        else:
            evaluator.evaluate({"output": "A", "context": "C"})


@pytest.mark.parametrize("asynchronous", [False, True])
async def test_provider_failure_propagates(asynchronous):
    evaluator = make_evaluator(None)
    failure = RuntimeError("provider unavailable")
    evaluator.llm.classify.side_effect = failure
    evaluator.llm.async_classify.side_effect = failure
    with pytest.raises(RuntimeError, match="provider unavailable") as caught:
        if asynchronous:
            await evaluator.async_evaluate({"output": "A", "context": "C"})
        else:
            evaluator.evaluate({"output": "A", "context": "C"})
    assert caught.value is failure


@pytest.mark.parametrize("choices", [[], {}, [""], ["yes", "yes"]])
def test_invalid_choices(choices):
    with pytest.raises(ValueError, match="choices"):
        ClassificationEvaluator(
            name="bad", llm=FakeModel(None), prompt_template="P", choices=choices
        )


def test_rejects_llm_invocation_parameters():
    with pytest.raises(ValueError, match="invocation parameters"):
        make_evaluator(None, temperature=0, system="Must not silently drop this")


def test_missing_optional_sdk(monkeypatch):
    monkeypatch.setitem(sys.modules, "typesafe_sdk", None)
    with pytest.raises(ImportError, match=r"arize-phoenix-evals\[typesafe\]"):
        TypeSafeEvaluationModel(client=Mock())


def test_core_import_without_optional_sdk():
    subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import sys; sys.modules['typesafe_sdk'] = None; "
                "from phoenix.evals import ClassificationEvaluator, EvaluationModel, LLM"
            ),
        ],
        check=True,
        capture_output=True,
    )


@pytest.mark.parametrize("asynchronous", [False, True])
async def test_llm_regression(asynchronous):
    llm = Mock(model="llm-model")
    response = {"label": "yes", "explanation": "Reason"}
    llm.generate_classification.return_value = response
    llm.async_generate_classification = AsyncMock(return_value=response)
    evaluator = ClassificationEvaluator(
        name="legacy",
        llm=llm,
        prompt_template="Judge {output}",
        choices={"yes": 1, "no": 0},
        temperature=0.1,
    )
    scores = (
        await evaluator.async_evaluate({"output": "A"})
        if asynchronous
        else evaluator.evaluate({"output": "A"})
    )
    score = scores[0]
    assert (score.label, score.score, score.explanation) == ("yes", 1, "Reason")
    assert {key: value for key, value in score.metadata.items() if key != "trace_id"} == {
        "model": "llm-model"
    }
    called = llm.async_generate_classification if asynchronous else llm.generate_classification
    assert called.call_args.kwargs["temperature"] == 0.1
    assert called.call_args.kwargs["include_explanation"] is True
