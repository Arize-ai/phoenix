from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import List, Optional, Union, cast

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.constants.server_requirements import (
    CREATE_DATASET_EVALUATOR,
    DELETE_DATASET_EVALUATOR,
    DELETE_DATASET_EVALUATORS,
    GET_DATASET_EVALUATOR,
    LIST_DATASET_EVALUATORS,
    PATCH_DATASET_EVALUATOR,
)
from phoenix.client.types.evaluators import EvaluatorOutputConfig
from phoenix.client.types.sentinels import NOT_GIVEN, NotGiven
from phoenix.client.utils.encode_path_param import encode_path_param
from phoenix.client.utils.problem_details import raise_for_problem
from phoenix.client.utils.server_requirements import (
    AsyncServerVersionGuard,
    ServerVersionGuard,
)

logger = logging.getLogger(__name__)

_PAGE_SIZE = 100


def _build_create_body(
    *,
    name: str,
    evaluator_id: str,
    input_mapping: v1.InputMapping,
    description: Union[str, NotGiven],
    output_configs: Union[Sequence[EvaluatorOutputConfig], NotGiven],
) -> v1.CreateDatasetEvaluatorRequest:
    body = v1.CreateDatasetEvaluatorRequest(
        name=name,
        evaluator_id=evaluator_id,
        input_mapping=input_mapping,
    )
    if not isinstance(description, NotGiven):
        body["description"] = description
    if not isinstance(output_configs, NotGiven):
        body["output_configs"] = list(output_configs)
    return body


def _build_patch_body(
    *,
    name: Union[str, NotGiven],
    input_mapping: Union[v1.InputMapping, NotGiven],
    description: Union[str, None, NotGiven],
    output_configs: Union[Sequence[EvaluatorOutputConfig], None, NotGiven],
) -> dict[str, object]:
    body: dict[str, object] = {}
    if not isinstance(name, NotGiven):
        body["name"] = name
    if not isinstance(input_mapping, NotGiven):
        body["input_mapping"] = input_mapping
    if not isinstance(description, NotGiven):
        body["description"] = description
    if not isinstance(output_configs, NotGiven):
        body["output_configs"] = None if output_configs is None else list(output_configs)
    if not body:
        raise ValueError("At least one field to update must be provided.")
    return body


def _delete_params(ids: Sequence[str]) -> tuple[tuple[str, str], ...]:
    if not ids:
        raise ValueError("At least one dataset_evaluator_id must be provided.")
    # A tuple matches httpx's query-parameter type. A list of str pairs does not:
    # list is invariant, so list[tuple[str, str]] is not a list of primitive pairs.
    return tuple(("dataset_evaluator_id", binding_id) for binding_id in ids)


class DatasetEvaluators:
    """Client for bindings between datasets and evaluators.

    A binding registers an evaluator to run against a dataset's experiments. It
    carries its own name and input mapping, and may override the shared
    definition's description and output configurations.

    Examples:
        Basic operations::

            from phoenix.client import Client
            client = Client()

            binding = client.evaluators.dataset_evaluators.create(
                dataset="golden-questions",
                name="exact-match",
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
            )

            for item in client.evaluators.dataset_evaluators.list(dataset="golden-questions"):
                print(item["id"], item["name"], item["evaluator_type"])

            client.evaluators.dataset_evaluators.delete(dataset_evaluator_id=binding["id"])
    """

    def __init__(
        self,
        client: httpx.Client,
        *,
        _guard: ServerVersionGuard | None = None,
    ) -> None:
        """Initialize the DatasetEvaluators client.

        Args:
            client (httpx.Client): The httpx client to use for making requests.
        """
        self._client = client
        self._guard = _guard or ServerVersionGuard(client)

    def create(
        self,
        *,
        dataset: str,
        name: str,
        evaluator_id: str,
        input_mapping: v1.InputMapping,
        description: Union[str, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[EvaluatorOutputConfig], NotGiven] = NOT_GIVEN,
    ) -> v1.DatasetEvaluator:
        """Bind an existing evaluator definition to a dataset.

        Create the definition first with :meth:`Evaluators.create_llm` or
        :meth:`Evaluators.create_code`, or bind a built-in evaluator by ID. This
        registers the evaluator and does not run an experiment.

        Args:
            dataset (str): The dataset name or ID. An ID takes precedence when a
                dataset is also named by the same string.
            name (str): The binding's name, unique within the dataset.
            evaluator_id (str): The ID of the LLM, code, or built-in evaluator.
            input_mapping (v1.InputMapping): How example and run fields map onto
                evaluator arguments.
            description (str): Overrides the shared definition's description on
                this binding. For LLM evaluators it must equal the description of
                the prompt's tool function.
            output_configs (Sequence[EvaluatorOutputConfig]): Overrides the shared
                definition's output configurations on this binding with at least
                one config; omit it to inherit them. For LLM evaluators the
                override must match the prompt's tool schema.

        Returns:
            The created binding.

        Raises:
            PhoenixAPIError: If the request fails. A name the dataset already
                uses is refused with ``code == "already_exists"`` and
                ``existing_id``.

        Example::

            from phoenix.client import Client
            client = Client()

            binding = client.evaluators.dataset_evaluators.create(
                dataset="golden-questions",
                name="exact-match",
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
            )
        """  # noqa: E501
        json_ = _build_create_body(
            name=name,
            evaluator_id=evaluator_id,
            input_mapping=input_mapping,
            description=description,
            output_configs=output_configs,
        )
        self._guard.require(CREATE_DATASET_EVALUATOR)
        url = f"v1/datasets/{encode_path_param(dataset)}/evaluators"
        response = self._client.post(url, json=json_)
        raise_for_problem(response)
        return cast(v1.DatasetEvaluatorResponseBody, response.json())["data"]

    def list(self, *, dataset: str, limit: Optional[int] = None) -> List[v1.DatasetEvaluator]:
        """List every evaluator bound to a dataset, newest first.

        Args:
            dataset (str): The dataset name or ID.
            limit (Optional[int]): Stop after this many bindings. By default
                pagination is followed to the end.

        Returns:
            The bindings.

        Raises:
            PhoenixAPIError: If the request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            for binding in client.evaluators.dataset_evaluators.list(dataset="golden-questions"):
                print(binding["id"], binding["name"])
        """  # noqa: E501
        self._guard.require(LIST_DATASET_EVALUATORS)
        url = f"v1/datasets/{encode_path_param(dataset)}/evaluators"
        bindings: list[v1.DatasetEvaluator] = []
        next_cursor: Optional[str] = None
        while True:
            remaining = (
                _PAGE_SIZE if limit is None else max(1, min(limit - len(bindings), _PAGE_SIZE))
            )
            params: dict[str, Union[str, int]] = {"limit": remaining}
            if next_cursor:
                params["cursor"] = next_cursor
            response = self._client.get(url, params=params)
            raise_for_problem(response)
            page = cast(v1.DatasetEvaluatorsResponseBody, response.json())
            bindings.extend(page["data"])
            if limit is not None and len(bindings) >= limit:
                return bindings[:limit]
            if not (next_cursor := page.get("next_cursor")):
                break
        return bindings

    def get(self, *, dataset_evaluator_id: str) -> v1.DatasetEvaluator:
        """Get a dataset evaluator binding by ID.

        Args:
            dataset_evaluator_id (str): The binding's ID.

        Returns:
            The binding. A null ``description`` or ``output_configs`` means the
            binding inherits the shared definition's value.

        Raises:
            PhoenixAPIError: If the request fails.
        """
        self._guard.require(GET_DATASET_EVALUATOR)
        url = f"v1/dataset_evaluators/{encode_path_param(dataset_evaluator_id)}"
        response = self._client.get(url)
        raise_for_problem(response)
        return cast(v1.DatasetEvaluatorResponseBody, response.json())["data"]

    def update(
        self,
        *,
        dataset_evaluator_id: str,
        name: Union[str, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, NotGiven] = NOT_GIVEN,
        description: Union[str, None, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[EvaluatorOutputConfig], None, NotGiven] = NOT_GIVEN,
    ) -> v1.DatasetEvaluator:
        """Update a binding. Omitted fields keep their current values.

        Args:
            dataset_evaluator_id (str): The binding's ID.
            name (str): A new name for the binding.
            input_mapping (v1.InputMapping): A new input mapping.
            description (Optional[str]): A new description override, or ``None``
                to inherit the shared definition's description again.
            output_configs (Optional[Sequence[EvaluatorOutputConfig]]): New
                output configuration overrides, at least one, or ``None`` to
                inherit the shared definition's outputs again.

        Returns:
            The updated binding.

        Raises:
            PhoenixAPIError: If the request fails.
            ValueError: If no field to update is provided.
        """
        json_ = _build_patch_body(
            name=name,
            input_mapping=input_mapping,
            description=description,
            output_configs=output_configs,
        )
        self._guard.require(PATCH_DATASET_EVALUATOR)
        url = f"v1/dataset_evaluators/{encode_path_param(dataset_evaluator_id)}"
        response = self._client.patch(url, json=json_)
        raise_for_problem(response)
        return cast(v1.DatasetEvaluatorResponseBody, response.json())["data"]

    def delete(
        self,
        *,
        dataset_evaluator_id: str,
    ) -> None:
        """Delete a binding; a missing binding is ignored.

        The binding's trace project and recorded traces are deleted. Its evaluator
        definition and prompt are kept. Delete a definition nothing binds with
        :meth:`Evaluators.delete`.

        Args:
            dataset_evaluator_id (str): The binding's ID.

        Raises:
            PhoenixAPIError: If the request fails.
        """
        self._guard.require(DELETE_DATASET_EVALUATOR)
        url = f"v1/dataset_evaluators/{encode_path_param(dataset_evaluator_id)}"
        response = self._client.delete(url)
        raise_for_problem(response)

    def delete_many(
        self,
        *,
        dataset: str,
        dataset_evaluator_ids: Sequence[str],
    ) -> None:
        """Delete several of a dataset's bindings atomically.

        Either every binding is deleted or none is. Missing bindings are
        ignored; an ID that is not a binding, or a binding of another dataset,
        fails the whole request. Each deleted binding's trace project and recorded
        traces are removed; evaluator definitions and prompts are kept.

        Args:
            dataset (str): The dataset name or ID.
            dataset_evaluator_ids (Sequence[str]): The binding IDs, at most 1000.

        Raises:
            PhoenixAPIError: If the request fails.
            ValueError: If no IDs are given.
        """
        params = _delete_params(dataset_evaluator_ids)
        self._guard.require(DELETE_DATASET_EVALUATORS)
        url = f"v1/datasets/{encode_path_param(dataset)}/evaluators"
        response = self._client.delete(url, params=params)
        raise_for_problem(response)


class AsyncDatasetEvaluators:
    """Asynchronous client for bindings between datasets and evaluators.

    A binding registers an evaluator to run against a dataset's experiments. It
    carries its own name and input mapping, and may override the shared
    definition's description and output configurations.

    Examples:
        Basic operations::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            binding = await client.evaluators.dataset_evaluators.create(
                dataset="golden-questions",
                name="exact-match",
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
            )

            for item in await client.evaluators.dataset_evaluators.list(dataset="golden-questions"):
                print(item["id"], item["name"], item["evaluator_type"])
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        _guard: AsyncServerVersionGuard | None = None,
    ) -> None:
        """Initialize the AsyncDatasetEvaluators client.

        Args:
            client (httpx.AsyncClient): The httpx client to use for making requests.
        """
        self._client = client
        self._guard = _guard or AsyncServerVersionGuard(client)

    async def create(
        self,
        *,
        dataset: str,
        name: str,
        evaluator_id: str,
        input_mapping: v1.InputMapping,
        description: Union[str, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[EvaluatorOutputConfig], NotGiven] = NOT_GIVEN,
    ) -> v1.DatasetEvaluator:
        """Bind an existing evaluator definition to a dataset.

        Create the definition first with :meth:`Evaluators.create_llm` or
        :meth:`Evaluators.create_code`, or bind a built-in evaluator by ID. This
        registers the evaluator and does not run an experiment.

        Args:
            dataset (str): The dataset name or ID. An ID takes precedence when a
                dataset is also named by the same string.
            name (str): The binding's name, unique within the dataset.
            evaluator_id (str): The ID of the LLM, code, or built-in evaluator.
            input_mapping (v1.InputMapping): How example and run fields map onto
                evaluator arguments.
            description (str): Overrides the shared definition's description on
                this binding. For LLM evaluators it must equal the description of
                the prompt's tool function.
            output_configs (Sequence[EvaluatorOutputConfig]): Overrides the shared
                definition's output configurations on this binding with at least
                one config; omit it to inherit them. For LLM evaluators the
                override must match the prompt's tool schema.

        Returns:
            The created binding.

        Raises:
            PhoenixAPIError: If the request fails.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            binding = await client.evaluators.dataset_evaluators.create(
                dataset="golden-questions",
                name="exact-match",
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
            )
        """  # noqa: E501
        json_ = _build_create_body(
            name=name,
            evaluator_id=evaluator_id,
            input_mapping=input_mapping,
            description=description,
            output_configs=output_configs,
        )
        await self._guard.require(CREATE_DATASET_EVALUATOR)
        url = f"v1/datasets/{encode_path_param(dataset)}/evaluators"
        response = await self._client.post(url, json=json_)
        raise_for_problem(response)
        return cast(v1.DatasetEvaluatorResponseBody, response.json())["data"]

    async def list(self, *, dataset: str, limit: Optional[int] = None) -> List[v1.DatasetEvaluator]:
        """List every evaluator bound to a dataset, newest first.

        Args:
            dataset (str): The dataset name or ID.
            limit (Optional[int]): Stop after this many bindings. By default
                pagination is followed to the end.

        Returns:
            The bindings.

        Raises:
            PhoenixAPIError: If the request fails.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            for binding in await client.evaluators.dataset_evaluators.list(
                dataset="golden-questions"
            ):
                print(binding["id"], binding["name"])
        """  # noqa: E501
        await self._guard.require(LIST_DATASET_EVALUATORS)
        url = f"v1/datasets/{encode_path_param(dataset)}/evaluators"
        bindings: list[v1.DatasetEvaluator] = []
        next_cursor: Optional[str] = None
        while True:
            remaining = (
                _PAGE_SIZE if limit is None else max(1, min(limit - len(bindings), _PAGE_SIZE))
            )
            params: dict[str, Union[str, int]] = {"limit": remaining}
            if next_cursor:
                params["cursor"] = next_cursor
            response = await self._client.get(url, params=params)
            raise_for_problem(response)
            page = cast(v1.DatasetEvaluatorsResponseBody, response.json())
            bindings.extend(page["data"])
            if limit is not None and len(bindings) >= limit:
                return bindings[:limit]
            if not (next_cursor := page.get("next_cursor")):
                break
        return bindings

    async def get(self, *, dataset_evaluator_id: str) -> v1.DatasetEvaluator:
        """Get a dataset evaluator binding by ID.

        Args:
            dataset_evaluator_id (str): The binding's ID.

        Returns:
            The binding. A null ``description`` or ``output_configs`` means the
            binding inherits the shared definition's value.

        Raises:
            PhoenixAPIError: If the request fails.
        """
        await self._guard.require(GET_DATASET_EVALUATOR)
        url = f"v1/dataset_evaluators/{encode_path_param(dataset_evaluator_id)}"
        response = await self._client.get(url)
        raise_for_problem(response)
        return cast(v1.DatasetEvaluatorResponseBody, response.json())["data"]

    async def update(
        self,
        *,
        dataset_evaluator_id: str,
        name: Union[str, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, NotGiven] = NOT_GIVEN,
        description: Union[str, None, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[EvaluatorOutputConfig], None, NotGiven] = NOT_GIVEN,
    ) -> v1.DatasetEvaluator:
        """Update a binding. Omitted fields keep their current values.

        Args:
            dataset_evaluator_id (str): The binding's ID.
            name (str): A new name for the binding.
            input_mapping (v1.InputMapping): A new input mapping.
            description (Optional[str]): A new description override, or ``None``
                to inherit the shared definition's description again.
            output_configs (Optional[Sequence[EvaluatorOutputConfig]]): New
                output configuration overrides, at least one, or ``None`` to
                inherit the shared definition's outputs again.

        Returns:
            The updated binding.

        Raises:
            PhoenixAPIError: If the request fails.
            ValueError: If no field to update is provided.
        """
        json_ = _build_patch_body(
            name=name,
            input_mapping=input_mapping,
            description=description,
            output_configs=output_configs,
        )
        await self._guard.require(PATCH_DATASET_EVALUATOR)
        url = f"v1/dataset_evaluators/{encode_path_param(dataset_evaluator_id)}"
        response = await self._client.patch(url, json=json_)
        raise_for_problem(response)
        return cast(v1.DatasetEvaluatorResponseBody, response.json())["data"]

    async def delete(
        self,
        *,
        dataset_evaluator_id: str,
    ) -> None:
        """Delete a binding; a missing binding is ignored.

        The binding's trace project and recorded traces are deleted. Its evaluator
        definition and prompt are kept. Delete a definition nothing binds with
        :meth:`Evaluators.delete`.

        Args:
            dataset_evaluator_id (str): The binding's ID.

        Raises:
            PhoenixAPIError: If the request fails.
        """
        await self._guard.require(DELETE_DATASET_EVALUATOR)
        url = f"v1/dataset_evaluators/{encode_path_param(dataset_evaluator_id)}"
        response = await self._client.delete(url)
        raise_for_problem(response)

    async def delete_many(
        self,
        *,
        dataset: str,
        dataset_evaluator_ids: Sequence[str],
    ) -> None:
        """Delete several of a dataset's bindings atomically.

        Either every binding is deleted or none is. Missing bindings are
        ignored; an ID that is not a binding, or a binding of another dataset,
        fails the whole request. Each deleted binding's trace project and recorded
        traces are removed; evaluator definitions and prompts are kept.

        Args:
            dataset (str): The dataset name or ID.
            dataset_evaluator_ids (Sequence[str]): The binding IDs, at most 1000.

        Raises:
            PhoenixAPIError: If the request fails.
            ValueError: If no IDs are given.
        """
        params = _delete_params(dataset_evaluator_ids)
        await self._guard.require(DELETE_DATASET_EVALUATORS)
        url = f"v1/datasets/{encode_path_param(dataset)}/evaluators"
        response = await self._client.delete(url, params=params)
        raise_for_problem(response)
