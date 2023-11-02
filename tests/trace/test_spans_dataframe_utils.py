import pandas as pd
from phoenix.trace.spans_dataframe_utils import to_span_ids


def test_to_span_ids():
    # Create mock data
    spans_df = pd.DataFrame({"context.span_id": [1, 2, 3, 4], "other_column": ["a", "b", "c", "d"]})

    # Run the function
    result = to_span_ids(spans_df)

    # Check the output
    assert "other_column" not in result.columns
    assert "span_id" in result.columns
    assert result["span_id"].tolist() == [1, 2, 3, 4]
    assert result.columns.tolist() == ["span_id"]
    assert spans_df.columns.tolist() == ["context.span_id", "other_column"]
