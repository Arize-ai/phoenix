from phoenix.server.app import _get_databricks_basename


def test_databricks_basename_parsing():
    assert (
        _get_databricks_basename(
            "https://dbc-dp-1018391329803962.cloud.databricks.com/driver-proxy/o/1018391329803962/0112-220452-osc8oiar/6007/tracing"
        )
        == "/driver-proxy/o/1018391329803962/0112-220452-osc8oiar/6007/"
    )
    assert (
        _get_databricks_basename(
            "https://dbc-dp-1018391329803962.cloud.databricks.com/driver-proxy/o/1018391329803962/0112-220452-osc8oiar/6007/"
        )
        == "/driver-proxy/o/1018391329803962/0112-220452-osc8oiar/6007/"
    )
