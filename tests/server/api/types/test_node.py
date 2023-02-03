from phoenix.server.api.types.node import from_global_id, to_global_id


def test_serialization():
    global_id = to_global_id("Dimension", 1)
    type_name, node_id = from_global_id(global_id)

    assert type_name == "Dimension"
    assert node_id == 1
