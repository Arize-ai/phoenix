import math
from typing import cast

import pandas as pd
import strawberry

from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.EvaluationSummary import EvaluationSummary
from phoenix.server.api.types.LabelFraction import LabelFraction


def test_summary_counts_serialize_as_graphql_integers() -> None:
    @strawberry.type
    class Query:
        annotation: AnnotationSummary
        evaluation: EvaluationSummary

    dataframe = pd.DataFrame({"record_count": [2, 3], "score_count": [1, 2], "label_count": [2, 2]})
    schema = strawberry.Schema(query=Query)
    result = schema.execute_sync(
        "{ annotation { count scoreCount labelCount } evaluation { count scoreCount labelCount } }",
        root_value=Query(
            annotation=AnnotationSummary(name="overall", df=dataframe),
            evaluation=EvaluationSummary(dataframe),
        ),
    )
    assert not result.errors
    expected = {"count": 5, "scoreCount": 3, "labelCount": 4}
    assert result.data == {"annotation": expected, "evaluation": expected}


def test_label_fractions_ignore_nan_label() -> None:
    summary = AnnotationSummary(
        name="overall",
        df=pd.DataFrame(
            [
                {"label": "pass", "avg_label_fraction": 1.0},
                # The metrics query uses this row for coverage rather than a label.
                {"label": math.nan, "avg_label_fraction": math.nan},
            ]
        ),
    )

    label_fractions = cast(
        list[LabelFraction],
        summary.label_fractions(),  # type: ignore[call-arg]
    )
    assert [
        (label_fraction.label, label_fraction.fraction) for label_fraction in label_fractions
    ] == [("pass", 1.0)]
