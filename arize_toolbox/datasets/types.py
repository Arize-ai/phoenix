from dataclasses import dataclass
from typing import Optional, List

@dataclass(frozen=True)
class Schema:
    prediction_id_column_name: str
    timestamp_column_name: Optional[str] = None
    feature_column_names: Optional[List[str]] = None
    prediction_label_column_name: Optional[str] = None
    prediction_score_column_name: Optional[str] = None
    actual_label_column_name: Optional[str] = None
    actual_score_column_name: Optional[str] = None
