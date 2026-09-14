"""Harbor adapter that drives PXI through Phoenix's agent session chat route.

A Phoenix server runs inside the task container against the fixture database;
this agent talks to it from the host over the container's published port, so
the server owns the transcript and every step goes through the same route the
browser assistant and the ``pxi`` CLI use.
"""

import asyncio
import json
import os
import re
import shlex
import tempfile
from pathlib import Path
from typing import Any

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from evals.harbor.agents.agent_session_chat import (
    AgentSessionChatClient,
    EditPermission,
    Message,
    Turn,
    answer_text,
    builtin_model_selection,
    count_tool_calls,
    parse_json_answer,
)

_SERVER_PORT = 6006
_START_SERVER_SCRIPT = "/opt/phoenix-eval/start_phoenix_server.sh"
_SERVER_LOG = "/var/lib/phoenix-eval/server.log"
_STEPS_DIR = "/logs/agent/steps"
_LATEST_LINK = "/logs/agent/latest"
_STEP_CONFIG_PATH = "step-config.json"
_TRACE_ENDPOINT_ENV_VAR = "HARBOR_PHOENIX_COLLECTOR_ENDPOINT"


class PhoenixChatAgent(BaseAgent):
    # Harbor reuses the same agent instance for every step of a trial, so the
    # session id and step counter live here; the server holds the transcript.
    _step: int = 0
    _session_id: str | None = None

    @staticmethod
    def name() -> str:
        return "phoenix-chat-agent"

    def version(self) -> str | None:
        return None

    async def setup(self, environment: BaseEnvironment) -> None:
        if environment.type() != "docker":
            raise RuntimeError(
                f"{self.name()} reaches the in-container Phoenix server through a published "
                f"Docker port and only supports the docker environment, not {environment.type()!r}"
            )

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        if not self.model_name:
            raise ValueError(
                "No model specified; pass one with the -m flag, e.g. -m anthropic/claude-sonnet-4-5."
            )
        model = builtin_model_selection(self.model_name)
        self._step += 1
        # Fixtures are downloaded by the step's setup hook, which runs before
        # the agent, so the server can only be started from here.
        await self._start_server(environment)
        step_config = await self._read_step_config(environment)
        allow_mutations = bool(step_config.get("allow_mutations", False))
        approve_tool_calls = bool(step_config.get("approve_tool_calls", False))
        edit_permission: EditPermission = "bypass" if allow_mutations else "manual"

        client = AgentSessionChatClient(
            await self._server_url(environment),
            model=model,
            turn_timeout_seconds=step_config.get("turn_timeout_seconds", 900.0),
        )
        try:
            if self._session_id is None:
                self._session_id = await client.create_session()
            turn = await client.run_turn(
                self._session_id,
                instruction,
                edit_permission=edit_permission,
                mutations_enabled=allow_mutations,
                approve=lambda _part: approve_tool_calls,
                export_remote_traces=_server_has_remote_trace_collector(),
            )
            transcript = await client.list_messages(self._session_id)
        finally:
            await client.aclose()

        answer = answer_text(turn.final_message)
        outputs = {
            "answer.md": answer,
            "answer.json": json.dumps(parse_json_answer(answer), indent=2) + "\n",
            "new_messages.json": _dump_messages(turn.assistant_messages),
            "messages.json": _dump_messages(transcript),
            "metrics.json": json.dumps(
                {"tool_calls": count_tool_calls(turn.assistant_messages)}, indent=2
            )
            + "\n",
            "usage.json": json.dumps(turn.usage, indent=2) + "\n",
        }
        await self._write_step_outputs(environment, outputs)
        self._populate_context(context, turn, answer)

    async def _start_server(self, environment: BaseEnvironment) -> None:
        result = await environment.exec(f"sh {_START_SERVER_SCRIPT}", timeout_sec=180)
        if result.return_code != 0:
            raise RuntimeError(
                result.stderr or result.stdout or "Failed to start the Phoenix server"
            )

    async def _server_url(self, environment: BaseEnvironment) -> str:
        host_port = await _published_host_port(environment.session_id, _SERVER_PORT)
        return f"http://127.0.0.1:{host_port}"

    async def _read_step_config(self, environment: BaseEnvironment) -> dict[str, Any]:
        # Harbor uploads step-config.json from the step's workdir into the exec
        # working directory.
        result = await environment.exec(f"cat {_STEP_CONFIG_PATH}")
        if result.return_code != 0 or not (result.stdout or "").strip():
            return {}
        config = json.loads(result.stdout or "{}")
        return config if isinstance(config, dict) else {}

    async def _write_step_outputs(
        self, environment: BaseEnvironment, outputs: dict[str, str]
    ) -> None:
        out_dir = f"{_STEPS_DIR}/{self._step}"
        local_dir = self.logs_dir / "steps" / str(self._step)
        local_dir.mkdir(parents=True, exist_ok=True)
        await environment.exec(f"mkdir -p {out_dir}")
        with tempfile.TemporaryDirectory() as staging:
            for name, content in outputs.items():
                local_dir.joinpath(name).write_text(content)
                staged = Path(staging, name)
                staged.write_text(content)
                await environment.upload_file(staged, f"{out_dir}/{name}")
        # Step verifiers locate this step's outputs via this stable symlink.
        await environment.exec(f"ln -sfn {shlex.quote(out_dir)} {_LATEST_LINK}")
        server_log = await environment.exec(f"cat {_SERVER_LOG}")
        local_dir.joinpath("server.log").write_text(server_log.stdout or "")

    @staticmethod
    def _populate_context(context: AgentContext, turn: Turn, answer: str) -> None:
        context.metadata = {"answer": answer}
        if (usage := turn.usage) is not None:
            tokens = usage.get("tokens", {})
            context.n_input_tokens = tokens.get("prompt")
            context.n_output_tokens = tokens.get("completion")
            prompt_details = usage.get("promptDetails") or {}
            context.n_cache_tokens = prompt_details.get("cacheRead")


def _server_has_remote_trace_collector() -> bool:
    """start_phoenix_server.sh hands the same variable to the in-container server."""
    return bool(os.getenv(_TRACE_ENDPOINT_ENV_VAR))


def _dump_messages(messages: list[Message]) -> str:
    return json.dumps(messages, indent=2) + "\n"


def _compose_project_name(session_id: str) -> str:
    """Harbor names the compose project after the environment session id, sanitized
    per https://docs.docker.com/compose/how-tos/project-name/."""
    name = session_id.lower()
    if not re.match(r"^[a-z0-9]", name):
        name = "0" + name
    return re.sub(r"[^a-z0-9_-]", "-", name)


async def _docker(*args: str) -> str:
    process = await asyncio.create_subprocess_exec(
        "docker",
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        raise RuntimeError(f"docker {' '.join(args)} failed: {stderr.decode().strip()}")
    return stdout.decode()


async def _published_host_port(session_id: str, container_port: int) -> int:
    project = _compose_project_name(session_id)
    container_ids = (
        await _docker(
            "ps",
            "--quiet",
            "--filter",
            f"label=com.docker.compose.project={project}",
            "--filter",
            "label=com.docker.compose.service=main",
        )
    ).split()
    if len(container_ids) != 1:
        raise RuntimeError(
            f"Expected one main container for compose project {project!r}, found {container_ids}"
        )
    mapping = await _docker("port", container_ids[0], f"{container_port}/tcp")
    for line in mapping.splitlines():
        host, _, port = line.strip().rpartition(":")
        if host and port.isdigit():
            return int(port)
    raise RuntimeError(
        f"Container port {container_port} is not published; add a ports entry for the main "
        "service in the task's environment/docker-compose.yaml"
    )
