import json
import os
import sys

from openinference.instrumentation.openai import OpenAIInstrumentor
from textdistance import levenshtein

import phoenix as px
from phoenix.experiments import evaluate_experiment
from phoenix.experiments.evaluators import create_evaluator
from phoenix.experiments.types import EvaluationResult
from phoenix.otel import register

tracer_provider = register(auto_instrument=False, verbose=False)
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)


def scorer(result: tuple[float, str]) -> EvaluationResult:
    label = "Matches" if result[0] == 1 else "Does not match"
    return EvaluationResult(score=result[0], explanation=result[1], label=label)


@create_evaluator(name="exact_match", kind="CODE", scorer=scorer)
def exact_match_evaluator(expected, output) -> tuple[float, str]:
    try:
        output_json = json.loads(output.get("messages")[0].get("content"))
        expected_json = json.loads(expected.get("expected_output"))
    except Exception as e:
        return (0, f"Error parsing JSON: {e}\nOutput: {output}")

    # Check if the dictionaries are equal and return detailed differences
    keys_to_ignore = ["event_title", "end_datetime", "event_description", "is_invitation"]
    output_json = {k: v for k, v in output_json.items() if k not in keys_to_ignore}
    expected_json = {k: v for k, v in expected_json.items() if k not in keys_to_ignore}

    differences = []
    differences.append("❌ Output does not match expected:")

    all_keys = set(output_json.keys()) | set(expected_json.keys())
    unequal = False
    for key in all_keys:
        if key not in output_json:
            differences.append(f"  Missing key in output: {key}")
            unequal = True
        elif key not in expected_json:
            differences.append(f"  Extra key in output: {key}")
            unequal = True
        elif output_json[key] != expected_json[key]:
            differences.append(f"  Key '{key}' differs:")
            differences.append(f"    Expected: {expected_json[key]}")
            differences.append(f"    Output:   {output_json[key]}")
            unequal = True

    if unequal:
        return (0, "\n".join(differences))
    else:
        return (1, "Output matches expected exactly")


@create_evaluator(name="levenshtein_similarity", kind="CODE")
def similarity_evaluator(expected, output) -> tuple[float, str]:
    try:
        output_str = output.get("messages")[0].get("content")
        expected_str = expected.get("expected_output")
    except Exception as e:
        return (0, f"Error parsing JSON: {e}\nOutput: {output}")

    # Calculate Levenshtein distance and normalize to 0-1 scale
    # where 1 is perfect similarity (distance = 0) and 0 is completely different
    max_len = max(len(output_str), len(expected_str))
    if max_len == 0:
        similarity = 1.0  # Both strings are empty, perfect match
    else:
        distance = levenshtein(output_str, expected_str)
        similarity = 1.0 - (distance / max_len)
    return similarity


def run_evaluation_for_experiment(experiment_ids):
    for experiment_id in experiment_ids:
        try:
            experiment = px.Client(endpoint=os.getenv("PHOENIX_BASE_URL")).get_experiment(
                experiment_id=experiment_id
            )
            evaluators = [exact_match_evaluator, similarity_evaluator]
            experiment = evaluate_experiment(experiment, evaluators)
            print("✅ Experiment evaluated successfully")
        except Exception as e:
            print(f"❌ Error evaluating experiment: {e}")
            sys.exit(1)


if __name__ == "__main__":
    run_evaluation_for_experiment(["RXhwZXJpbWVudDo1NA=="])
