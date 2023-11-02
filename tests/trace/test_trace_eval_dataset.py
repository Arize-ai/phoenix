from collections import OrderedDict

import numpy as np
import pandas as pd
from phoenix.trace.trace_eval_dataset import (
    TraceEvalDataset,
    binary_classifications_to_trace_eval_dataset,
)


def test_binary_classifications_to_trace_eval_dataset():
    # Create mock data
    eval_name = "toxicity"
    classifications_df = pd.DataFrame(
        {"label": ["toxic", "non-toxic", "toxic", "non-toxic", "unparsable"]}
    )
    spans_df = pd.DataFrame({"span_id": [1, 2, 3, 4, 5], "other_column": ["a", "b", "c", "d", "e"]})
    rails_map = OrderedDict({True: "toxic", False: "non-toxic"})

    # Run the function
    result = binary_classifications_to_trace_eval_dataset(
        eval_name, classifications_df, spans_df, rails_map
    )

    # Check the output
    assert isinstance(result, TraceEvalDataset)
    assert result.eval_name == eval_name
    assert "other_column" not in result.dataframe.columns
    assert "value" in result.dataframe.columns
    print(result.dataframe["value"].tolist())
    assert np.array_equal(result.dataframe["value"].tolist(), [1, 0, 1, 0, np.nan], equal_nan=True)

    # Check that the spans_df is unchanged
    assert "other_column" in spans_df.columns
