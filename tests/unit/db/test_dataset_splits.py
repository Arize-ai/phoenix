"""Tests for dataset splits functionality."""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


class TestDatasetSplits:
    """Test dataset splits model and relationships."""

    async def test_create_dataset_split(self, db: DbSessionFactory) -> None:
        """Test creating a dataset split."""
        async with db() as session:
            split = models.DatasetSplit(
                name="train",
                description="Training split",
                metadata_={"ratio": 0.7, "reserved": False},
            )
            session.add(split)
            await session.commit()

            # Verify the split was created
            result = await session.scalar(
                select(models.DatasetSplit).where(models.DatasetSplit.name == "train")
            )
            assert result is not None
            assert result.name == "train"
            assert result.description == "Training split"
            assert result.metadata_["ratio"] == 0.7
            assert result.metadata_["reserved"] is False

    async def test_dataset_split_name_uniqueness(self, db: DbSessionFactory) -> None:
        """Test that dataset split names must be unique."""
        async with db() as session:
            # Create first split
            split1 = models.DatasetSplit(
                name="train",
                description="First training split",
                metadata_={},
            )
            session.add(split1)
            await session.commit()

            # Try to create second split with same name
            split2 = models.DatasetSplit(
                name="train",
                description="Second training split",
                metadata_={},
            )
            session.add(split2)

            with pytest.raises(IntegrityError):
                await session.commit()

    async def test_reserved_splits(self, db: DbSessionFactory) -> None:
        """Test creating reserved splits (baseline, latest)."""
        async with db() as session:
            # Create reserved splits
            baseline_split = models.DatasetSplit(
                name="baseline",
                description="Reserved baseline split",
                metadata_={"reserved": True},
            )
            latest_split = models.DatasetSplit(
                name="latest",
                description="Reserved latest split",
                metadata_={"reserved": True},
            )

            session.add_all([baseline_split, latest_split])
            await session.commit()

            # Verify reserved splits
            baseline = await session.scalar(
                select(models.DatasetSplit).where(models.DatasetSplit.name == "baseline")
            )
            latest = await session.scalar(
                select(models.DatasetSplit).where(models.DatasetSplit.name == "latest")
            )

            assert baseline is not None
            assert baseline.metadata_["reserved"] is True
            assert latest is not None
            assert latest.metadata_["reserved"] is True


class TestDatasetSplitDatasetExample:
    """Test crosswalk table functionality."""

    async def test_create_crosswalk_relationship(self, db: DbSessionFactory) -> None:
        """Test creating relationships between dataset splits and examples."""
        async with db() as session:
            # Create a dataset
            dataset = models.Dataset(
                name="test_dataset",
                description="Test dataset",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()  # Get the ID

            # Create a dataset example
            example = models.DatasetExample(
                dataset_id=dataset.id,
                span_rowid=None,
            )
            session.add(example)
            await session.flush()  # Get the ID

            # Create a dataset split
            split = models.DatasetSplit(
                name="train",
                description="Training split",
                metadata_={},
            )
            session.add(split)
            await session.flush()  # Get the ID

            # Create crosswalk relationship
            crosswalk = models.DatasetSplitDatasetExample(
                dataset_split_id=split.id,
                dataset_example_id=example.id,
            )
            session.add(crosswalk)
            await session.commit()

            # Verify the relationship
            result = await session.scalar(
                select(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_split_id == split.id)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == example.id)
            )
            assert result is not None
            assert result.dataset_split_id == split.id
            assert result.dataset_example_id == example.id

    async def test_crosswalk_unique_constraint(self, db: DbSessionFactory) -> None:
        """Test that the crosswalk table enforces unique constraints."""
        async with db() as session:
            # Create a dataset
            dataset = models.Dataset(
                name="test_dataset",
                description="Test dataset",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            # Create a dataset example
            example = models.DatasetExample(
                dataset_id=dataset.id,
                span_rowid=None,
            )
            session.add(example)
            await session.flush()

            # Create a dataset split
            split = models.DatasetSplit(
                name="train",
                description="Training split",
                metadata_={},
            )
            session.add(split)
            await session.flush()

            # Create first crosswalk relationship
            crosswalk1 = models.DatasetSplitDatasetExample(
                dataset_split_id=split.id,
                dataset_example_id=example.id,
            )
            session.add(crosswalk1)
            await session.commit()

            # Try to create duplicate relationship
            crosswalk2 = models.DatasetSplitDatasetExample(
                dataset_split_id=split.id,
                dataset_example_id=example.id,
            )
            session.add(crosswalk2)

            with pytest.raises(IntegrityError):
                await session.commit()

    async def test_cascade_delete_split(self, db: DbSessionFactory) -> None:
        """Test that deleting a split cascades to crosswalk entries."""
        async with db() as session:
            # Create a dataset
            dataset = models.Dataset(
                name="test_dataset",
                description="Test dataset",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            # Create a dataset example
            example = models.DatasetExample(
                dataset_id=dataset.id,
                span_rowid=None,
            )
            session.add(example)
            await session.flush()

            # Create a dataset split
            split = models.DatasetSplit(
                name="train",
                description="Training split",
                metadata_={},
            )
            session.add(split)
            await session.flush()

            # Create crosswalk relationship
            crosswalk = models.DatasetSplitDatasetExample(
                dataset_split_id=split.id,
                dataset_example_id=example.id,
            )
            session.add(crosswalk)
            await session.commit()

            # Delete the split
            await session.delete(split)
            await session.commit()

            # Verify crosswalk entry was deleted
            result = await session.scalar(
                select(models.DatasetSplitDatasetExample).where(
                    models.DatasetSplitDatasetExample.dataset_split_id == split.id
                )
            )
            assert result is None

    async def test_cascade_delete_example(self, db: DbSessionFactory) -> None:
        """Test that deleting an example cascades to crosswalk entries."""
        async with db() as session:
            # Create a dataset
            dataset = models.Dataset(
                name="test_dataset",
                description="Test dataset",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            # Create a dataset example
            example = models.DatasetExample(
                dataset_id=dataset.id,
                span_rowid=None,
            )
            session.add(example)
            await session.flush()

            # Create a dataset split
            split = models.DatasetSplit(
                name="train",
                description="Training split",
                metadata_={},
            )
            session.add(split)
            await session.flush()

            # Create crosswalk relationship
            crosswalk = models.DatasetSplitDatasetExample(
                dataset_split_id=split.id,
                dataset_example_id=example.id,
            )
            session.add(crosswalk)
            await session.commit()

            # Delete the example
            await session.delete(example)
            await session.commit()

            # Verify crosswalk entry was deleted
            result = await session.scalar(
                select(models.DatasetSplitDatasetExample).where(
                    models.DatasetSplitDatasetExample.dataset_example_id == example.id
                )
            )
            assert result is None


class TestDatasetSplitRelationships:
    """Test ORM relationships between models."""

    async def test_dataset_split_to_examples_relationship(self, db: DbSessionFactory) -> None:
        """Test accessing examples through dataset split relationship."""
        async with db() as session:
            # Create a dataset
            dataset = models.Dataset(
                name="test_dataset",
                description="Test dataset",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            # Create dataset examples
            example1 = models.DatasetExample(dataset_id=dataset.id, span_rowid=None)
            example2 = models.DatasetExample(dataset_id=dataset.id, span_rowid=None)
            session.add_all([example1, example2])
            await session.flush()

            # Create a dataset split
            split = models.DatasetSplit(
                name="train",
                description="Training split",
                metadata_={},
            )
            session.add(split)
            await session.flush()

            # Create crosswalk relationships
            crosswalk1 = models.DatasetSplitDatasetExample(
                dataset_split_id=split.id,
                dataset_example_id=example1.id,
            )
            crosswalk2 = models.DatasetSplitDatasetExample(
                dataset_split_id=split.id,
                dataset_example_id=example2.id,
            )
            session.add_all([crosswalk1, crosswalk2])
            await session.commit()

            # Test relationship access
            split_with_examples = await session.scalar(
                select(models.DatasetSplit).where(models.DatasetSplit.id == split.id)
            )
            assert split_with_examples is not None

            # Access examples through relationship
            crosswalk_entries = split_with_examples.dataset_splits_dataset_examples
            assert len(crosswalk_entries) == 2

            example_ids = {entry.dataset_example_id for entry in crosswalk_entries}
            assert example1.id in example_ids
            assert example2.id in example_ids

    async def test_dataset_example_to_splits_relationship(self, db: DbSessionFactory) -> None:
        """Test accessing splits through dataset example relationship."""
        async with db() as session:
            # Create a dataset
            dataset = models.Dataset(
                name="test_dataset",
                description="Test dataset",
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            # Create a dataset example
            example = models.DatasetExample(
                dataset_id=dataset.id,
                span_rowid=None,
            )
            session.add(example)
            await session.flush()

            # Create dataset splits
            train_split = models.DatasetSplit(
                name="train",
                description="Training split",
                metadata_={},
            )
            test_split = models.DatasetSplit(
                name="test",
                description="Test split",
                metadata_={},
            )
            session.add_all([train_split, test_split])
            await session.flush()

            # Create crosswalk relationships
            crosswalk1 = models.DatasetSplitDatasetExample(
                dataset_split_id=train_split.id,
                dataset_example_id=example.id,
            )
            crosswalk2 = models.DatasetSplitDatasetExample(
                dataset_split_id=test_split.id,
                dataset_example_id=example.id,
            )
            session.add_all([crosswalk1, crosswalk2])
            await session.commit()

            # Test relationship access
            example_with_splits = await session.scalar(
                select(models.DatasetExample).where(models.DatasetExample.id == example.id)
            )
            assert example_with_splits is not None

            # Access splits through relationship
            crosswalk_entries = example_with_splits.dataset_splits_dataset_examples
            assert len(crosswalk_entries) == 2

            split_ids = {entry.dataset_split_id for entry in crosswalk_entries}
            assert train_split.id in split_ids
            assert test_split.id in split_ids
