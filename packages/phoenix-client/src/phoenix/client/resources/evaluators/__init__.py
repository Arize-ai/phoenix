from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import List, Literal, Optional, Union, cast

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.constants.server_requirements import (
    CREATE_EVALUATOR,
    CREATE_EVALUATOR_VERSION,
    DELETE_EVALUATOR,
    GET_EVALUATOR,
    LIST_EVALUATOR_VERSIONS,
    LIST_EVALUATORS,
    PATCH_EVALUATOR,
)
from phoenix.client.types.sentinels import NOT_GIVEN, NotGiven
from phoenix.client.utils.encode_path_param import encode_path_param
from phoenix.client.utils.server_requirements import (
    AsyncServerVersionGuard,
    ServerVersionGuard,
)

logger = logging.getLogger(__name__)

_PAGE_SIZE = 100

EvaluatorDefinition = Union[v1.LLMEvaluatorDefinition, v1.CodeEvaluatorDefinition]
"""A shared evaluator definition. The ``type`` field discriminates the variants."""

EvaluatorType = Literal["llm", "code"]
"""A kind of evaluator definition, as accepted by the ``type`` filter of :meth:`Evaluators.list`."""

EvaluatorOutputConfig = Union[
    v1.CategoricalAnnotationConfigData,
    v1.ContinuousAnnotationConfigData,
    v1.FreeformAnnotationConfigData,
]
"""An output configuration accepted by code evaluators."""

Language = Literal["PYTHON", "TYPESCRIPT"]
"""The language a code evaluator is written in."""


def _build_llm_patch(
    *,
    name: Union[str, NotGiven],
    description: Union[str, None, NotGiven],
    prompt_version_id: Union[str, NotGiven],
    output_configs: Union[Sequence[v1.CategoricalAnnotationConfigData], NotGiven],
) -> dict[str, object]:
    body: dict[str, object] = {"type": "llm"}
    if not isinstance(name, NotGiven):
        body["name"] = name
    if not isinstance(description, NotGiven):
        body["description"] = description
    if not isinstance(prompt_version_id, NotGiven):
        body["prompt_version_id"] = prompt_version_id
    if not isinstance(output_configs, NotGiven):
        body["output_configs"] = list(output_configs)
    if len(body) == 1:
        raise ValueError("At least one field to update must be provided.")
    return body


def _build_code_patch(
    *,
    name: Union[str, NotGiven],
    description: Union[str, None, NotGiven],
    sandbox_config_id: Union[str, None, NotGiven],
    input_mapping: Union[v1.InputMapping, NotGiven],
    output_configs: Union[Sequence[EvaluatorOutputConfig], NotGiven],
) -> dict[str, object]:
    body: dict[str, object] = {"type": "code"}
    if not isinstance(name, NotGiven):
        body["name"] = name
    if not isinstance(description, NotGiven):
        body["description"] = description
    if not isinstance(sandbox_config_id, NotGiven):
        body["sandbox_config_id"] = sandbox_config_id
    if not isinstance(input_mapping, NotGiven):
        body["input_mapping"] = input_mapping
    if not isinstance(output_configs, NotGiven):
        body["output_configs"] = list(output_configs)
    if len(body) == 1:
        raise ValueError("At least one field to update must be provided.")
    return body


def _build_create_body(
    *,
    name: str,
    source_code: str,
    language: Language,
    sandbox_config_id: str,
    input_mapping: v1.InputMapping,
    output_configs: Sequence[EvaluatorOutputConfig],
    description: Optional[str],
) -> v1.CreateCodeEvaluatorRequest:
    body = v1.CreateCodeEvaluatorRequest(
        type="code",
        name=name,
        source_code=source_code,
        language=language,
        sandbox_config_id=sandbox_config_id,
        input_mapping=input_mapping,
        output_configs=list(output_configs),
    )
    if description is not None:
        body["description"] = description
    return body


def _build_version_body(
    *,
    source_code: str,
    expected_current_version_id: Union[str, NotGiven],
    description: Union[str, None, NotGiven],
    sandbox_config_id: Union[str, None, NotGiven],
    input_mapping: Union[v1.InputMapping, NotGiven],
    output_configs: Union[Sequence[EvaluatorOutputConfig], NotGiven],
) -> dict[str, object]:
    body: dict[str, object] = {"source_code": source_code}
    if not isinstance(expected_current_version_id, NotGiven):
        body["expected_current_version_id"] = expected_current_version_id
    if not isinstance(description, NotGiven):
        body["description"] = description
    if not isinstance(sandbox_config_id, NotGiven):
        body["sandbox_config_id"] = sandbox_config_id
    if not isinstance(input_mapping, NotGiven):
        body["input_mapping"] = input_mapping
    if not isinstance(output_configs, NotGiven):
        body["output_configs"] = list(output_configs)
    return body


def _list_params(
    cursor: Optional[str],
    *,
    type: Optional[EvaluatorType] = None,
    name: Optional[str] = None,
    remaining: Optional[int] = None,
) -> dict[str, Union[str, int]]:
    page = _PAGE_SIZE if remaining is None else max(1, min(remaining, _PAGE_SIZE))
    params: dict[str, Union[str, int]] = {"limit": page}
    if type is not None:
        params["type"] = type
    if name is not None:
        params["name"] = name
    if cursor:
        params["cursor"] = cursor
    return params


class Evaluators:
    """Client for the shared evaluator definitions API.

    Definitions are shared by every project and dataset binding that references
    them, so an update here applies everywhere the evaluator is used.

    Examples:
        Basic operations::

            from phoenix.client import Client
            client = Client()

            for definition in client.evaluators.list(type="code"):
                print(definition["id"], definition["name"])

            definition = client.evaluators.get(evaluator_id="Q29kZUV2YWx1YXRvcjoy")
            print(definition["type"], definition["name"])

            client.evaluators.update_code(
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                description="Exact match against the expected output",
            )

            version = client.evaluators.create_code_version(
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                source_code="def evaluate(output: str) -> float:\\n    return 1.0\\n",
            )
            print(version["id"], version["was_created"])
    """

    def __init__(
        self,
        client: httpx.Client,
        *,
        _guard: ServerVersionGuard | None = None,
    ) -> None:
        """Initialize the Evaluators client.

        Args:
            client (httpx.Client): The httpx client to use for making requests.
        """
        self._client = client
        self._guard = _guard or ServerVersionGuard(client)

    def list(
        self,
        *,
        type: Optional[EvaluatorType] = None,
        name: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[EvaluatorDefinition]:
        """List shared evaluator definitions, newest first.

        Every definition is returned whether or not a project or dataset binds it.
        Each item embeds its current code or prompt version, so prefer ``name`` or
        ``limit`` over listing everything when looking for one evaluator.

        Args:
            type (Optional[Literal["llm", "code"]]): Return only one kind of
                definition. All kinds are returned by default.
            name (Optional[str]): Return only the evaluator with this exact name.
            limit (Optional[int]): Stop after this many definitions. By default
                pagination is followed to the end.

        Returns:
            The definitions.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            for definition in client.evaluators.list(type="llm", limit=20):
                print(definition["id"], definition["name"])
        """  # noqa: E501
        self._guard.require(LIST_EVALUATORS)
        definitions: list[EvaluatorDefinition] = []
        next_cursor: Optional[str] = None
        while True:
            remaining = None if limit is None else limit - len(definitions)
            response = self._client.get(
                "v1/evaluators",
                params=_list_params(next_cursor, type=type, name=name, remaining=remaining),
            )
            response.raise_for_status()
            page = cast(v1.EvaluatorDefinitionsResponseBody, response.json())
            definitions.extend(page["data"])
            if limit is not None and len(definitions) >= limit:
                return definitions[:limit]
            if not (next_cursor := page.get("next_cursor")):
                break
        return definitions

    def get(self, *, evaluator_id: str) -> EvaluatorDefinition:
        """Get a shared evaluator definition by ID.

        Args:
            evaluator_id (str): The ID of the evaluator.

        Returns:
            The LLM or code evaluator definition. Inspect ``type`` to tell them
            apart.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            definition = client.evaluators.get(evaluator_id="Q29kZUV2YWx1YXRvcjoy")
            if definition["type"] == "code":
                print(definition["source_code"])
        """  # noqa: E501
        self._guard.require(GET_EVALUATOR)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}"
        response = self._client.get(url)
        response.raise_for_status()
        return cast(v1.EvaluatorDefinitionResponseBody, response.json())["data"]

    def create_code(
        self,
        *,
        name: str,
        source_code: str,
        language: Language,
        sandbox_config_id: str,
        input_mapping: v1.InputMapping,
        output_configs: Sequence[EvaluatorOutputConfig],
        description: Optional[str] = None,
    ) -> v1.CodeEvaluatorDefinition:
        """Create a code evaluator that nothing binds yet, with its first version.

        LLM evaluators are created through the project and dataset binding methods
        because each one is tied to its own prompt.

        Args:
            name (str): A name unique among evaluators.
            source_code (str): The full source of the first version.
            language (Literal["PYTHON", "TYPESCRIPT"]): The language of the source.
            sandbox_config_id (str): The ID of the sandbox configuration to run in.
            input_mapping (v1.InputMapping): The default mapping from record fields
                to the function's arguments.
            output_configs (Sequence[EvaluatorOutputConfig]): The outputs the
                evaluator produces; at least one.
            description (Optional[str]): A description.

        Returns:
            The created code evaluator definition.

        Raises:
            httpx.HTTPError: If the request fails. The server responds with 409
                when the name is taken.

        Example::

            from phoenix.client import Client
            client = Client()

            definition = client.evaluators.create_code(
                name="exact-match",
                source_code=open("evaluator.py").read(),
                language="PYTHON",
                sandbox_config_id="U2FuZGJveENvbmZpZzox",
                input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
                output_configs=[
                    {"type": "CONTINUOUS", "name": "score", "optimization_direction": "MAXIMIZE"}
                ],
            )
        """  # noqa: E501
        json_ = _build_create_body(
            name=name,
            source_code=source_code,
            language=language,
            sandbox_config_id=sandbox_config_id,
            input_mapping=input_mapping,
            output_configs=output_configs,
            description=description,
        )
        self._guard.require(CREATE_EVALUATOR)
        response = self._client.post("v1/evaluators", json=json_)
        response.raise_for_status()
        data = cast(v1.EvaluatorDefinitionResponseBody, response.json())["data"]
        return cast(v1.CodeEvaluatorDefinition, data)

    def update_llm(
        self,
        *,
        evaluator_id: str,
        name: Union[str, NotGiven] = NOT_GIVEN,
        description: Union[str, None, NotGiven] = NOT_GIVEN,
        prompt_version_id: Union[str, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[v1.CategoricalAnnotationConfigData], NotGiven] = NOT_GIVEN,
    ) -> v1.LLMEvaluatorDefinition:
        """Update a shared LLM evaluator. Omitted fields keep their current values.

        Prompt content is not edited here. Create a new prompt version with
        :meth:`phoenix.client.resources.prompts.Prompts.create` and pass its ID as
        ``prompt_version_id``.

        Args:
            evaluator_id (str): The ID of the LLM evaluator.
            name (str): A new name for the evaluator.
            description (Optional[str]): A new description, or ``None`` to clear
                it. It must equal the description of the prompt's tool function,
                because that description is the instruction the evaluator's
                output tool carries.
            prompt_version_id (str): The ID of the prompt version to run. A
                version of another prompt moves the evaluator to that prompt.
            output_configs (Sequence[v1.CategoricalAnnotationConfigData]): The
                categorical outputs the evaluator produces. They must match the
                prompt's tool schema.

        Returns:
            The updated LLM evaluator definition.

        Raises:
            httpx.HTTPError: If the request fails. The server responds with 409
                when a dataset binding overrides outputs that the new prompt no
                longer supports.
            ValueError: If no field to update is provided.

        Example::

            from phoenix.client import Client
            client = Client()

            client.evaluators.update_llm(
                evaluator_id="TExNRXZhbHVhdG9yOjE=",
                prompt_version_id="UHJvbXB0VmVyc2lvbjo3",
            )
        """  # noqa: E501
        json_ = _build_llm_patch(
            name=name,
            description=description,
            prompt_version_id=prompt_version_id,
            output_configs=output_configs,
        )
        self._guard.require(PATCH_EVALUATOR)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}"
        response = self._client.patch(url, json=json_)
        response.raise_for_status()
        data = cast(v1.EvaluatorDefinitionResponseBody, response.json())["data"]
        return cast(v1.LLMEvaluatorDefinition, data)

    def update_code(
        self,
        *,
        evaluator_id: str,
        name: Union[str, NotGiven] = NOT_GIVEN,
        description: Union[str, None, NotGiven] = NOT_GIVEN,
        sandbox_config_id: Union[str, None, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[EvaluatorOutputConfig], NotGiven] = NOT_GIVEN,
    ) -> v1.CodeEvaluatorDefinition:
        """Update a shared code evaluator. Omitted fields keep their current values.

        Source code is immutable per version; use :meth:`create_code_version` to
        append new code, optionally together with the configuration it needs.

        Args:
            evaluator_id (str): The ID of the code evaluator.
            name (str): A new name for the evaluator.
            description (Optional[str]): A new description, or ``None`` to clear it.
            sandbox_config_id (Optional[str]): The ID of the sandbox configuration
                to run in, or ``None`` to clear it.
            input_mapping (v1.InputMapping): The default mapping from record
                fields to evaluator arguments.
            output_configs (Sequence[EvaluatorOutputConfig]): The outputs the
                evaluator produces; at least one.

        Returns:
            The updated code evaluator definition.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If no field to update is provided.

        Example::

            from phoenix.client import Client
            client = Client()

            client.evaluators.update_code(
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
            )
        """  # noqa: E501
        json_ = _build_code_patch(
            name=name,
            description=description,
            sandbox_config_id=sandbox_config_id,
            input_mapping=input_mapping,
            output_configs=output_configs,
        )
        self._guard.require(PATCH_EVALUATOR)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}"
        response = self._client.patch(url, json=json_)
        response.raise_for_status()
        data = cast(v1.EvaluatorDefinitionResponseBody, response.json())["data"]
        return cast(v1.CodeEvaluatorDefinition, data)

    def delete(self, *, evaluator_id: str) -> None:
        """Delete a code evaluator that nothing binds, with its version history.

        A definition still bound by a project or dataset is refused; delete those
        bindings first, or delete the last binding, which removes the definition
        with it. LLM evaluators are deleted with their last binding and built-in
        evaluators are never deleted. A missing evaluator is ignored.

        Args:
            evaluator_id (str): The ID of the code evaluator.

        Raises:
            httpx.HTTPError: If the request fails. The server responds with 409
                while the evaluator is still bound and 422 for LLM or built-in ids.
        """
        self._guard.require(DELETE_EVALUATOR)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}"
        response = self._client.delete(url)
        response.raise_for_status()

    def list_code_versions(
        self, *, evaluator_id: str, limit: Optional[int] = None
    ) -> List[v1.CodeEvaluatorVersion]:
        """List the versions of a code evaluator, newest first.

        Args:
            evaluator_id (str): The ID of the code evaluator.
            limit (Optional[int]): Stop after this many versions. By default
                pagination is followed to the end.

        Returns:
            The versions. The first entry is the version the evaluator currently runs.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            for version in client.evaluators.list_code_versions(evaluator_id="Q29kZUV2YWx1YXRvcjoy"):
                print(version["id"], version["created_at"])
        """  # noqa: E501
        self._guard.require(LIST_EVALUATOR_VERSIONS)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}/versions"
        versions: list[v1.CodeEvaluatorVersion] = []
        next_cursor: Optional[str] = None
        while True:
            remaining = None if limit is None else limit - len(versions)
            response = self._client.get(url, params=_list_params(next_cursor, remaining=remaining))
            response.raise_for_status()
            page = cast(v1.CodeEvaluatorVersionsResponseBody, response.json())
            versions.extend(page["data"])
            if limit is not None and len(versions) >= limit:
                return versions[:limit]
            if not (next_cursor := page.get("next_cursor")):
                break
        return versions

    def create_code_version(
        self,
        *,
        evaluator_id: str,
        source_code: str,
        expected_current_version_id: Union[str, NotGiven] = NOT_GIVEN,
        description: Union[str, None, NotGiven] = NOT_GIVEN,
        sandbox_config_id: Union[str, None, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[EvaluatorOutputConfig], NotGiven] = NOT_GIVEN,
    ) -> v1.CreatedCodeEvaluatorVersion:
        """Append a new immutable version of a code evaluator's source.

        Configuration passed alongside is applied in the same transaction, so
        bindings never run the new code with the old sandbox, input mapping, or
        outputs. If the source matches the current version, the existing version
        is returned and ``was_created`` is ``False``; only the current version is
        compared, so restoring older source creates a new version.

        Args:
            evaluator_id (str): The ID of the code evaluator.
            source_code (str): The full source of the new version.
            expected_current_version_id (str): The version believed to be current.
                When another version has been appended since, the server refuses
                with 409 instead of deploying over it.
            description (Optional[str]): A new description, or ``None`` to clear it.
            sandbox_config_id (Optional[str]): The sandbox the new code runs in,
                or ``None`` to clear it.
            input_mapping (v1.InputMapping): The default mapping for the new
                code's arguments.
            output_configs (Sequence[EvaluatorOutputConfig]): The outputs the new
                code produces; at least one.

        Returns:
            The persisted code version.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            current = client.evaluators.get(evaluator_id="Q29kZUV2YWx1YXRvcjoy")
            version = client.evaluators.create_code_version(
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                source_code=open("evaluator.py").read(),
                expected_current_version_id=current["current_version_id"],
            )
            print(version["id"], version["was_created"])
        """  # noqa: E501
        json_ = _build_version_body(
            source_code=source_code,
            expected_current_version_id=expected_current_version_id,
            description=description,
            sandbox_config_id=sandbox_config_id,
            input_mapping=input_mapping,
            output_configs=output_configs,
        )
        self._guard.require(CREATE_EVALUATOR_VERSION)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}/versions"
        response = self._client.post(url, json=json_)
        response.raise_for_status()
        return cast(v1.CreatedCodeEvaluatorVersionResponseBody, response.json())["data"]


class AsyncEvaluators:
    """Asynchronous client for the shared evaluator definitions API.

    Definitions are shared by every project and dataset binding that references
    them, so an update here applies everywhere the evaluator is used.

    Examples:
        Basic operations::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            for definition in await client.evaluators.list(type="code"):
                print(definition["id"], definition["name"])

            definition = await client.evaluators.get(evaluator_id="Q29kZUV2YWx1YXRvcjoy")
            print(definition["type"], definition["name"])

            await client.evaluators.update_code(
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                description="Exact match against the expected output",
            )

            version = await client.evaluators.create_code_version(
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                source_code="def evaluate(output: str) -> float:\\n    return 1.0\\n",
            )
            print(version["id"], version["was_created"])
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        _guard: AsyncServerVersionGuard | None = None,
    ) -> None:
        """Initialize the AsyncEvaluators client.

        Args:
            client (httpx.AsyncClient): The httpx client to use for making requests.
        """
        self._client = client
        self._guard = _guard or AsyncServerVersionGuard(client)

    async def list(
        self,
        *,
        type: Optional[EvaluatorType] = None,
        name: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[EvaluatorDefinition]:
        """List shared evaluator definitions, newest first.

        Every definition is returned whether or not a project or dataset binds it.
        Each item embeds its current code or prompt version, so prefer ``name`` or
        ``limit`` over listing everything when looking for one evaluator.

        Args:
            type (Optional[Literal["llm", "code"]]): Return only one kind of
                definition. All kinds are returned by default.
            name (Optional[str]): Return only the evaluator with this exact name.
            limit (Optional[int]): Stop after this many definitions. By default
                pagination is followed to the end.

        Returns:
            The definitions.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            for definition in await client.evaluators.list(type="llm", limit=20):
                print(definition["id"], definition["name"])
        """  # noqa: E501
        await self._guard.require(LIST_EVALUATORS)
        definitions: list[EvaluatorDefinition] = []
        next_cursor: Optional[str] = None
        while True:
            remaining = None if limit is None else limit - len(definitions)
            response = await self._client.get(
                "v1/evaluators",
                params=_list_params(next_cursor, type=type, name=name, remaining=remaining),
            )
            response.raise_for_status()
            page = cast(v1.EvaluatorDefinitionsResponseBody, response.json())
            definitions.extend(page["data"])
            if limit is not None and len(definitions) >= limit:
                return definitions[:limit]
            if not (next_cursor := page.get("next_cursor")):
                break
        return definitions

    async def get(self, *, evaluator_id: str) -> EvaluatorDefinition:
        """Get a shared evaluator definition by ID.

        Args:
            evaluator_id (str): The ID of the evaluator.

        Returns:
            The LLM or code evaluator definition. Inspect ``type`` to tell them
            apart.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            definition = await client.evaluators.get(evaluator_id="Q29kZUV2YWx1YXRvcjoy")
            if definition["type"] == "code":
                print(definition["source_code"])
        """  # noqa: E501
        await self._guard.require(GET_EVALUATOR)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}"
        response = await self._client.get(url)
        response.raise_for_status()
        return cast(v1.EvaluatorDefinitionResponseBody, response.json())["data"]

    async def create_code(
        self,
        *,
        name: str,
        source_code: str,
        language: Language,
        sandbox_config_id: str,
        input_mapping: v1.InputMapping,
        output_configs: Sequence[EvaluatorOutputConfig],
        description: Optional[str] = None,
    ) -> v1.CodeEvaluatorDefinition:
        """Create a code evaluator that nothing binds yet, with its first version.

        LLM evaluators are created through the project and dataset binding methods
        because each one is tied to its own prompt.

        Args:
            name (str): A name unique among evaluators.
            source_code (str): The full source of the first version.
            language (Literal["PYTHON", "TYPESCRIPT"]): The language of the source.
            sandbox_config_id (str): The ID of the sandbox configuration to run in.
            input_mapping (v1.InputMapping): The default mapping from record fields
                to the function's arguments.
            output_configs (Sequence[EvaluatorOutputConfig]): The outputs the
                evaluator produces; at least one.
            description (Optional[str]): A description.

        Returns:
            The created code evaluator definition.

        Raises:
            httpx.HTTPError: If the request fails. The server responds with 409
                when the name is taken.
        """
        json_ = _build_create_body(
            name=name,
            source_code=source_code,
            language=language,
            sandbox_config_id=sandbox_config_id,
            input_mapping=input_mapping,
            output_configs=output_configs,
            description=description,
        )
        await self._guard.require(CREATE_EVALUATOR)
        response = await self._client.post("v1/evaluators", json=json_)
        response.raise_for_status()
        data = cast(v1.EvaluatorDefinitionResponseBody, response.json())["data"]
        return cast(v1.CodeEvaluatorDefinition, data)

    async def update_llm(
        self,
        *,
        evaluator_id: str,
        name: Union[str, NotGiven] = NOT_GIVEN,
        description: Union[str, None, NotGiven] = NOT_GIVEN,
        prompt_version_id: Union[str, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[v1.CategoricalAnnotationConfigData], NotGiven] = NOT_GIVEN,
    ) -> v1.LLMEvaluatorDefinition:
        """Update a shared LLM evaluator. Omitted fields keep their current values.

        Prompt content is not edited here. Create a new prompt version with
        :meth:`phoenix.client.resources.prompts.AsyncPrompts.create` and pass its
        ID as ``prompt_version_id``.

        Args:
            evaluator_id (str): The ID of the LLM evaluator.
            name (str): A new name for the evaluator.
            description (Optional[str]): A new description, or ``None`` to clear
                it. It must equal the description of the prompt's tool function,
                because that description is the instruction the evaluator's
                output tool carries.
            prompt_version_id (str): The ID of the prompt version to run. A
                version of another prompt moves the evaluator to that prompt.
            output_configs (Sequence[v1.CategoricalAnnotationConfigData]): The
                categorical outputs the evaluator produces. They must match the
                prompt's tool schema.

        Returns:
            The updated LLM evaluator definition.

        Raises:
            httpx.HTTPError: If the request fails. The server responds with 409
                when a dataset binding overrides outputs that the new prompt no
                longer supports.
            ValueError: If no field to update is provided.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            await client.evaluators.update_llm(
                evaluator_id="TExNRXZhbHVhdG9yOjE=",
                prompt_version_id="UHJvbXB0VmVyc2lvbjo3",
            )
        """  # noqa: E501
        json_ = _build_llm_patch(
            name=name,
            description=description,
            prompt_version_id=prompt_version_id,
            output_configs=output_configs,
        )
        await self._guard.require(PATCH_EVALUATOR)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}"
        response = await self._client.patch(url, json=json_)
        response.raise_for_status()
        data = cast(v1.EvaluatorDefinitionResponseBody, response.json())["data"]
        return cast(v1.LLMEvaluatorDefinition, data)

    async def update_code(
        self,
        *,
        evaluator_id: str,
        name: Union[str, NotGiven] = NOT_GIVEN,
        description: Union[str, None, NotGiven] = NOT_GIVEN,
        sandbox_config_id: Union[str, None, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[EvaluatorOutputConfig], NotGiven] = NOT_GIVEN,
    ) -> v1.CodeEvaluatorDefinition:
        """Update a shared code evaluator. Omitted fields keep their current values.

        Source code is immutable per version; use :meth:`create_code_version` to
        append new code, optionally together with the configuration it needs.

        Args:
            evaluator_id (str): The ID of the code evaluator.
            name (str): A new name for the evaluator.
            description (Optional[str]): A new description, or ``None`` to clear it.
            sandbox_config_id (Optional[str]): The ID of the sandbox configuration
                to run in, or ``None`` to clear it.
            input_mapping (v1.InputMapping): The default mapping from record
                fields to evaluator arguments.
            output_configs (Sequence[EvaluatorOutputConfig]): The outputs the
                evaluator produces; at least one.

        Returns:
            The updated code evaluator definition.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If no field to update is provided.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            await client.evaluators.update_code(
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
            )
        """  # noqa: E501
        json_ = _build_code_patch(
            name=name,
            description=description,
            sandbox_config_id=sandbox_config_id,
            input_mapping=input_mapping,
            output_configs=output_configs,
        )
        await self._guard.require(PATCH_EVALUATOR)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}"
        response = await self._client.patch(url, json=json_)
        response.raise_for_status()
        data = cast(v1.EvaluatorDefinitionResponseBody, response.json())["data"]
        return cast(v1.CodeEvaluatorDefinition, data)

    async def delete(self, *, evaluator_id: str) -> None:
        """Delete a code evaluator that nothing binds, with its version history.

        A definition still bound by a project or dataset is refused; delete those
        bindings first, or delete the last binding, which removes the definition
        with it. LLM evaluators are deleted with their last binding and built-in
        evaluators are never deleted. A missing evaluator is ignored.

        Args:
            evaluator_id (str): The ID of the code evaluator.

        Raises:
            httpx.HTTPError: If the request fails. The server responds with 409
                while the evaluator is still bound and 422 for LLM or built-in ids.
        """
        await self._guard.require(DELETE_EVALUATOR)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}"
        response = await self._client.delete(url)
        response.raise_for_status()

    async def list_code_versions(
        self, *, evaluator_id: str, limit: Optional[int] = None
    ) -> List[v1.CodeEvaluatorVersion]:
        """List the versions of a code evaluator, newest first.

        Args:
            evaluator_id (str): The ID of the code evaluator.
            limit (Optional[int]): Stop after this many versions. By default
                pagination is followed to the end.

        Returns:
            The versions. The first entry is the version the evaluator currently runs.

        Raises:
            httpx.HTTPError: If the request fails.
        """
        await self._guard.require(LIST_EVALUATOR_VERSIONS)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}/versions"
        versions: list[v1.CodeEvaluatorVersion] = []
        next_cursor: Optional[str] = None
        while True:
            remaining = None if limit is None else limit - len(versions)
            response = await self._client.get(
                url, params=_list_params(next_cursor, remaining=remaining)
            )
            response.raise_for_status()
            page = cast(v1.CodeEvaluatorVersionsResponseBody, response.json())
            versions.extend(page["data"])
            if limit is not None and len(versions) >= limit:
                return versions[:limit]
            if not (next_cursor := page.get("next_cursor")):
                break
        return versions

    async def create_code_version(
        self,
        *,
        evaluator_id: str,
        source_code: str,
        expected_current_version_id: Union[str, NotGiven] = NOT_GIVEN,
        description: Union[str, None, NotGiven] = NOT_GIVEN,
        sandbox_config_id: Union[str, None, NotGiven] = NOT_GIVEN,
        input_mapping: Union[v1.InputMapping, NotGiven] = NOT_GIVEN,
        output_configs: Union[Sequence[EvaluatorOutputConfig], NotGiven] = NOT_GIVEN,
    ) -> v1.CreatedCodeEvaluatorVersion:
        """Append a new immutable version of a code evaluator's source.

        Configuration passed alongside is applied in the same transaction, so
        bindings never run the new code with the old sandbox, input mapping, or
        outputs. If the source matches the current version, the existing version
        is returned and ``was_created`` is ``False``; only the current version is
        compared, so restoring older source creates a new version.

        Args:
            evaluator_id (str): The ID of the code evaluator.
            source_code (str): The full source of the new version.
            expected_current_version_id (str): The version believed to be current.
                When another version has been appended since, the server refuses
                with 409 instead of deploying over it.
            description (Optional[str]): A new description, or ``None`` to clear it.
            sandbox_config_id (Optional[str]): The sandbox the new code runs in,
                or ``None`` to clear it.
            input_mapping (v1.InputMapping): The default mapping for the new
                code's arguments.
            output_configs (Sequence[EvaluatorOutputConfig]): The outputs the new
                code produces; at least one.

        Returns:
            The persisted code version.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            version = await client.evaluators.create_code_version(
                evaluator_id="Q29kZUV2YWx1YXRvcjoy",
                source_code=open("evaluator.py").read(),
            )
            print(version["id"], version["was_created"])
        """  # noqa: E501
        json_ = _build_version_body(
            source_code=source_code,
            expected_current_version_id=expected_current_version_id,
            description=description,
            sandbox_config_id=sandbox_config_id,
            input_mapping=input_mapping,
            output_configs=output_configs,
        )
        await self._guard.require(CREATE_EVALUATOR_VERSION)
        url = f"v1/evaluators/{encode_path_param(evaluator_id)}/versions"
        response = await self._client.post(url, json=json_)
        response.raise_for_status()
        return cast(v1.CreatedCodeEvaluatorVersionResponseBody, response.json())["data"]
