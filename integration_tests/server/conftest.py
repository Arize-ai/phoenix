import os
import tempfile
from typing import Iterator, List
from unittest import mock
from urllib.parse import urljoin

import pytest
from _pytest.monkeypatch import MonkeyPatch
from faker import Faker
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter as GRPCExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter as HTTPExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import Tracer
from phoenix.config import (
    ENV_PHOENIX_GRPC_PORT,
    ENV_PHOENIX_PORT,
    ENV_PHOENIX_WORKING_DIR,
    get_base_url,
    get_env_grpc_port,
    get_env_host,
)
from portpicker import pick_unused_port  # type: ignore[import-untyped]


@pytest.fixture(autouse=True)
def set_env_var(monkeypatch: Iterator[MonkeyPatch]) -> Iterator[None]:
    tmp = tempfile.TemporaryDirectory()
    values = (
        (ENV_PHOENIX_PORT, str(pick_unused_port())),
        (ENV_PHOENIX_GRPC_PORT, str(pick_unused_port())),
        (ENV_PHOENIX_WORKING_DIR, tmp.name),
    )
    try:
        with mock.patch.dict(os.environ, values):
            yield
    finally:
        try:
            # This is for Windows. In Python 3.10+, it's cleaner to use
            # `TemporaryDirectory(ignore_cleanup_errors=True)` instead.
            tmp.cleanup()
        except BaseException:
            pass


@pytest.fixture
def tracers(
    project_name: str,
    fake: Faker,
) -> List[Tracer]:
    host = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    grpc_endpoint = f"http://{host}:{get_env_grpc_port()}"
    http_endpoint = urljoin(get_base_url(), "v1/traces")
    tracers = []
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name})
    for exporter in (GRPCExporter(grpc_endpoint), HTTPExporter(http_endpoint)):
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
        tracers.append(tracer_provider.get_tracer(__name__))
    return tracers


@pytest.fixture
def fake() -> Faker:
    return Faker()


@pytest.fixture
def project_name(fake: Faker) -> str:
    return fake.pystr()
