from sqlalchemy import select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestCreateDatasetLabel:
    MUTATION = """
      mutation ($input: CreateDatasetLabelInput!) {
        createDatasetLabel(input: $input) {
          datasetLabel {
            name
            description
            color
          }
        }
      }
    """

    async def test_creates_label_without_description(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={"input": {"name": "prod", "color": "#33aa55"}},
        )
        assert not response.errors
        assert response.data == {
            "createDatasetLabel": {
                "datasetLabel": {"name": "prod", "description": None, "color": "#33aa55"}
            }
        }
        async with db() as session:
            label = await session.scalar(select(models.DatasetLabel))
        assert label is not None
        assert label.description is None
