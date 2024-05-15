import tempfile

import httpx
import pytest
from phoenix.core.model_schema_adapter import create_model_from_inferences
from phoenix.db import models
from phoenix.inferences.inferences import EMPTY_INFERENCES
from phoenix.pointcloud.umap_parameters import get_umap_parameters
from phoenix.server.app import SessionFactory, create_app


@pytest.fixture
async def test_client(dialect, db):
    factory = SessionFactory(session_factory=db, dialect=dialect)
    temp_dir = tempfile.TemporaryDirectory()
    app = create_app(
        db=factory,
        model=create_model_from_inferences(EMPTY_INFERENCES, None),
        export_path=temp_dir.name,
        umap_params=get_umap_parameters(None),
    )
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
async def simple_dataset(session):
    """
    A dataset with one example added in one version
    """

    dataset = models.Dataset(
        id=0,
        name="simple dataset",
        description=None,
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
    """
    A dataset with three versions, where two examples are added, patched, then deleted
    """

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


@pytest.fixture
async def dataset_with_revisions(session):
    """
    A dataset with two versions, first two examples are added, then one example is patched and a
    third example is added
    """

    dataset = models.Dataset(
        id=2,
        name="revised dataset",
        description="this dataset grows over time",
        metadata_={},
    )
    session.add(dataset)
    await session.flush()

    dataset_version_4 = models.DatasetVersion(
        id=4,
        dataset_id=2,
        description="data gets added",
        metadata_={"info": "gotta get some test data somewhere"},
    )
    session.add(dataset_version_4)
    await session.flush()

    example_3 = models.DatasetExample(
        id=3,
        dataset_id=2,
    )
    session.add(example_3)
    await session.flush()

    example_4 = models.DatasetExample(
        id=4,
        dataset_id=2,
    )
    session.add(example_4)
    await session.flush()

    example_3_revision_4 = models.DatasetExampleRevision(
        id=7,
        dataset_example_id=3,
        dataset_version_id=4,
        input={"in": "foo"},
        output={"out": "bar"},
        metadata_={"info": "first revision"},
        revision_kind="CREATE",
    )
    session.add(example_3_revision_4)
    await session.flush()

    example_4_revision_4 = models.DatasetExampleRevision(
        id=8,
        dataset_example_id=4,
        dataset_version_id=4,
        input={"in": "foofoo"},
        output={"out": "barbar"},
        metadata_={"info": "first revision"},
        revision_kind="CREATE",
    )
    session.add(example_4_revision_4)
    await session.flush()

    dataset_version_5 = models.DatasetVersion(
        id=5,
        dataset_id=2,
        description="data gets patched and added",
        metadata_={},
    )
    session.add(dataset_version_5)
    await session.flush()

    example_5 = models.DatasetExample(
        id=5,
        dataset_id=2,
    )
    session.add(example_5)
    await session.flush()

    example_4_revision_5 = models.DatasetExampleRevision(
        id=9,
        dataset_example_id=4,
        dataset_version_id=5,
        input={"in": "updated foofoo"},
        output={"out": "updated barbar"},
        metadata_={"info": "updating revision"},
        revision_kind="PATCH",
    )
    session.add(example_4_revision_5)
    await session.flush()

    example_5_revision_5 = models.DatasetExampleRevision(
        id=10,
        dataset_example_id=5,
        dataset_version_id=5,
        input={"in": "look at me"},
        output={"out": "i have all the answers"},
        metadata_={"info": "a new example"},
        revision_kind="CREATE",
    )
    session.add(example_5_revision_5)
    await session.flush()
