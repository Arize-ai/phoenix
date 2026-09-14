import pytest

VALID_SPAN_KINDS = {"LLM", "RETRIEVER", "EMBEDDING", "CHAIN", "AGENT", "TOOL"}

def normalize_span_kind(kind: str) -> str:
    if not kind or not isinstance(kind, str):
        raise ValueError("Span kind must be non-empty string")
    k = kind.strip().upper()
    if k not in VALID_SPAN_KINDS:
        raise ValueError(f"Unknown span kind: {k}")
    return k

def test_valid_span_kinds():
    assert normalize_span_kind("llm") == "LLM"
    assert normalize_span_kind("  retriever  ") == "RETRIEVER"
    assert normalize_span_kind("AGENT") == "AGENT"

def test_invalid_span_kinds():
    with pytest.raises(ValueError, match="Unknown span kind"):
        normalize_span_kind("INVALID_KIND")
