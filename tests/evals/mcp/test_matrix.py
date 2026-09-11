from harbor.agents.installed.claude_code import ClaudeCode
from harbor.agents.installed.codex import Codex

from evals.mcp.scripts.stage import CONFIG, job_config


def test_four_conditions_use_paired_models_and_native_harbor_adapters(tmp_path):
    jobs = []
    for condition in ("claude-mcp", "claude-cli", "codex-mcp", "codex-cli"):
        job = job_config(
            condition,
            tasks=tmp_path / "tasks",
            output=tmp_path,
            images={"target": {"id": "sha256:" + "a" * 64}},
        )
        jobs.append(job)
        agent = job.agents[0]
        assert bool(agent.mcp_servers) == condition.endswith("mcp")
        assert job.n_concurrent_trials == 1
        assert job.retry.max_retries == 0
        implementation = ClaudeCode if agent.name == "claude-code" else Codex
        # Construct the actual installed adapter to exercise its flag validation.
        instance = implementation(
            logs_dir=tmp_path / condition, model_name=agent.model_name, **agent.kwargs
        )
        assert instance._version == CONFIG["agents"][agent.name]["version"]
        assert agent.model_name == CONFIG["agents"][agent.name]["model"]
    assert all(job.datasets == jobs[0].datasets for job in jobs)
    assert jobs[0].agents[0].model_name == jobs[1].agents[0].model_name
    assert jobs[2].agents[0].model_name == jobs[3].agents[0].model_name
    assert jobs[2].agents[0].kwargs["web_search"] == "disabled"


def test_runner_keeps_selected_provider_and_results_credentials_only():
    from evals.mcp.scripts.experiment import run_environment

    supplied = {
        "PATH": "/bin",
        "HOME": "/home/test",
        "OPENAI_API_KEY": "selected-provider",
        "ANTHROPIC_API_KEY": "other-provider",
        "PHOENIX_API_KEY": "results-key",
        "HF_TOKEN": "dataset-key",
        "CODEX_AUTH_JSON_PATH": "/private/personal-auth",
        "CODEX_FORCE_AUTH_JSON": "1",
        "CLAUDE_CODE_OAUTH_TOKEN": "oauth",
        "ANTHROPIC_BASE_URL": "https://outside",
    }
    assert run_environment(supplied, "OPENAI_API_KEY") == {
        "PATH": "/bin",
        "HOME": "/home/test",
        "OPENAI_API_KEY": "selected-provider",
        "PHOENIX_API_KEY": "results-key",
    }


def test_harbor_exit_success_does_not_hide_trial_failures(tmp_path):
    import json

    import pytest

    from evals.mcp.scripts.experiment import require_completed_job

    result = {
        "stats": {"n_errored_trials": 0, "n_completed_trials": 1},
        "n_total_trials": 1,
    }
    trial = {"verifier_result": {"rewards": {"reward": 0}}}
    trial_dir = tmp_path / "count-traces__example"
    trial_dir.mkdir()
    (tmp_path / "result.json").write_text(json.dumps(result))
    (trial_dir / "result.json").write_text(json.dumps(trial))
    require_completed_job(tmp_path)
    result["stats"]["n_errored_trials"] = 1
    (tmp_path / "result.json").write_text(json.dumps(result))
    with pytest.raises(RuntimeError, match="every trial"):
        require_completed_job(tmp_path)
    result["stats"]["n_errored_trials"] = 0
    (tmp_path / "result.json").write_text(json.dumps(result))
    trial["verifier_result"]["rewards"].clear()
    (trial_dir / "result.json").write_text(json.dumps(trial))
    with pytest.raises(RuntimeError, match="no task reward"):
        require_completed_job(tmp_path)
