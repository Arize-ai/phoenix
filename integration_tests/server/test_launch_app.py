import json
import os
import sys
from contextlib import contextmanager
from queue import SimpleQueue
from subprocess import PIPE, STDOUT
from threading import Thread
from time import sleep, time
from typing import Any, Dict, Iterator, List, Optional, Set
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import pytest
from faker import Faker
from opentelemetry.trace import Tracer
from phoenix.config import get_base_url
from psutil import STATUS_ZOMBIE, Popen


@pytest.fixture
def req() -> Request:
    query = dict(query="query{projects{edges{node{name spans{edges{node{name}}}}}}}")
    return Request(
        method="POST",
        url=urljoin(get_base_url(), "graphql"),
        data=json.dumps(query).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )


def test_launch_app(
    tracers: List[Tracer],
    project_name: str,
    req: Request,
    fake: Faker,
) -> None:
    cycles = 2
    span_names: Set[str] = set()
    for _ in range(cycles):
        response_dict: Optional[Dict[str, Any]] = None
        with launch():
            for tracer in tracers:
                name = fake.pystr()
                span_names.add(name)
                tracer.start_span(name).end()
            sleep(2)
            response = urlopen(req)
            response_dict = json.loads(response.read().decode("utf-8"))
            assert response_dict
            assert not response_dict.get("errors")
            assert {
                span["node"]["name"]
                for project in response_dict["data"]["projects"]["edges"]
                for span in project["node"]["spans"]["edges"]
                if project["node"]["name"] == project_name
            } == span_names
        print(f"{response_dict=}")


@contextmanager
def launch() -> Iterator[None]:
    command = f"{sys.executable} -m phoenix.server.main --no-ui serve"
    process = Popen(command.split(), stdout=PIPE, stderr=STDOUT, text=True, env=os.environ)
    log: "SimpleQueue[str]" = SimpleQueue()
    Thread(target=capture_stdout, args=(process, log), daemon=True).start()
    t = 60
    time_limit = time() + t
    timed_out = False
    url = urljoin(get_base_url(), "healthz")
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


def is_alive(process: Popen) -> bool:
    return process.is_running() and process.status() != STATUS_ZOMBIE


def capture_stdout(process: Popen, log: "SimpleQueue[str]") -> None:
    while True:
        log.put(process.stdout.readline())
