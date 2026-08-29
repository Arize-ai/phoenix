from __future__ import annotations

import logging
from typing import Optional, cast

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.utils.encode_path_param import encode_path_param
from phoenix.client.utils.server_requirements import (
    AsyncServerVersionGuard,
    ServerVersionGuard,
)

logger = logging.getLogger(__name__)


class DatasetLabels:
    """Client for interacting with the global dataset label API endpoints.

    Dataset labels are global resources: a label exists independently of any dataset,
    and the same label can be applied to many datasets. This class manages the labels
    themselves. Applying a label to a dataset, or listing the labels currently on one,
    is dataset membership and is handled by the datasets resource.

    Examples:
        Basic dataset label operations::

            from phoenix.client import Client
            client = Client()

            # List every label defined on the server
            labels = client.dataset_labels.list()
            for label in labels:
                print(f"Label: {label['name']}")

            # Create a label
            label = client.dataset_labels.create(name="regression", color="#FF0000")

            # Rename it, leaving its color and description untouched
            label = client.dataset_labels.update(
                dataset_label_id=label["id"], name="regression-suite"
            )

            # Delete it, which also removes it from every dataset it was applied to
            client.dataset_labels.delete(dataset_label_id=label["id"])
    """

    def __init__(
        self,
        client: httpx.Client,
        *,
        _guard: ServerVersionGuard | None = None,
    ) -> None:
        """Initialize the DatasetLabels client.

        Args:
            client (httpx.Client): The httpx client to use for making requests.
        """
        self._client = client
        self._guard = _guard or ServerVersionGuard(client)

    def list(self) -> list[v1.DatasetLabel]:
        """List all dataset labels, following cursor pagination to completion.

        Returns:
            A list of every dataset label defined on the server.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            labels = client.dataset_labels.list()
            for label in labels:
                print(f"Label name: {label['name']}")
        """  # noqa: E501
        all_dataset_labels: list[v1.DatasetLabel] = []
        next_cursor: Optional[str] = None
        while True:
            params: dict[str, str] = {}
            if next_cursor:
                params["cursor"] = next_cursor
            response = self._client.get("v1/dataset_labels", params=params)
            response.raise_for_status()
            data = cast(v1.GetDatasetLabelsResponseBody, response.json())
            all_dataset_labels.extend(data["data"])
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_dataset_labels

    def get(self, *, dataset_label_id: str) -> v1.DatasetLabel:
        """Get a dataset label by ID.

        Args:
            dataset_label_id (str): The ID of the dataset label to retrieve.

        Returns:
            The dataset label with the specified ID.

        Raises:
            httpx.HTTPError: If the request fails, including a 404 when no label has
                the given ID.

        Example::

            from phoenix.client import Client
            client = Client()

            label = client.dataset_labels.get(dataset_label_id="RGF0YXNldExhYmVsOjE=")
            print(f"Label name: {label['name']}")
        """  # noqa: E501
        url = f"v1/dataset_labels/{encode_path_param(dataset_label_id)}"
        response = self._client.get(url)
        response.raise_for_status()
        return cast(v1.GetDatasetLabelResponseBody, response.json())["data"]

    def create(
        self,
        *,
        name: str,
        color: str,
        description: Optional[str] = None,
    ) -> v1.DatasetLabel:
        """Create a new dataset label.

        Args:
            name (str): The name of the label. Label names are unique across the server.
            color (str): The color of the label.
            description (Optional[str]): An optional description of the label.

        Returns:
            The newly created dataset label.

        Raises:
            httpx.HTTPError: If the request fails, including a 409 when a label with
                the same name already exists.

        Example::

            from phoenix.client import Client
            client = Client()

            label = client.dataset_labels.create(
                name="regression",
                color="#FF0000",
                description="Datasets used for regression testing",
            )
            print(f"Created dataset label with ID: {label['id']}")
        """  # noqa: E501
        json_ = v1.CreateDatasetLabelRequestBody(name=name, color=color)
        if description is not None:
            json_["description"] = description
        response = self._client.post(url="v1/dataset_labels", json=json_)
        response.raise_for_status()
        return cast(v1.CreateDatasetLabelResponseBody, response.json())["data"]

    def update(
        self,
        *,
        dataset_label_id: str,
        name: Optional[str] = None,
        color: Optional[str] = None,
        description: Optional[str] = None,
    ) -> v1.DatasetLabel:
        """Update a dataset label by ID.

        Only the fields supplied here are sent to the server, so any field left out
        keeps its current value.

        Args:
            dataset_label_id (str): The ID of the dataset label to update.
            name (Optional[str]): The new name for the label.
            color (Optional[str]): The new color for the label.
            description (Optional[str]): The new description for the label.

        Returns:
            The updated dataset label.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If none of name, color, or description is provided.

        Example::

            from phoenix.client import Client
            client = Client()

            # Change only the color; name and description are preserved
            label = client.dataset_labels.update(
                dataset_label_id="RGF0YXNldExhYmVsOjE=",
                color="#00FF00",
            )
            print(f"Updated dataset label color: {label['color']}")
        """  # noqa: E501
        json_ = v1.UpdateDatasetLabelRequestBody()
        if name is not None:
            json_["name"] = name
        if color is not None:
            json_["color"] = color
        if description is not None:
            json_["description"] = description
        if not json_:
            raise ValueError("At least one of name, color, or description must be provided.")
        url = f"v1/dataset_labels/{encode_path_param(dataset_label_id)}"
        response = self._client.patch(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.UpdateDatasetLabelResponseBody, response.json())["data"]

    def delete(self, *, dataset_label_id: str) -> None:
        """Delete a dataset label by ID.

        Deleting a label also removes it from every dataset it was applied to. The
        datasets themselves are not affected.

        Args:
            dataset_label_id (str): The ID of the dataset label to delete.

        Raises:
            httpx.HTTPError: If the request fails, including a 404 when no label has
                the given ID.

        Example::

            from phoenix.client import Client
            client = Client()

            client.dataset_labels.delete(dataset_label_id="RGF0YXNldExhYmVsOjE=")
        """  # noqa: E501
        url = f"v1/dataset_labels/{encode_path_param(dataset_label_id)}"
        response = self._client.delete(url)
        response.raise_for_status()


class AsyncDatasetLabels:
    """Asynchronous client for interacting with the global dataset label API endpoints.

    Dataset labels are global resources: a label exists independently of any dataset,
    and the same label can be applied to many datasets. This class manages the labels
    themselves. Applying a label to a dataset, or listing the labels currently on one,
    is dataset membership and is handled by the datasets resource.

    Examples:
        Basic dataset label operations::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            # List every label defined on the server
            labels = await client.dataset_labels.list()
            for label in labels:
                print(f"Label: {label['name']}")

            # Create a label
            label = await client.dataset_labels.create(name="regression", color="#FF0000")

            # Rename it, leaving its color and description untouched
            label = await client.dataset_labels.update(
                dataset_label_id=label["id"], name="regression-suite"
            )

            # Delete it, which also removes it from every dataset it was applied to
            await client.dataset_labels.delete(dataset_label_id=label["id"])
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        _guard: AsyncServerVersionGuard | None = None,
    ) -> None:
        """Initialize the AsyncDatasetLabels client.

        Args:
            client (httpx.AsyncClient): The httpx async client to use for making requests.
        """
        self._client = client
        self._guard = _guard or AsyncServerVersionGuard(client)

    async def list(self) -> list[v1.DatasetLabel]:
        """List all dataset labels, following cursor pagination to completion.

        Returns:
            A list of every dataset label defined on the server.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            labels = await client.dataset_labels.list()
            for label in labels:
                print(f"Label name: {label['name']}")
        """  # noqa: E501
        all_dataset_labels: list[v1.DatasetLabel] = []
        next_cursor: Optional[str] = None
        while True:
            params: dict[str, str] = {}
            if next_cursor:
                params["cursor"] = next_cursor
            response = await self._client.get("v1/dataset_labels", params=params)
            response.raise_for_status()
            data = cast(v1.GetDatasetLabelsResponseBody, response.json())
            all_dataset_labels.extend(data["data"])
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_dataset_labels

    async def get(self, *, dataset_label_id: str) -> v1.DatasetLabel:
        """Get a dataset label by ID.

        Args:
            dataset_label_id (str): The ID of the dataset label to retrieve.

        Returns:
            The dataset label with the specified ID.

        Raises:
            httpx.HTTPError: If the request fails, including a 404 when no label has
                the given ID.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            label = await client.dataset_labels.get(dataset_label_id="RGF0YXNldExhYmVsOjE=")
            print(f"Label name: {label['name']}")
        """  # noqa: E501
        url = f"v1/dataset_labels/{encode_path_param(dataset_label_id)}"
        response = await self._client.get(url)
        response.raise_for_status()
        return cast(v1.GetDatasetLabelResponseBody, response.json())["data"]

    async def create(
        self,
        *,
        name: str,
        color: str,
        description: Optional[str] = None,
    ) -> v1.DatasetLabel:
        """Create a new dataset label.

        Args:
            name (str): The name of the label. Label names are unique across the server.
            color (str): The color of the label.
            description (Optional[str]): An optional description of the label.

        Returns:
            The newly created dataset label.

        Raises:
            httpx.HTTPError: If the request fails, including a 409 when a label with
                the same name already exists.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            label = await client.dataset_labels.create(
                name="regression",
                color="#FF0000",
                description="Datasets used for regression testing",
            )
            print(f"Created dataset label with ID: {label['id']}")
        """  # noqa: E501
        json_ = v1.CreateDatasetLabelRequestBody(name=name, color=color)
        if description is not None:
            json_["description"] = description
        response = await self._client.post(url="v1/dataset_labels", json=json_)
        response.raise_for_status()
        return cast(v1.CreateDatasetLabelResponseBody, response.json())["data"]

    async def update(
        self,
        *,
        dataset_label_id: str,
        name: Optional[str] = None,
        color: Optional[str] = None,
        description: Optional[str] = None,
    ) -> v1.DatasetLabel:
        """Update a dataset label by ID.

        Only the fields supplied here are sent to the server, so any field left out
        keeps its current value.

        Args:
            dataset_label_id (str): The ID of the dataset label to update.
            name (Optional[str]): The new name for the label.
            color (Optional[str]): The new color for the label.
            description (Optional[str]): The new description for the label.

        Returns:
            The updated dataset label.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If none of name, color, or description is provided.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            # Change only the color; name and description are preserved
            label = await client.dataset_labels.update(
                dataset_label_id="RGF0YXNldExhYmVsOjE=",
                color="#00FF00",
            )
            print(f"Updated dataset label color: {label['color']}")
        """  # noqa: E501
        json_ = v1.UpdateDatasetLabelRequestBody()
        if name is not None:
            json_["name"] = name
        if color is not None:
            json_["color"] = color
        if description is not None:
            json_["description"] = description
        if not json_:
            raise ValueError("At least one of name, color, or description must be provided.")
        url = f"v1/dataset_labels/{encode_path_param(dataset_label_id)}"
        response = await self._client.patch(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.UpdateDatasetLabelResponseBody, response.json())["data"]

    async def delete(self, *, dataset_label_id: str) -> None:
        """Delete a dataset label by ID.

        Deleting a label also removes it from every dataset it was applied to. The
        datasets themselves are not affected.

        Args:
            dataset_label_id (str): The ID of the dataset label to delete.

        Raises:
            httpx.HTTPError: If the request fails, including a 404 when no label has
                the given ID.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            await client.dataset_labels.delete(dataset_label_id="RGF0YXNldExhYmVsOjE=")
        """  # noqa: E501
        url = f"v1/dataset_labels/{encode_path_param(dataset_label_id)}"
        response = await self._client.delete(url)
        response.raise_for_status()
