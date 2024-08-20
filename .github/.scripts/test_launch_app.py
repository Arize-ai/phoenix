import json
import os
import sys
from queue import SimpleQueue
from random import random
from subprocess import PIPE
from threading import Thread
from time import sleep, time
from typing import Any, Dict, List, Tuple
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from openinference.semconv.resource import ResourceAttributes
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter as GRPCExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter as HTTPExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from portpicker import pick_unused_port  # type: ignore[import-untyped]
from psutil import Popen

from phoenix.config import ENV_PHOENIX_GRPC_PORT, ENV_PHOENIX_PORT

host = "127.0.0.1"
http_port = str(pick_unused_port())
grpc_port = str(pick_unused_port())
env = {
    **os.environ,
    ENV_PHOENIX_PORT: http_port,
    ENV_PHOENIX_GRPC_PORT: grpc_port,
}
base_url = f"http://{host}:{http_port}"
http_endpoint = urljoin(base_url, "v1/traces")
grpc_endpoint = f"http://{host}:{grpc_port}"


def capture_stdout(process: Popen, log: "SimpleQueue[str]") -> None:
    while True:
        log.put(process.stdout.readline())


def launch() -> Tuple[Popen, "SimpleQueue[str]"]:
    command = f"{sys.executable} -m phoenix.server.main --no-ui serve"
    process = Popen(command.split(), stdout=PIPE, stderr=PIPE, text=True, env=env)
    log: "SimpleQueue[str]" = SimpleQueue()
    Thread(target=capture_stdout, args=(process, log), daemon=True).start()
    t = 60
    time_limit = time() + t
    timed_out = False
    url = urljoin(base_url, "healthz")
    while not timed_out:
        sleep(0.1)
        try:
            urlopen(url)
            break
        except BaseException:
            timed_out = time() > time_limit
    while not log.empty():
        print(log.get(), end="")
    if timed_out:
        raise TimeoutError(f"Server did not start within {t} seconds.")
    return process, log


tracers = []
project_name = str(random())
resource = Resource({ResourceAttributes.PROJECT_NAME: project_name})
for exporter in (HTTPExporter(http_endpoint), GRPCExporter(grpc_endpoint)):
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracers.append(tracer_provider.get_tracer(__name__))

query = dict(query="query{projects{edges{node{name spans{edges{node{name}}}}}}}")
request = Request(
    method="POST",
    url=urljoin(base_url, "graphql"),
    data=json.dumps(query).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)

CYCLES = 2
span_names: List[str] = []
response: Dict[str, Any] = {}
for _ in range(CYCLES):
    process, stdout = launch()
    for tracer in tracers:
        span_names.append(str(random()))
        tracer.start_span(span_names[-1]).end()
    sleep(2)
    try:
        response = json.loads(urlopen(request).read().decode("utf-8"))
        assert not response.get("errors")
        assert sorted(
            span["node"]["name"]
            for project in response["data"]["projects"]["edges"]
            for span in project["node"]["spans"]["edges"]
            if project["node"]["name"] == project_name
        ) == sorted(span_names)
        process.terminate()
        process.wait(10)
    finally:
        while not stdout.empty():
            print(stdout.get(), end="")
        print(f"{response=}")
