from phoenix.server.app import _get_proxy_basename


def test_get_proxy_basename():
    assert _get_proxy_basename("proxy/6006/tracing") == "/proxy/6006"
    assert _get_proxy_basename("jupyter/default/proxy/6006") == "/jupyter/default/proxy/6006"
