import json

import pytest
from harbor.agents.installed.claude_code import ClaudeCode
from harbor.agents.installed.codex import Codex

from matrix import MATRIX, render_job, runner_environment


def test_four_conditions_use_same_tasks_and_isolated_interfaces(tmp_path):
    jobs = []
    for condition in MATRIX["conditions"]:
        job, plugin = render_job(
            condition,
            tasks=tmp_path,
            target_endpoint="http://target:6006",
            results_endpoint="http://results:6006",
            job_name=condition,
        )
        jobs.append(job)
        agent = job.agents[0]
        assert bool(agent.mcp_servers) == condition.endswith("mcp")
        assert plugin["trace_mode"] == "atif"
        assert agent.extra_allowed_hosts[0] == "target"
        assert "results" not in agent.extra_allowed_hosts
        assert job.n_concurrent_trials == 1
        assert job.retry.max_retries == 0
        implementation = ClaudeCode if agent.name == "claude-code" else Codex
        # Exercise the pinned adapter's argument/flag validation, not only our JSON.
        instance = implementation(
            logs_dir=tmp_path / condition, model_name=agent.model_name, **agent.kwargs
        )
        assert instance._version == MATRIX["agent_versions"][agent.name]
    assert all(job.datasets == jobs[0].datasets for job in jobs)
    assert jobs[0].agents[0].model_name == jobs[1].agents[0].model_name == "claude-opus-5"
    assert jobs[2].agents[0].model_name == jobs[3].agents[0].model_name == "gpt-5.6"
    assert jobs[2].agents[0].kwargs["web_search"] == "disabled"


def test_runner_credentials_are_selected_not_inherited(tmp_path):
    source = {
        "PATH": "/usr/bin",
        "OPENAI_API_KEY": "OPENAI_CANARY",
        "HF_TOKEN": "HF_CANARY",
        "ANTHROPIC_API_KEY": "ANTHROPIC_CANARY",
        "CODEX_AUTH_JSON_PATH": "/private/auth",
        "OPENAI_BASE_URL": "https://unrelated.invalid",
    }
    selected = runner_environment(source, agent="codex", runner_home=tmp_path)
    assert selected == {
        "PATH": "/usr/bin",
        "HOME": str(tmp_path),
        "LANG": "C.UTF-8",
        "OPENAI_API_KEY": "OPENAI_CANARY",
    }
    job, plugin = render_job(
        "codex-cli",
        tasks=tmp_path,
        target_endpoint="http://target:6006",
        results_endpoint="http://results:6006",
        job_name="test",
    )
    assert "CANARY" not in job.model_dump_json() + json.dumps(plugin)
    with pytest.raises(ValueError, match="Missing"):
        runner_environment({}, agent="codex", runner_home=tmp_path)


def test_no_silent_model_substitution_or_endpoint_credentials(tmp_path):
    args = dict(
        tasks=tmp_path,
        target_endpoint="http://target:6006",
        results_endpoint="http://results:6006",
        job_name="test",
    )
    job, _ = render_job("codex-mcp", requested_model="unknown-request", **args)
    assert job.agents[0].model_name == "unknown-request"
    for bad in ("http://secret@target", "http://target?key=secret", "file:///tmp/db"):
        with pytest.raises(ValueError):
            render_job("codex-mcp", **(args | {"target_endpoint": bad}))


def test_target_cannot_share_results_host_on_another_port(tmp_path):
    with pytest.raises(ValueError, match="different hosts"):
        render_job(
            "codex-mcp",
            tasks=tmp_path,
            target_endpoint="http://target:6007",
            results_endpoint="http://target:6006",
            job_name="test",
        )
