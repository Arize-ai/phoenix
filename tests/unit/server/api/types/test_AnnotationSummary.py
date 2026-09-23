import math
from typing import cast

import pandas as pd

from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.LabelFraction import LabelFraction


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
