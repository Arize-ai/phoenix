# pyright: reportUnknownMemberType=false, reportCallIssue=false

from __future__ import annotations

from pathlib import Path
from secrets import token_hex
from typing import Any

import pandas as pd
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.datasets import Dataset

from .._helpers import _AppInfo, _await_or_return, _gql


class TestDatasetIntegration:
    """Integration tests for dataset operations against a real Phoenix server."""

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_create_and_get_dataset(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_dataset_{token_hex(4)}"

        # Create dataset with JSON data
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "What is 2+2?"}, {"text": "What is the capital of France?"}],
                outputs=[{"answer": "4"}, {"answer": "Paris"}],
                metadata=[{"category": "math"}, {"category": "geography"}],
                dataset_description="A test dataset for integration testing",
            )
        )

        assert dataset.name == unique_name
        assert dataset.description == "A test dataset for integration testing"
        assert len(dataset) == 2
        assert dataset[0]["input"]["text"] == "What is 2+2?"
        assert dataset[0]["output"]["answer"] == "4"

        # Get the same dataset
        retrieved = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=unique_name
            )
        )

        assert retrieved.id == dataset.id
        assert retrieved.version_id == dataset.version_id
        assert len(retrieved) == 2

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_add_examples_to_dataset(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_dataset_{token_hex(4)}"

        # Create initial dataset
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "Hello"}],
                outputs=[{"response": "Hi"}],
            )
        )

        assert len(dataset) == 1

        # Add more examples
        updated = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.add_examples_to_dataset(
                dataset=dataset,  # Pass the dataset object
                inputs=[{"text": "Goodbye"}, {"text": "Thanks"}],
                outputs=[{"response": "Bye"}, {"response": "You're welcome"}],
            )
        )

        assert len(updated) == 3
        assert updated.id == dataset.id
        assert updated.version_id != dataset.version_id  # New version

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dataset_versions(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_dataset_{token_hex(4)}"

        # Create dataset
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "v1"}],
                outputs=[{"response": "version 1"}],
            )
        )

        # Add examples to create new version
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.add_examples_to_dataset(
                dataset=dataset,
                inputs=[{"text": "v2"}],
                outputs=[{"response": "version 2"}],
            )
        )

        # Get versions
        versions = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset_versions(
                dataset=dataset
            )
        )

        assert len(versions) >= 2
        assert all("version_id" in v for v in versions)
        assert all("created_at" in v for v in versions)

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_create_dataset_from_csv(
        self,
        is_async: bool,
        _app: _AppInfo,
        tmp_path: Path,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create CSV file with split column
        csv_file = tmp_path / "test_data.csv"
        csv_content = """question,answer,category,data_split
What is 2+2?,4,math,train
Capital of France?,Paris,geography,test
Who wrote Hamlet?,Shakespeare,literature,train
"""
        csv_file.write_text(csv_content)

        unique_name = f"test_csv_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                csv_file_path=csv_file,
                input_keys=["question"],
                output_keys=["answer"],
                metadata_keys=["category"],
                split_keys=["data_split"],
            )
        )

        assert len(dataset) == 3
        assert dataset[0]["input"]["question"] == "What is 2+2?"
        assert dataset[0]["output"]["answer"] == "4"
        assert dataset[0]["metadata"]["category"] == "math"

        # Verify split filtering works - "train" split should return 2 examples
        train_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=dataset.id,
                splits=["train"],
            )
        )
        assert len(train_dataset) == 2

        # "test" split should return 1 example
        test_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=dataset.id,
                splits=["test"],
            )
        )
        assert len(test_dataset) == 1

        # Test add_examples_to_dataset with CSV and split_keys
        append_csv = tmp_path / "append_data.csv"
        append_csv.write_text("""question,answer,category,data_split
What is 3+3?,6,math,train
Capital of Germany?,Berlin,geography,validation
""")
        updated_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.add_examples_to_dataset(
                dataset=dataset.id,
                csv_file_path=append_csv,
                input_keys=["question"],
                output_keys=["answer"],
                metadata_keys=["category"],
                split_keys=["data_split"],
            )
        )
        assert len(updated_dataset) == 5

        # Verify train now has 3 examples (2 original + 1 appended)
        train_after = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=dataset.id,
                splits=["train"],
            )
        )
        assert len(train_after) == 3

        # Verify new "validation" split has 1 example
        validation_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=dataset.id,
                splits=["validation"],
            )
        )
        assert len(validation_dataset) == 1

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_create_dataset_from_dataframe(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        df = pd.DataFrame(
            {
                "prompt": ["Write a poem", "Tell a joke", "Explain gravity"],
                "response": ["Roses are red...", "Why did the chicken...", "Gravity is a force..."],
                "rating": [5, 4, 5],
            }
        )

        unique_name = f"test_df_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                dataframe=df,
                input_keys=["prompt"],
                output_keys=["response"],
                metadata_keys=["rating"],
            )
        )

        assert len(dataset) == 3
        assert dataset[0]["input"]["prompt"] == "Write a poem"
        assert dataset[1]["output"]["response"] == "Why did the chicken..."
        assert dataset[2]["metadata"]["rating"] == "5"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dataset_to_dataframe_round_trip(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_roundtrip_{token_hex(4)}"

        # Create dataset
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"question": "What is AI?", "context": "technology"},
                    {"question": "Define ML", "context": "tech"},
                ],
                outputs=[
                    {"answer": "Artificial Intelligence", "confidence": 0.9},
                    {"answer": "Machine Learning", "confidence": 0.95},
                ],
                metadata=[
                    {"source": "wiki", "verified": True},
                    {"source": "textbook", "verified": True},
                ],
            )
        )

        # Convert to DataFrame
        df = dataset.to_dataframe()

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2
        assert list(df.columns) == ["input", "output", "metadata"]

        # Extract data from DataFrame
        inputs: list[dict[str, Any]] = df["input"].tolist()  # pyright: ignore[reportUnknownVariableType]
        outputs: list[dict[str, Any]] = df["output"].tolist()  # pyright: ignore[reportUnknownVariableType]
        metadata: list[dict[str, Any]] = df["metadata"].tolist()  # pyright: ignore[reportUnknownVariableType]

        # Create new dataset from DataFrame data
        new_name = f"test_from_df_{token_hex(4)}"
        new_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=new_name,
                inputs=inputs,  # pyright: ignore[reportUnknownArgumentType]
                outputs=outputs,  # pyright: ignore[reportUnknownArgumentType]
                metadata=metadata,  # pyright: ignore[reportUnknownArgumentType]
            )
        )

        assert len(new_dataset) == 2
        assert new_dataset[0]["input"] == dataset[0]["input"]
        assert new_dataset[0]["output"] == dataset[0]["output"]

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dataset_examples_parameter(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create source dataset
        source_name = f"test_source_{token_hex(4)}"
        source = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=source_name,
                inputs=[{"q": "Q1"}, {"q": "Q2"}, {"q": "Q3"}],
                outputs=[{"a": "A1"}, {"a": "A2"}, {"a": "A3"}],
                metadata=[{"idx": 1}, {"idx": 2}, {"idx": 3}],
            )
        )

        # Create target dataset with single example from source
        target_name = f"test_target_{token_hex(4)}"
        target = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=target_name,
                examples=source[0],  # Single example
            )
        )

        assert len(target) == 1
        assert target[0]["input"] == {"q": "Q1"}
        assert target[0]["output"] == {"a": "A1"}

        # Add multiple examples
        updated = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.add_examples_to_dataset(
                dataset=target,
                examples=source.examples[1:3],  # Multiple examples
            )
        )

        assert len(updated) == 3

        # Test creating dataset with splits via examples parameter
        splits_name = f"test_splits_{token_hex(4)}"
        splits_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=splits_name,
                examples=[
                    {"input": {"q": "Q1"}, "output": {"a": "A1"}, "splits": "train"},
                    {"input": {"q": "Q2"}, "output": {"a": "A2"}, "splits": ["test", "hard"]},
                    {"input": {"q": "Q3"}, "output": {"a": "A3"}, "splits": None},
                ],
            )
        )
        assert len(splits_dataset) == 3

        # Verify split filtering works
        train_only = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=splits_dataset.id,
                splits=["train"],
            )
        )
        assert len(train_only) == 1

        test_only = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=splits_dataset.id,
                splits=["test"],
            )
        )
        assert len(test_only) == 1

        # Test add_examples_to_dataset with splits (ensures client append+splits works)
        updated_splits_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.add_examples_to_dataset(
                dataset=splits_dataset.id,
                examples=[
                    {"input": {"q": "Q4"}, "output": {"a": "A4"}, "splits": "train"},
                    {"input": {"q": "Q5"}, "output": {"a": "A5"}, "splits": ["test", "new_split"]},
                ],
            )
        )
        assert len(updated_splits_dataset) == 5

        # Verify train now has 2 examples (Q1 + Q4)
        train_after_append = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=splits_dataset.id,
                splits=["train"],
            )
        )
        assert len(train_after_append) == 2

        # Verify test now has 2 examples (Q2 + Q5)
        test_after_append = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=splits_dataset.id,
                splits=["test"],
            )
        )
        assert len(test_after_append) == 2

        # Verify new_split has 1 example (Q5)
        new_split_examples = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=splits_dataset.id,
                splits=["new_split"],
            )
        )
        assert len(new_split_examples) == 1

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dataset_identifier_flexibility(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_flex_{token_hex(4)}"

        # Create dataset
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                inputs=[{"text": "test"}],
                outputs=[{"result": "success"}],
            )
        )

        # Get by ID
        by_id = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(dataset=dataset.id)
        )
        assert by_id.id == dataset.id

        # Get by name
        by_name = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=unique_name
            )
        )
        assert by_name.id == dataset.id

        # Get by dataset object
        by_obj = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(dataset=dataset)
        )
        assert by_obj.id == dataset.id

        # Get by dict
        by_dict = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset={"id": dataset.id, "name": unique_name}
            )
        )
        assert by_dict.id == dataset.id

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_error_handling(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Test dataset not found
        with pytest.raises(ValueError, match="Dataset not found"):
            await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                    dataset="non_existent_dataset_xyz123"
                )
            )

        # Test invalid input data
        with pytest.raises(ValueError, match="inputs must be non-empty"):
            await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                    name="test",
                    inputs=[],
                    outputs=[],
                )
            )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dataset_examples_direct_pass(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test that dataset.examples can be passed directly to add_examples_to_dataset."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create source dataset with multiple examples
        source_name = f"test_source_{token_hex(4)}"
        source_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=source_name,
                inputs=[
                    {"question": "What is Python?", "difficulty": "easy"},
                    {"question": "Explain async/await", "difficulty": "medium"},
                    {"question": "What are metaclasses?", "difficulty": "hard"},
                ],
                outputs=[
                    {"answer": "A programming language", "confidence": 0.95},
                    {"answer": "Concurrency primitives", "confidence": 0.85},
                    {"answer": "Classes that create classes", "confidence": 0.80},
                ],
                metadata=[
                    {"topic": "basics", "reviewed": True},
                    {"topic": "concurrency", "reviewed": True},
                    {"topic": "advanced", "reviewed": False},
                ],
            )
        )

        assert len(source_dataset) == 3

        # Create empty target dataset
        target_name = f"test_target_{token_hex(4)}"
        target_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=target_name,
                inputs=[{"placeholder": "initial"}],
                outputs=[{"placeholder": "initial"}],
            )
        )

        assert len(target_dataset) == 1

        # Pass dataset.examples directly to add_examples_to_dataset
        updated_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.add_examples_to_dataset(
                dataset=target_dataset,
                examples=source_dataset.examples,  # Direct pass of examples list
            )
        )

        # Should have original + all source examples
        assert len(updated_dataset) == 4

        # Verify the examples were copied correctly
        # Skip the first example (placeholder) and compare the rest
        for i, source_example in enumerate(source_dataset.examples):
            target_example = updated_dataset.examples[i + 1]  # +1 to skip placeholder

            # Compare the content (excluding IDs which will be different)
            assert target_example["input"] == source_example["input"]
            assert target_example["output"] == source_example["output"]
            assert target_example["metadata"] == source_example["metadata"]

        # Also test passing a subset of examples
        subset_target_name = f"test_subset_{token_hex(4)}"
        subset_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=subset_target_name,
                examples=source_dataset.examples[:2],  # Only first 2 examples
            )
        )

        assert len(subset_dataset) == 2
        assert subset_dataset[0]["input"]["question"] == "What is Python?"
        assert subset_dataset[1]["input"]["question"] == "Explain async/await"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_legacy_experiments_compatibility(
        self,
        is_async: bool,
        _app: _AppInfo,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        api_key = _app.admin_secret
        monkeypatch.setenv("PHOENIX_API_KEY", api_key)

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_legacy_compat_{token_hex(4)}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"question": "What is 2+2?"},
                    {"question": "What is the capital of France?"},
                    {"question": "Who wrote Hamlet?"},
                ],
                outputs=[
                    {"answer": "4"},
                    {"answer": "Paris"},
                    {"answer": "Shakespeare"},
                ],
                metadata=[
                    {"category": "math", "difficulty": "easy"},
                    {"category": "geography", "difficulty": "easy"},
                    {"category": "literature", "difficulty": "medium"},
                ],
            )
        )

        from phoenix.experiments.functions import run_experiment

        def simple_task(input: dict[str, Any]) -> str:
            return f"Answer: {input['question']}"

        def simple_evaluator(output: str, expected: dict[str, Any]) -> float:
            return 1.0 if expected["answer"] in output else 0.0

        result = run_experiment(
            dataset=dataset,
            task=simple_task,
            evaluators=[simple_evaluator],
            experiment_name=f"test_legacy_compat_{token_hex(4)}",
            dry_run=True,  # Use dry run to avoid database operations
            print_summary=False,
        )

        assert result is not None
        assert len(result.runs) > 0

        assert hasattr(result.dataset, "examples")
        assert hasattr(result.dataset.examples, "values")
        assert hasattr(result.dataset.examples, "get")

        first_example = result.dataset[0]
        assert hasattr(first_example, "input")
        assert hasattr(first_example, "output")
        assert hasattr(first_example, "metadata")
        assert hasattr(first_example, "id")

        assert "question" in first_example.input
        assert "answer" in first_example.output
        assert "category" in first_example.metadata

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dataset_json_round_trip(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test that Dataset.to_dict() and Dataset.from_dict() work correctly for round-tripping."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from phoenix.client.resources.datasets import Dataset

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_json_roundtrip_{token_hex(4)}"

        original_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {
                        "question": "What is machine learning?",
                        "context": "AI basics",
                        "difficulty": 1,
                    },
                    {
                        "question": "Explain neural networks",
                        "context": "Deep learning",
                        "difficulty": 3,
                    },
                    {
                        "question": "What is overfitting?",
                        "context": "Model training",
                        "difficulty": 2,
                    },
                ],
                outputs=[
                    {
                        "answer": "A subset of AI",
                        "confidence": 0.9,
                        "sources": ["textbook", "paper"],
                    },
                    {"answer": "Interconnected nodes", "confidence": 0.85, "sources": ["lecture"]},
                    {
                        "answer": "Model memorizes training data",
                        "confidence": 0.95,
                        "sources": ["docs"],
                    },
                ],
                metadata=[
                    {"topic": "basics", "reviewed": True, "tags": ["ml", "ai"]},
                    {"topic": "deep-learning", "reviewed": False, "tags": ["neural", "networks"]},
                    {
                        "topic": "training",
                        "reviewed": True,
                        "tags": ["overfitting", "generalization"],
                    },
                ],
                dataset_description="Test dataset for JSON round-trip functionality",
            )
        )

        json_data = original_dataset.to_dict()

        assert json_data["id"] == original_dataset.id
        assert json_data["name"] == original_dataset.name
        assert json_data["description"] == original_dataset.description
        assert json_data["version_id"] == original_dataset.version_id
        assert json_data["example_count"] == original_dataset.example_count
        assert len(json_data["examples"]) == len(original_dataset.examples)

        if json_data.get("created_at"):
            assert isinstance(json_data["created_at"], str)
        if json_data.get("updated_at"):
            assert isinstance(json_data["updated_at"], str)

        restored_dataset = Dataset.from_dict(json_data)

        assert restored_dataset.id == original_dataset.id
        assert restored_dataset.name == original_dataset.name
        assert restored_dataset.description == original_dataset.description
        assert restored_dataset.version_id == original_dataset.version_id
        assert restored_dataset.example_count == original_dataset.example_count
        assert restored_dataset.metadata == original_dataset.metadata
        assert len(restored_dataset.examples) == len(original_dataset.examples)

        if original_dataset.created_at:
            assert restored_dataset.created_at == original_dataset.created_at
        if original_dataset.updated_at:
            assert restored_dataset.updated_at == original_dataset.updated_at

        for i, original_example in enumerate(original_dataset.examples):
            restored_example = restored_dataset.examples[i]

            assert restored_example["id"] == original_example["id"]
            assert restored_example["input"] == original_example["input"]
            assert restored_example["output"] == original_example["output"]
            assert restored_example["metadata"] == original_example["metadata"]

        assert len(restored_dataset) == len(original_dataset)
        assert list(restored_dataset) == list(original_dataset)
        assert restored_dataset[0] == original_dataset[0]

        invalid_json = {"id": "test", "name": "test"}
        with pytest.raises(ValueError, match="Missing required fields"):
            Dataset.from_dict(invalid_json)

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_list_datasets_with_pagination(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """
        Test comprehensive list() functionality for datasets.

        This test creates datasets with different example counts and verifies the list API,
        which internally tests pagination functionality:

        **Setup:**
        - Creates 2 datasets with 1 example each
        - Creates 1 dataset with 0 examples

        **Test Coverage:**
        - list() method with example_count always included
        - Pagination functionality tested indirectly through list() with various limits
        - Consistent ordering across different limit values (datasets ordered by ID DESC)
        - Verifying dataset structure and metadata fields
        - Accurate example_count reporting for datasets with 0 and 1 examples
        - GraphQL example deletion functionality
        - Consistency between list and get_dataset APIs
        - Type safety with proper v1.Dataset annotations
        """  # noqa: E501
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # ===== SETUP PHASE: Create test datasets with different example counts =====

        # Minimal dataset creation for efficiency - 2 with 1 example, 1 with 0 examples
        test_prefix = f"test_order_{token_hex(6)}"

        query = (
            "mutation($input:DeleteDatasetExamplesInput!){"
            "deleteDatasetExamples(input:$input){dataset{id}}}"
        )

        # Create datasets with predictable names for easier identification
        created_datasets: list[Dataset] = []
        created_dataset_ids: set[str] = set()

        # Part 1: Create 2 datasets with 1 example each
        for i in range(2):
            name = f"{test_prefix}_one_example_{i}"
            dataset = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                    name=name,
                    inputs=[{"text": f"input {i}"}, {}],  # 2 examples initially
                    outputs=[{"result": f"output {i}"}, {}],
                    metadata=[{"index": i}, {}],
                    dataset_description=f"Test dataset {name}",
                )
            )
            created_datasets.append(dataset)
            created_dataset_ids.add(dataset.id)

            # Delete second example to end up with 1 example
            _gql(
                _app,
                _app.admin_secret,
                query=query,
                variables={"input": {"exampleIds": [dataset.examples[1]["id"]]}},
            )

        # Part 2: Create 1 dataset with 0 examples
        zero_name = f"{test_prefix}_zero_examples"
        zero_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=zero_name,
                inputs=[{}, {}],
                outputs=[{}, {}],
                metadata=[{}, {}],
                dataset_description=f"Dataset to be emptied {zero_name}",
            )
        )
        created_datasets.append(zero_dataset)
        created_dataset_ids.add(zero_dataset.id)

        # Delete all examples from zero dataset
        all_example_ids = [example["id"] for example in zero_dataset.examples]
        _gql(
            _app,
            _app.admin_secret,
            query=query,
            variables={"input": {"exampleIds": all_example_ids}},
        )

        # ===== HELPER FUNCTION FOR VALIDATION =====
        def validate_dataset_structure(dataset_dict: v1.Dataset) -> None:
            """Validate the structure and data types of a dataset dictionary against generated types."""
            # Validate required fields exist
            assert "id" in dataset_dict
            assert "name" in dataset_dict
            assert "description" in dataset_dict or dataset_dict.get("description") is None
            assert "metadata" in dataset_dict
            assert "created_at" in dataset_dict
            assert "updated_at" in dataset_dict
            assert "example_count" in dataset_dict

            # Validate data types against generated v1.Dataset type
            assert isinstance(dataset_dict["id"], str), (
                f"id should be str, got {type(dataset_dict['id'])}"
            )
            assert isinstance(dataset_dict["name"], str), (
                f"name should be str, got {type(dataset_dict['name'])}"
            )
            assert dataset_dict["description"] is None or isinstance(
                dataset_dict["description"], str
            ), f"description should be str or None, got {type(dataset_dict['description'])}"
            assert isinstance(dataset_dict["metadata"], dict), (
                f"metadata should be dict (Mapping), got {type(dataset_dict['metadata'])}"
            )
            assert isinstance(dataset_dict["created_at"], str), (
                f"created_at should be str, got {type(dataset_dict['created_at'])}"
            )
            assert isinstance(dataset_dict["updated_at"], str), (
                f"updated_at should be str, got {type(dataset_dict['updated_at'])}"
            )
            assert isinstance(dataset_dict["example_count"], int), (
                f"example_count should be int, got {type(dataset_dict['example_count'])}"
            )

            # Validate business logic constraints
            assert dataset_dict["example_count"] >= 0, (
                f"example_count should be non-negative, got {dataset_dict['example_count']}"
            )

        # ===== TESTING PHASE: Verify list() functionality =====

        # Test 1: Fetch datasets with different limits in strategic order to test ordering consistency
        # Since datasets are ordered by ID DESC (newest first), our newly created datasets should appear first

        # Fetch with different limits - do this strategically to test ordering
        single_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list(limit=1)
        )
        double_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list(limit=2)
        )
        triple_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list(limit=3)
        )

        # Validate basic structure and length
        assert isinstance(single_result, list) and len(single_result) == 1
        assert isinstance(double_result, list) and len(double_result) == 2
        assert isinstance(triple_result, list) and len(triple_result) == 3

        # Validate structure for all results
        for dataset_dict in single_result + double_result + triple_result:
            validate_dataset_structure(dataset_dict)

        # Test 2: Verify consistent ordering across different limits
        # The key insight: limited results should be prefixes of larger results in the same order

        # First item should be consistent across all limits
        assert single_result[0]["id"] == double_result[0]["id"], (
            "First item should be consistent between limit=1 and limit=2"
        )
        assert double_result[0]["id"] == triple_result[0]["id"], (
            "First item should be consistent between limit=2 and limit=3"
        )

        # First 2 items from triple should match double result exactly
        for i in range(2):
            assert double_result[i]["id"] == triple_result[i]["id"], (
                f"Item {i} should be identical between limit=2 and limit=3 results"
            )
            assert double_result[i]["name"] == triple_result[i]["name"], (
                f"Item {i} name should be identical between limit=2 and limit=3 results"
            )

        # Test 3: Verify our created datasets appear in the results and validate example counts
        # Since we created 3 datasets most recently, they should be in the first 3 results (ID DESC order)
        found_our_datasets = 0
        for dataset_dict in triple_result:
            if dataset_dict["id"] in created_dataset_ids:
                found_our_datasets += 1
                # Validate example counts for our test datasets
                if dataset_dict["name"].endswith("_zero_examples"):
                    assert dataset_dict["example_count"] == 0, (
                        f"Zero example dataset should have 0 examples, got {dataset_dict['example_count']}"
                    )
                elif "_one_example_" in dataset_dict["name"]:
                    assert dataset_dict["example_count"] == 1, (
                        f"One example dataset should have 1 example, got {dataset_dict['example_count']}"
                    )

        # We should find all 3 of our datasets in the first 3 results due to DESC ordering
        assert found_our_datasets == 3, (
            f"Expected to find all 3 created datasets in first 3 results, found {found_our_datasets}"
        )

        # Test 4: Test unlimited list() and consistency
        all_datasets = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list()
        )
        assert isinstance(all_datasets, list)
        assert len(all_datasets) >= 3  # Should have at least our 3 test datasets

        # First 3 items from unlimited should match our triple_result
        for i in range(3):
            assert all_datasets[i]["id"] == triple_result[i]["id"], (
                f"Item {i} should be identical between unlimited and limit=3 results"
            )

        # Test 5: Consistency with get_dataset (using one of our known datasets)
        test_dataset = created_datasets[0]  # Use first created dataset
        individual_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=test_dataset.id
            )
        )

        # Find our test dataset in the results
        test_dataset_from_list = None
        for dataset_dict in all_datasets:
            if dataset_dict["id"] == test_dataset.id:
                test_dataset_from_list = dataset_dict
                break

        assert test_dataset_from_list is not None, (
            f"Test dataset {test_dataset.id} not found in list"
        )

        # Compare key fields (list doesn't include examples)
        assert test_dataset_from_list["id"] == individual_dataset.id
        assert test_dataset_from_list["name"] == individual_dataset.name
        assert test_dataset_from_list["description"] == individual_dataset.description
        assert test_dataset_from_list["metadata"] == individual_dataset.metadata

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dataset_with_splits(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test dataset splits functionality including creating splits and filtering by splits."""
        api_key = _app.admin_secret
        api_key_str = str(api_key)

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_splits_{token_hex(4)}"

        # Create dataset with examples
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key_str).datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"text": "Example 1"},
                    {"text": "Example 2"},
                    {"text": "Example 3"},
                    {"text": "Example 4"},
                ],
                outputs=[
                    {"label": "A"},
                    {"label": "B"},
                    {"label": "A"},
                    {"label": "B"},
                ],
                metadata=[{}, {}, {}, {}],
            )
        )

        assert len(dataset) == 4
        example_ids = [example["id"] for example in dataset.examples]

        # Create splits using GraphQL
        # Split 1: Examples 0 and 1
        split1_mutation = """
            mutation($input: CreateDatasetSplitWithExamplesInput!) {
                createDatasetSplitWithExamples(input: $input) {
                    datasetSplit {
                        id
                        name
                    }
                }
            }
        """
        split1_result, _ = _gql(
            _app,
            api_key,
            query=split1_mutation,
            variables={
                "input": {
                    "name": f"{unique_name}_train",
                    "color": "#FF0000",
                    "exampleIds": [example_ids[0], example_ids[1]],
                }
            },
        )
        split1_name = split1_result["data"]["createDatasetSplitWithExamples"]["datasetSplit"][
            "name"
        ]

        # Split 2: Examples 2 and 3
        split2_result, _ = _gql(
            _app,
            _app.admin_secret,
            query=split1_mutation,
            variables={
                "input": {
                    "name": f"{unique_name}_test",
                    "color": "#00FF00",
                    "exampleIds": [example_ids[2], example_ids[3]],
                }
            },
        )
        split2_name = split2_result["data"]["createDatasetSplitWithExamples"]["datasetSplit"][
            "name"
        ]

        # Get dataset without split filter - should return ALL examples regardless of split membership
        full_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key_str).datasets.get_dataset(
                dataset=dataset.id
            )
        )
        assert len(full_dataset) == 4, (
            f"Expected all 4 examples when no split filter is applied, got {len(full_dataset)}"
        )
        # When no split filter is applied, split_names should be empty (not filtering by any splits)
        assert full_dataset._filtered_split_names == [], (
            f"Expected empty split_names when no filter applied, got {full_dataset._filtered_split_names}"
        )

        # Verify all 4 example IDs are present in the unfiltered dataset
        unfiltered_example_ids = {example["id"] for example in full_dataset.examples}
        assert unfiltered_example_ids == set(example_ids), (
            "Unfiltered dataset should contain all original example IDs"
        )

        # Get dataset filtered by split 1 - should return 2 examples
        split1_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key_str).datasets.get_dataset(
                dataset=dataset.id,
                splits=[split1_name],
            )
        )
        assert len(split1_dataset) == 2, (
            f"Expected 2 examples with split1, got {len(split1_dataset)}"
        )
        assert split1_name in split1_dataset._filtered_split_names, (
            "Split1 name should be in _filtered_split_names"
        )

        # Get dataset filtered by split 2 - should return 2 examples
        split2_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key_str).datasets.get_dataset(
                dataset=dataset.id,
                splits=[split2_name],
            )
        )
        assert len(split2_dataset) == 2, (
            f"Expected 2 examples with split2, got {len(split2_dataset)}"
        )
        assert split2_name in split2_dataset._filtered_split_names, (
            "Split2 name should be in _filtered_split_names"
        )

        # Get dataset filtered by both splits - should return all 4 examples
        both_splits_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key_str).datasets.get_dataset(
                dataset=dataset.id,
                splits=[split1_name, split2_name],
            )
        )
        assert len(both_splits_dataset) == 4, (
            f"Expected 4 examples with both splits, got {len(both_splits_dataset)}"
        )
        assert split1_name in both_splits_dataset._filtered_split_names, (
            "Split1 name should be in _filtered_split_names"
        )
        assert split2_name in both_splits_dataset._filtered_split_names, (
            "Split2 name should be in _filtered_split_names"
        )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dataset_splits_no_duplicates(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test that filtering by multiple splits returns distinct examples (no duplicates)."""
        api_key = _app.admin_secret
        api_key_str = str(api_key)

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_splits_dedup_{token_hex(4)}"

        # Create dataset with examples
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key_str).datasets.create_dataset(
                name=unique_name,
                inputs=[
                    {"text": "Example 1 - in both splits"},
                    {"text": "Example 2 - in split 1 only"},
                    {"text": "Example 3 - in split 2 only"},
                    {"text": "Example 4 - in both splits"},
                ],
                outputs=[
                    {"label": "A"},
                    {"label": "B"},
                    {"label": "C"},
                    {"label": "D"},
                ],
                metadata=[{}, {}, {}, {}],
            )
        )

        assert len(dataset) == 4
        example_ids = [example["id"] for example in dataset.examples]

        # Create split 1: Examples 0, 1, 3 (examples 0 and 3 will also be in split 2)
        split1_mutation = """
            mutation($input: CreateDatasetSplitWithExamplesInput!) {
                createDatasetSplitWithExamples(input: $input) {
                    datasetSplit {
                        id
                        name
                    }
                }
            }
        """
        split1_result, _ = _gql(
            _app,
            _app.admin_secret,
            query=split1_mutation,
            variables={
                "input": {
                    "name": f"{unique_name}_split1",
                    "color": "#FF0000",
                    "exampleIds": [example_ids[0], example_ids[1], example_ids[3]],
                }
            },
        )
        split1_name = split1_result["data"]["createDatasetSplitWithExamples"]["datasetSplit"][
            "name"
        ]

        # Create split 2: Examples 0, 2, 3 (examples 0 and 3 overlap with split 1)
        split2_result, _ = _gql(
            _app,
            _app.admin_secret,
            query=split1_mutation,
            variables={
                "input": {
                    "name": f"{unique_name}_split2",
                    "color": "#00FF00",
                    "exampleIds": [example_ids[0], example_ids[2], example_ids[3]],
                }
            },
        )
        split2_name = split2_result["data"]["createDatasetSplitWithExamples"]["datasetSplit"][
            "name"
        ]

        # Get dataset filtered by split 1 only - should return 3 examples
        split1_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key_str).datasets.get_dataset(
                dataset=dataset.id,
                splits=[split1_name],
            )
        )
        assert len(split1_dataset) == 3, (
            f"Expected 3 examples with split1, got {len(split1_dataset)}"
        )
        split1_example_ids = {ex["id"] for ex in split1_dataset.examples}
        assert split1_example_ids == {example_ids[0], example_ids[1], example_ids[3]}, (
            f"Split1 should contain examples 0, 1, 3. Got: {split1_example_ids}"
        )

        # Get dataset filtered by split 2 only - should return 3 examples
        split2_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key_str).datasets.get_dataset(
                dataset=dataset.id,
                splits=[split2_name],
            )
        )
        assert len(split2_dataset) == 3, (
            f"Expected 3 examples with split2, got {len(split2_dataset)}"
        )
        split2_example_ids = {ex["id"] for ex in split2_dataset.examples}
        assert split2_example_ids == {example_ids[0], example_ids[2], example_ids[3]}, (
            f"Split2 should contain examples 0, 2, 3. Got: {split2_example_ids}"
        )

        # Get dataset filtered by BOTH splits - should return 4 DISTINCT examples
        # Even though examples 0 and 3 belong to both splits, they should only appear once
        both_splits_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key_str).datasets.get_dataset(
                dataset=dataset.id,
                splits=[split1_name, split2_name],
            )
        )

        # Critical assertion: verify no duplicates
        assert len(both_splits_dataset) == 4, (
            f"Expected 4 DISTINCT examples when filtering by both splits, got {len(both_splits_dataset)}. "
            f"This indicates duplicates are being returned!"
        )

        # Verify all 4 examples are present
        both_splits_example_ids = {ex["id"] for ex in both_splits_dataset.examples}
        assert both_splits_example_ids == set(example_ids), (
            f"Expected all 4 example IDs when filtering by both splits. "
            f"Expected: {set(example_ids)}, Got: {both_splits_example_ids}"
        )

        # Verify the split names are tracked correctly
        assert split1_name in both_splits_dataset._filtered_split_names, (
            "Split1 name should be in _filtered_split_names"
        )
        assert split2_name in both_splits_dataset._filtered_split_names, (
            "Split2 name should be in _filtered_split_names"
        )

        # Additional check: verify example IDs in the list are unique (no duplicates in the list)
        example_id_list = [ex["id"] for ex in both_splits_dataset.examples]
        assert len(example_id_list) == len(set(example_id_list)), (
            f"Duplicate example IDs found in results! IDs: {example_id_list}"
        )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_create_dataset_with_span_id_key_csv(
        self,
        is_async: bool,
        _app: _AppInfo,
        tmp_path: Path,
    ) -> None:
        """Test creating dataset with span_id_key parameter from CSV."""
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from sqlalchemy import insert, select

        from phoenix.db import models
        from phoenix.server.types import DbSessionFactory

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]
        api_key = _app.admin_secret

        # Get database session factory from the _app fixture
        # We need to create spans directly in the database first
        from phoenix.db.helpers import get_session_factory_from_env

        db = get_session_factory_from_env()

        # Create a project and spans in the database
        async with db() as session:
            from datetime import datetime, timezone

            # Create a project
            project_id = await session.scalar(
                insert(models.Project).values(name="test-project").returning(models.Project.id)
            )

            # Create a trace
            trace_id = await session.scalar(
                insert(models.Trace)
                .values(
                    project_rowid=project_id,
                    trace_id="test-trace-123",
                    start_time=datetime.now(timezone.utc),
                    end_time=datetime.now(timezone.utc),
                )
                .returning(models.Trace.id)
            )

            # Create spans with specific span_ids
            await session.execute(
                insert(models.Span).values(
                    [
                        {
                            "trace_rowid": trace_id,
                            "span_id": "span-abc-123",
                            "name": "test_span_1",
                            "span_kind": "INTERNAL",
                            "start_time": datetime.now(timezone.utc),
                            "end_time": datetime.now(timezone.utc),
                            "attributes": {},
                            "events": [],
                            "status_code": "OK",
                            "status_message": "",
                            "cumulative_error_count": 0,
                            "cumulative_llm_token_count_prompt": 0,
                            "cumulative_llm_token_count_completion": 0,
                        },
                        {
                            "trace_rowid": trace_id,
                            "span_id": "span-def-456",
                            "name": "test_span_2",
                            "span_kind": "INTERNAL",
                            "start_time": datetime.now(timezone.utc),
                            "end_time": datetime.now(timezone.utc),
                            "attributes": {},
                            "events": [],
                            "status_code": "OK",
                            "status_message": "",
                            "cumulative_error_count": 0,
                            "cumulative_llm_token_count_prompt": 0,
                            "cumulative_llm_token_count_completion": 0,
                        },
                    ]
                )
            )

            await session.commit()

        # Create CSV file with span_id column
        unique_name = f"test_span_links_{token_hex(4)}"
        csv_file = tmp_path / "test_data.csv"
        csv_content = """question,answer,trace_span_id
What is AI?,Artificial Intelligence,span-abc-123
What is ML?,Machine Learning,span-def-456
What is DL?,Deep Learning,nonexistent-span
What is NLP?,Natural Language Processing,
"""
        csv_file.write_text(csv_content)

        # Create dataset with span_id_key parameter
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                csv_file_path=csv_file,
                input_keys=["question"],
                output_keys=["answer"],
                span_id_key="trace_span_id",
            )
        )

        assert dataset.name == unique_name
        assert len(dataset) == 4

        # Verify examples were linked to spans in the database
        async with db() as session:
            examples = list(
                await session.scalars(
                    select(models.DatasetExample)
                    .join(models.Dataset)
                    .where(models.Dataset.name == unique_name)
                    .order_by(models.DatasetExample.id)
                )
            )

            # First example should be linked to span-abc-123
            assert examples[0].span_rowid is not None

            # Second example should be linked to span-def-456
            assert examples[1].span_rowid is not None

            # Third example has nonexistent span, should be None
            assert examples[2].span_rowid is None

            # Fourth example has empty span_id, should be None
            assert examples[3].span_rowid is None

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_create_dataset_with_span_id_key_dataframe(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test creating dataset with span_id_key parameter from DataFrame."""
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from sqlalchemy import insert, select

        from phoenix.db import models

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]
        api_key = _app.admin_secret

        # Get database session factory
        from phoenix.db.helpers import get_session_factory_from_env

        db = get_session_factory_from_env()

        # Create a project and spans in the database
        async with db() as session:
            from datetime import datetime, timezone

            # Create a project
            project_id = await session.scalar(
                insert(models.Project).values(name="test-project").returning(models.Project.id)
            )

            # Create a trace
            trace_id = await session.scalar(
                insert(models.Trace)
                .values(
                    project_rowid=project_id,
                    trace_id="test-trace-456",
                    start_time=datetime.now(timezone.utc),
                    end_time=datetime.now(timezone.utc),
                )
                .returning(models.Trace.id)
            )

            # Create spans
            await session.execute(
                insert(models.Span).values(
                    [
                        {
                            "trace_rowid": trace_id,
                            "span_id": "span-xyz-789",
                            "name": "test_span_3",
                            "span_kind": "INTERNAL",
                            "start_time": datetime.now(timezone.utc),
                            "end_time": datetime.now(timezone.utc),
                            "attributes": {},
                            "events": [],
                            "status_code": "OK",
                            "status_message": "",
                            "cumulative_error_count": 0,
                            "cumulative_llm_token_count_prompt": 0,
                            "cumulative_llm_token_count_completion": 0,
                        },
                    ]
                )
            )

            await session.commit()

        # Create DataFrame with span_id column
        unique_name = f"test_span_links_df_{token_hex(4)}"
        df = pd.DataFrame(
            {
                "input": ["What is Phoenix?", "What is OpenTelemetry?"],
                "output": ["An observability platform", "A telemetry framework"],
                "context.span_id": ["span-xyz-789", None],
            }
        )

        # Create dataset with span_id_key parameter
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                dataframe=df,
                input_keys=["input"],
                output_keys=["output"],
                span_id_key="context.span_id",
            )
        )

        assert dataset.name == unique_name
        assert len(dataset) == 2

        # Verify examples were linked to spans in the database
        async with db() as session:
            examples = list(
                await session.scalars(
                    select(models.DatasetExample)
                    .join(models.Dataset)
                    .where(models.Dataset.name == unique_name)
                    .order_by(models.DatasetExample.id)
                )
            )

            # First example should be linked to span-xyz-789
            assert examples[0].span_rowid is not None

            # Second example has None span_id, should be None
            assert examples[1].span_rowid is None

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_create_dataset_with_span_id_in_examples(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test creating dataset with span_id in examples parameter (JSON path)."""
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from sqlalchemy import insert, select

        from phoenix.db import models

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]
        api_key = _app.admin_secret

        # Get database session factory
        from phoenix.db.helpers import get_session_factory_from_env

        db = get_session_factory_from_env()

        # Create a project and spans in the database
        async with db() as session:
            from datetime import datetime, timezone

            # Create a project
            project_id = await session.scalar(
                insert(models.Project).values(name="test-project").returning(models.Project.id)
            )

            # Create a trace
            trace_id = await session.scalar(
                insert(models.Trace)
                .values(
                    project_rowid=project_id,
                    trace_id="test-trace-json",
                    start_time=datetime.now(timezone.utc),
                    end_time=datetime.now(timezone.utc),
                )
                .returning(models.Trace.id)
            )

            # Create spans
            await session.execute(
                insert(models.Span).values(
                    [
                        {
                            "trace_rowid": trace_id,
                            "span_id": "span-json-111",
                            "name": "test_span_json_1",
                            "span_kind": "INTERNAL",
                            "start_time": datetime.now(timezone.utc),
                            "end_time": datetime.now(timezone.utc),
                            "attributes": {},
                            "events": [],
                            "status_code": "OK",
                            "status_message": "",
                            "cumulative_error_count": 0,
                            "cumulative_llm_token_count_prompt": 0,
                            "cumulative_llm_token_count_completion": 0,
                        },
                        {
                            "trace_rowid": trace_id,
                            "span_id": "span-json-222",
                            "name": "test_span_json_2",
                            "span_kind": "INTERNAL",
                            "start_time": datetime.now(timezone.utc),
                            "end_time": datetime.now(timezone.utc),
                            "attributes": {},
                            "events": [],
                            "status_code": "OK",
                            "status_message": "",
                            "cumulative_error_count": 0,
                            "cumulative_llm_token_count_prompt": 0,
                            "cumulative_llm_token_count_completion": 0,
                        },
                    ]
                )
            )

            await session.commit()

        # Create dataset with span_id in examples
        unique_name = f"test_span_examples_{token_hex(4)}"
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                examples=[
                    {
                        "input": {"q": "What is span linking?"},
                        "output": {"a": "It links examples to traces"},
                        "span_id": "span-json-111",
                    },
                    {
                        "input": {"q": "How does it work?"},
                        "output": {"a": "By storing span_rowid"},
                        "span_id": "span-json-222",
                    },
                    {
                        "input": {"q": "What about missing spans?"},
                        "output": {"a": "They are handled gracefully"},
                        "span_id": "nonexistent-span",
                    },
                    {
                        "input": {"q": "What about None?"},
                        "output": {"a": "Also handled"},
                        "span_id": None,
                    },
                ],
            )
        )

        assert dataset.name == unique_name
        assert len(dataset) == 4

        # Verify examples were linked to spans in the database
        async with db() as session:
            examples = list(
                await session.scalars(
                    select(models.DatasetExample)
                    .join(models.Dataset)
                    .where(models.Dataset.name == unique_name)
                    .order_by(models.DatasetExample.id)
                )
            )

            # First example should be linked to span-json-111
            assert examples[0].span_rowid is not None

            # Second example should be linked to span-json-222
            assert examples[1].span_rowid is not None

            # Third example has nonexistent span, should be None
            assert examples[2].span_rowid is None

            # Fourth example has None span_id, should be None
            assert examples[3].span_rowid is None

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_add_examples_with_span_id(
        self,
        is_async: bool,
        _app: _AppInfo,
    ) -> None:
        """Test adding examples with span_id to existing dataset."""
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from sqlalchemy import insert, select

        from phoenix.db import models

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]
        api_key = _app.admin_secret

        # Get database session factory
        from phoenix.db.helpers import get_session_factory_from_env

        db = get_session_factory_from_env()

        # Create a project and spans in the database
        async with db() as session:
            from datetime import datetime, timezone

            # Create a project
            project_id = await session.scalar(
                insert(models.Project).values(name="test-project").returning(models.Project.id)
            )

            # Create a trace
            trace_id = await session.scalar(
                insert(models.Trace)
                .values(
                    project_rowid=project_id,
                    trace_id="test-trace-append",
                    start_time=datetime.now(timezone.utc),
                    end_time=datetime.now(timezone.utc),
                )
                .returning(models.Trace.id)
            )

            # Create spans
            await session.execute(
                insert(models.Span).values(
                    [
                        {
                            "trace_rowid": trace_id,
                            "span_id": "span-append-111",
                            "name": "test_span_append_1",
                            "span_kind": "INTERNAL",
                            "start_time": datetime.now(timezone.utc),
                            "end_time": datetime.now(timezone.utc),
                            "attributes": {},
                            "events": [],
                            "status_code": "OK",
                            "status_message": "",
                            "cumulative_error_count": 0,
                            "cumulative_llm_token_count_prompt": 0,
                            "cumulative_llm_token_count_completion": 0,
                        },
                    ]
                )
            )

            await session.commit()

        # Create initial dataset without span links
        unique_name = f"test_append_spans_{token_hex(4)}"
        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                examples=[
                    {"input": {"q": "Initial"}, "output": {"a": "Example"}},
                ],
            )
        )

        assert len(dataset) == 1

        # Add examples with span links
        updated_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.add_examples_to_dataset(
                dataset=dataset,
                examples=[
                    {
                        "input": {"q": "Added with span"},
                        "output": {"a": "Linked"},
                        "span_id": "span-append-111",
                    },
                ],
            )
        )

        assert len(updated_dataset) == 2

        # Verify the added example was linked to the span
        async with db() as session:
            examples = list(
                await session.scalars(
                    select(models.DatasetExample)
                    .join(models.Dataset)
                    .where(models.Dataset.name == unique_name)
                    .order_by(models.DatasetExample.id)
                )
            )

            # First example (original) should have no span link
            assert examples[0].span_rowid is None

            # Second example (added) should be linked to span-append-111
            assert examples[1].span_rowid is not None
