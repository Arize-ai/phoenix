#!/usr/bin/env python3
"""Export a Phoenix snapshot, batch-log to AX, and verify the original spans."""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, urlsplit

import httpx
from dotenv import dotenv_values


class MigrationError(Exception):
    pass


class APIRequestError(MigrationError):
    def __init__(self, context, status):
        self.status = status
        super().__init__(
            f"{context} returned HTTP {status}; check credentials, permissions, and endpoint configuration."
        )


class RejectedUpload(MigrationError):
    pass


class PreparationError(MigrationError):
    pass


def dump(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    return hashlib.sha256(dump(value).encode()).hexdigest()


def utc(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise MigrationError("Timestamps must include a UTC offset.")
    return result.astimezone(timezone.utc)


def nanos(value):
    dt = utc(value)
    delta = dt - datetime(1970, 1, 1, tzinfo=timezone.utc)
    fraction = re.search(r"T\d{2}:\d{2}:\d{2}\.(\d+)", value)
    subsecond = (
        int((fraction[1] + "000000000")[:9]) if fraction else delta.microseconds * 1000
    )
    return (delta.days * 86400 + delta.seconds) * 1_000_000_000 + subsecond


def configuration(env_file=None, environ=None):
    values = dict(dotenv_values(env_file)) if env_file else {}
    values.update(os.environ if environ is None else environ)
    values = {k: v for k, v in values.items() if v}
    if not values.get("ARIZE_SPACE_ID") and values.get("ARIZE_SPACE"):
        values["ARIZE_SPACE_ID"] = values["ARIZE_SPACE"]
    return values


def missing_inputs(config, operation):
    fields = []
    if operation in ("preflight", "export"):
        fields += ["PHOENIX_BASE_URL", "PHOENIX_PROJECT_NAME"]
    if operation in ("preflight", "import", "verify"):
        fields += ["ARIZE_API_KEY", "ARIZE_SPACE_ID"]
    if operation == "import":
        fields += ["ARIZE_PROJECT_NAME"]
    return [name for name in fields if not config.get(name)]


def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as stream:
        stream.write(dump(value) + "\n")
    temporary.replace(path)
    path.chmod(0o600)


def sdk_client(config):
    from arize import ArizeClient
    from arize.regions import Region

    logging.getLogger("arize").setLevel(logging.CRITICAL)
    options = {
        name: config["ARIZE_" + name.upper()]
        for name in ("api_host", "api_scheme", "single_host", "base_domain")
        if config.get("ARIZE_" + name.upper())
    }
    for name in ("api_port", "single_port"):
        if config.get("ARIZE_" + name.upper()):
            options[name] = int(config["ARIZE_" + name.upper()])
    if config.get("ARIZE_REGION"):
        options["region"] = Region(config["ARIZE_REGION"])
    client = ArizeClient(api_key=config["ARIZE_API_KEY"], **options)
    if urlsplit(client.sdk_config.api_url).scheme != "https":
        raise MigrationError("AX API requests require HTTPS.")
    return client


class APIs:
    def __init__(self, config, client=None, sleep=time.sleep):
        self.config = config
        self.client = client or httpx.Client(timeout=60, follow_redirects=False)
        self.sleep = sleep

    def request(self, method, url, key=None, context="API request", **kwargs):
        headers = {"Accept": "application/json"}
        if key:
            headers["Authorization"] = "Bearer " + key
        for attempt in range(4):
            try:
                response = self.client.request(method, url, headers=headers, **kwargs)
            except httpx.TransportError:
                if attempt == 3:
                    raise MigrationError(
                        f"{context} connection failed after four attempts."
                    ) from None
                self.sleep(2**attempt)
                continue
            if response.status_code == 429 or response.status_code >= 500:
                if attempt < 3:
                    delay = (
                        10 * 2**attempt if response.status_code == 429 else 2**attempt
                    )
                    retry_after = response.headers.get("Retry-After", "")
                    if retry_after.isdigit():
                        delay = max(delay, min(int(retry_after), 60))
                    self.sleep(delay)
                    continue
            if not 200 <= response.status_code < 300:
                raise APIRequestError(context, response.status_code)
            try:
                return response.json()
            except ValueError:
                raise MigrationError(f"{context} returned invalid JSON.") from None
        raise MigrationError(f"{context} did not complete.")

    def phoenix(self, path, params=None):
        base = self.config["PHOENIX_BASE_URL"].rstrip("/")
        if urlsplit(base).scheme not in ("http", "https"):
            raise MigrationError("Phoenix URL must use HTTP or HTTPS.")
        if urlsplit(base).scheme == "http" and self.config.get("PHOENIX_API_KEY"):
            raise MigrationError("Use HTTPS when sending a Phoenix API key.")
        return self.request(
            "GET",
            base + "/v1/" + path,
            self.config.get("PHOENIX_API_KEY"),
            params=params,
            context="Phoenix span export"
            if path.endswith("/spans")
            else "Phoenix project lookup",
        )

    def ax(self, method, path, **kwargs):
        base = sdk_client(self.config).sdk_config.api_url.rstrip("/")
        return self.request(
            method,
            base + "/v2/" + path,
            self.config["ARIZE_API_KEY"],
            context="AX verification readback"
            if path == "spans"
            else "AX destination lookup",
            **kwargs,
        )

    def project(self):
        return self.phoenix(
            "projects/" + quote(self.config["PHOENIX_PROJECT_NAME"], safe="")
        )["data"]

    def space(self):
        return self.ax("GET", "spaces/" + quote(self.config["ARIZE_SPACE_ID"], safe=""))

    def ax_project(self, name, space):
        cursor = None
        seen = set()
        while True:
            params = {"space_id": space, "limit": 100}
            if cursor:
                params["cursor"] = cursor
            page = self.ax("GET", "projects", params=params)
            rows = page.get("projects", page.get("data", []))
            matches = [row for row in rows if row["name"] == name]
            if len(matches) > 1:
                raise MigrationError("Destination project name is ambiguous.")
            if matches:
                return matches[0]
            cursor = page.get("pagination", {}).get("next_cursor")
            if not cursor:
                return None
            if cursor in seen:
                raise MigrationError("AX project pagination repeated a cursor.")
            seen.add(cursor)

    def ax_spans(self, project, start, end, progress=None):
        # Cursor pagination can omit records in historical multi-segment queries.
        # Query disjoint millisecond windows, splitting any truncated response.
        start_ms = nanos(start) // 1_000_000
        end_ms = (nanos(end) + 999_999) // 1_000_000
        windows = [(start_ms, end_ms)]
        rows = []
        requests = 0
        last_progress = float("-inf")
        while windows:
            lower, upper = windows.pop()
            requests += 1
            if requests > 4096:
                raise MigrationError(
                    "AX verification exceeded 4096 time-window requests."
                )
            if requests > 1:
                self.sleep(2)
            page = self.ax(
                "POST",
                "spans",
                params={"limit": 500},
                json={
                    "project_id": project,
                    "start_time": (
                        datetime(1970, 1, 1, tzinfo=timezone.utc)
                        + timedelta(milliseconds=lower)
                    ).isoformat(),
                    "end_time": (
                        datetime(1970, 1, 1, tzinfo=timezone.utc)
                        + timedelta(milliseconds=upper)
                    ).isoformat(),
                },
            )
            pagination = page.get("pagination", {})
            if pagination.get("has_more") or pagination.get("next_cursor"):
                if upper - lower <= 1:
                    raise MigrationError(
                        "More than 500 AX spans share a millisecond; complete readback requires another export method."
                    )
                middle = (lower + upper) // 2
                windows.extend([(lower, middle), (middle, upper)])
            else:
                rows.extend(page.get("spans", page.get("data", [])))
            if progress and (time.monotonic() - last_progress >= 15 or not windows):
                last_progress = time.monotonic()
                progress(
                    "reading_spans",
                    found_span_count=len(rows),
                    request_count=requests,
                    pending_windows=len(windows),
                )
        return rows


def preflight(api):
    project = api.project()
    space = api.space()
    target = api.config.get("ARIZE_PROJECT_NAME")
    existing = api.ax_project(target, space["id"]) if target else None
    return {
        "source_project": project,
        "destination_space": {"id": space["id"], "name": space["name"]},
        "destination_project": target,
        "destination_exists": existing is not None,
        "ingestion_verified": False,
    }


def export_snapshot(api, manifest_path, trace_ids=None):
    if Path(manifest_path).exists():
        raise MigrationError(
            "Manifest already exists; use it for import/verify or choose a new path."
        )
    project = api.project()
    end = datetime.now(timezone.utc).isoformat()
    cursor = None
    seen_cursors = set()
    spans = {}
    pages = 0
    while True:
        params = {"limit": 100, "end_time": end}
        if cursor:
            params["cursor"] = cursor
        page = api.phoenix(
            "projects/" + quote(project["id"], safe="") + "/spans", params
        )
        pages += 1
        for span in page["data"]:
            if trace_ids and span["context"]["trace_id"] not in trace_ids:
                continue
            identifier = span["context"]["span_id"]
            if identifier in spans and spans[identifier] != span:
                raise MigrationError("Source snapshot contains conflicting span IDs.")
            spans[identifier] = span
        cursor = page.get("next_cursor")
        if not cursor:
            break
        if cursor in seen_cursors:
            raise MigrationError("Phoenix pagination repeated a cursor.")
        seen_cursors.add(cursor)
    rows = sorted(
        spans.values(), key=lambda s: (s["start_time"], s["context"]["span_id"])
    )
    found_traces = {s["context"]["trace_id"] for s in rows}
    if trace_ids and set(trace_ids) != found_traces:
        raise MigrationError(
            "One or more selected trace IDs were not found in the snapshot."
        )
    manifest = {
        "version": 1,
        "source": {"endpoint": api.config["PHOENIX_BASE_URL"], "project": project},
        "snapshot_end_time": end,
        "pages": pages,
        "spans": rows,
        "checksum": digest(rows),
        "destination": None,
        "batches": [],
    }
    save(manifest_path, manifest)
    return manifest


def load_manifest(path):
    manifest = json.loads(Path(path).read_text())
    if (
        manifest.get("version") != 1
        or digest(manifest["spans"]) != manifest["checksum"]
    ):
        raise MigrationError("Manifest version or checksum is invalid.")
    ids = [s["context"]["span_id"] for s in manifest["spans"]]
    if len(ids) != len(set(ids)):
        raise MigrationError("Manifest contains duplicate span IDs.")
    return manifest


def expand_indexed(attrs):
    result = dict(attrs)
    groups = {}
    for key, value in attrs.items():
        match = re.match(
            r"^(llm\.(?:input_messages|output_messages|tools))\.(\d+)\.(.+)$", key
        )
        if not match:
            continue
        prefix, index, suffix = match.groups()
        groups.setdefault(prefix, {}).setdefault(int(index), {})[suffix] = value
        result.pop(key)
    for prefix, items in groups.items():
        expanded = []
        for index in range(max(items) + 1):
            entry = {}
            calls = {}
            for key, value in items.get(index, {}).items():
                match = re.match(r"^message\.tool_calls\.(\d+)\.(.+)$", key)
                if match:
                    calls.setdefault(int(match[1]), {})[match[2]] = value
                else:
                    entry[key] = value
            if calls:
                entry["message.tool_calls"] = [
                    calls.get(i, {}) for i in range(max(calls) + 1)
                ]
            expanded.append(entry)
        result[prefix] = expanded
    return result


def span_row(span):
    attrs = dict(span.get("attributes") or {})
    row = {
        "context.trace_id": span["context"]["trace_id"],
        "context.span_id": span["context"]["span_id"],
        "parent_id": span.get("parent_id") or None,
        "name": span["name"],
        "start_time": nanos(span["start_time"]),
        "end_time": nanos(span["end_time"]),
        "status_code": span.get("status_code", "UNSET"),
        "status_message": span.get("status_message", ""),
        "span_kind": span["span_kind"],
    }
    if row["end_time"] < row["start_time"]:
        raise MigrationError("Source span ends before it starts.")
    for key, value in expand_indexed(attrs).items():
        if key != "metadata" and not key.startswith("metadata."):
            if key in ("session.id", "user.id") and value is not None:
                value = str(value)
            row["attributes." + key] = value
    metadata = attrs.get("metadata", {})
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except ValueError:
            metadata = {"original_metadata": metadata}
    if not isinstance(metadata, dict):
        metadata = {"original_metadata": metadata}
    metadata = dict(metadata)
    for key, value in attrs.items():
        if key.startswith("metadata."):
            metadata[key[9:]] = value
    if "phoenix_migration" in metadata:
        raise MigrationError(
            "Source metadata already uses reserved phoenix_migration key."
        )
    metadata["phoenix_migration"] = dump(
        {
            "attributes": attrs,
            "events": span.get("events", []),
            "start_time": span["start_time"],
            "end_time": span["end_time"],
        }
    )
    row["attributes.metadata"] = metadata
    if span.get("events"):
        row["events"] = span["events"]
    return row


def upload_sdk(config, spans, destination):
    import pandas as pd
    import pyarrow as pa
    from arize.exceptions.auth import AuthenticationError
    from arize.exceptions.base import ValidationFailure
    from arize.exceptions.http import APIError

    client = sdk_client(config)
    frame = pd.DataFrame([span_row(s) for s in spans])
    # Nullable integers avoid Arrow coercion of token counts when non-LLM rows are present.
    for column in frame:
        if column.startswith("attributes.llm.token_count."):
            frame[column] = pd.array(frame[column], dtype="Int64")
    try:
        client.spans.log(
            space_id=destination["space_id"],
            project_name=destination["project_name"],
            dataframe=frame,
            timeout=60,
        )
    except AuthenticationError as exc:
        raise RejectedUpload(
            f"AX rejected the upload (HTTP {exc.status_code}); fix credentials or permissions and rerun import with the same manifest."
        ) from None
    except APIError as exc:
        # A timeout/server failure can still be ambiguous after a write.
        if 400 <= exc.status_code < 500 and exc.status_code != 408:
            raise RejectedUpload(
                f"AX rejected the upload (HTTP {exc.status_code}); fix the request and rerun import with the same manifest."
            ) from None
        raise MigrationError(
            "AX upload response was ambiguous; run verify before retrying."
        ) from None
    except (ValidationFailure, pa.ArrowInvalid, pa.ArrowTypeError):
        raise PreparationError(
            "AX SDK validation or Arrow conversion failed before upload. Check source field types; no payload is included in this error."
        ) from None


def import_snapshot(api, path, batch_size=500, max_batches=None, upload=upload_sdk):
    manifest = load_manifest(path)
    if not manifest["spans"]:
        return {"status": "empty", "span_count": 0}
    space = api.space()
    target = api.config["ARIZE_PROJECT_NAME"]
    destination = {"space_id": space["id"], "project_name": target}
    if manifest["destination"] and manifest["destination"] != destination:
        raise MigrationError("Resume destination differs from the manifest.")
    if manifest["destination"] is None:
        if api.ax_project(target, space["id"]):
            raise MigrationError(
                "Destination already exists; choose a fresh project name."
            )
        manifest["destination"] = destination
        manifest["batches"] = [
            {
                "start": i,
                "end": min(i + batch_size, len(manifest["spans"])),
                "status": "pending",
            }
            for i in range(0, len(manifest["spans"]), batch_size)
        ]
        save(path, manifest)
    completed = 0
    for batch in manifest["batches"]:
        if batch["status"] == "submitted":
            continue
        if batch["status"] == "uncertain":
            raise MigrationError(
                "An upload has an uncertain outcome. Run verify; do not blindly retry this batch."
            )
        if max_batches is not None and completed >= max_batches:
            break
        rows = manifest["spans"][batch["start"] : batch["end"]]
        for span in rows:
            span_row(span)
        batch["status"] = "uncertain"
        save(path, manifest)
        try:
            upload(api.config, rows, destination)
        except (PreparationError, RejectedUpload):
            batch["status"] = "pending"
            save(path, manifest)
            raise
        except Exception:
            raise MigrationError(
                "Upload did not complete reliably. Manifest records an uncertain batch; run verify before retrying."
            ) from None
        batch["status"] = "submitted"
        save(path, manifest)
        completed += 1
    return {
        "status": "uploaded_unverified"
        if all(b["status"] == "submitted" for b in manifest["batches"])
        else "paused",
        "submitted_span_count": sum(
            b["end"] - b["start"]
            for b in manifest["batches"]
            if b["status"] == "submitted"
        ),
    }


def metadata_dict(span):
    metadata = (span.get("attributes") or {}).get("metadata", {})
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except ValueError:
            return {}
    return metadata if isinstance(metadata, dict) else {}


def compare(source, actual):
    expected = {s["context"]["span_id"]: s for s in source}
    observed = {s["context"]["span_id"]: s for s in actual}
    differences = []
    timestamp_delta = 0
    core = [
        "name",
        "parent_id",
        "start_time",
        "end_time",
        "status_code",
        "status_message",
    ]
    important = [
        "input.value",
        "output.value",
        "input.mime_type",
        "output.mime_type",
        "session.id",
        "llm.model_name",
        "llm.provider",
        "llm.token_count.prompt",
        "llm.token_count.completion",
        "llm.token_count.total",
        "tool.name",
    ]
    for identifier in expected.keys() & observed.keys():
        left, right = expected[identifier], observed[identifier]
        for field in core:
            a, b = left.get(field), right.get(field)
            if field in ("start_time", "end_time"):
                delta = abs(nanos(a) - nanos(b))
                timestamp_delta = max(timestamp_delta, delta)
                equal = delta <= 128
            else:
                equal = (a or "") == (b or "")
            if not equal:
                differences.append({"span_id": identifier, "field": field})
        if left["context"]["trace_id"] != right["context"]["trace_id"]:
            differences.append({"span_id": identifier, "field": "context.trace_id"})
        if left["span_kind"] != right.get("kind", right.get("span_kind")):
            differences.append({"span_id": identifier, "field": "span_kind"})
        attributes = left.get("attributes") or {}
        preserved = metadata_dict(right).get("phoenix_migration", {})
        for _ in range(3):
            if not isinstance(preserved, str):
                break
            try:
                preserved = json.loads(preserved)
            except ValueError:
                preserved = {}
                break
        if not isinstance(preserved, dict):
            preserved = {}
        for field in ("attributes", "events"):
            if isinstance(preserved.get(field), str):
                try:
                    preserved[field] = json.loads(preserved[field])
                except ValueError:
                    pass
        if preserved.get("attributes") != attributes or preserved.get(
            "events"
        ) != left.get("events", []):
            differences.append(
                {"span_id": identifier, "field": "preserved_attributes_and_events"}
            )
        if any(
            preserved.get(field) != left[field] for field in ("start_time", "end_time")
        ):
            differences.append(
                {"span_id": identifier, "field": "preserved_original_timestamps"}
            )
        for field in important:
            a = attributes.get(field)
            b = (right.get("attributes") or {}).get(field)
            equal = (
                str(a) == str(b)
                if field == "session.id" or field.startswith("llm.token_count.")
                else a == b
            )
            if field in attributes and not equal:
                differences.append(
                    {"span_id": identifier, "field": "attributes." + field}
                )
    return {
        "status": "verified"
        if expected.keys() == observed.keys()
        and not differences
        and len(actual) == len(observed)
        else "uploaded_unverified",
        "source_span_count": len(source),
        "destination_span_count": len(actual),
        "missing_span_count": len(expected.keys() - observed.keys()),
        "extra_span_count": len(observed.keys() - expected.keys()),
        "duplicate_span_count": len(actual) - len(observed),
        "difference_count": len(differences),
        "max_timestamp_readback_delta_ns": timestamp_delta,
        "differences": differences[:20],
    }


def emit_progress(result):
    print(dump(result), file=sys.stderr, flush=True)


def verify_snapshot(api, path, wait_seconds=900, interval=15, progress=None):
    manifest = load_manifest(path)
    spans = manifest["spans"]
    if not spans:
        return {
            "status": "empty",
            "reason": "Snapshot contains no spans; nothing was uploaded or requires verification.",
            "source_span_count": 0,
            "destination_span_count": 0,
        }
    destination = manifest["destination"]
    if not destination:
        raise MigrationError("Manifest has no import destination.")
    if destination["space_id"] != api.config["ARIZE_SPACE_ID"]:
        raise MigrationError("Configured AX space differs from the manifest.")
    start = (
        min(utc(s["start_time"]) for s in spans) - timedelta(seconds=1)
    ).isoformat()
    end = (max(utc(s["end_time"]) for s in spans) + timedelta(seconds=1)).isoformat()
    began = time.monotonic()
    deadline = began + wait_seconds

    def notify(stage, **counts):
        if progress:
            progress(
                {
                    "event": "verification_progress",
                    "stage": stage,
                    "elapsed_seconds": round(time.monotonic() - began, 1),
                    "expected_span_count": len(spans),
                    **counts,
                }
            )

    result = {
        "status": "uploaded_unverified",
        "reason": "Destination project is not yet visible.",
    }
    notify("looking_up_destination", found_span_count=0)
    while True:
        try:
            project = api.ax_project(
                destination["project_name"], destination["space_id"]
            )
            if project:
                notify("reading_spans", found_span_count=0)
                actual = api.ax_spans(
                    project["id"], start, end, progress=notify if progress else None
                )
                result = compare(spans, actual)
                notify(
                    "readback_checked",
                    found_span_count=len(actual),
                    missing_span_count=result["missing_span_count"],
                    difference_count=result["difference_count"],
                )
                if result["status"] == "verified":
                    for batch in manifest["batches"]:
                        batch["status"] = "submitted"
                    manifest["verification"] = result
                    save(path, manifest)
                    return result
        except APIRequestError as exc:
            if exc.status not in (401, 403, 404):
                raise
            notify("readback_unavailable" if exc.status == 404 else "readback_denied")
            return {
                "status": "uploaded_unverified",
                "source_span_count": len(spans),
                "reason": str(exc),
                "readback_http_status": exc.status,
            }
        if time.monotonic() >= deadline:
            return result
        notify(
            "waiting_for_indexing",
            found_span_count=result.get("destination_span_count", 0),
        )
        api.sleep(min(interval, max(0, deadline - time.monotonic())))


def summary(manifest):
    return {
        "status": "exported",
        "span_count": len(manifest["spans"]),
        "trace_count": len({s["context"]["trace_id"] for s in manifest["spans"]}),
        "pages": manifest["pages"],
        "snapshot_end_time": manifest["snapshot_end_time"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "operation", choices=["preflight", "export", "import", "verify"]
    )
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--project", help="Destination AX project name")
    parser.add_argument("--trace-id", action="append")
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--max-batches", type=int)
    parser.add_argument("--wait-seconds", type=int, default=900)
    args = parser.parse_args()
    try:
        if (
            args.batch_size < 1
            or args.wait_seconds < 0
            or (args.max_batches is not None and args.max_batches < 1)
        ):
            raise MigrationError(
                "Batch sizes must be positive and wait time nonnegative."
            )
        config = configuration(args.env_file)
        if args.project:
            config["ARIZE_PROJECT_NAME"] = args.project
        if args.operation in ("import", "verify") and args.manifest:
            if not load_manifest(args.manifest)["spans"]:
                print(dump(verify_snapshot(None, args.manifest)))
                return 0
        missing = missing_inputs(config, args.operation)
        if missing:
            print(dump({"status": "needs_input", "missing": missing}))
            return 2
        if args.operation != "preflight" and not args.manifest:
            raise MigrationError("This operation requires --manifest.")
        api = APIs(config)
        if args.operation == "preflight":
            result = preflight(api)
        elif args.operation == "export":
            result = summary(export_snapshot(api, args.manifest, args.trace_id))
        elif args.operation == "import":
            result = import_snapshot(
                api, args.manifest, args.batch_size, args.max_batches
            )
        else:
            result = verify_snapshot(
                api, args.manifest, args.wait_seconds, progress=emit_progress
            )
        print(dump(result))
        return (
            3
            if result.get("status") == "uploaded_unverified"
            and args.operation == "verify"
            else 0
        )
    except MigrationError as exc:
        print(dump({"status": "error", "message": str(exc)}))
        return 1
    except Exception:
        print(
            dump(
                {
                    "status": "error",
                    "message": "Unexpected failure; inspect configuration, manifest format, and installed dependency versions. No credentials or payloads are included in this error.",
                }
            )
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
