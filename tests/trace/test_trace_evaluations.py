from collections import OrderedDict

import numpy as np
import pandas as pd
from phoenix.trace.trace_evaluations import (
    TraceEvaluations,
    binary_classifications_to_trace_evaluations,
)


def test_binary_classifications_to_trace_evaluations():
    # Create mock data
    eval_name = "toxicity"
    classifications_df = pd.DataFrame(
        {
            "context.span_id": ["a", "b", "c", "d", "e"],
            "label": ["toxic", "non-toxic", "toxic", "non-toxic", "unparsable"],
        },
    ).set_index("context.span_id")
    rails_map = OrderedDict({True: "toxic", False: "non-toxic"})

    # Run the function
    result = binary_classifications_to_trace_evaluations(eval_name, classifications_df, rails_map)

    # Check the output
    assert isinstance(result, TraceEvaluations)
    assert result.eval_name == eval_name
    assert "other_column" not in result.dataframe.columns
    assert "value" in result.dataframe.columns
    print(result.dataframe["value"].tolist())
    assert np.array_equal(result.dataframe["value"].tolist(), [1, 0, 1, 0, np.nan], equal_nan=True)
