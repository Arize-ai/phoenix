"""Behavioral tests for Phoenix dataset and evaluation migration."""

import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[5]
SCRIPTS = ROOT / ".agents" / "skills" / "phoenix-to-ax-migration" / "scripts"
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location(
    "migrate_data", SCRIPTS / "migrate_data.py"
)
data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(data)


def test_serializable_handles_datetimes_and_dataclasses():
    assert data.serializable({"time": datetime(2026, 1, 1, tzinfo=timezone.utc)}) == {
        "time": "2026-01-01T00:00:00+00:00"
    }


def test_manifest_is_owner_only_and_detects_changes(tmp_path):
    value = {"schema": 1, "datasets": [], "state": {}}
    value["checksum"] = data.checksum(value)
    path = tmp_path / "data.json"
    data.save(path, value)
    assert path.stat().st_mode & 0o777 == 0o600
    loaded = json.loads(path.read_text())
    loaded["datasets"].append({"name": "changed"})
    path.write_text(json.dumps(loaded))
    with pytest.raises(data.DataMigrationError, match="checksum"):
        data.load(path)


def test_ax_row_preserves_nested_values_as_canonical_json():
    row = data.ax_row(
        {
            "source_id": "custom",
            "source_global_id": "global",
            "input": {"nested": {"same": "input"}},
            "output": {"nested": {"same": "output"}},
            "metadata": {"nested": {"same": "metadata"}},
        }
    )
    assert json.loads(row["input_json"])["nested"]["same"] == "input"
    assert json.loads(row["output_json"])["nested"]["same"] == "output"
    assert json.loads(row["metadata_json"])["nested"]["same"] == "metadata"


def test_destination_examples_follows_cursor_pages():
    first = SimpleNamespace(
        examples=[
            SimpleNamespace(id="a", additional_properties={"phoenix_example_id": "one"})
        ],
        pagination=SimpleNamespace(has_more=True, next_cursor="next"),
    )
    second = SimpleNamespace(
        examples=[
            SimpleNamespace(id="b", additional_properties={"phoenix_example_id": "two"})
        ],
        pagination=SimpleNamespace(has_more=False, next_cursor=None),
    )
    datasets = SimpleNamespace(
        list_examples=lambda **kwargs: first if kwargs["cursor"] is None else second
    )
    result = data.destination_examples(SimpleNamespace(datasets=datasets), "dataset")
    assert set(result) == {"one", "two"}


def test_destination_examples_rejects_missing_cursor():
    response = SimpleNamespace(
        examples=[], pagination=SimpleNamespace(has_more=True, next_cursor=None)
    )
    client = SimpleNamespace(
        datasets=SimpleNamespace(list_examples=lambda **kwargs: response)
    )
    with pytest.raises(data.DataMigrationError, match="next cursor"):
        data.destination_examples(client, "dataset")


def test_get_dataset_after_create_retries():
    calls = []

    def get(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            raise RuntimeError("not indexed")
        return "ready"

    client = SimpleNamespace(datasets=SimpleNamespace(get=get))
    assert (
        data.get_dataset_after_create(client, "name", "space", sleep=lambda _: None)
        == "ready"
    )
    assert len(calls) == 2


def test_missing_configuration_names_only_missing_values():
    with pytest.raises(data.DataMigrationError, match="ARIZE_SPACE_ID") as error:
        data.require({"ARIZE_API_KEY": "secret"}, ["ARIZE_API_KEY", "ARIZE_SPACE_ID"])
    assert "secret" not in str(error.value)


def test_export_stops_at_unpageable_version_boundary(monkeypatch, tmp_path):
    datasets = SimpleNamespace(
        list=lambda: [{"id": "dataset", "name": "many-versions"}],
        get_dataset_versions=lambda **kwargs: [
            {"version_id": str(index)} for index in range(100)
        ],
    )
    monkeypatch.setattr(
        data,
        "phoenix_client",
        lambda config: SimpleNamespace(datasets=datasets),
    )
    with pytest.raises(data.DataMigrationError, match="at least 100 versions"):
        data.export_data({"PHOENIX_BASE_URL": "https://example.test"}, tmp_path / "x")


def test_cli_does_not_include_dependency_error_details(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr(data, "configuration", lambda _: {})
    monkeypatch.setattr(
        data,
        "export_data",
        lambda *args: (_ for _ in ()).throw(RuntimeError("secret response body")),
    )
    monkeypatch.setattr(
        sys, "argv", ["migrate_data.py", "export", "--manifest", str(tmp_path / "x")]
    )
    assert data.main() == 1
    assert "secret response body" not in capsys.readouterr().out


def test_cli_reports_authentication_without_dependency_details(
    monkeypatch, capsys, tmp_path
):
    class UnauthorizedException(Exception):
        pass

    monkeypatch.setattr(data, "configuration", lambda _: {})
    monkeypatch.setattr(
        data,
        "export_data",
        lambda *args: (_ for _ in ()).throw(
            UnauthorizedException("private response body")
        ),
    )
    monkeypatch.setattr(
        sys, "argv", ["migrate_data.py", "export", "--manifest", str(tmp_path / "x")]
    )
    assert data.main() == 1
    output = capsys.readouterr().out
    assert "authentication or permission" in output
    assert "private response body" not in output


def write_manifest(path, datasets):
    value = {"schema": 1, "source": "phoenix", "datasets": datasets, "state": {}}
    value["checksum"] = data.checksum(value)
    data.save(path, value)


def source_dataset():
    return {
        "id": "px-dataset",
        "name": "source",
        "versions": [
            {
                "id": "px-version",
                "examples": [
                    {
                        "source_id": "custom",
                        "source_global_id": "global",
                        "input": {"q": "one"},
                        "output": {"a": "two"},
                        "metadata": {},
                    }
                ],
            }
        ],
        "experiments": [],
    }


def test_import_reconciles_create_when_response_is_lost(monkeypatch, tmp_path):
    path = tmp_path / "manifest.json"
    write_manifest(path, [source_dataset()])
    dataset = SimpleNamespace(id="ax-dataset", name="m-source")
    version = SimpleNamespace(id="ax-version", name="initial")
    example = SimpleNamespace(
        id="ax-example",
        additional_properties={
            "phoenix_example_id": "global",
            "phoenix_custom_id": "custom",
            "input_json": '{"q":"one"}',
            "output_json": '{"a":"two"}',
            "metadata_json": "{}",
        },
    )

    class Datasets:
        created = False

        def list(self, **kwargs):
            return SimpleNamespace(datasets=[dataset] if self.created else [])

        def create(self, **kwargs):
            self.created = True
            raise RuntimeError("response lost")

        def get(self, **kwargs):
            return SimpleNamespace(versions=[version])

        def list_examples(self, **kwargs):
            return SimpleNamespace(
                examples=[example],
                pagination=SimpleNamespace(has_more=False, next_cursor=None),
            )

    client = SimpleNamespace(
        datasets=Datasets(),
        experiments=SimpleNamespace(
            list=lambda **kwargs: SimpleNamespace(experiments=[])
        ),
    )
    monkeypatch.setattr(data, "ax_client", lambda config: client)
    config = {"ARIZE_API_KEY": "secret", "ARIZE_SPACE_ID": "space"}
    with pytest.raises(RuntimeError, match="response lost"):
        data.import_data(config, path, "m-")
    assert data.load(path)["state"]["px-dataset"]["create_started"] is True
    assert data.import_data(config, path, "m-")["status"] == "imported_unverified"
    assert data.load(path)["state"]["px-dataset"]["dataset_id"] == "ax-dataset"


def test_failed_destination_auth_does_not_lock_prefix(monkeypatch, tmp_path):
    path = tmp_path / "manifest.json"
    write_manifest(path, [source_dataset()])

    class Datasets:
        def list(self, **kwargs):
            raise RuntimeError("authentication failed")

    client = SimpleNamespace(datasets=Datasets())
    monkeypatch.setattr(data, "ax_client", lambda config: client)
    config = {"ARIZE_API_KEY": "invalid", "ARIZE_SPACE_ID": "space"}
    with pytest.raises(RuntimeError, match="authentication failed"):
        data.import_data(config, path, "first-")
    assert data.load(path)["state"] == {}

    with pytest.raises(RuntimeError, match="authentication failed"):
        data.import_data(config, path, "corrected-")
    assert data.load(path)["state"] == {}


def test_import_upgrades_legacy_completed_state(monkeypatch, tmp_path):
    path = tmp_path / "manifest.json"
    write_manifest(path, [source_dataset()])
    manifest = data.load(path)
    manifest["state"] = {
        "px-dataset": {
            "dataset_id": "ax-dataset",
            "version_ids": {"px-version": "ax-version"},
            "experiments": [],
        }
    }
    data.save_manifest(path, manifest)
    dataset = SimpleNamespace(id="ax-dataset", name="m-source")
    version = SimpleNamespace(id="ax-version", name="initial")
    example = SimpleNamespace(
        id="ax-example",
        additional_properties={"phoenix_example_id": "global"},
    )
    client = SimpleNamespace(
        datasets=SimpleNamespace(
            list=lambda **kwargs: SimpleNamespace(datasets=[dataset]),
            get=lambda **kwargs: SimpleNamespace(versions=[version]),
            list_examples=lambda **kwargs: SimpleNamespace(
                examples=[example],
                pagination=SimpleNamespace(has_more=False, next_cursor=None),
            ),
        ),
        experiments=SimpleNamespace(
            list=lambda **kwargs: SimpleNamespace(experiments=[])
        ),
    )
    monkeypatch.setattr(data, "ax_client", lambda config: client)
    result = data.import_data(
        {"ARIZE_API_KEY": "secret", "ARIZE_SPACE_ID": "space"}, path, "m-"
    )
    assert result["status"] == "imported_unverified"
    upgraded = data.load(path)["state"]["px-dataset"]
    assert upgraded["dataset_name"] == "m-source"
    assert upgraded["create_started"] is True


def test_duplicate_evaluation_names_stop_before_write():
    experiment = {
        "name": "experiment",
        "metadata": {},
        "task_runs": [{"id": "run", "dataset_example_id": "global", "output": "x"}],
        "evaluation_runs": [
            {"experiment_run_id": "run", "name": "quality", "result": {"score": 1}},
            {"experiment_run_id": "run", "name": "quality", "result": {"score": 0}},
        ],
    }
    client = SimpleNamespace(experiments=SimpleNamespace())
    examples = {"global": SimpleNamespace(id="ax-example")}
    with pytest.raises(data.DataMigrationError, match="duplicate evaluation name"):
        data.import_experiment(
            client, SimpleNamespace(id="dataset"), experiment, examples, ""
        )
