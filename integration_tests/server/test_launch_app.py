import json
from random import random
from time import sleep
from typing import Callable, ContextManager, List
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import pytest
from opentelemetry.trace import Tracer


@pytest.fixture
def req(base_url: str) -> Request:
    query = dict(query="query{projects{edges{node{name spans{edges{node{name}}}}}}}")
    return Request(
        method="POST",
        url=urljoin(base_url, "graphql"),
        data=json.dumps(query).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )


def test_launch_app(
    app: Callable[[], ContextManager[None]],
    tracers: List[Tracer],
    project_name: str,
    base_url: str,
    req: Request,
) -> None:
    CYCLES = 2
    span_names: List[str] = []
    for _ in range(CYCLES):
        with app():
            for tracer in tracers:
                span_names.append(str(random()))
                tracer.start_span(span_names[-1]).end()
            sleep(2)
            response = urlopen(req)
            response_dict = json.loads(response.read().decode("utf-8"))
            assert response_dict
            print(f"{response_dict=}")
            assert not response_dict.get("errors")
            assert sorted(
                span["node"]["name"]
                for project in response_dict["data"]["projects"]["edges"]
                for span in project["node"]["spans"]["edges"]
                if project["node"]["name"] == project_name
            ) == sorted(span_names)
