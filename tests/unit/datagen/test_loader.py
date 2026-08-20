from pathlib import Path

from phoenix.datagen import load_corpus


def test_load_corpus_parses_local_fixture() -> None:
    corpus_path = Path(__file__).parent / "fixtures" / "corpus"

    corpus = load_corpus(corpus_path)

    assert corpus.manifest["scenario"] == "synthetic-chat"
    assert len(corpus.requests) == 3
    assert (
        sum(
            len(scope_spans.spans)
            for request in corpus.requests
            for resource_spans in request.resource_spans
            for scope_spans in resource_spans.scope_spans
        )
        == 4
    )
