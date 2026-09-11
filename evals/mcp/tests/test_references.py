from references import compute


def test_source_references_use_trace_groups_upserts_and_pinned_costs():
    def span(t, i, kind, name="Tool", error=False):
        return {
            "context": {"trace_id": t, "span_id": str(i)},
            "name": name,
            "span_kind": kind,
            "status_code": "ERROR" if error else "OK",
            "attributes": {"llm.model_name": "model", "llm.token_count.prompt": 2}
            if kind == "LLM"
            else {},
        }

    spans = [span("short", 1, "LLM"), span("short", 2, "TOOL", error=True)]
    spans += [span("long", i + 10, "TOOL", name="Repeated", error=i < 4) for i in range(40)]
    a = {"span_id": "2", "name": "trail_error", "identifier": "a", "result": {"label": "old"}}
    payload = {"spans": spans, "span_annotations": [a, a | {"result": {"label": "updated"}}]}
    refs = compute(payload, {"models": {"model": {"input": 1, "output": 2, "cache_read": 0.5}}})
    assert refs["count-traces"]["value"] == 2
    assert refs["total-cost"]["value"] == 2
    assert refs["error-rate-by-length"] == {"short": 50, "long": 10}
    assert refs["max-llm-calls"]["value"] == 1
    assert refs["repeated-tool-calls"] == {"winners": [["Repeated"]], "value": 40}
    assert refs["top-error-category"]["winners"] == [["updated"]]
    assert refs["spend-concentration"]["value"] == 100
