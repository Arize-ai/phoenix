from __future__ import annotations

import uuid
from pathlib import Path

import pandas as pd
import pytest

from .._helpers import _ADMIN, _MEMBER, _await_or_return, _GetUser, _RoleOrUser


class TestDatasetIntegration:
    """Integration tests for dataset operations against a real Phoenix server."""

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_create_and_get_dataset(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_dataset_{uuid.uuid4().hex[:8]}"

        # Create dataset with JSON data
        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                dataset_name=unique_name,
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
        retrieved = await _await_or_return(Client().datasets.get_dataset(dataset=unique_name))

        assert retrieved.id == dataset.id
        assert retrieved.version_id == dataset.version_id
        assert len(retrieved) == 2

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_add_examples_to_dataset(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_dataset_{uuid.uuid4().hex[:8]}"

        # Create initial dataset
        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                dataset_name=unique_name,
                inputs=[{"text": "Hello"}],
                outputs=[{"response": "Hi"}],
            )
        )

        assert len(dataset) == 1

        # Add more examples
        updated = await _await_or_return(
            Client().datasets.add_examples_to_dataset(
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
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_dataset_{uuid.uuid4().hex[:8]}"

        # Create dataset
        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                dataset_name=unique_name,
                inputs=[{"text": "v1"}],
                outputs=[{"response": "version 1"}],
            )
        )

        # Add examples to create new version
        await _await_or_return(
            Client().datasets.add_examples_to_dataset(
                dataset=dataset,
                inputs=[{"text": "v2"}],
                outputs=[{"response": "version 2"}],
            )
        )

        # Get versions
        versions = await _await_or_return(Client().datasets.get_dataset_versions(dataset=dataset))

        assert len(versions) >= 2
        assert all("version_id" in v for v in versions)
        assert all("created_at" in v for v in versions)

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_create_dataset_from_csv(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

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
            Client().datasets.create_dataset(
                dataset_name=unique_name,
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
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

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
            Client().datasets.create_dataset(
                dataset_name=unique_name,
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
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_roundtrip_{uuid.uuid4().hex[:8]}"

        # Create dataset
        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                dataset_name=unique_name,
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
        inputs = df["input"].tolist()
        outputs = df["output"].tolist()
        metadata = df["metadata"].tolist()

        # Create new dataset from DataFrame data
        new_name = f"test_from_df_{uuid.uuid4().hex[:8]}"
        new_dataset = await _await_or_return(
            Client().datasets.create_dataset(
                dataset_name=new_name, inputs=inputs, outputs=outputs, metadata=metadata
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
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create source dataset
        source_name = f"test_source_{uuid.uuid4().hex[:8]}"
        source = await _await_or_return(
            Client().datasets.create_dataset(
                dataset_name=source_name,
                inputs=[{"q": "Q1"}, {"q": "Q2"}, {"q": "Q3"}],
                outputs=[{"a": "A1"}, {"a": "A2"}, {"a": "A3"}],
                metadata=[{"idx": 1}, {"idx": 2}, {"idx": 3}],
            )
        )

        # Create target dataset with single example from source
        target_name = f"test_target_{uuid.uuid4().hex[:8]}"
        target = await _await_or_return(
            Client().datasets.create_dataset(
                dataset_name=target_name,
                examples=source[0],  # Single example
            )
        )

        assert len(target) == 1
        assert target[0]["input"] == {"q": "Q1"}
        assert target[0]["output"] == {"a": "A1"}

        # Add multiple examples
        updated = await _await_or_return(
            Client().datasets.add_examples_to_dataset(
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
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        unique_name = f"test_flex_{uuid.uuid4().hex[:8]}"

        # Create dataset
        dataset = await _await_or_return(
            Client().datasets.create_dataset(
                dataset_name=unique_name,
                inputs=[{"text": "test"}],
                outputs=[{"result": "success"}],
            )
        )

        # Get by ID
        by_id = await _await_or_return(Client().datasets.get_dataset(dataset=dataset.id))
        assert by_id.id == dataset.id

        # Get by name
        by_name = await _await_or_return(Client().datasets.get_dataset(dataset=unique_name))
        assert by_name.id == dataset.id

        # Get by dataset object
        by_obj = await _await_or_return(Client().datasets.get_dataset(dataset=dataset))
        assert by_obj.id == dataset.id

        # Get by dict
        by_dict = await _await_or_return(
            Client().datasets.get_dataset(dataset={"id": dataset.id, "name": unique_name})
        )
        assert by_dict.id == dataset.id

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_error_handling(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Test dataset not found
        with pytest.raises(ValueError, match="Dataset not found"):
            await _await_or_return(
                Client().datasets.get_dataset(dataset="non_existent_dataset_xyz123")
            )

        # Test invalid input data
        with pytest.raises(ValueError, match="inputs must be non-empty"):
            await _await_or_return(
                Client().datasets.create_dataset(
                    dataset_name="test",
                    inputs=[],
                    outputs=[],
                )
            )

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_dataset_examples_direct_pass(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that dataset.examples can be passed directly to add_examples_to_dataset."""
        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create source dataset with multiple examples
        source_name = f"test_source_{uuid.uuid4().hex[:8]}"
        source_dataset = await _await_or_return(
            Client().datasets.create_dataset(
                dataset_name=source_name,
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
            Client().datasets.create_dataset(
                dataset_name=target_name,
                inputs=[{"placeholder": "initial"}],
                outputs=[{"placeholder": "initial"}],
            )
        )

        assert len(target_dataset) == 1

        # Pass dataset.examples directly to add_examples_to_dataset
        updated_dataset = await _await_or_return(
            Client().datasets.add_examples_to_dataset(
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
            Client().datasets.create_dataset(
                dataset_name=subset_target_name,
                examples=source_dataset.examples[:2],  # Only first 2 examples
            )
        )

        assert len(subset_dataset) == 2
        assert subset_dataset[0]["input"]["question"] == "What is Python?"
        assert subset_dataset[1]["input"]["question"] == "Explain async/await"
