import sqlite3

import pytest

from smoke_gateway import local_tool
from smoke_target import Policy, scoped_sql


@pytest.mark.parametrize(
    "query",
    [
        "SELECT count(*) FROM traces",
        "WITH t AS (SELECT * FROM traces) SELECT count(*) FROM t",
        "SELECT count(*) FROM traces t JOIN projects p ON p.id=t.project_rowid",
        "SELECT count(*) FROM traces WHERE project_rowid != 2",
    ],
)
def test_sql_cannot_read_other_project(query):
    with sqlite3.connect(":memory:") as db:
        db.executescript(
            "CREATE TABLE projects(id INTEGER); "
            "CREATE TABLE traces(id INTEGER, project_rowid INTEGER); "
            "INSERT INTO projects VALUES(1),(2); "
            "INSERT INTO traces VALUES(1,1),(2,2),(3,2);"
        )
        assert db.execute(scoped_sql(query, 1)).fetchall() == [(1,)]


@pytest.mark.parametrize(
    "query",
    [
        "SELECT * FROM datasets",
        "SELECT * FROM main.traces",
        "SELECT * FROM traces UNION SELECT * FROM experiment_runs",
        "DELETE FROM traces",
        "SELECT * FROM traces; SELECT * FROM datasets",
        "WITH t AS (SELECT * FROM datasets) SELECT * FROM t",
    ],
)
def test_sql_forbidden_relations_and_writes(query):
    with pytest.raises(ValueError):
        scoped_sql(query, 1)


@pytest.fixture
def policy(tmp_path):
    dbpath = tmp_path / "unit.db"
    with sqlite3.connect(dbpath) as db:
        db.execute("CREATE TABLE projects(id INTEGER, name TEXT)")
        db.executemany("INSERT INTO projects VALUES(?,?)", [(1, "mcp-trail-gaia"), (2, "results")])
    # The full snapshot is covered by the live check; this unit test isolates
    # authorization and query rewriting without a Phoenix schema fixture.
    result = object.__new__(Policy)
    result.database = dbpath
    result.truth = {"project": "mcp-trail-gaia"}
    result.project_id = 1
    result.node_id = "UHJvamVjdDox"
    result.review = None
    result.span_nodes = set()
    return result


def test_graphql_scope_overrides_caller_filter_and_preserves_alias(policy):
    query = '{ mine: projects(filter:{col:name,value:"results"}) {edges{node{id name traceCount}}}}'
    scoped = policy.graphql({"query": query})["query"]
    assert 'value: "mcp-trail-gaia"' in scoped
    assert "mine: projects" in scoped


@pytest.mark.parametrize(
    "query, variables",
    [
        ('mutation { deleteProject(id:"UHJvamVjdDoy") { id }}', {}),
        ("{ datasets { edges { node { id } } } }", {}),
        ("query($id:ID!) {node(id:$id){id}}", {"id": "UHJvamVjdDoy"}),
        ("{ projects {edges{node{dataset{id}}}}}", {}),
        ("{projects {...Secrets}} fragment Secrets on ProjectConnection {edges{node{id}}}", {}),
    ],
)
def test_graphql_forbidden_access(policy, query, variables):
    with pytest.raises(ValueError):
        policy.graphql({"query": query, "variables": variables})


def test_native_tool_namespaces_preserve_hosted_tool_boundary():
    assert local_tool({"type": "namespace", "tools": [{"type": "function"}]})
    assert local_tool({"type": "tool_search", "execution": "client"})
    assert not local_tool({"type": "namespace", "tools": [{"type": "web_search"}]})
    assert not local_tool({"type": "tool_search", "execution": "server"})
    assert not local_tool({"type": "mcp", "server_url": "https://example.com"})
    assert not local_tool({"type": "shell", "environment": {"type": "container_auto"}})
