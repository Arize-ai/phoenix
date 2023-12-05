import pandas as pd
from phoenix.trace.span_evaluations import SpanEvaluations


def test_span_evaluations_construction():
    num_records = 5
    span_ids = [f"span_{index}" for index in range(num_records)]

    eval_ds = SpanEvaluations(
        eval_name="my_eval",
        dataframe=pd.DataFrame(
            {
                "context.span_id": span_ids,
                "label": [index for index in range(num_records)],
                "score": [index for index in range(num_records)],
                "random_column": [index for index in range(num_records)],
            }
        ).set_index("context.span_id"),
    )

    # make sure the dataframe only has the needed values
    assert "context.span_id" not in eval_ds.dataframe.columns
    assert "random_column" not in eval_ds.dataframe.columns
    assert "score" in eval_ds.dataframe.columns
