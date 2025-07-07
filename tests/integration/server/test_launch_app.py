import json
from secrets import token_hex
from typing import Any, Iterator, Mapping, Optional

import pandas as pd
import phoenix as px
import pytest
from _pytest.tmpdir import TempPathFactory
from faker import Faker
from opentelemetry.trace import format_span_id, format_trace_id
from pandas.core.dtypes.common import is_datetime64_any_dtype
from phoenix.trace.dsl import SpanQuery
from sqlalchemy import URL

from .._helpers import (
    _AppInfo,
    _get,
    _get_gql_spans,
    _grpc_span_exporter,
    _http_span_exporter,
    _random_schema,
    _server,
    _start_span,
)


@pytest.fixture
def _env_sql_database(
    _sql_database_url: URL,
    tmp_path_factory: TempPathFactory,
) -> Iterator[dict[str, str]]:
    if _sql_database_url.get_backend_name() == "sqlite":
        tmp = tmp_path_factory.mktemp(token_hex(8))
        database = str(tmp / "phoenix.db")
        _sql_database_url = URL.create("sqlite", database=database)
    env = {"PHOENIX_SQL_DATABASE_URL": _sql_database_url.render_as_string()}
    if not _sql_database_url.get_backend_name().startswith("postgresql"):
        yield env
    else:
        with _random_schema(_sql_database_url) as schema:
            yield {**env, "PHOENIX_SQL_DATABASE_SCHEMA": schema}


@pytest.fixture
def _env(
    _ports: Iterator[int],
    _env_sql_database: dict[str, str],
) -> dict[str, str]:
    return {
        **_env_sql_database,
        "PHOENIX_PORT": str(next(_ports)),
        "PHOENIX_GRPC_PORT": str(next(_ports)),
    }


class TestLaunchApp:
    async def test_send_spans(self, _env: Mapping[str, str], _fake: Faker) -> None:
        project_name = _fake.unique.pystr()
        span_names: set[str] = set()
        spans = []
        for i in range(2):
            with _server(_AppInfo(_env)) as app:
                for j, exporter in enumerate([_http_span_exporter, _grpc_span_exporter]):
                    span_name = f"{i}_{j}_{token_hex(8)}"
                    span_names.add(span_name)
                    spans.append(
                        _start_span(
                            project_name=project_name,
                            span_name=span_name,
                            exporter=exporter(app),
                            attributes={
                                "j": j if j % 2 else f"{j}",
                                "metadata": json.dumps({"j": j if j % 2 else {f"{j}": [j]}}),
                            },
                        )
                    )
                    spans[-1].end()

                def query_fn() -> Optional[list[dict[str, Any]]]:
                    ans = _get_gql_spans(app, None, "name").get(project_name)
                    if not ans or len(spans) != len(ans):
                        return None
                    return ans

                project = await _get(query_fn)
                gql_span_names = set(span["name"] for span in project)
                assert gql_span_names == span_names

                q = SpanQuery()
                results = px.Client(endpoint=app.base_url).query_spans(
                    q, q, project_name=project_name
                )
                assert isinstance(results, list)
                assert len(results) == 2
                for df in results:
                    assert isinstance(df, pd.DataFrame)
                    assert df.size
                    assert sorted(df.name) == sorted(span_names)
                    assert is_datetime64_any_dtype(df.start_time)
                    assert df.index.names == ["context.span_id"]
                    assert set(df.index) == {
                        format_span_id(span.get_span_context().span_id) for span in spans
                    }
                    assert set(df.loc[:, "context.trace_id"]) == {
                        format_trace_id(span.get_span_context().trace_id) for span in spans
                    }
                    assert set(df.parent_id) == {None}
                    assert set(df.loc[:, "attributes.j"]) == {"0", 1}
                    assert df.reset_index(drop=True).sort_values("start_time").loc[
                        :, "attributes.metadata"
                    ].to_list() == [
                        {"j": {"0": [0]}},
                        {"j": 1},
                    ] * (i + 1)
