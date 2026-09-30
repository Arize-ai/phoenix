from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import List, Literal, Optional, Union, cast

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.constants.server_requirements import (
    CREATE_PROJECT_EVALUATOR,
    DELETE_PROJECT_EVALUATOR,
    DELETE_PROJECT_EVALUATORS,
    GET_PROJECT_EVALUATOR,
    LIST_PROJECT_EVALUATORS,
    PATCH_PROJECT_EVALUATOR,
)
from phoenix.client.types.sentinels import NOT_GIVEN, NotGiven
from phoenix.client.utils.encode_path_param import encode_path_param
from phoenix.client.utils.problem_details import raise_for_problem
from phoenix.client.utils.server_requirements import (
    AsyncServerVersionGuard,
    ServerVersionGuard,
)

logger = logging.getLogger(__name__)

_PAGE_SIZE = 100

EvaluationTarget = Literal["SPAN", "TRACE", "SESSION"]


def _build_create_body(
    *,
    name: str,
    evaluation_target: EvaluationTarget,
    sampling_rate: float,
    evaluator_id: str,
    filter_condition: Union[str, NotGiven],
    enabled: Union[bool, NotGiven],
    input_mapping: Union[v1.InputMapping, NotGiven],
    evaluation_delay_seconds: Union[int, NotGiven],
) -> v1.CreateProjectEvaluatorRequest:
    body = v1.CreateProjectEvaluatorRequest(
        name=name,
        evaluator_id=evaluator_id,
        evaluation_target=evaluation_target,
        sampling_rate=sampling_rate,
    )
    if not isinstance(filter_condition, NotGiven):
        body["filter_condition"] = filter_condition
    if not isinstance(enabled, NotGiven):
        body["enabled"] = enabled
    if not isinstance(input_mapping, NotGiven):
        body["input_mapping"] = input_mapping
    if not isinstance(evaluation_delay_seconds, NotGiven):
        body["evaluation_delay_seconds"] = evaluation_delay_seconds
    return body


def _build_patch_body(
    *,
    name: Union[str, NotGiven],
    sampling_rate: Union[float, NotGiven],
    filter_condition: Union[str, NotGiven],
    enabled: Union[bool, NotGiven],
    input_mapping: Union[v1.InputMapping, None, NotGiven],
    evaluation_delay_seconds: Union[int, None, NotGiven],
) -> dict[str, object]:
    body: dict[str, object] = {}
    if not isinstance(name, NotGiven):
        body["name"] = name
    if not isinstance(sampling_rate, NotGiven):
        body["sampling_rate"] = sampling_rate
    if not isinstance(filter_condition, NotGiven):
        body["filter_condition"] = filter_condition
    if not isinstance(enabled, NotGiven):
        body["enabled"] = enabled
    if not isinstance(input_mapping, NotGiven):
        body["input_mapping"] = input_mapping
    if not isinstance(evaluation_delay_seconds, NotGiven):
        body["evaluation_delay_seconds"] = evaluation_delay_seconds
    if not body:
        raise ValueError("At least one field to update must be provided.")
    return body


def _delete_params(ids: Sequence[str]) -> list[tuple[str, str]]:
    if not ids:
        raise ValueError("At least one project_evaluator_id must be provided.")
    return [("project_evaluator_id", binding_id) for binding_id in ids]


class ProjectEvaluators:
    """Client for bindings that run evaluators on a project's incoming traces.

    A binding names the evaluator within the project and controls scheduling:
    the target (SPAN, TRACE, or SESSION), a sampling rate, an optional filter
    in the target's filter language, and for TRACE and SESSION targets a
    quiet-period delay. SPAN evaluators run on matching sampled spans as they
    arrive. TRACE and SESSION evaluators run once per trace or session, after
    it has been quiet for the delay.

    Examples:
        Basic operations::

            from phoenix.client import Client
            client = Client()

            binding = client.evaluators.project_evaluators.create(
                project="support-bot",
                name="toxicity",
                evaluation_target="SPAN",
                sampling_rate=0.25,
                evaluator_id="Q29kZUV2YWx1YXRvcjox",
                filter_condition="span_kind == 'LLM'",
            )

            for item in client.evaluators.project_evaluators.list(project="support-bot"):
                print(item["id"], item["name"], item["evaluation_target"], item["enabled"])

            client.evaluators.project_evaluators.update(
                project_evaluator_id=binding["id"], enabled=False
            )
    """

    def __init__(
        self,
        client: httpx.Client,
        *,
        _guard: ServerVersionGuard | None = None,
    ) -> None:
        """Initialize the ProjectEvaluators client.

        Args:
            client (httpx.Client): The httpx client to use for making requests.
        """
        self._client = client
        self._guard = _guard or ServerVersionGuard(client)

    def create(
        self,
        *,
        project: str,
        name: str,
        evaluation_target: EvaluationTarget,
        sampling_rate: float,
        evaluator_id: str,
        filter_condition: Union[str, NotGiven] = NOT_GIVEN,
        enabled: Union[bool, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, NotGiven] = NOT_GIVEN,
        evaluation_delay_seconds: Union[int, NotGiven] = NOT_GIVEN,
    ) -> v1.ProjectEvaluator:
        """Bind an existing evaluator definition to a project.

        Create LLM and code definitions first with
        :meth:`Evaluators.create_llm` or :meth:`Evaluators.create_code`; one
        definition can back many bindings.

        Args:
            project (str): The project name or ID. An ID takes precedence when a
                project is also named by the same string.
            name (str): The binding's name, unique within the project.
            evaluation_target (EvaluationTarget): ``"SPAN"``, ``"TRACE"``, or
                ``"SESSION"``.
            sampling_rate (float): The fraction of matching records to evaluate,
                between 0 and 1.
            evaluator_id (str): The ID of the LLM or code evaluator to bind.
            filter_condition (str): A filter expression, in the language of the
                evaluation target (span, trace, or session), that records must match
                to be evaluated.
            enabled (bool): Whether the binding is active. Defaults to enabled.
            input_mapping (v1.InputMapping): How record fields map onto evaluator
                arguments. Omit it to use the shared definition's mapping. LLM
                evaluators have none, so their template variables bind to record
                fields of the same name.
            evaluation_delay_seconds (int): For TRACE and SESSION targets, how
                long the trace or session must be quiet before it is evaluated.
                Defaults to the server's setting for the target. Rejected for
                SPAN targets, which evaluate spans as they arrive.

        Returns:
            The created binding. ``evaluation_delay_seconds`` is ``0`` for SPAN
            targets, which evaluate spans as they arrive.

        Raises:
            PhoenixAPIError: If the request fails. A name the project already
                uses is refused with ``code == "already_exists"`` and
                ``existing_id``.

        Example::

            from phoenix.client import Client
            client = Client()

            binding = client.evaluators.project_evaluators.create(
                project="support-bot",
                name="toxicity",
                evaluation_target="SPAN",
                sampling_rate=0.25,
                evaluator_id="Q29kZUV2YWx1YXRvcjox",
            )
        """  # noqa: E501
        json_ = _build_create_body(
            name=name,
            evaluation_target=evaluation_target,
            sampling_rate=sampling_rate,
            evaluator_id=evaluator_id,
            filter_condition=filter_condition,
            enabled=enabled,
            input_mapping=input_mapping,
            evaluation_delay_seconds=evaluation_delay_seconds,
        )
        self._guard.require(CREATE_PROJECT_EVALUATOR)
        url = f"v1/projects/{encode_path_param(project)}/evaluators"
        response = self._client.post(url, json=json_)
        raise_for_problem(response)
        return cast(v1.ProjectEvaluatorResponseBody, response.json())["data"]

    def list(self, *, project: str, limit: Optional[int] = None) -> List[v1.ProjectEvaluator]:
        """List every evaluator bound to a project, newest first.

        Args:
            project (str): The project name or ID.
            limit (Optional[int]): Stop after this many bindings. By default
                pagination is followed to the end.

        Returns:
            The bindings.

        Raises:
            PhoenixAPIError: If the request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            for binding in client.evaluators.project_evaluators.list(project="support-bot"):
                print(binding["id"], binding["name"])
        """  # noqa: E501
        self._guard.require(LIST_PROJECT_EVALUATORS)
        url = f"v1/projects/{encode_path_param(project)}/evaluators"
        bindings: list[v1.ProjectEvaluator] = []
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
            page = cast(v1.ProjectEvaluatorsResponseBody, response.json())
            bindings.extend(page["data"])
            if limit is not None and len(bindings) >= limit:
                return bindings[:limit]
            if not (next_cursor := page.get("next_cursor")):
                break
        return bindings

    def get(self, *, project_evaluator_id: str) -> v1.ProjectEvaluator:
        """Get a project evaluator binding by ID.

        Args:
            project_evaluator_id (str): The binding's ID.

        Returns:
            The binding. A null ``input_mapping`` means the binding uses the
            shared definition's mapping.

        Raises:
            PhoenixAPIError: If the request fails.
        """
        self._guard.require(GET_PROJECT_EVALUATOR)
        url = f"v1/project_evaluators/{encode_path_param(project_evaluator_id)}"
        response = self._client.get(url)
        raise_for_problem(response)
        return cast(v1.ProjectEvaluatorResponseBody, response.json())["data"]

    def update(
        self,
        *,
        project_evaluator_id: str,
        name: Union[str, NotGiven] = NOT_GIVEN,
        sampling_rate: Union[float, NotGiven] = NOT_GIVEN,
        filter_condition: Union[str, NotGiven] = NOT_GIVEN,
        enabled: Union[bool, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, None, NotGiven] = NOT_GIVEN,
        evaluation_delay_seconds: Union[int, None, NotGiven] = NOT_GIVEN,
    ) -> v1.ProjectEvaluator:
        """Update a binding. Omitted fields keep their current values.

        The evaluation target cannot change; create a new binding instead.

        Args:
            project_evaluator_id (str): The binding's ID.
            name (str): A new name for the binding.
            sampling_rate (float): A new sampling rate between 0 and 1.
            filter_condition (str): A new filter expression in the language of
                the evaluation target.
            enabled (bool): Enable or disable the binding.
            input_mapping (Optional[v1.InputMapping]): A new input mapping, or
                ``None`` to use the shared definition's mapping again.
            evaluation_delay_seconds (Optional[int]): A new quiet-period delay for
                TRACE and SESSION targets, or ``None`` to restore the server's
                default. Rejected for SPAN targets.

        Returns:
            The updated binding.

        Raises:
            PhoenixAPIError: If the request fails.
            ValueError: If no field to update is provided.
        """
        json_ = _build_patch_body(
            name=name,
            sampling_rate=sampling_rate,
            filter_condition=filter_condition,
            enabled=enabled,
            input_mapping=input_mapping,
            evaluation_delay_seconds=evaluation_delay_seconds,
        )
        self._guard.require(PATCH_PROJECT_EVALUATOR)
        url = f"v1/project_evaluators/{encode_path_param(project_evaluator_id)}"
        response = self._client.patch(url, json=json_)
        raise_for_problem(response)
        return cast(v1.ProjectEvaluatorResponseBody, response.json())["data"]

    def delete(
        self,
        *,
        project_evaluator_id: str,
    ) -> None:
        """Delete a binding; a missing binding is ignored.

        The evaluator definition, its prompt, and the binding's trace project are
        kept. Delete a definition nothing binds with :meth:`Evaluators.delete`.

        Args:
            project_evaluator_id (str): The binding's ID.

        Raises:
            PhoenixAPIError: If the request fails.
        """
        self._guard.require(DELETE_PROJECT_EVALUATOR)
        url = f"v1/project_evaluators/{encode_path_param(project_evaluator_id)}"
        response = self._client.delete(url)
        raise_for_problem(response)

    def delete_many(
        self,
        *,
        project: str,
        project_evaluator_ids: Sequence[str],
    ) -> None:
        """Delete several of a project's bindings atomically.

        Either every binding is deleted or none is. Missing bindings are
        ignored; an ID that is not a binding, or a binding of another project,
        fails the whole request. Definitions, prompts, and trace projects are
        kept.

        Args:
            project (str): The project name or ID.
            project_evaluator_ids (Sequence[str]): The binding IDs, at most 1000.

        Raises:
            PhoenixAPIError: If the request fails.
            ValueError: If no IDs are given.
        """
        params = _delete_params(project_evaluator_ids)
        self._guard.require(DELETE_PROJECT_EVALUATORS)
        url = f"v1/projects/{encode_path_param(project)}/evaluators"
        response = self._client.delete(url, params=params)
        raise_for_problem(response)


class AsyncProjectEvaluators:
    """Asynchronous client for bindings that run evaluators on a project's traces.

    A binding names the evaluator within the project and controls scheduling:
    the target (SPAN, TRACE, or SESSION), a sampling rate, an optional filter
    in the target's filter language, and for TRACE and SESSION targets a
    quiet-period delay. SPAN evaluators run on matching sampled spans as they
    arrive. TRACE and SESSION evaluators run once per trace or session, after
    it has been quiet for the delay.

    Examples:
        Basic operations::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            binding = await client.evaluators.project_evaluators.create(
                project="support-bot",
                name="toxicity",
                evaluation_target="SPAN",
                sampling_rate=0.25,
                evaluator_id="Q29kZUV2YWx1YXRvcjox",
            )

            for item in await client.evaluators.project_evaluators.list(project="support-bot"):
                print(item["id"], item["name"], item["evaluation_target"], item["enabled"])
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        _guard: AsyncServerVersionGuard | None = None,
    ) -> None:
        """Initialize the AsyncProjectEvaluators client.

        Args:
            client (httpx.AsyncClient): The httpx client to use for making requests.
        """
        self._client = client
        self._guard = _guard or AsyncServerVersionGuard(client)

    async def create(
        self,
        *,
        project: str,
        name: str,
        evaluation_target: EvaluationTarget,
        sampling_rate: float,
        evaluator_id: str,
        filter_condition: Union[str, NotGiven] = NOT_GIVEN,
        enabled: Union[bool, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, NotGiven] = NOT_GIVEN,
        evaluation_delay_seconds: Union[int, NotGiven] = NOT_GIVEN,
    ) -> v1.ProjectEvaluator:
        """Bind an existing evaluator definition to a project.

        Create LLM and code definitions first with
        :meth:`Evaluators.create_llm` or :meth:`Evaluators.create_code`; one
        definition can back many bindings.

        Args:
            project (str): The project name or ID. An ID takes precedence when a
                project is also named by the same string.
            name (str): The binding's name, unique within the project.
            evaluation_target (EvaluationTarget): ``"SPAN"``, ``"TRACE"``, or
                ``"SESSION"``.
            sampling_rate (float): The fraction of matching records to evaluate,
                between 0 and 1.
            evaluator_id (str): The ID of the LLM or code evaluator to bind.
            filter_condition (str): A filter expression, in the language of the
                evaluation target (span, trace, or session), that records must match
                to be evaluated.
            enabled (bool): Whether the binding is active. Defaults to enabled.
            input_mapping (v1.InputMapping): How record fields map onto evaluator
                arguments. Omit it to use the shared definition's mapping. LLM
                evaluators have none, so their template variables bind to record
                fields of the same name.
            evaluation_delay_seconds (int): For TRACE and SESSION targets, how
                long the trace or session must be quiet before it is evaluated.
                Defaults to the server's setting for the target. Rejected for
                SPAN targets, which evaluate spans as they arrive.

        Returns:
            The created binding. ``evaluation_delay_seconds`` is ``0`` for SPAN
            targets, which evaluate spans as they arrive.

        Raises:
            PhoenixAPIError: If the request fails. A name the project already
                uses is refused with ``code == "already_exists"`` and
                ``existing_id``.
        """
        json_ = _build_create_body(
            name=name,
            evaluation_target=evaluation_target,
            sampling_rate=sampling_rate,
            evaluator_id=evaluator_id,
            filter_condition=filter_condition,
            enabled=enabled,
            input_mapping=input_mapping,
            evaluation_delay_seconds=evaluation_delay_seconds,
        )
        await self._guard.require(CREATE_PROJECT_EVALUATOR)
        url = f"v1/projects/{encode_path_param(project)}/evaluators"
        response = await self._client.post(url, json=json_)
        raise_for_problem(response)
        return cast(v1.ProjectEvaluatorResponseBody, response.json())["data"]

    async def list(self, *, project: str, limit: Optional[int] = None) -> List[v1.ProjectEvaluator]:
        """List every evaluator bound to a project, newest first.

        Args:
            project (str): The project name or ID.
            limit (Optional[int]): Stop after this many bindings. By default
                pagination is followed to the end.

        Returns:
            The bindings.

        Raises:
            PhoenixAPIError: If the request fails.
        """
        await self._guard.require(LIST_PROJECT_EVALUATORS)
        url = f"v1/projects/{encode_path_param(project)}/evaluators"
        bindings: list[v1.ProjectEvaluator] = []
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
            page = cast(v1.ProjectEvaluatorsResponseBody, response.json())
            bindings.extend(page["data"])
            if limit is not None and len(bindings) >= limit:
                return bindings[:limit]
            if not (next_cursor := page.get("next_cursor")):
                break
        return bindings

    async def get(self, *, project_evaluator_id: str) -> v1.ProjectEvaluator:
        """Get a project evaluator binding by ID.

        Args:
            project_evaluator_id (str): The binding's ID.

        Returns:
            The binding. A null ``input_mapping`` means the binding uses the
            shared definition's mapping.

        Raises:
            PhoenixAPIError: If the request fails.
        """
        await self._guard.require(GET_PROJECT_EVALUATOR)
        url = f"v1/project_evaluators/{encode_path_param(project_evaluator_id)}"
        response = await self._client.get(url)
        raise_for_problem(response)
        return cast(v1.ProjectEvaluatorResponseBody, response.json())["data"]

    async def update(
        self,
        *,
        project_evaluator_id: str,
        name: Union[str, NotGiven] = NOT_GIVEN,
        sampling_rate: Union[float, NotGiven] = NOT_GIVEN,
        filter_condition: Union[str, NotGiven] = NOT_GIVEN,
        enabled: Union[bool, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, None, NotGiven] = NOT_GIVEN,
        evaluation_delay_seconds: Union[int, None, NotGiven] = NOT_GIVEN,
    ) -> v1.ProjectEvaluator:
        """Update a binding. Omitted fields keep their current values.

        The evaluation target cannot change; create a new binding instead.

        Args:
            project_evaluator_id (str): The binding's ID.
            name (str): A new name for the binding.
            sampling_rate (float): A new sampling rate between 0 and 1.
            filter_condition (str): A new filter expression in the language of
                the evaluation target.
            enabled (bool): Enable or disable the binding.
            input_mapping (Optional[v1.InputMapping]): A new input mapping, or
                ``None`` to use the shared definition's mapping again.
            evaluation_delay_seconds (Optional[int]): A new quiet-period delay for
                TRACE and SESSION targets, or ``None`` to restore the server's
                default. Rejected for SPAN targets.

        Returns:
            The updated binding.

        Raises:
            PhoenixAPIError: If the request fails.
            ValueError: If no field to update is provided.
        """
        json_ = _build_patch_body(
            name=name,
            sampling_rate=sampling_rate,
            filter_condition=filter_condition,
            enabled=enabled,
            input_mapping=input_mapping,
            evaluation_delay_seconds=evaluation_delay_seconds,
        )
        await self._guard.require(PATCH_PROJECT_EVALUATOR)
        url = f"v1/project_evaluators/{encode_path_param(project_evaluator_id)}"
        response = await self._client.patch(url, json=json_)
        raise_for_problem(response)
        return cast(v1.ProjectEvaluatorResponseBody, response.json())["data"]

    async def delete(
        self,
        *,
        project_evaluator_id: str,
    ) -> None:
        """Delete a binding; a missing binding is ignored.

        The evaluator definition, its prompt, and the binding's trace project are
        kept. Delete a definition nothing binds with :meth:`Evaluators.delete`.

        Args:
            project_evaluator_id (str): The binding's ID.

        Raises:
            PhoenixAPIError: If the request fails.
        """
        await self._guard.require(DELETE_PROJECT_EVALUATOR)
        url = f"v1/project_evaluators/{encode_path_param(project_evaluator_id)}"
        response = await self._client.delete(url)
        raise_for_problem(response)

    async def delete_many(
        self,
        *,
        project: str,
        project_evaluator_ids: Sequence[str],
    ) -> None:
        """Delete several of a project's bindings atomically.

        Either every binding is deleted or none is. Missing bindings are
        ignored; an ID that is not a binding, or a binding of another project,
        fails the whole request. Definitions, prompts, and trace projects are
        kept.

        Args:
            project (str): The project name or ID.
            project_evaluator_ids (Sequence[str]): The binding IDs, at most 1000.

        Raises:
            PhoenixAPIError: If the request fails.
            ValueError: If no IDs are given.
        """
        params = _delete_params(project_evaluator_ids)
        await self._guard.require(DELETE_PROJECT_EVALUATORS)
        url = f"v1/projects/{encode_path_param(project)}/evaluators"
        response = await self._client.delete(url, params=params)
        raise_for_problem(response)
