import os
from time import sleep
from typing import Set

from faker import Faker

from .._helpers import (
    _get_gql_spans,
    _grpc_span_exporter,
    _http_span_exporter,
    _server,
    _start_span,
)


class TestLaunchApp:
    def test_send_spans(self, _fake: Faker) -> None:
        if (url := os.environ.get("PHOENIX_SQL_DATABASE_URL")) and ":memory:" in url:
            # This test is not intended for an in-memory databases.
            os.environ.pop("PHOENIX_SQL_DATABASE_URL", None)
        project_name = _fake.unique.pystr()
        span_names: Set[str] = set()
        for i in range(2):
            with _server():
                for j, exporter in enumerate([_http_span_exporter, _grpc_span_exporter]):
                    span_name = f"{i}_{j}_{_fake.unique.pystr()}"
                    span_names.add(span_name)
                    _start_span(
                        project_name=project_name,
                        span_name=span_name,
                        exporter=exporter(),
                    ).end()
                sleep(2)
                project = _get_gql_spans(None, "name")[project_name]
                gql_span_names = set(span["name"] for span in project)
                assert gql_span_names == span_names
