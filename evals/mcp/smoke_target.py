"""Run the native Phoenix dev server with a read-only, fixture-scoped smoke boundary.

Uses the shared database. No copied database, altered schema, or replacement MCP
tool definitions. The boundary applies to nested code-mode tool dispatch too.
This initial boundary admits only the tracing reads needed by the count task.
"""

from __future__ import annotations

import argparse
import base64
import dataclasses
import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote

from fastmcp.exceptions import ToolError
from fastmcp.server.middleware import Middleware
from graphql import parse as parse_graphql
from graphql import print_ast, value_from_ast_untyped
from graphql.language import ast
from sqlglot import exp, parse, parse_one
from sqlglot.optimizer.scope import traverse_scope
from starlette.responses import JSONResponse

from smoke_state import snapshot


def scoped_sql(sql: str, project_id: int, review: dict | None = None) -> str:
    statements = parse(sql, read="sqlite")
    if len(statements) != 1:
        raise ValueError("Only one SQL statement is available")
    root = statements[0]
    if not isinstance(root, exp.Query):
        raise ValueError("Only read-only tracing SQL is available")
    physical = []
    predicates = {
        "projects": f"id = {int(project_id)}",
        "traces": f"project_rowid = {int(project_id)}",
        "spans": f"trace_rowid IN (SELECT id FROM traces WHERE project_rowid = {int(project_id)})",
        "span_annotations": (
            "span_rowid IN (SELECT id FROM spans WHERE trace_rowid IN "
            f"(SELECT id FROM traces WHERE project_rowid = {int(project_id)}))"
        ),
    }
    if review:
        dataset_id = int(base64.b64decode(review["dataset_id"]).decode().split(":")[1])
        experiment_id = int(base64.b64decode(review["experiment_id"]).decode().split(":")[1])
        predicates |= {
            "datasets": f"id = {dataset_id}",
            "dataset_versions": f"dataset_id = {dataset_id}",
            "dataset_examples": f"dataset_id = {dataset_id}",
            "dataset_example_revisions": (
                "dataset_example_id IN (SELECT id FROM dataset_examples "
                f"WHERE dataset_id = {dataset_id})"
            ),
            "experiments": f"id = {experiment_id}",
            "experiment_runs": f"experiment_id = {experiment_id}",
            "experiment_run_annotations": (
                "experiment_run_id IN (SELECT id FROM experiment_runs "
                f"WHERE experiment_id = {experiment_id})"
            ),
        }
    for scope in traverse_scope(root):
        for _, source in scope.selected_sources.values():
            if isinstance(source, exp.Table):
                physical.append(source)
    for table in physical:
        if table.db or table.catalog or table.name not in predicates:
            raise ValueError("SQL relation is outside the smoke fixture")
        subquery = parse_one(
            f"SELECT * FROM {table.name} WHERE {predicates[table.name]}", read="sqlite"
        ).subquery(alias=table.alias_or_name)
        table.replace(subquery)
    return root.sql(dialect="sqlite")


class Policy:
    def __init__(self, database: Path, truth: dict, audit: Path):
        self.database, self.truth, self.audit = database, truth, audit
        self.state = snapshot(database, truth["project"])
        self.project_id = self.state["project_id"]
        self.node_id = base64.b64encode(f"Project:{self.project_id}".encode()).decode()
        review_path = audit.parent / "review-fixture.json"
        self.review = json.loads(review_path.read_text()) if review_path.exists() else None
        with sqlite3.connect(f"file:{database}?mode=ro", uri=True) as conn:
            self.span_nodes = {
                base64.b64encode(f"Span:{row[0]}".encode()).decode()
                for row in conn.execute(
                    "SELECT s.id FROM spans s JOIN traces t ON t.id=s.trace_rowid "
                    "WHERE t.project_rowid=?",
                    (self.project_id,),
                )
            }

    def log(self, kind: str, **fields):
        with self.audit.open("a") as stream:
            stream.write(json.dumps({"kind": kind, **fields}) + "\n")

    def graphql(self, payload: dict) -> dict:
        document = parse_graphql(payload["query"])
        variables = payload.get("variables") or {}
        permitted = {
            "projects",
            "node",
            "id",
            "name",
            "traceCount",
            "traces",
            "traceId",
            "edges",
            "pageInfo",
            "endCursor",
            "startCursor",
            "hasNextPage",
            "hasPreviousPage",
            "__typename",
            "startTime",
            "endTime",
            "cursor",
            "datasetVersionId",
            "datasetId",
            "exampleCount",
            "runCount",
            "errorRate",
            "averageRunLatencyMs",
            "successfulRunCount",
            "failedRunCount",
            "repetitions",
            "description",
            "createdAt",
            "updatedAt",
            "spanId",
            "spanAnnotations",
            "label",
            "score",
            "explanation",
            "annotatorKind",
            "identifier",
            "runs",
            "datasetExampleId",
            "datasetExample",
            "datasetVersion",
            "dataset",
            "example",
            "error",
            "output",
            "input",
            "repetitionNumber",
            "context",
        }
        if not self.review:
            permitted -= {"dataset", "datasetVersion", "datasetExample", "runs", "example"}

        def check(selection):
            if isinstance(selection, ast.FieldNode):
                name = selection.name.value
                if name not in permitted:
                    raise ValueError(f"GraphQL field outside count scope: {name}")
                if name == "node" and selection.arguments:
                    values = {
                        a.name.value: value_from_ast_untyped(a.value, variables)
                        for a in selection.arguments
                    }
                    allowed_ids = {self.node_id} | self.span_nodes
                    if self.review:
                        allowed_ids |= {
                            self.review["dataset_id"],
                            self.review["experiment_id"],
                            self.review["dataset_version_id"],
                        }
                    if set(values) != {"id"} or values["id"] not in allowed_ids:
                        raise ValueError(
                            "Only fixture project, dataset and experiment nodes are available"
                        )
                if name == "projects":
                    # The native filter is substring based. Fail if it would match
                    # any other project, then inject the fixture filter.
                    import sqlite3

                    with sqlite3.connect(f"file:{self.database}?mode=ro", uri=True) as conn:
                        matches = conn.execute(
                            "SELECT id FROM projects WHERE name LIKE ?",
                            (f"%{self.truth['project']}%",),
                        ).fetchall()
                    if matches != [(self.project_id,)]:
                        raise ValueError("Project filter is no longer uniquely scoped")
                    arg = (
                        parse_graphql(
                            "{projects(filter:{col:name,value:"
                            + json.dumps(self.truth["project"])
                            + "}){edges{node{id}}}}"
                        )
                        .definitions[0]
                        .selection_set.selections[0]
                        .arguments[0]
                    )
                    selection.arguments = tuple(
                        a for a in selection.arguments if a.name.value != "filter"
                    ) + (arg,)
            elif not isinstance(selection, ast.InlineFragmentNode):
                raise ValueError("Named fragments are not admitted by this smoke boundary")
            if selection.selection_set:
                for child in selection.selection_set.selections:
                    check(child)

        for definition in document.definitions:
            if (
                not isinstance(definition, ast.OperationDefinitionNode)
                or definition.operation.value != "query"
            ):
                raise ValueError("Only GraphQL queries are available")
            for field in definition.selection_set.selections:
                if isinstance(field, ast.FieldNode) and field.name.value in {
                    "__schema",
                    "__type",
                    "__typename",
                }:
                    # Schema introspection has no user-data resolvers.
                    continue
                if not isinstance(field, ast.FieldNode) or field.name.value not in {
                    "projects",
                    "node",
                }:
                    raise ValueError("Only fixture project queries are available")
                check(field)
        return payload | {"query": print_ast(document)}


class TargetBoundary:
    def __init__(self, app, policy: Policy):
        self.app, self.policy = app, policy

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path, method = unquote(scope["path"]), scope["method"]
        try:
            if path in {"/mcp", "/mcp/", "/healthz"}:
                return await self.app(scope, receive, send)
            if path == "/graphql" and method == "POST":
                body = b""
                while True:
                    chunk = await receive()
                    body += chunk.get("body", b"")
                    if len(body) > 100_000:
                        raise ValueError("GraphQL request too large")
                    if not chunk.get("more_body"):
                        break
                data = json.dumps(self.policy.graphql(json.loads(body))).encode()
                scope = dict(
                    scope, headers=[(k, v) for k, v in scope["headers"] if k != b"content-length"]
                )

                async def replacement():
                    return {"type": "http.request", "body": data, "more_body": False}

                self.policy.log("graphql", query=json.loads(data)["query"])
                return await self.app(scope, replacement, send)
            if method != "GET":
                raise ValueError("The smoke target is read-only")
            parts = path.strip("/").split("/")
            if parts == ["v1", "projects"] or (parts == ["v1", "datasets"] and self.policy.review):
                messages: list[dict[str, Any]] = []
                inner_scope = dict(
                    scope, headers=[(k, v) for k, v in scope["headers"] if k != b"accept-encoding"]
                )
                await self.app(inner_scope, receive, self._collector(messages))
                body = b"".join(message.get("body", b"") for message in messages)
                payload = json.loads(body)
                key = "name" if parts[1] == "projects" else "id"
                if parts[1] == "projects":
                    expected = self.policy.truth["project"]
                else:
                    assert self.policy.review is not None
                    expected = self.policy.review["dataset_id"]
                payload["data"] = [p for p in payload["data"] if p[key] == expected]
                response = JSONResponse(payload)
                return await response(scope, receive, send)
            allowed = False
            if len(parts) >= 3 and parts[:2] == ["v1", "projects"]:
                allowed = parts[2] in {
                    self.policy.truth["project"],
                    self.policy.node_id,
                    str(self.policy.project_id),
                } and (
                    len(parts) == 3
                    or parts[3] in {"spans", "traces", "span_annotations", "trace_annotations"}
                )
            if len(parts) >= 3 and parts[:2] == ["v1", "traces"]:
                allowed = parts[2] in self.policy.truth["trace_ids"]
            if len(parts) >= 3 and parts[:2] == ["v1", "spans"]:
                allowed = parts[2] in self.policy.truth["span_ids"]
            review = self.policy.review
            if review and len(parts) >= 3:
                if parts[:2] == ["v1", "datasets"]:
                    allowed = parts[2] == review["dataset_id"] and (
                        len(parts) == 3
                        or (len(parts) == 4 and parts[3] in {"examples", "versions", "experiments"})
                    )
                    params = parse_qs(scope.get("query_string", b"").decode())
                    if "version_id" in params and params["version_id"] != [
                        review["dataset_version_id"]
                    ]:
                        allowed = False
                elif parts[:2] == ["v1", "experiments"]:
                    allowed = parts[2] == review["experiment_id"] and (
                        len(parts) == 3 or (len(parts) == 4 and parts[3] in {"runs", "json"})
                    )
            if not allowed:
                raise ValueError("Route is outside the fixture tracing scope")
            self.policy.log("rest", path=path)
            return await self.app(scope, receive, send)
        except ValueError as exc:
            self.policy.log("denied", path=path, reason=str(exc))
            return await JSONResponse({"error": str(exc)}, status_code=403)(scope, receive, send)

    @staticmethod
    def _collector(messages):
        async def collect(message):
            messages.append(message)

        return collect


class ToolBoundary(Middleware):
    def __init__(self, policy: Policy):
        self.policy = policy

    async def on_call_tool(self, context, call_next):
        name = context.message.name
        args = context.message.arguments or {}
        if name == "executeSql":
            if "sql" not in args:
                # Let the native validator report missing arguments. A malformed
                # call is not an attempt to access a forbidden resource.
                return await call_next(context)
            try:
                args = args | {
                    "sql": scoped_sql(args["sql"], self.policy.project_id, self.policy.review)
                }
            except (ValueError, KeyError) as exc:
                self.policy.log("denied", tool=name, reason=str(exc))
                raise ToolError(str(exc)) from exc
            self.policy.log("sql", sql=args["sql"])
            message = context.message.model_copy(update={"arguments": args})
            context = dataclasses.replace(context, message=message)
        return await call_next(context)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--truth", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--port", type=int, default=6007)
    args = parser.parse_args()
    database = Path.home() / ".phoenix/phoenix.db"
    policy = Policy(database, json.loads(args.truth.read_text()), args.audit)
    import phoenix.server.app as application
    from phoenix.config import get_env_mcp_code_mode
    from phoenix.server.mcp_server import build_phoenix_mcp_server

    def build(app, *, monty_runtime=None, db):
        mcp, sandbox = build_phoenix_mcp_server(
            app, monty_runtime=monty_runtime, code_mode=get_env_mcp_code_mode(), db=db
        )
        mcp.add_middleware(ToolBoundary(policy))
        return mcp.http_app(path="/"), sandbox

    original = application.create_app

    def create_app(*a, **kw):
        app = original(*a, **kw)
        from phoenix.server.authorization import prevent_access_in_read_only_mode

        # Phoenix's read-only switch also blocks GET REST routes. Keep its
        # background writers disabled; the outer boundary admits scoped GETs
        # and rejects mutations before dispatch reaches this dependency.
        app.dependency_overrides[prevent_access_in_read_only_mode] = lambda: None
        app.add_middleware(TargetBoundary, policy=policy)
        return app

    application.create_phoenix_mcp_app = build
    application.create_app = create_app
    os.environ.pop("PHOENIX_WORKING_DIR", None)
    os.environ["PHOENIX_DANGEROUSLY_DISABLE_MIGRATIONS"] = "true"
    os.environ["PHOENIX_DISABLE_AGENT_ASSISTANT"] = "true"
    os.environ["PHOENIX_TELEMETRY_ENABLED"] = "false"
    from phoenix.server.main import main as serve

    sys.argv = [
        "phoenix",
        "serve",
        "--read-only",
        "--dev",
        "--no-ui",
        "--port",
        str(args.port),
        "--host",
        "0.0.0.0",
        "--grpc-port",
        "0",
    ]
    serve()


if __name__ == "__main__":
    main()
