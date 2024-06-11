import pytest
from phoenix.db import models


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
