"""Behavioral tests for the bundled Phoenix migration helper; no live services."""

import copy
import importlib.util
import json
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[5]
SCRIPT = (
    ROOT
    / ".agents"
    / "skills"
    / "phoenix-to-ax-migration"
    / "scripts"
    / "migrate.py"
)
spec = importlib.util.spec_from_file_location("phoenix_migrate", SCRIPT)
migrate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate)


@pytest.fixture
def span():
    return {
        "context": {"trace_id": "a" * 32, "span_id": "b" * 16},
        "name": "agent",
        "span_kind": "AGENT",
        "parent_id": None,
        "start_time": "2026-03-22T08:00:00.123456+00:00",
        "end_time": "2026-03-22T08:00:01.123456+00:00",
        "status_code": "OK",
        "status_message": "",
        "events": [],
        "attributes": {
            "input.value": "question",
            "output.value": "answer",
            "session.id": "session-1",
            "metadata.langgraph_step": 1,
        },
    }


@pytest.fixture
def config():
    return {
        "PHOENIX_BASE_URL": "https://phoenix.example/s/test",
        "PHOENIX_PROJECT_NAME": "source",
        "PHOENIX_API_KEY": "test-phoenix-secret",
        "ARIZE_API_KEY": "test-ax-secret",
        "ARIZE_SPACE_ID": "space-1",
        "ARIZE_PROJECT_NAME": "fresh-test",
    }


class FakeAPI:
    def __init__(self, config, pages=None):
        self.config = config
        self.pages = pages or []
        self.calls = []
        self.existing = None
        self.actual = []
        self.sleep = lambda _: None

    def project(self):
        return {"id": "project-1", "name": "source"}

    def space(self):
        return {"id": "space-1", "name": "sandbox"}

    def phoenix(self, path, params):
        self.calls.append((path, params))
        return self.pages.pop(0)

    def ax_project(self, name, space):
        return self.existing

    def ax_spans(self, project, start, end, progress=None):
        self.calls.append((project, start, end))
        return self.actual


def exported(tmp_path, config, spans):
    api = FakeAPI(config, [{"data": spans}])
    path = tmp_path / "manifest.json"
    migrate.export_snapshot(api, path)
    return api, path


def observed(span):
    result = copy.deepcopy(span)
    result["kind"] = result.pop("span_kind")
    result["attributes"]["metadata"] = migrate.span_row(span)["attributes.metadata"]
    return result


def test_configuration_reuses_values_and_environment_wins(tmp_path):
    path = tmp_path / ".env"
    path.write_text("ARIZE_SPACE=from-file\nARIZE_API_KEY=file-secret\n")
    config = migrate.configuration(path, {"ARIZE_API_KEY": "env-secret"})
    assert config["ARIZE_SPACE_ID"] == "from-file"
    assert config["ARIZE_API_KEY"] == "env-secret"


def test_missing_input_lists_only_missing_fields(config):
    assert migrate.missing_inputs(config, "preflight") == []
    del config["ARIZE_SPACE_ID"]
    assert migrate.missing_inputs(config, "preflight") == ["ARIZE_SPACE_ID"]


def test_secret_is_optional_for_public_phoenix(config):
    del config["PHOENIX_API_KEY"]
    assert migrate.missing_inputs(config, "export") == []


def test_export_uses_every_page_and_fixed_snapshot(tmp_path, config, span):
    child = copy.deepcopy(span)
    child["context"]["span_id"] = "c" * 16
    child["parent_id"] = span["context"]["span_id"]
    api = FakeAPI(
        config, [{"data": [span], "next_cursor": "second"}, {"data": [child]}]
    )
    path = tmp_path / "manifest.json"
    manifest = migrate.export_snapshot(api, path)
    assert len(manifest["spans"]) == 2
    assert api.calls[1][1]["cursor"] == "second"
    assert api.calls[0][1]["end_time"] == api.calls[1][1]["end_time"]
    assert "test-phoenix-secret" not in path.read_text()
    assert path.stat().st_mode & 0o777 == 0o600


def test_complete_trace_selection_includes_later_children(tmp_path, config, span):
    child = copy.deepcopy(span)
    child["context"]["span_id"] = "c" * 16
    child["parent_id"] = span["context"]["span_id"]
    other = copy.deepcopy(span)
    other["context"] = {"span_id": "d" * 16, "trace_id": "e" * 32}
    api = FakeAPI(
        config, [{"data": [span, other], "next_cursor": "second"}, {"data": [child]}]
    )
    manifest = migrate.export_snapshot(
        api, tmp_path / "selected.json", [span["context"]["trace_id"]]
    )
    assert len(manifest["spans"]) == 2


def test_repeated_source_cursor_stops(tmp_path, config):
    api = FakeAPI(config, [{"data": [], "next_cursor": "same"}] * 2)
    with pytest.raises(migrate.MigrationError, match="repeated"):
        migrate.export_snapshot(api, tmp_path / "manifest.json")


def test_missing_selected_trace_is_error(tmp_path, config):
    api = FakeAPI(config, [{"data": []}])
    with pytest.raises(migrate.MigrationError, match="not found"):
        migrate.export_snapshot(api, tmp_path / "manifest.json", ["absent"])


def test_empty_export_does_not_upload(tmp_path, config):
    api, path = exported(tmp_path, config, [])
    assert (
        migrate.import_snapshot(
            api, path, upload=lambda *args: pytest.fail("upload called")
        )["status"]
        == "empty"
    )


def test_preflight_is_read_only(config):
    result = migrate.preflight(FakeAPI(config))
    assert result["destination_exists"] is False
    assert result["ingestion_verified"] is False
    assert "test-ax-secret" not in json.dumps(result)


def test_mapping_preserves_metadata_messages_and_events(span):
    span["events"] = [
        {
            "name": "exception",
            "timestamp": span["end_time"],
            "attributes": {"exception.message": "synthetic error"},
        }
    ]
    span["attributes"].update(
        {
            "llm.input_messages.0.message.role": "assistant",
            "llm.input_messages.0.message.tool_calls.0.tool_call.function.name": "lookup",
            "llm.input_messages.0.message.tool_calls.0.tool_call.function.arguments": "{}",
        }
    )
    row = migrate.span_row(span)
    assert (
        json.loads(row["attributes.metadata"]["phoenix_migration"])["attributes"]
        == span["attributes"]
    )
    assert (
        json.loads(row["attributes.metadata"]["phoenix_migration"])["events"]
        == span["events"]
    )
    assert (
        row["attributes.llm.input_messages"][0]["message.tool_calls"][0][
            "tool_call.function.name"
        ]
        == "lookup"
    )
    assert row["start_time"] == 1774166400123456000
    assert row["attributes.metadata"]["langgraph_step"] == 1


def test_nanosecond_conversion_does_not_use_float():
    assert migrate.nanos("2026-03-22T08:00:00.000001+00:00") % 1_000_000_000 == 1000
    assert (
        migrate.nanos("2026-03-22T08:00:00.123456789+00:00") % 1_000_000_000
        == 123456789
    )


def test_numeric_phoenix_sessions_are_valid_ax_identifiers(span):
    span["attributes"]["session.id"] = 123
    row = migrate.span_row(span)
    assert row["attributes.session.id"] == "123"
    actual = observed(span)
    actual["attributes"]["session.id"] = "123"
    assert migrate.compare([span], [actual])["status"] == "verified"


def test_local_validation_failure_remains_pending(tmp_path, config, span):
    api, path = exported(tmp_path, config, [span])

    def failed(*args):
        raise migrate.PreparationError("local validation failed")

    with pytest.raises(migrate.PreparationError):
        migrate.import_snapshot(api, path, upload=failed)
    assert migrate.load_manifest(path)["batches"][0]["status"] == "pending"


def test_naive_timestamp_rejected():
    with pytest.raises(migrate.MigrationError, match="offset"):
        migrate.nanos("2026-03-22T08:00:00")


def test_negative_duration_rejected(span):
    span["end_time"] = "2026-03-21T00:00:00+00:00"
    with pytest.raises(migrate.MigrationError, match="before"):
        migrate.span_row(span)


def test_manifest_tampering_rejected(tmp_path, config, span):
    _, path = exported(tmp_path, config, [span])
    data = json.loads(path.read_text())
    data["spans"][0]["name"] = "modified"
    path.write_text(json.dumps(data))
    with pytest.raises(migrate.MigrationError, match="checksum"):
        migrate.load_manifest(path)


def test_fresh_destination_required(tmp_path, config, span):
    api, path = exported(tmp_path, config, [span])
    api.existing = {"id": "existing"}
    with pytest.raises(migrate.MigrationError, match="already exists"):
        migrate.import_snapshot(
            api, path, upload=lambda *args: pytest.fail("upload called")
        )


def test_pause_resume_does_not_resubmit_successful_batch(tmp_path, config, span):
    child = copy.deepcopy(span)
    child["context"]["span_id"] = "c" * 16
    api, path = exported(tmp_path, config, [span, child])
    uploads = []

    def upload(config, spans, dest):
        uploads.append(spans)

    assert migrate.import_snapshot(api, path, 1, 1, upload)["status"] == "paused"
    api.existing = {"id": "new-project"}
    assert (
        migrate.import_snapshot(api, path, upload=upload)["status"]
        == "uploaded_unverified"
    )
    assert len(uploads) == 2
    assert uploads[0][0]["context"]["span_id"] != uploads[1][0]["context"]["span_id"]


def test_uncertain_upload_is_not_blindly_retried(tmp_path, config, span):
    api, path = exported(tmp_path, config, [span])

    def failed(*args):
        raise TimeoutError("synthetic lost response")

    with pytest.raises(migrate.MigrationError, match="uncertain"):
        migrate.import_snapshot(api, path, upload=failed)
    with pytest.raises(migrate.MigrationError, match="uncertain"):
        migrate.import_snapshot(api, path, upload=lambda *args: pytest.fail("retried"))


def test_resume_destination_must_match(tmp_path, config, span):
    api, path = exported(tmp_path, config, [span])
    migrate.import_snapshot(api, path, upload=lambda *args: None)
    api.config = dict(config, ARIZE_PROJECT_NAME="different")
    with pytest.raises(migrate.MigrationError, match="differs"):
        migrate.import_snapshot(api, path)


def test_readback_checks_fields_and_preservation(span):
    actual = observed(span)
    assert migrate.compare([span], [actual])["status"] == "verified"
    actual["attributes"]["output.value"] = "changed"
    assert migrate.compare([span], [actual])["difference_count"] == 1


def test_ax_readback_serializes_nested_metadata_as_json(span):
    actual = observed(span)
    metadata = actual["attributes"]["metadata"]
    metadata["phoenix_migration"] = json.dumps(metadata["phoenix_migration"])
    assert migrate.compare([span], [actual])["status"] == "verified"


def test_readback_precision_is_reported_and_original_times_required(span):
    actual = observed(span)
    actual["start_time"] = "2026-03-22T08:00:00.123456128+00:00"
    result = migrate.compare([span], [actual])
    assert result["status"] == "verified"
    assert result["max_timestamp_readback_delta_ns"] == 128
    actual["start_time"] = "2026-03-22T08:00:00.123456129+00:00"
    assert migrate.compare([span], [actual])["status"] == "uploaded_unverified"
    actual = observed(span)
    preserved = json.loads(actual["attributes"]["metadata"]["phoenix_migration"])
    preserved.pop("start_time")
    actual["attributes"]["metadata"]["phoenix_migration"] = json.dumps(preserved)
    assert migrate.compare([span], [actual])["status"] == "uploaded_unverified"


def test_ax_readback_string_token_counts_keep_numeric_meaning(span):
    span["attributes"]["llm.token_count.total"] = 7
    actual = observed(span)
    actual["attributes"]["llm.token_count.total"] = "7"
    assert migrate.compare([span], [actual])["status"] == "verified"


def test_sdk_validation_and_arrow_conversion_without_network(config, span):
    from unittest.mock import patch

    span["attributes"]["session.id"] = 123
    span["attributes"].update(
        {
            "llm.input_messages.0.message.role": "assistant",
            "llm.input_messages.0.message.tool_calls.0.tool_call.function.name": "lookup",
            "llm.token_count.total": 5,
        }
    )
    span["events"] = [
        {
            "name": "exception",
            "timestamp": span["end_time"],
            "attributes": {"exception.message": "synthetic failure"},
        }
    ]
    span["status_code"] = "ERROR"
    with patch("arize.spans.client.post_arrow_table") as network:
        migrate.upload_sdk(
            config, [span], {"space_id": "space-1", "project_name": "test"}
        )
        assert network.call_args.kwargs["pa_table"].num_rows == 1


@pytest.mark.parametrize("field", ["parent_id", "start_time", "name", "status_code"])
def test_readback_catches_core_changes(span, field):
    actual = observed(span)
    actual[field] = "2026-03-23T08:00:00+00:00" if field == "start_time" else "changed"
    assert migrate.compare([span], [actual])["status"] == "uploaded_unverified"


def test_readback_counts_missing_extra_duplicate(span):
    actual = observed(span)
    assert migrate.compare([span], [])["missing_span_count"] == 1
    assert migrate.compare([], [actual])["extra_span_count"] == 1
    assert migrate.compare([span], [actual, actual])["duplicate_span_count"] == 1


def test_verification_uses_historical_window_and_reconciles_uncertain(
    tmp_path, config, span
):
    api, path = exported(tmp_path, config, [span])

    def failed(*args):
        raise TimeoutError()

    with pytest.raises(migrate.MigrationError):
        migrate.import_snapshot(api, path, upload=failed)
    api.existing = {"id": "new-project"}
    api.actual = [observed(span)]
    assert migrate.verify_snapshot(api, path, 0)["status"] == "verified"
    assert api.calls[-1][1].startswith("2026-03-22")
    assert migrate.load_manifest(path)["batches"][0]["status"] == "submitted"


@pytest.mark.parametrize("status", [401, 403, 404, 302])
def test_api_errors_do_not_echo_secrets(config, status):
    client = httpx.Client(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                status, json={"secret": config["ARIZE_API_KEY"]}
            )
        )
    )
    api = migrate.APIs(config, client, sleep=lambda _: None)
    with pytest.raises(migrate.MigrationError) as exc:
        api.space()
    assert config["ARIZE_API_KEY"] not in str(exc.value)


def test_api_retry_is_bounded(config):
    calls = []

    def response(request):
        calls.append(request)
        return httpx.Response(429)

    api = migrate.APIs(
        config,
        httpx.Client(transport=httpx.MockTransport(response)),
        sleep=lambda _: None,
    )
    with pytest.raises(migrate.MigrationError):
        api.space()
    assert len(calls) == 4


def test_ax_readback_splits_truncated_time_windows(config):
    calls = []

    def response(request):
        calls.append(request)
        body = json.loads(request.content)
        assert "cursor" not in request.url.params
        assert request.url.params["limit"] == "500"
        if len(calls) == 1:
            return httpx.Response(
                200,
                json={
                    "spans": [{"discard": True}],
                    "pagination": {"has_more": True, "next_cursor": "broken"},
                },
            )
        return httpx.Response(
            200, json={"spans": [{"window": body}], "pagination": {"has_more": False}}
        )

    api = migrate.APIs(
        config,
        httpx.Client(transport=httpx.MockTransport(response)),
        sleep=lambda _: None,
    )
    rows = api.ax_spans("project", "2026-03-22T00:00:00Z", "2026-03-22T00:00:02Z")
    assert len(rows) == 2
    bodies = [json.loads(c.content) for c in calls]
    assert bodies[1]["start_time"] == bodies[2]["end_time"]
    assert bodies[2]["start_time"] == bodies[0]["start_time"]
    assert bodies[1]["end_time"] == bodies[0]["end_time"]
    assert calls[0].url.path == "/v2/spans"


def test_ax_readback_refuses_truncated_single_millisecond(config):
    api = migrate.APIs(
        config,
        httpx.Client(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200, json={"pagination": {"has_more": True}}
                )
            )
        ),
    )
    with pytest.raises(migrate.MigrationError, match="share a millisecond"):
        api.ax_spans("project", "2026-03-22T00:00:00Z", "2026-03-22T00:00:00.001Z")


def test_cli_missing_input_is_machine_readable(monkeypatch, capsys):
    monkeypatch.setattr(migrate, "configuration", lambda *args: {})
    monkeypatch.setattr("sys.argv", ["migrate.py", "preflight"])
    assert migrate.main() == 2
    result = json.loads(capsys.readouterr().out)
    assert result["status"] == "needs_input"
    assert "PHOENIX_PROJECT_NAME" in result["missing"]


@pytest.mark.parametrize("status", [401, 403, 400, 404, 422, 429])
def test_definite_sdk_rejection_can_resume(tmp_path, config, span, status):
    from unittest.mock import patch

    from arize.exceptions.auth import AuthenticationError
    from arize.exceptions.http import APIError

    api, path = exported(tmp_path, config, [span])
    exception = AuthenticationError if status in (401, 403) else APIError
    with patch(
        "arize.spans.client.post_arrow_table",
        side_effect=exception(status, "secret server detail"),
    ):
        with pytest.raises(migrate.RejectedUpload) as failure:
            migrate.import_snapshot(api, path)
    assert "secret server detail" not in str(failure.value)
    assert migrate.load_manifest(path)["batches"][0]["status"] == "pending"
    with patch("arize.spans.client.post_arrow_table") as upload:
        result = migrate.import_snapshot(api, path)
    assert result["submitted_span_count"] == 1
    assert upload.call_count == 1


@pytest.mark.parametrize("status", [408, 500, 503])
def test_ambiguous_sdk_response_stops_resume(tmp_path, config, span, status):
    from unittest.mock import patch

    from arize.exceptions.http import APIError

    api, path = exported(tmp_path, config, [span])
    with patch(
        "arize.spans.client.post_arrow_table",
        side_effect=APIError(status, "secret server detail"),
    ):
        with pytest.raises(migrate.MigrationError, match="uncertain"):
            migrate.import_snapshot(api, path)
    assert migrate.load_manifest(path)["batches"][0]["status"] == "uncertain"
    with patch("arize.spans.client.post_arrow_table") as upload:
        with pytest.raises(migrate.MigrationError, match="uncertain"):
            migrate.import_snapshot(api, path)
    upload.assert_not_called()


@pytest.mark.parametrize(
    "overrides,expected",
    [
        ({}, "https://api.arize.com"),
        (
            {"ARIZE_API_HOST": "custom.example", "ARIZE_API_PORT": "8443"},
            "https://custom.example:8443",
        ),
        (
            {"ARIZE_SINGLE_HOST": "single.example", "ARIZE_SINGLE_PORT": "9443"},
            "https://single.example:9443",
        ),
        (
            {
                "ARIZE_SINGLE_HOST": "single.example",
                "ARIZE_SINGLE_PORT": "9443",
                "ARIZE_API_PORT": "8443",
            },
            "https://single.example:8443",
        ),
        ({"ARIZE_BASE_DOMAIN": "private.example"}, "https://api.private.example"),
        ({"ARIZE_REGION": "eu-west-1a"}, "https://api.eu-west-1a.arize.com"),
    ],
)
def test_rest_and_upload_share_sdk_endpoint(config, span, overrides, expected):
    from unittest.mock import patch

    config = {**config, **overrides}
    calls = []
    api = migrate.APIs(
        config,
        httpx.Client(
            transport=httpx.MockTransport(
                lambda request: calls.append(request) or httpx.Response(200, json={})
            )
        ),
    )
    api.ax("GET", "spaces/space-1")
    with patch("arize.spans.client.post_arrow_table") as upload:
        migrate.upload_sdk(
            config, [span], {"space_id": "space-1", "project_name": "test"}
        )
    assert str(calls[0].url) == expected + "/v2/spaces/space-1"
    assert upload.call_args.kwargs["files_url"].startswith(expected + "/")


def test_non_https_endpoint_rejected_before_upload(config, span):
    from unittest.mock import patch

    config = {**config, "ARIZE_API_SCHEME": "http"}
    with patch("arize.spans.client.post_arrow_table") as upload:
        with pytest.raises(migrate.MigrationError, match="HTTPS"):
            migrate.upload_sdk(
                config, [span], {"space_id": "space-1", "project_name": "test"}
            )
    upload.assert_not_called()


@pytest.mark.parametrize(
    "service,expected",
    [("phoenix", "Phoenix project lookup"), ("ax", "AX destination lookup")],
)
def test_authentication_errors_identify_service(config, service, expected):
    api = migrate.APIs(
        config,
        httpx.Client(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(401, text="private error detail")
            )
        ),
    )
    with pytest.raises(migrate.APIRequestError, match=expected) as failure:
        api.project() if service == "phoenix" else api.space()
    assert "private error detail" not in str(failure.value)


def test_phoenix_export_error_identifies_stage(config):
    api = migrate.APIs(
        config,
        httpx.Client(
            transport=httpx.MockTransport(lambda request: httpx.Response(403))
        ),
    )
    with pytest.raises(migrate.APIRequestError, match="Phoenix span export"):
        api.phoenix("projects/source/spans")


@pytest.mark.parametrize("operation", ["import", "verify"])
def test_empty_snapshot_cli_needs_no_keys_or_network(
    tmp_path, config, monkeypatch, capsys, operation
):
    _, path = exported(tmp_path, config, [])
    monkeypatch.setattr(migrate, "configuration", lambda *args: {})

    def forbidden(*args, **kwargs):
        raise AssertionError("Empty snapshots must make no API calls")

    monkeypatch.setattr(migrate, "APIs", forbidden)
    monkeypatch.setattr("sys.argv", ["migrate.py", operation, "--manifest", str(path)])
    assert migrate.main() == 0
    result = json.loads(capsys.readouterr().out)
    assert result["status"] == "empty"
    assert result["destination_span_count"] == 0
    assert migrate.load_manifest(path)["destination"] is None


@pytest.mark.parametrize("status", [401, 403, 404])
@pytest.mark.parametrize("denied_path", ["projects", "spans"])
def test_submitted_spans_with_unreadable_key_remain_unverified(
    tmp_path, config, span, status, denied_path
):
    from unittest.mock import patch

    api, path = exported(tmp_path, config, [span])
    with patch("arize.spans.client.post_arrow_table"):
        migrate.import_snapshot(api, path)

    def response(request):
        if request.url.path.endswith("/" + denied_path):
            return httpx.Response(status, text="private server payload")
        return httpx.Response(
            200,
            json={
                "projects": [
                    {"id": "destination", "name": config["ARIZE_PROJECT_NAME"]}
                ]
            },
        )

    reader = migrate.APIs(config, httpx.Client(transport=httpx.MockTransport(response)))
    progress = []
    result = migrate.verify_snapshot(reader, path, 0, progress=progress.append)
    assert result["status"] == "uploaded_unverified"
    assert result["readback_http_status"] == status
    assert "AX " in result["reason"]
    assert "private server payload" not in json.dumps(result)
    assert migrate.load_manifest(path)["batches"][0]["status"] == "submitted"
    assert "verification" not in migrate.load_manifest(path)
    assert progress[-1]["stage"] == (
        "readback_unavailable" if status == 404 else "readback_denied"
    )


def test_ingest_only_key_cannot_bypass_destination_read_checks(tmp_path, config, span):
    from unittest.mock import patch

    _, path = exported(tmp_path, config, [span])
    api = migrate.APIs(
        config,
        httpx.Client(
            transport=httpx.MockTransport(lambda request: httpx.Response(403))
        ),
    )
    with patch("arize.spans.client.post_arrow_table") as upload:
        with pytest.raises(migrate.APIRequestError, match="AX destination lookup"):
            migrate.import_snapshot(api, path)
    upload.assert_not_called()
    assert migrate.load_manifest(path)["destination"] is None


def test_read_only_key_rejected_by_ingestion_keeps_pending(tmp_path, config, span):
    from unittest.mock import patch

    from arize.exceptions.auth import AuthenticationError

    _, path = exported(tmp_path, config, [span])

    def response(request):
        if request.url.path.endswith("/spaces/space-1"):
            return httpx.Response(200, json={"id": "space-1", "name": "sandbox"})
        return httpx.Response(200, json={"projects": []})

    api = migrate.APIs(config, httpx.Client(transport=httpx.MockTransport(response)))
    with patch(
        "arize.spans.client.post_arrow_table",
        side_effect=AuthenticationError(403, "private payload"),
    ):
        with pytest.raises(migrate.RejectedUpload, match="HTTP 403"):
            migrate.import_snapshot(api, path)
    assert migrate.load_manifest(path)["batches"][0]["status"] == "pending"


def test_verification_progress_stderr_preserves_final_stdout(
    tmp_path, config, span, monkeypatch, capsys
):
    api, path = exported(tmp_path, config, [span])
    migrate.import_snapshot(api, path, upload=lambda *args: None)
    api.existing = {"id": "destination"}
    api.actual = [observed(span)]
    monkeypatch.setattr(migrate, "configuration", lambda *args: config)
    monkeypatch.setattr(migrate, "APIs", lambda *args: api)
    monkeypatch.setattr(
        "sys.argv",
        ["migrate.py", "verify", "--manifest", str(path), "--wait-seconds", "0"],
    )
    assert migrate.main() == 0
    output = capsys.readouterr()
    assert json.loads(output.out)["status"] == "verified"
    progress = [json.loads(line) for line in output.err.splitlines()]
    assert progress[0]["expected_span_count"] == 1
    assert progress[-1]["found_span_count"] == 1
    assert all("elapsed_seconds" in event for event in progress)
    for private in [
        config["ARIZE_API_KEY"],
        span["attributes"]["input.value"],
        span["context"]["span_id"],
    ]:
        assert private not in output.err


def test_denied_readback_cli_exits_unverified(
    tmp_path, config, span, monkeypatch, capsys
):
    api, path = exported(tmp_path, config, [span])
    migrate.import_snapshot(api, path, upload=lambda *args: None)
    reader = migrate.APIs(
        config,
        httpx.Client(
            transport=httpx.MockTransport(lambda request: httpx.Response(403))
        ),
    )
    monkeypatch.setattr(migrate, "configuration", lambda *args: config)
    monkeypatch.setattr(migrate, "APIs", lambda *args: reader)
    monkeypatch.setattr(
        "sys.argv",
        ["migrate.py", "verify", "--manifest", str(path), "--wait-seconds", "0"],
    )
    assert migrate.main() == 3
    assert json.loads(capsys.readouterr().out)["status"] == "uploaded_unverified"


def test_window_progress_reports_partial_counts(config):
    calls = []

    def response(request):
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "spans": [] if len(calls) == 1 else [{"synthetic": len(calls)}],
                "pagination": {"has_more": len(calls) == 1},
            },
        )

    api = migrate.APIs(
        config,
        httpx.Client(transport=httpx.MockTransport(response)),
        sleep=lambda _: None,
    )
    progress = []
    rows = api.ax_spans(
        "destination",
        "2026-03-22T00:00:00Z",
        "2026-03-22T00:00:02Z",
        progress=lambda stage, **counts: progress.append(counts),
    )
    assert len(rows) == 2
    assert progress[0]["found_span_count"] == 0
    assert progress[-1]["found_span_count"] == 2
    assert progress[-1]["pending_windows"] == 0
