import asyncio
import os
import random
import time
import traceback
from typing import Any, Dict, List, Optional

import anthropic
from openinference.instrumentation.anthropic import AnthropicInstrumentor

# Legacy imports
from phoenix import Client as LegacyClient
from phoenix.client import AsyncClient, Client
from phoenix.experiments.evaluators import create_evaluator
from phoenix.experiments.functions import evaluate_experiment as legacy_evaluate_experiment
from phoenix.experiments.functions import run_experiment as legacy_run_experiment
from phoenix.experiments.types import Dataset as LegacyDataset
from phoenix.experiments.types import Example as LegacyExample
from phoenix.otel import register

# Set up tracing
register(endpoint="http://localhost:6006/v1/traces")
AnthropicInstrumentor().instrument()

# Initialize clients
phoenix_client = Client()
phoenix_async_client = AsyncClient()
anthropic_client = anthropic.Client(api_key=os.getenv("ANTHROPIC_API_KEY"))
legacy_client = LegacyClient()


class TestResults:
    """Track test results and comparisons."""

    def __init__(self):
        self.results = []
        self.errors = []

    def add_result(
        self, test_name: str, new_client_result: Any, legacy_result: Any, notes: str = ""
    ):
        self.results.append(
            {
                "test": test_name,
                "new_client": new_client_result,
                "legacy": legacy_result,
                "notes": notes,
            }
        )

    def add_error(self, test_name: str, error: Exception, client_type: str):
        self.errors.append(
            {
                "test": test_name,
                "error": str(error),
                "client_type": client_type,
                "traceback": traceback.format_exc(),
            }
        )

    def print_summary(self):
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)

        print(f"\nCompleted {len(self.results)} tests")
        for result in self.results:
            print(f"✓ {result['test']}: {result['notes']}")

        if self.errors:
            print(f"\nErrors ({len(self.errors)}):")
            for error in self.errors:
                print(f"✗ {error['test']} ({error['client_type']}): {error['error']}")

        print("\n" + "=" * 80)


def create_test_dataset() -> tuple[Any, LegacyDataset]:
    """Create test datasets for both new and legacy clients."""

    # Sample data for testing
    examples_data = [
        {
            "input": {"question": "What is the capital of France?", "context": "geography"},
            "output": {"answer": "Paris", "confidence": 0.9},
            "metadata": {"difficulty": "easy", "category": "geography"},
        },
        {
            "input": {"question": "Explain quantum computing", "context": "science"},
            "output": {"answer": "Quantum computing uses quantum bits...", "confidence": 0.7},
            "metadata": {"difficulty": "hard", "category": "science"},
        },
        {
            "input": {"question": "What is 2+2?", "context": "math"},
            "output": {"answer": "4", "confidence": 1.0},
            "metadata": {"difficulty": "easy", "category": "math"},
        },
    ]

    # Create dataset for new client
    try:
        new_dataset = phoenix_client.datasets.create_dataset(
            name="test_dataset",
            inputs=[ex["input"] for ex in examples_data],
            outputs=[ex["output"] for ex in examples_data],
            metadata=[ex["metadata"] for ex in examples_data],
            dataset_description="Test dataset for experiment comparison",
        )
    except Exception as e:
        print(f"Warning: Could not create new dataset, will try to get existing: {e}")
        # Try to get an existing dataset
        try:
            new_dataset = phoenix_client.datasets.get_dataset(dataset="test_dataset")
        except Exception as e2:
            print(f"Error: Could not get existing dataset either: {e2}")
            raise

    # # Create dataset for legacy client
    # legacy_examples = {}
    # for i, ex in enumerate(examples_data):
    #     example = LegacyExample(
    #         id=f"example_{i}", input=ex["input"], output=ex["output"], metadata=ex["metadata"]
    #     )
    #     legacy_examples[example.id] = example

    legacy_dataset = legacy_client.get_dataset(name="test_dataset")

    return new_dataset, legacy_dataset


def simple_sync_task(input: Dict[str, Any]) -> Dict[str, Any]:
    """Simple synchronous task that calls Anthropic."""
    try:
        response = anthropic_client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=100,
            messages=[
                {
                    "role": "user",
                    "content": f"Answer this question briefly: {input.get('question', 'Hello')}",
                }
            ],
        )
        return {
            "response": response.content[0].text,
            "model": "claude-3-sonnet",
            "task_type": "sync",
        }
    except Exception as e:
        return {"error": str(e), "task_type": "sync"}


async def simple_async_task(input: Dict[str, Any]) -> Dict[str, Any]:
    """Simple asynchronous task that calls Anthropic."""
    try:
        async_client = anthropic.AsyncClient()
        response = await async_client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=100,
            messages=[
                {
                    "role": "user",
                    "content": f"Answer this question briefly: {input.get('question', 'Hello')}",
                }
            ],
        )
        return {
            "response": response.content[0].text,
            "model": "claude-3-sonnet",
            "task_type": "async",
        }
    except Exception as e:
        return {"error": str(e), "task_type": "async"}


def multi_param_task(
    input: Dict[str, Any], expected: Dict[str, Any], metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """Task that uses multiple parameters to test dynamic binding."""
    try:
        prompt = f"Question: {input.get('question', 'Hello')}\n"
        prompt += f"Expected format: {expected.get('answer', 'any')}\n"
        prompt += f"Difficulty: {metadata.get('difficulty', 'unknown')}\n"
        prompt += "Please answer accordingly."

        response = anthropic_client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}],
        )
        return {
            "response": response.content[0].text,
            "model": "claude-3-sonnet",
            "task_type": "multi_param",
            "used_metadata": metadata,
        }
    except Exception as e:
        return {"error": str(e), "task_type": "multi_param"}


def failing_task(input: Dict[str, Any]) -> Dict[str, Any]:
    """Task that always fails to test error handling."""
    raise ValueError("This task always fails for testing purposes")


# Evaluator functions
def simple_evaluator(output: Dict[str, Any]) -> Dict[str, Any]:
    """Simple evaluator that checks if output contains a response."""
    if "error" in output:
        return {"score": 0.0, "label": "error", "explanation": "Task failed"}
    elif "response" in output and output["response"]:
        return {"score": 1.0, "label": "success", "explanation": "Task completed"}
    else:
        return {"score": 0.0, "label": "no_response", "explanation": "No response generated"}


def content_length_evaluator(output: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluator that scores based on response length."""
    if "error" in output:
        return {"score": 0.0, "label": "error"}

    response = output.get("response", "")
    length = len(response)

    if length < 10:
        return {"score": 0.2, "label": "too_short"}
    elif length > 200:
        return {"score": 0.5, "label": "too_long"}
    else:
        return {"score": 1.0, "label": "good_length"}


def accuracy_evaluator(output: Dict[str, Any], expected: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluator that compares output to expected answer."""
    if "error" in output:
        return {"score": 0.0, "label": "error"}

    response = output.get("response", "").lower()
    expected_answer = expected.get("answer", "").lower()

    if expected_answer in response:
        return {"score": 1.0, "label": "correct"}
    else:
        return {"score": 0.0, "label": "incorrect"}


async def async_evaluator(output: Dict[str, Any]) -> Dict[str, Any]:
    """Async evaluator for testing async evaluation."""
    await asyncio.sleep(0.1)  # Simulate async work
    return simple_evaluator(output)


def test_basic_experiments(new_dataset: Any, legacy_dataset: LegacyDataset, results: TestResults):
    """Test basic experiment functionality."""
    print("\n🧪 Testing basic experiments...")

    # Test 1: Basic sync experiment
    try:
        new_result = phoenix_client.experiments.run_experiment(
            dataset=new_dataset,
            task=simple_sync_task,
            experiment_name="new_client_basic_sync",
            dry_run=False,
        )
        new_success = len(new_result["task_runs"]) > 0
    except Exception as e:
        results.add_error("basic_sync", e, "new_client")
        new_success = False

    try:
        legacy_result = legacy_run_experiment(
            dataset=legacy_dataset,
            task=simple_sync_task,
            experiment_name="legacy_basic_sync",
            dry_run=False,
        )
        legacy_success = len(legacy_result.runs) > 0
    except Exception as e:
        results.add_error("basic_sync", e, "legacy")
        legacy_success = False

    results.add_result("basic_sync", new_success, legacy_success, "Basic synchronous experiment")

    # Test 2: Multi-parameter task
    try:
        new_result = phoenix_client.experiments.run_experiment(
            dataset=new_dataset,
            task=multi_param_task,
            experiment_name="new_client_multi_param",
            dry_run=False,
        )
        new_success = len(new_result["task_runs"]) > 0
    except Exception as e:
        results.add_error("multi_param", e, "new_client")
        new_success = False

    try:
        legacy_result = legacy_run_experiment(
            dataset=legacy_dataset,
            task=multi_param_task,
            experiment_name="legacy_multi_param",
            dry_run=False,
        )
        legacy_success = len(legacy_result.runs) > 0
    except Exception as e:
        results.add_error("multi_param", e, "legacy")
        legacy_success = False

    results.add_result("multi_param", new_success, legacy_success, "Multi-parameter task binding")


def test_experiments_with_evaluators(
    new_dataset: Any, legacy_dataset: LegacyDataset, results: TestResults
):
    """Test experiments with evaluators."""
    print("\n🧠 Testing experiments with evaluators...")

    evaluators = [simple_evaluator, content_length_evaluator, accuracy_evaluator]

    try:
        new_result = phoenix_client.experiments.run_experiment(
            dataset=new_dataset,
            task=simple_sync_task,
            evaluators=evaluators,
            experiment_name="new_client_with_evaluators",
            dry_run=False,
        )
        new_success = len(new_result["evaluation_runs"]) > 0
    except Exception as e:
        results.add_error("with_evaluators", e, "new_client")
        new_success = False

    try:
        legacy_result = legacy_run_experiment(
            dataset=legacy_dataset,
            task=simple_sync_task,
            evaluators=evaluators,
            experiment_name="legacy_with_evaluators",
            dry_run=False,
        )
        legacy_success = len(legacy_result.eval_runs) > 0
    except Exception as e:
        results.add_error("with_evaluators", e, "legacy")
        legacy_success = False

    results.add_result(
        "with_evaluators", new_success, legacy_success, "Experiments with evaluators"
    )


def test_error_handling(new_dataset: Any, legacy_dataset: LegacyDataset, results: TestResults):
    """Test error handling in experiments."""
    print("\n❌ Testing error handling...")

    # Test with failing task
    try:
        new_result = phoenix_client.experiments.run_experiment(
            dataset=new_dataset,
            task=failing_task,
            experiment_name="new_client_failing",
            dry_run=False,
        )
        new_has_errors = any("error" in run.get("error", "") for run in new_result["task_runs"])
    except Exception as e:
        new_has_errors = True

    try:
        legacy_result = legacy_run_experiment(
            dataset=legacy_dataset,
            task=failing_task,
            experiment_name="legacy_failing",
            dry_run=False,
        )
        legacy_has_errors = any(run.error is not None for run in legacy_result.runs.values())
    except Exception as e:
        legacy_has_errors = True

    results.add_result(
        "error_handling", new_has_errors, legacy_has_errors, "Error handling in tasks"
    )


async def test_async_experiments(
    new_dataset: Any, legacy_dataset: LegacyDataset, results: TestResults
):
    """Test async experiment functionality."""
    print("\n⚡ Testing async experiments...")

    # Test async task with new client
    try:
        new_result = await phoenix_async_client.experiments.run_experiment(
            dataset=new_dataset,
            task=simple_async_task,
            experiment_name="new_client_async",
            dry_run=False,
        )
        new_success = len(new_result["task_runs"]) > 0
    except Exception as e:
        results.add_error("async_task", e, "new_client")
        new_success = False

    # Test async task with legacy client
    try:
        legacy_result = legacy_run_experiment(
            dataset=legacy_dataset,
            task=simple_async_task,
            experiment_name="legacy_async",
            dry_run=False,
        )
        legacy_success = len(legacy_result.runs) > 0
    except Exception as e:
        results.add_error("async_task", e, "legacy")
        legacy_success = False

    results.add_result("async_task", new_success, legacy_success, "Async task execution")

    # Test async evaluators
    try:
        new_result = await phoenix_async_client.experiments.run_experiment(
            dataset=new_dataset,
            task=simple_sync_task,
            evaluators=[async_evaluator],
            experiment_name="new_client_async_eval",
            dry_run=False,
        )
        new_success = len(new_result["evaluation_runs"]) > 0
    except Exception as e:
        results.add_error("async_evaluator", e, "new_client")
        new_success = False

    try:
        legacy_result = legacy_run_experiment(
            dataset=legacy_dataset,
            task=simple_sync_task,
            evaluators=[async_evaluator],
            experiment_name="legacy_async_eval",
            dry_run=False,
        )
        legacy_success = len(legacy_result.eval_runs) > 0
    except Exception as e:
        results.add_error("async_evaluator", e, "legacy")
        legacy_success = False

    results.add_result("async_evaluator", new_success, legacy_success, "Async evaluators")


def test_dataset_functionality(results: TestResults):
    """Test dataset creation and management."""
    print("\n📊 Testing dataset functionality...")

    # Test dataset creation
    try:
        test_dataset = phoenix_client.datasets.create_dataset(
            name=f"test_create_{int(time.time())}",
            inputs=[{"question": "Test question"}],
            outputs=[{"answer": "Test answer"}],
            metadata=[{"test": True}],
        )
        create_success = len(test_dataset.examples) > 0
    except Exception as e:
        results.add_error("dataset_creation", e, "new_client")
        create_success = False

    results.add_result(
        "dataset_creation", create_success, "N/A", "Dataset creation (new client only)"
    )

    # Test dataset retrieval
    try:
        retrieved_dataset = phoenix_client.datasets.get_dataset(dataset=test_dataset.id)
        retrieve_success = retrieved_dataset.id == test_dataset.id
    except Exception as e:
        results.add_error("dataset_retrieval", e, "new_client")
        retrieve_success = False

    results.add_result(
        "dataset_retrieval", retrieve_success, "N/A", "Dataset retrieval (new client only)"
    )


def test_dry_run_functionality(
    new_dataset: Any, legacy_dataset: LegacyDataset, results: TestResults
):
    """Test dry run functionality."""
    print("\n🌵 Testing dry run functionality...")

    # Test dry run with boolean
    try:
        new_result = phoenix_client.experiments.run_experiment(
            dataset=new_dataset,
            task=simple_sync_task,
            experiment_name="new_client_dry_run_bool",
            dry_run=False,
        )
        new_success = new_result["experiment_id"] == "DRY_RUN"
    except Exception as e:
        results.add_error("dry_run_bool", e, "new_client")
        new_success = False

    try:
        legacy_result = legacy_run_experiment(
            dataset=legacy_dataset,
            task=simple_sync_task,
            experiment_name="legacy_dry_run_bool",
            dry_run=False,
        )
        legacy_success = legacy_result.id.startswith("DRY_RUN")
    except Exception as e:
        results.add_error("dry_run_bool", e, "legacy")
        legacy_success = False

    results.add_result("dry_run_bool", new_success, legacy_success, "Dry run with boolean")

    # Test dry run with sample size
    try:
        new_result = phoenix_client.experiments.run_experiment(
            dataset=new_dataset,
            task=simple_sync_task,
            experiment_name="new_client_dry_run_sample",
            dry_run=2,
        )
        new_success = len(new_result["task_runs"]) <= 2
    except Exception as e:
        results.add_error("dry_run_sample", e, "new_client")
        new_success = False

    try:
        legacy_result = legacy_run_experiment(
            dataset=legacy_dataset,
            task=simple_sync_task,
            experiment_name="legacy_dry_run_sample",
            dry_run=2,
        )
        legacy_success = len(legacy_result.runs) <= 2
    except Exception as e:
        results.add_error("dry_run_sample", e, "legacy")
        legacy_success = False

    results.add_result("dry_run_sample", new_success, legacy_success, "Dry run with sample size")


def test_rate_limiting(new_dataset: Any, legacy_dataset: LegacyDataset, results: TestResults):
    """Test rate limiting functionality."""
    print("\n🚦 Testing rate limiting...")

    # Simulate rate limit errors
    class MockRateLimitError(Exception):
        pass

    try:
        new_result = phoenix_client.experiments.run_experiment(
            dataset=new_dataset,
            task=simple_sync_task,
            experiment_name="new_client_rate_limit",
            rate_limit_errors=MockRateLimitError,
            dry_run=False,
        )
        new_success = len(new_result["task_runs"]) > 0
    except Exception as e:
        results.add_error("rate_limiting", e, "new_client")
        new_success = False

    try:
        legacy_result = legacy_run_experiment(
            dataset=legacy_dataset,
            task=simple_sync_task,
            experiment_name="legacy_rate_limit",
            rate_limit_errors=MockRateLimitError,
            dry_run=False,
        )
        legacy_success = len(legacy_result.runs) > 0
    except Exception as e:
        results.add_error("rate_limiting", e, "legacy")
        legacy_success = False

    results.add_result("rate_limiting", new_success, legacy_success, "Rate limiting configuration")


async def main():
    """Run all tests."""
    print("🚀 Starting comprehensive Phoenix experiments test...")
    print("This test compares new client vs legacy experiment functionality")

    results = TestResults()

    # Set up test data
    try:
        new_dataset, legacy_dataset = create_test_dataset()
        print(f"✓ Created test datasets: {new_dataset.name} ({len(new_dataset.examples)} examples)")
    except Exception as e:
        print(f"❌ Failed to create test datasets: {e}")
        return

    # Run all tests
    test_basic_experiments(new_dataset, legacy_dataset, results)
    test_experiments_with_evaluators(new_dataset, legacy_dataset, results)
    test_error_handling(new_dataset, legacy_dataset, results)
    await test_async_experiments(new_dataset, legacy_dataset, results)
    test_dataset_functionality(results)
    test_dry_run_functionality(new_dataset, legacy_dataset, results)
    test_rate_limiting(new_dataset, legacy_dataset, results)

    # Print summary
    results.print_summary()

    print("\n🎉 Test completed!")
    print("Check your Phoenix UI at http://localhost:6006 to see the generated traces.")


if __name__ == "__main__":
    print("Phoenix Experiments Comprehensive Test")
    print("=" * 50)
    print("This script tests both new client and legacy experiment functionality")
    print("Make sure Phoenix is running at http://localhost:6006")
    print("Make sure you have ANTHROPIC_API_KEY set in your environment")
    print("=" * 50)

    asyncio.run(main())
