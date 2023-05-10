import phoenix.core.model_schema as ms
from phoenix.core.model_schema import FEATURE
from phoenix.server.api.types.Dimension import Dimension
from phoenix.server.api.types.pagination import ConnectionArgs, connection_from_list


def test_connection_from_list():
    dimensions = [
        Dimension(
            id_attr=0,
            name="first",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
        Dimension(
            id_attr=1,
            name="second",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
        Dimension(
            id_attr=2,
            name="third",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
    ]
    connection = connection_from_list(dimensions, ConnectionArgs(first=2))

    # Check that the connection has the correct number of edges and that it has a next page
    assert len(connection.edges) == 2
    assert connection.page_info.has_next_page is True

    # Check that the connection can be paged forward
    next_connection = connection_from_list(
        dimensions, ConnectionArgs(first=2, after=connection.page_info.end_cursor)
    )
    assert len(next_connection.edges) == 1
    assert next_connection.page_info.has_next_page is False


def test_connection_from_list_reverse():
    dimensions = [
        Dimension(
            id_attr=0,
            name="first",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
        Dimension(
            id_attr=1,
            name="second",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
        Dimension(
            id_attr=2,
            name="third",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
    ]
    connection = connection_from_list(dimensions, ConnectionArgs(last=2))

    # Check that the connection has the correct number of edges and that it has a previous page
    assert len(connection.edges) == 2
    assert connection.page_info.has_previous_page is True
    assert connection.page_info.has_next_page is False

    # Check that the connection can be paged backwards
    next_connection = connection_from_list(
        dimensions, ConnectionArgs(last=2, before=connection.page_info.start_cursor)
    )
    assert len(next_connection.edges) == 1
    assert next_connection.page_info.has_previous_page is False


def test_connection_from_empty_list():
    connection = connection_from_list([], ConnectionArgs(first=2))

    assert len(connection.edges) == 0
    assert connection.page_info.has_next_page is False
