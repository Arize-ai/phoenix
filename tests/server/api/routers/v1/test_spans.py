from random import getrandbits

from phoenix import Client, TraceDataset
from phoenix.trace.dsl import SpanQuery


def test_spans_with_docs(test_phoenix_clients, span_data_with_documents):
    sync_client, _ = test_phoenix_clients
    client = Client()
    client._client = sync_client
    df = client.get_spans_dataframe()
    new_ids = {span_id: getrandbits(64).to_bytes(8, "big").hex() for span_id in df.index}
    for span_id_col_name in ("context.span_id", "parent_id"):
        df.loc[:, span_id_col_name] = df.loc[:, span_id_col_name].map(new_ids.get)
    df = df.set_index("context.span_id", drop=False)
    doc_query = SpanQuery().explode("retrieval.documents", content="document.content")
    assert (_ := len(client.query_spans(doc_query)))
    client.log_traces(TraceDataset(df))
    # FIXME: lifespan is not working for Starlette, so span can't be inserted
    # assert (new_doc_count := len(client.query_spans(doc_query)))
    # assert new_doc_count == orig_doc_count * 2
