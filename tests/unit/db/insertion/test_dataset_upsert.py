from collections import Counter

import pytest
from sqlalchemy import func, select

from phoenix.db import models
from phoenix.db.helpers import get_dataset_example_revisions
from phoenix.db.insertion.dataset import (
    DatasetUpsertSummary,
    ExampleContent,
    add_dataset_examples,
    classify_dataset_hash_diff,
    compute_example_content_hash,
    normalize_content_hash,
    upsert_dataset_examples_by_hash,
)
from phoenix.server.types import DbSessionFactory


def _example(*, question: str, answer: str) -> ExampleContent:
    return ExampleContent(
        input={"question": question},
        output={"answer": answer},
        metadata={},
    )


def _hash_for(*, question: str, answer: str) -> str:
    return compute_example_content_hash(
        input={"question": question},
        output={"answer": answer},
        metadata={},
    )


def test_compute_example_content_hash_is_deterministic_for_key_order() -> None:
    hash_1 = compute_example_content_hash(
        input={"b": 2, "a": 1},
        output={"z": 3, "y": 2},
        metadata={"n": 9, "m": 8},
    )
    hash_2 = compute_example_content_hash(
        input={"a": 1, "b": 2},
        output={"y": 2, "z": 3},
        metadata={"m": 8, "n": 9},
    )
    assert hash_1 == hash_2


def test_normalize_content_hash_validates_and_normalizes() -> None:
    assert normalize_content_hash("A" * 64) == "a" * 64
    with pytest.raises(ValueError, match="content_hash"):
        normalize_content_hash("z" * 64)


def test_classify_dataset_hash_diff_is_multiset_aware() -> None:
    hash_a = "a" * 64
    hash_b = "b" * 64
    hash_c = "c" * 64
    hash_d = "d" * 64

    diff = classify_dataset_hash_diff(
        existing_hashes=[hash_a, hash_a, hash_b, hash_c],
        incoming_hashes=[hash_a, hash_b, hash_b, hash_d],
    )

    assert diff.to_delete_by_hash == Counter({hash_a: 1, hash_c: 1})
    assert diff.to_create_by_hash == Counter({hash_b: 1, hash_d: 1})
    assert diff.summary == DatasetUpsertSummary(added=0, updated=2, deleted=0, unchanged=2)


async def test_upsert_dataset_examples_unchanged_is_noop(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        create_event = await add_dataset_examples(
            session=session,
            name="upsert-unchanged",
            examples=[
                _example(question="q1", answer="a1"),
                _example(question="q2", answer="a2"),
            ],
        )
    assert create_event is not None

    async with db() as session:
        upsert_event = await upsert_dataset_examples_by_hash(
            session=session,
            dataset_id=create_event.dataset_id,
            examples=[
                _example(question="q1", answer="a1"),
                _example(question="q2", answer="a2"),
            ],
        )
    assert upsert_event.is_noop is True
    assert upsert_event.dataset_version_id == create_event.dataset_version_id
    assert upsert_event.summary == DatasetUpsertSummary(unchanged=2)

    async with db() as session:
        version_count = await session.scalar(
            select(func.count(models.DatasetVersion.id)).where(
                models.DatasetVersion.dataset_id == create_event.dataset_id
            )
        )
        revision_count = await session.scalar(
            select(func.count(models.DatasetExampleRevision.id))
            .select_from(models.DatasetExampleRevision)
            .join(models.DatasetExample)
            .where(models.DatasetExample.dataset_id == create_event.dataset_id)
        )
    assert version_count == 1
    assert revision_count == 2


async def test_upsert_dataset_examples_changed_uses_delete_and_create(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        create_event = await add_dataset_examples(
            session=session,
            name="upsert-changed",
            examples=[_example(question="q1", answer="old")],
        )
    assert create_event is not None

    async with db() as session:
        upsert_event = await upsert_dataset_examples_by_hash(
            session=session,
            dataset_id=create_event.dataset_id,
            examples=[_example(question="q1", answer="new")],
        )
    assert upsert_event.is_noop is False
    assert upsert_event.summary == DatasetUpsertSummary(updated=1)

    async with db() as session:
        revisions = (
            await session.scalars(
                select(models.DatasetExampleRevision)
                .where(
                    models.DatasetExampleRevision.dataset_version_id
                    == upsert_event.dataset_version_id
                )
                .order_by(models.DatasetExampleRevision.id)
            )
        ).all()
    assert len(revisions) == 2
    assert {revision.revision_kind for revision in revisions} == {"CREATE", "DELETE"}

    create_revision = next(revision for revision in revisions if revision.revision_kind == "CREATE")
    delete_revision = next(revision for revision in revisions if revision.revision_kind == "DELETE")
    assert create_revision.content_hash == _hash_for(question="q1", answer="new")
    assert delete_revision.content_hash == _hash_for(question="q1", answer="old")
    assert create_revision.dataset_example_id != delete_revision.dataset_example_id


async def test_upsert_dataset_examples_missing_creates_delete_revision(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        create_event = await add_dataset_examples(
            session=session,
            name="upsert-delete",
            examples=[
                _example(question="q1", answer="a1"),
                _example(question="q2", answer="a2"),
            ],
        )
    assert create_event is not None

    async with db() as session:
        upsert_event = await upsert_dataset_examples_by_hash(
            session=session,
            dataset_id=create_event.dataset_id,
            examples=[_example(question="q1", answer="a1")],
        )
    assert upsert_event.summary == DatasetUpsertSummary(deleted=1, unchanged=1)

    async with db() as session:
        revisions = (
            await session.scalars(
                select(models.DatasetExampleRevision)
                .where(
                    models.DatasetExampleRevision.dataset_version_id
                    == upsert_event.dataset_version_id
                )
                .order_by(models.DatasetExampleRevision.id)
            )
        ).all()
    assert len(revisions) == 1
    assert revisions[0].revision_kind == "DELETE"


async def test_upsert_dataset_examples_new_creates_create_revision(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        create_event = await add_dataset_examples(
            session=session,
            name="upsert-create",
            examples=[_example(question="q1", answer="a1")],
        )
    assert create_event is not None

    async with db() as session:
        upsert_event = await upsert_dataset_examples_by_hash(
            session=session,
            dataset_id=create_event.dataset_id,
            examples=[
                _example(question="q1", answer="a1"),
                _example(question="q2", answer="a2"),
            ],
        )
    assert upsert_event.summary == DatasetUpsertSummary(added=1, unchanged=1)

    async with db() as session:
        revisions = (
            await session.scalars(
                select(models.DatasetExampleRevision)
                .where(
                    models.DatasetExampleRevision.dataset_version_id
                    == upsert_event.dataset_version_id
                )
                .order_by(models.DatasetExampleRevision.id)
            )
        ).all()
    assert len(revisions) == 1
    assert revisions[0].revision_kind == "CREATE"


async def test_upsert_dataset_examples_duplicate_examples_use_multiset_semantics(
    db: DbSessionFactory,
) -> None:
    duplicate_example = _example(question="q-dup", answer="a-dup")
    async with db() as session:
        create_event = await add_dataset_examples(
            session=session,
            name="upsert-duplicates",
            examples=[duplicate_example, duplicate_example],
        )
    assert create_event is not None

    async with db() as session:
        upsert_event = await upsert_dataset_examples_by_hash(
            session=session,
            dataset_id=create_event.dataset_id,
            examples=[duplicate_example],
        )
    assert upsert_event.summary == DatasetUpsertSummary(deleted=1, unchanged=1)

    async with db() as session:
        revisions_for_new_version = (
            await session.scalars(
                select(models.DatasetExampleRevision)
                .where(
                    models.DatasetExampleRevision.dataset_version_id
                    == upsert_event.dataset_version_id
                )
                .order_by(models.DatasetExampleRevision.id)
            )
        ).all()
        active_revisions = (
            await session.scalars(
                get_dataset_example_revisions(
                    upsert_event.dataset_version_id,
                    dataset_id=create_event.dataset_id,
                )
            )
        ).all()

    assert len(revisions_for_new_version) == 1
    assert revisions_for_new_version[0].revision_kind == "DELETE"
    assert len(active_revisions) == 1
    assert active_revisions[0].content_hash == _hash_for(question="q-dup", answer="a-dup")
