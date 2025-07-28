from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

import pandas as pd
import pytest
from phoenix.client.resources.datasets import Dataset
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput

from .._helpers import _ADMIN, _MEMBER, _AppInfo, _await_or_return, _GetUser, _gql


class TestDatasetIntegration:
    """Integration tests for dataset operations against a real Phoenix server."""

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_create_and_get_dataset(
        self,
        is_async: bool,
        role_or_user: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_dataset_{uuid.uuid4().hex[:8]}"

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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_add_examples_to_dataset(
        self,
        is_async: bool,
        role_or_user: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_dataset_{uuid.uuid4().hex[:8]}"

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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_dataset_versions(
        self,
        is_async: bool,
        role_or_user: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_dataset_{uuid.uuid4().hex[:8]}"

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
        _get_user: _GetUser,
        _app: _AppInfo,
        tmp_path: Path,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create CSV file
        csv_file = tmp_path / "test_data.csv"
        csv_content = """question,answer,category
What is 2+2?,4,math
Capital of France?,Paris,geography
Who wrote Hamlet?,Shakespeare,literature
"""
        csv_file.write_text(csv_content)

        unique_name = f"test_csv_{uuid.uuid4().hex[:8]}"

        dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=unique_name,
                csv_file_path=csv_file,
                input_keys=["question"],
                output_keys=["answer"],
                metadata_keys=["category"],
            )
        )

        assert len(dataset) == 3
        assert dataset[0]["input"]["question"] == "What is 2+2?"
        assert dataset[0]["output"]["answer"] == "4"
        assert dataset[0]["metadata"]["category"] == "math"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_create_dataset_from_dataframe(
        self,
        is_async: bool,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(user.create_api_key(_app))

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

        unique_name = f"test_df_{uuid.uuid4().hex[:8]}"

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
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_roundtrip_{uuid.uuid4().hex[:8]}"

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
        new_name = f"test_from_df_{uuid.uuid4().hex[:8]}"
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
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create source dataset
        source_name = f"test_source_{uuid.uuid4().hex[:8]}"
        source = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                name=source_name,
                inputs=[{"q": "Q1"}, {"q": "Q2"}, {"q": "Q3"}],
                outputs=[{"a": "A1"}, {"a": "A2"}, {"a": "A3"}],
                metadata=[{"idx": 1}, {"idx": 2}, {"idx": 3}],
            )
        )

        # Create target dataset with single example from source
        target_name = f"test_target_{uuid.uuid4().hex[:8]}"
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

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_dataset_identifier_flexibility(
        self,
        is_async: bool,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_flex_{uuid.uuid4().hex[:8]}"

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
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(user.create_api_key(_app))

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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_dataset_examples_direct_pass(
        self,
        is_async: bool,
        role_or_user: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that dataset.examples can be passed directly to add_examples_to_dataset."""
        user = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create source dataset with multiple examples
        source_name = f"test_source_{uuid.uuid4().hex[:8]}"
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
        target_name = f"test_target_{uuid.uuid4().hex[:8]}"
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
        subset_target_name = f"test_subset_{uuid.uuid4().hex[:8]}"
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
        _get_user: _GetUser,
        _app: _AppInfo,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(user.create_api_key(_app))
        monkeypatch.setenv("PHOENIX_API_KEY", api_key)

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_legacy_compat_{uuid.uuid4().hex[:8]}"

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
            experiment_name=f"test_legacy_compat_{uuid.uuid4().hex[:8]}",
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
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that Dataset.to_dict() and Dataset.from_dict() work correctly for round-tripping."""
        user = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from phoenix.client.resources.datasets import Dataset

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_json_roundtrip_{uuid.uuid4().hex[:8]}"

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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_list_and_paginate_datasets(
        self,
        is_async: bool,
        role_or_user: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test comprehensive list() and paginate() functionality for datasets."""
        user = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create multiple test datasets for comprehensive testing
        dataset_names = [f"test_list_{i}_{uuid.uuid4().hex[:8]}" for i in range(5)]

        created_datasets: list[Dataset] = []
        for i, name in enumerate(dataset_names):
            dataset = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).datasets.create_dataset(
                    name=name,
                    inputs=[{"text": f"test input for {name}"}, {}],
                    outputs=[{"result": f"test output for {name}"}, {}],
                    metadata=[{"index": i}, {}],
                    dataset_description=f"Test dataset {name}",
                )
            )
            created_datasets.append(dataset)
            # Use GraphQL to delete second example
            _gql(
                _app,
                _app.admin_secret,
                query="mutation($input:DeleteDatasetExamplesInput!){"
                "deleteDatasetExamples(input:$input){dataset{id}}}",
                variables={"input": {"exampleIds": [dataset.examples[1]["id"]]}},
            )

        # Test 1: Basic list functionality (get all datasets with counts)
        all_datasets = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list(
                include_example_count=True
            )
        )

        # Verify we got a list of all datasets
        assert isinstance(all_datasets, list)
        assert len(all_datasets) >= len(created_datasets)

        # Check that our created datasets are in the list
        dataset_ids = {d["id"] for d in all_datasets}
        for created_dataset in created_datasets:
            assert created_dataset.id in dataset_ids

            # Test 2: Verify structure of returned datasets
        for dataset_dict in all_datasets:
            assert "id" in dataset_dict
            assert "name" in dataset_dict
            assert "description" in dataset_dict or dataset_dict.get("description") is None
            assert "metadata" in dataset_dict
            assert "created_at" in dataset_dict
            assert "updated_at" in dataset_dict
            assert "example_count" in dataset_dict

            # Verify example_count is an integer
            assert isinstance(dataset_dict["example_count"], int)
            assert dataset_dict["example_count"] >= 0  # Should be non-negative

            # For our test datasets with counts enabled, verify expected example counts
            if dataset_dict["name"].startswith("test_list_"):
                assert "example_count" in dataset_dict
                assert dataset_dict["example_count"] == 1

        # Test 2a: Test without counts (faster, no example_count field)
        all_datasets_no_counts = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list()
        )

        # Verify structure without counts
        for dataset_dict in all_datasets_no_counts:
            assert "id" in dataset_dict
            assert "name" in dataset_dict
            assert "description" in dataset_dict or dataset_dict.get("description") is None
            assert "metadata" in dataset_dict
            assert "created_at" in dataset_dict
            assert "updated_at" in dataset_dict

            # example_count should be None when include_example_count=False
            assert dataset_dict.get("example_count") is None

        # Test 3: Test pagination with different limit values
        # Test with limit=2 and counts
        limited_response = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.paginate(
                limit=2, include_example_count=True
            )
        )
        assert isinstance(limited_response, dict)
        assert len(limited_response["data"]) == 2

        # Test with limit=1
        single_response = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.paginate(limit=1)
        )
        assert isinstance(single_response, dict)
        assert len(single_response["data"]) == 1

        # Test with larger limit
        large_limit_response = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.paginate(limit=100)
        )
        assert isinstance(large_limit_response, dict)
        assert len(large_limit_response["data"]) >= len(dataset_names)

        # Test 4: Test default pagination parameters
        default_response = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.paginate()
        )
        assert isinstance(default_response, dict)
        default_datasets = default_response["data"]
        # Should not exceed the default limit (100) unless there are really many datasets
        assert len(default_datasets) <= 100

        # Verify at least our test datasets are included
        default_dataset_names = {d["name"] for d in default_datasets}
        for name in dataset_names:
            assert name in default_dataset_names

        # Test 5: Test cursor-based pagination functionality
        # Test cursor-based pagination if we have a next_cursor
        if limited_response["next_cursor"]:
            next_page_response = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).datasets.paginate(
                    cursor=limited_response["next_cursor"], limit=2
                )
            )
            assert isinstance(next_page_response, dict)
            assert "data" in next_page_response
            assert "next_cursor" in next_page_response

            # Test 6: Test list method (get all datasets with counts)
        all_datasets_list = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list(
                include_example_count=True
            )
        )
        assert isinstance(all_datasets_list, list)
        assert len(all_datasets_list) >= len(created_datasets)

        # Test 6a: Verify example_count for both types of datasets in list_all results
        for dataset_dict in all_datasets_list:
            if dataset_dict["name"].startswith("test_list_"):
                assert "example_count" in dataset_dict
                assert dataset_dict["example_count"] == 1

        # Test 6b: Test list method without counts (faster)
        all_datasets_no_counts_list = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list()
        )
        assert isinstance(all_datasets_no_counts_list, list)
        assert len(all_datasets_no_counts_list) >= len(created_datasets)

        # Verify no example_count when include_example_count=False
        for dataset_dict in all_datasets_no_counts_list:
            assert "example_count" not in dataset_dict

        # Test 7: Test list method with limit parameter
        # Test with small limit
        limited_list_3 = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list(limit=3)
        )
        assert isinstance(limited_list_3, list)
        assert len(limited_list_3) == 3

        # Test with limit larger than available datasets
        large_limit_list = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list(limit=1000)
        )
        assert isinstance(large_limit_list, list)
        # Should not exceed the actual number of datasets
        assert len(large_limit_list) <= len(all_datasets_list)

        # Test with limit=1
        single_list = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list(limit=1)
        )
        assert isinstance(single_list, list)
        assert len(single_list) == 1

        # Test 8: Consistency with get_dataset
        test_dataset: Any = created_datasets[0]  # Use first created dataset

        # Find our test dataset in the list using all_datasets from test 1
        test_dataset_from_list = None
        for d in all_datasets:
            if d["id"] == test_dataset.id:
                test_dataset_from_list = d
                break

        assert test_dataset_from_list is not None

        # Get the same dataset individually
        individual_dataset = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.get_dataset(
                dataset=test_dataset.id
            )
        )

        # Compare key fields (list/paginate don't include examples)
        assert test_dataset_from_list["id"] == individual_dataset.id
        assert test_dataset_from_list["name"] == individual_dataset.name
        assert test_dataset_from_list["description"] == individual_dataset.description
        assert test_dataset_from_list["metadata"] == individual_dataset.metadata
        # Note: created_at and updated_at might have slight differences in precision
        # so we just verify they exist and are datetime objects
