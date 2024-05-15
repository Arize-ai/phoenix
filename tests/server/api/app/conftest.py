import tempfile

import pytest
from phoenix.core.model_schema_adapter import create_model_from_datasets
from phoenix.db import models
from phoenix.inferences.inferences import EMPTY_INFERENCES
from phoenix.pointcloud.umap_parameters import get_umap_parameters
from phoenix.server.app import SessionFactory, create_app
from starlette.testclient import TestClient


@pytest.fixture
def test_client(dialect, db):
    factory = SessionFactory(session_factory=db, dialect=dialect)
    temp_dir = tempfile.TemporaryDirectory()
    app = create_app(
        db=factory,
        model=create_model_from_datasets(EMPTY_INFERENCES, None),
        export_path=temp_dir.name,
        umap_params=get_umap_parameters(None),
    )
    with TestClient(app) as client:
        yield client


@pytest.fixture
async def dataset_0(session):
    dataset = models.Dataset(
        id=0,
        name="dataset 0",
        description="a test dataset",
        metadata_={"info": "a test dataset"},
    )
    example_0 = models.DatasetExample(
        id=0,
        dataset_id=0,
    )
    dataset_version_0 = models.DatasetVersion(
        id=0,
        dataset_id=0,
        description="the first version",
        metadata_={"info": "gotta get some test data somewhere"},
    )
    example_0_revision_0 = models.DatasetExampleRevision(
        id=0,
        dataset_example_id=0,
        dataset_version_id=0,
        input={"in": "foo"},
        output={"out": "bar"},
        metadata_={"info": "the first reivision"},
        revision_kind="CREATE",
    )
    session.add(dataset)
    session.add(dataset_version_0)
    await session.flush()
    session.add(example_0)
    session.add(example_0_revision_0)
