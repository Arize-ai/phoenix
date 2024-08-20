import os
import sys
import tempfile
from contextlib import ExitStack, contextmanager
from queue import SimpleQueue
from subprocess import PIPE, STDOUT
from threading import Thread
from time import sleep, time
from typing import Callable, ContextManager, Iterator, List
from unittest import mock
from urllib.parse import urljoin
from urllib.request import urlopen

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
from psutil import STATUS_ZOMBIE, Popen


@pytest.fixture(autouse=True)
def set_env_var(monkeypatch: Iterator[MonkeyPatch]) -> Iterator[None]:
    with ExitStack() as stack:
        tmp = stack.enter_context(tempfile.TemporaryDirectory())
        patch_env = mock.patch.dict(
            os.environ,
            (
                (ENV_PHOENIX_PORT, str(pick_unused_port())),
                (ENV_PHOENIX_GRPC_PORT, str(pick_unused_port())),
                (ENV_PHOENIX_WORKING_DIR, tmp),
            ),
        )
        stack.enter_context(patch_env)
        yield


@pytest.fixture
def app(base_url: str) -> Callable[[], ContextManager[None]]:
    @contextmanager
    def _() -> Iterator[None]:
        with launch(base_url):
            yield

    return _


@contextmanager
def launch(base_url: str) -> Iterator[None]:
    command = f"{sys.executable} -m phoenix.server.main --no-ui serve"
    process = Popen(command.split(), stdout=PIPE, stderr=STDOUT, text=True, env=os.environ)
    log: "SimpleQueue[str]" = SimpleQueue()
    Thread(target=capture_stdout, args=(process, log), daemon=True).start()
    t = 60
    time_limit = time() + t
    timed_out = False
    url = urljoin(base_url, "healthz")
    while not timed_out and is_alive(process):
        sleep(0.1)
        try:
            urlopen(url)
            break
        except BaseException:
            timed_out = time() > time_limit
    try:
        if timed_out:
            raise TimeoutError(f"Server did not start within {t} seconds.")
        assert is_alive(process)
        yield
        process.terminate()
        process.wait(10)
    finally:
        logs = []
        while not log.empty():
            # For unknown reasons, this hangs if we try to print immediately
            # after `get()`, so we collect the lines and print them later.
            logs.append(log.get())
        for line in logs:
            print(line, end="")


@pytest.fixture
def tracers(
    base_url: str,
    project_name: str,
    fake: Faker,
) -> List[Tracer]:
    http_endpoint = urljoin(base_url, "v1/traces")
    grpc_endpoint = f"http://{get_env_host()}:{get_env_grpc_port()}"
    tracers = []
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name})
    for exporter in (HTTPExporter(http_endpoint), GRPCExporter(grpc_endpoint)):
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
        tracers.append(tracer_provider.get_tracer(__name__))
    return tracers


@pytest.fixture
def base_url() -> str:
    return get_base_url()


@pytest.fixture
def fake() -> Faker:
    return Faker()


@pytest.fixture
def project_name(fake: Faker) -> str:
    return fake.pystr()


def is_alive(process: Popen) -> bool:
    return process.is_running() and process.status() != STATUS_ZOMBIE


def capture_stdout(process: Popen, log: "SimpleQueue[str]") -> None:
    while True:
        log.put(process.stdout.readline())
