from phoenix.server.telemetry import normalize_http_collector_endpoint


def test_normalize_http_collector_endpoint():
    assert normalize_http_collector_endpoint("http://localhost:4317") == "http://localhost:4317"
    assert normalize_http_collector_endpoint("https://localhost:4317") == "https://localhost:4317"
    assert normalize_http_collector_endpoint("localhost:4317") == "http://localhost:4317"
    assert (
        normalize_http_collector_endpoint("http://localhost:4317/v1/traces")
        == "http://localhost:4317"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4317/v1/traces")
        == "https://localhost:4317"
    )
    assert normalize_http_collector_endpoint("localhost:4317/v1/traces") == "http://localhost:4317"
    assert (
        normalize_http_collector_endpoint("https://localhost:4318", "v1/traces")
        == "https://localhost:4318/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4318/otlp", "v1/traces")
        == "https://localhost:4318/otlp/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4318/otlp/v1/traces", "v1/traces")
        == "https://localhost:4318/otlp/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4318/otlp///", "v1/metrics")
        == "https://localhost:4318/otlp/v1/metrics"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4318/v1/traces", "v1/traces")
        == "https://localhost:4318/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4318/v1/metrics", "v1/traces")
        == "https://localhost:4318/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4318/v1/traces///", "v1/metrics")
        == "https://localhost:4318/v1/metrics"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4318/otlp/v1/metrics//", "v1/traces")
        == "https://localhost:4318/otlp/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4318/otlp/v1/traces", "v1/metrics")
        == "https://localhost:4318/otlp/v1/metrics"
    )
    assert (
        normalize_http_collector_endpoint("localhost:4318", "v1/traces")
        == "http://localhost:4318/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("localhost:4318/otlp", "v1/traces")
        == "http://localhost:4318/otlp/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("localhost:4318/otlp/v1/traces", "v1/traces")
        == "http://localhost:4318/otlp/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("localhost:4318/otlp///", "v1/metrics")
        == "http://localhost:4318/otlp/v1/metrics"
    )
    assert (
        normalize_http_collector_endpoint("localhost:4318/v1/metrics", "v1/metrics")
        == "http://localhost:4318/v1/metrics"
    )
    assert (
        normalize_http_collector_endpoint("localhost:4318/v1/metrics", "v1/traces")
        == "http://localhost:4318/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("localhost:4318/v1/traces///", "v1/metrics")
        == "http://localhost:4318/v1/metrics"
    )
    assert (
        normalize_http_collector_endpoint("localhost:4318/otlp/v1/metrics//", "v1/traces")
        == "http://localhost:4318/otlp/v1/traces"
    )
    assert (
        normalize_http_collector_endpoint("localhost:4318/otlp/v1/traces", "v1/metrics")
        == "http://localhost:4318/otlp/v1/metrics"
    )
