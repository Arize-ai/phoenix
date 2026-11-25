from pathlib import Path

import pytest
import yaml

from evals.harbor.scripts import check_job_staged
from evals.harbor.scripts.fixture_inputs import STAGE_STATUS, compute_fixture_key


def create_task(task: Path) -> Path:
    task.mkdir(parents=True)
    (task / "task.toml").write_text('[metadata]\nfixture = "phoenix-seed"\n')
    environment = task / "environment"
    for name in check_job_staged.STAGED:
        output = environment / name.replace("*", "test")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.touch()
    return task


def test_preflight_rejects_stale_environment_without_seed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    task = create_task(tmp_path / "task")
    job = tmp_path / "job.yaml"
    job.write_text(yaml.safe_dump({"tasks": [{"path": str(task)}]}))
    monkeypatch.setattr("sys.argv", ["check_job_staged.py", str(job)])
    assert check_job_staged.main() == 1
    assert "phoenix_seed.json" in capsys.readouterr().err


def test_preflight_rejects_empty_selection(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    job = tmp_path / "job.yaml"
    job.write_text("tasks: []\n")
    monkeypatch.setattr("sys.argv", ["check_job_staged.py", str(job)])
    assert check_job_staged.main() == 1


def test_job_selection_honors_patterns_exclusions_and_explicit_tasks(tmp_path: Path) -> None:
    dataset = tmp_path / "dataset"
    first = create_task(dataset / "first")
    create_task(dataset / "second")
    third = create_task(dataset / "third")
    job = {
        "datasets": [{"path": str(dataset), "task_names": ["*"], "exclude_task_names": ["sec*"]}],
        "tasks": [{"path": str(first)}],
    }
    assert check_job_staged.select_job_tasks(job) == [first.resolve(), third.resolve()]


@pytest.mark.parametrize(
    ("agents", "replaced", "expected"),
    [
        ([{"import_path": "agents:CodexCliAgent"}], False, True),
        ([{"import_path": "agents:ClaudeCodeCliAgent"}], True, False),
        ([{"import_path": "agents:ClaudeCodeMcpAgent"}], False, False),
        ([{"name": "oracle"}], False, False),
    ],
)
def test_cli_archive_detection(
    agents: list[dict[str, str]], replaced: bool, expected: bool
) -> None:
    assert check_job_staged.requires_cli_archive({"agents": agents}, replaced) is expected


def test_failed_restage_blocks_preflight_and_preserves_old_database(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from evals.harbor.scripts import stage_harbor_environments as staging

    task = create_task(tmp_path / "task")
    (task / "fixture").mkdir()
    seed = task / "fixture/phoenix_seed.json"
    seed.write_text("{}")
    database = task / "environment/data/phoenix.db"
    database.write_bytes(b"old database")
    context = tmp_path / "context"
    context.mkdir()
    monkeypatch.setattr(staging, "build_context", lambda: context)
    monkeypatch.setattr(staging, "hash_phoenix_sources", lambda: "source")
    monkeypatch.setattr(check_job_staged, "hash_phoenix_sources", lambda: "source")
    key = compute_fixture_key(task, "source")
    (task / "environment" / STAGE_STATUS).write_text(key)
    job = tmp_path / "job.yaml"
    job.write_text(yaml.safe_dump({"tasks": [{"path": str(task)}]}))
    monkeypatch.setattr("sys.argv", ["check_job_staged.py", str(job)])
    assert check_job_staged.main() == 0

    def fail_fixture(task: Path, key: str, reseed: bool) -> Path:
        raise ValueError("fixture unavailable")

    monkeypatch.setattr(staging, "prepare_fixture", fail_fixture)
    with pytest.raises(ValueError, match="fixture unavailable"):
        staging.prepare_tasks([task], reseed=True)
    assert database.read_bytes() == b"old database"
    assert check_job_staged.main() == 1
    assert "incomplete" in capsys.readouterr().err


def test_reseed_preserves_generations_and_other_datasets(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from evals.harbor.scripts import stage_harbor_environments as staging

    script = tmp_path / "fixture.sh"
    script.write_text('#!/bin/bash\nprintf fixture > "$1/phoenix.db"\n')
    monkeypatch.setattr(staging, "HERE", tmp_path)
    monkeypatch.setattr(staging, "list_fixture_inputs", lambda task: [script])
    first = staging.prepare_fixture(tmp_path, "selected", reseed=False)
    other = staging.prepare_fixture(tmp_path, "other", reseed=False)
    assert staging.prepare_fixture(tmp_path, "selected", reseed=False).resolve() == first
    regenerated = staging.prepare_fixture(tmp_path, "selected", reseed=True)
    assert regenerated != first
    assert first.read_bytes() == regenerated.read_bytes() == other.read_bytes() == b"fixture"
    assert staging.prepare_fixture(tmp_path, "selected", reseed=False).resolve() == regenerated


def test_fixture_cache_tracks_seed_seeder_and_phoenix_source(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from evals.harbor.scripts import fixture_inputs

    task = create_task(tmp_path / "task")
    seed = task / "fixture/phoenix_seed.json"
    seed.parent.mkdir()
    seed.write_text("{}")
    seeder = tmp_path / "environments/fixtures/seed_phoenix.py"
    seeder.parent.mkdir(parents=True)
    seeder.write_text("version one")
    monkeypatch.setattr(fixture_inputs, "HERE", tmp_path)
    original = fixture_inputs.compute_fixture_key(task, "source one")
    seed.write_text('{"projects": {}}')
    changed_seed = fixture_inputs.compute_fixture_key(task, "source one")
    seeder.write_text("version two")
    changed_seeder = fixture_inputs.compute_fixture_key(task, "source one")
    changed_source = fixture_inputs.compute_fixture_key(task, "source two")
    assert len({original, changed_seed, changed_seeder, changed_source}) == 4


def test_staging_prepares_only_job_selection_and_preserves_previous_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from evals.harbor.scripts import stage_harbor_environments as staging

    selected = create_task(tmp_path / "dataset/selected")
    unselected = create_task(tmp_path / "dataset/unselected")
    for task in [selected, unselected]:
        (task / "fixture").mkdir()
        (task / "fixture/phoenix_seed.json").write_text("{}")
        (task / "environment/data/phoenix.db").write_bytes(b"previous database")
    script = tmp_path / "fixture.sh"
    script.write_text('#!/bin/bash\nprintf new > "$1/phoenix.db"\n')
    context = tmp_path / "context"
    context.mkdir()
    (context / "Dockerfile").write_text("FROM example\n")
    monkeypatch.setattr(staging, "HERE", tmp_path)
    monkeypatch.setattr(staging, "build_context", lambda: context)
    monkeypatch.setattr(staging, "list_fixture_inputs", lambda task: [script])
    monkeypatch.setattr(staging, "hash_phoenix_sources", lambda: "source")
    monkeypatch.setenv("HARBOR_CLI", "0")
    monkeypatch.delenv("HARBOR_TASKS_DIR", raising=False)
    job = tmp_path / "job.yaml"
    job.write_text(
        yaml.safe_dump(
            {
                "datasets": [{"path": str(selected.parent), "task_names": ["selected"]}],
            }
        )
    )
    monkeypatch.setattr("sys.argv", ["stage_harbor_environments.py", str(job)])
    assert staging.main() == 0
    assert (selected / "environment/data/phoenix.db").read_bytes() == b"new"
    previous = list(
        (tmp_path / ".cache/task-environments").glob(
            "previous-selected-*/environment/data/phoenix.db"
        )
    )
    assert len(previous) == 1
    assert previous[0].read_bytes() == b"previous database"
    assert (unselected / "environment/data/phoenix.db").read_bytes() == b"previous database"
    assert not (unselected / "environment" / STAGE_STATUS).exists()


def test_missing_seed_fails_before_build_and_invalidates_old_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from evals.harbor.scripts import stage_harbor_environments as staging

    task = create_task(tmp_path / "task")
    (task / "environment/data/phoenix.db").write_bytes(b"previous database")

    def unexpected_build() -> Path:
        pytest.fail("Missing inputs must fail before building wheels")

    monkeypatch.setattr(staging, "build_context", unexpected_build)
    with pytest.raises(ValueError, match="phoenix_seed.json is missing"):
        staging.prepare_tasks([task], reseed=False)
    assert (task / "environment" / STAGE_STATUS).read_text() == "incomplete"
    assert (task / "environment/data/phoenix.db").read_bytes() == b"previous database"


def test_unavailable_fixture_does_not_replace_cached_generation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import subprocess

    from evals.harbor.scripts import stage_harbor_environments as staging

    script = tmp_path / "fixture.sh"
    script.write_text('#!/bin/bash\nprintf fixture > "$1/phoenix.db"\n')
    monkeypatch.setattr(staging, "HERE", tmp_path)
    monkeypatch.setattr(staging, "list_fixture_inputs", lambda task: [script])
    original = staging.prepare_fixture(tmp_path, "selected", reseed=False)
    script.write_text("#!/bin/bash\nexit 2\n")
    with pytest.raises(subprocess.CalledProcessError) as failure:
        staging.prepare_fixture(tmp_path, "selected", reseed=True)
    assert failure.value.returncode == 2
    assert original.read_bytes() == b"fixture"
    assert staging.prepare_fixture(tmp_path, "selected", reseed=False).resolve() == original


def test_job_selection_honors_task_limit(tmp_path: Path) -> None:
    dataset = tmp_path / "dataset"
    create_task(dataset / "first")
    create_task(dataset / "second")
    first_on_disk = next(dataset.iterdir()).resolve()
    assert check_job_staged.select_job_tasks(
        {
            "datasets": [{"path": str(dataset), "n_tasks": 1}],
        }
    ) == [first_on_disk]


def test_job_selection_rejects_remote_datasets_instead_of_staging_part_of_job(
    tmp_path: Path,
) -> None:
    task = create_task(tmp_path / "task")
    with pytest.raises(ValueError, match="local dataset paths"):
        check_job_staged.select_job_tasks(
            {
                "tasks": [{"path": str(task)}],
                "datasets": [{"name": "remote-dataset"}],
            }
        )
