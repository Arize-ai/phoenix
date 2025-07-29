# ruff: noqa: E501
from __future__ import annotations

import uuid
from pathlib import Path
from secrets import token_hex
from typing import Any

import pandas as pd
import pytest
from phoenix.client.__generated__ import v1
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
    async def test_list_datasets_with_pagination(
        self,
        is_async: bool,
        role_or_user: UserRoleInput,
        _get_user: _GetUser,
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
        user = _get_user(_app, role_or_user).log_in(_app)
        api_key = str(user.create_api_key(_app))

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
            assert isinstance(
                dataset_dict["id"], str
            ), f"id should be str, got {type(dataset_dict['id'])}"
            assert isinstance(
                dataset_dict["name"], str
            ), f"name should be str, got {type(dataset_dict['name'])}"
            assert dataset_dict["description"] is None or isinstance(
                dataset_dict["description"], str
            ), f"description should be str or None, got {type(dataset_dict['description'])}"
            assert isinstance(
                dataset_dict["metadata"], dict
            ), f"metadata should be dict (Mapping), got {type(dataset_dict['metadata'])}"
            assert isinstance(
                dataset_dict["created_at"], str
            ), f"created_at should be str, got {type(dataset_dict['created_at'])}"
            assert isinstance(
                dataset_dict["updated_at"], str
            ), f"updated_at should be str, got {type(dataset_dict['updated_at'])}"
            assert isinstance(
                dataset_dict["example_count"], int
            ), f"example_count should be int, got {type(dataset_dict['example_count'])}"

            # Validate business logic constraints
            assert (
                dataset_dict["example_count"] >= 0
            ), f"example_count should be non-negative, got {dataset_dict['example_count']}"

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
        assert (
            single_result[0]["id"] == double_result[0]["id"]
        ), "First item should be consistent between limit=1 and limit=2"
        assert (
            double_result[0]["id"] == triple_result[0]["id"]
        ), "First item should be consistent between limit=2 and limit=3"

        # First 2 items from triple should match double result exactly
        for i in range(2):
            assert (
                double_result[i]["id"] == triple_result[i]["id"]
            ), f"Item {i} should be identical between limit=2 and limit=3 results"
            assert (
                double_result[i]["name"] == triple_result[i]["name"]
            ), f"Item {i} name should be identical between limit=2 and limit=3 results"

        # Test 3: Verify our created datasets appear in the results and validate example counts
        # Since we created 3 datasets most recently, they should be in the first 3 results (ID DESC order)
        found_our_datasets = 0
        for dataset_dict in triple_result:
            if dataset_dict["id"] in created_dataset_ids:
                found_our_datasets += 1
                # Validate example counts for our test datasets
                if dataset_dict["name"].endswith("_zero_examples"):
                    assert (
                        dataset_dict["example_count"] == 0
                    ), f"Zero example dataset should have 0 examples, got {dataset_dict['example_count']}"
                elif "_one_example_" in dataset_dict["name"]:
                    assert (
                        dataset_dict["example_count"] == 1
                    ), f"One example dataset should have 1 example, got {dataset_dict['example_count']}"

        # We should find all 3 of our datasets in the first 3 results due to DESC ordering
        assert (
            found_our_datasets == 3
        ), f"Expected to find all 3 created datasets in first 3 results, found {found_our_datasets}"

        # Test 4: Test unlimited list() and consistency
        all_datasets = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).datasets.list()
        )
        assert isinstance(all_datasets, list)
        assert len(all_datasets) >= 3  # Should have at least our 3 test datasets

        # First 3 items from unlimited should match our triple_result
        for i in range(3):
            assert (
                all_datasets[i]["id"] == triple_result[i]["id"]
            ), f"Item {i} should be identical between unlimited and limit=3 results"

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

        assert (
            test_dataset_from_list is not None
        ), f"Test dataset {test_dataset.id} not found in list"

        # Compare key fields (list doesn't include examples)
        assert test_dataset_from_list["id"] == individual_dataset.id
        assert test_dataset_from_list["name"] == individual_dataset.name
        assert test_dataset_from_list["description"] == individual_dataset.description
        assert test_dataset_from_list["metadata"] == individual_dataset.metadata
