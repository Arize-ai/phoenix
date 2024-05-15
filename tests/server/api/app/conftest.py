import tempfile

import httpx
import pytest
from phoenix.core.model_schema_adapter import create_model_from_datasets
from phoenix.db import models
from phoenix.inferences.inferences import EMPTY_INFERENCES
from phoenix.pointcloud.umap_parameters import get_umap_parameters
from phoenix.server.app import SessionFactory, create_app
from starlette.testclient import TestClient


@pytest.fixture
async def test_client(dialect, db):
    factory = SessionFactory(session_factory=db, dialect=dialect)
    temp_dir = tempfile.TemporaryDirectory()
    app = create_app(
        db=factory,
        model=create_model_from_datasets(EMPTY_INFERENCES, None),
        export_path=temp_dir.name,
        umap_params=get_umap_parameters(None),
    )
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
async def simple_dataset(session):
    dataset = models.Dataset(
        id=0,
        name="simple dataset",
        description="a test dataset with a single example",
        metadata_={"info": "a test dataset"},
    )
    session.add(dataset)
    await session.flush()

    dataset_version_0 = models.DatasetVersion(
        id=0,
        dataset_id=0,
        description="the first version",
        metadata_={"info": "gotta get some test data somewhere"},
    )
    session.add(dataset_version_0)
    await session.flush()

    example_0 = models.DatasetExample(
        id=0,
        dataset_id=0,
    )
    session.add(example_0)
    await session.flush()

    example_0_revision_0 = models.DatasetExampleRevision(
        id=0,
        dataset_example_id=0,
        dataset_version_id=0,
        input={"in": "foo"},
        output={"out": "bar"},
        metadata_={"info": "the first reivision"},
        revision_kind="CREATE",
    )
    session.add(example_0_revision_0)
    await session.flush()


@pytest.fixture
async def empty_dataset(session):
    dataset = models.Dataset(
        id=1,
        name="empty dataset",
        description="emptied after two revisions",
        metadata_={},
    )
    session.add(dataset)
    await session.flush()

    dataset_version_1 = models.DatasetVersion(
        id=1,
        dataset_id=1,
        description="data gets added",
        metadata_={"info": "gotta get some test data somewhere"},
    )
    session.add(dataset_version_1)
    await session.flush()

    example_1 = models.DatasetExample(
        id=1,
        dataset_id=1,
    )
    session.add(example_1)
    await session.flush()

    example_2 = models.DatasetExample(
        id=2,
        dataset_id=1,
    )
    session.add(example_2)
    await session.flush()

    example_1_revision_1 = models.DatasetExampleRevision(
        id=1,
        dataset_example_id=1,
        dataset_version_id=1,
        input={"in": "foo"},
        output={"out": "bar"},
        metadata_={"info": "first revision"},
        revision_kind="CREATE",
    )
    session.add(example_1_revision_1)
    await session.flush()

    example_2_revision_1 = models.DatasetExampleRevision(
        id=2,
        dataset_example_id=2,
        dataset_version_id=1,
        input={"in": "foofoo"},
        output={"out": "barbar"},
        metadata_={"info": "first revision"},
        revision_kind="CREATE",
    )
    session.add(example_2_revision_1)
    await session.flush()

    dataset_version_2 = models.DatasetVersion(
        id=2,
        dataset_id=1,
        description="data gets patched",
        metadata_={"info": "all caps patch"},
    )
    session.add(dataset_version_2)
    await session.flush()

    example_1_revision_2 = models.DatasetExampleRevision(
        id=3,
        dataset_example_id=1,
        dataset_version_id=2,
        input={"in": "FOO"},
        output={"out": "BAR"},
        metadata_={"info": "all caps revision"},
        revision_kind="PATCH",
    )
    session.add(example_1_revision_2)
    await session.flush()

    example_2_revision_2 = models.DatasetExampleRevision(
        id=4,
        dataset_example_id=2,
        dataset_version_id=2,
        input={"in": "FOOFOO"},
        output={"out": "BARBAR"},
        metadata_={"info": "all caps revision"},
        revision_kind="PATCH",
    )
    session.add(example_2_revision_2)
    await session.flush()

    dataset_version_3 = models.DatasetVersion(
        id=3,
        dataset_id=1,
        description="data gets deleted",
        metadata_={"info": "all gone"},
    )
    session.add(dataset_version_3)
    await session.flush()

    example_1_revision_3 = models.DatasetExampleRevision(
        id=5,
        dataset_example_id=1,
        dataset_version_id=3,
        input={},
        output={},
        metadata_={"info": "all caps revision"},
        revision_kind="DELETE",
    )
    session.add(example_1_revision_3)
    await session.flush()

    example_2_revision_3 = models.DatasetExampleRevision(
        id=6,
        dataset_example_id=2,
        dataset_version_id=3,
        input={},
        output={},
        metadata_={"info": "all caps revision"},
        revision_kind="DELETE",
    )
    session.add(example_2_revision_3)
    await session.flush()
