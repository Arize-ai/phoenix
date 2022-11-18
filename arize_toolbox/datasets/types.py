from dataclasses import dataclass
from typing import Dict, List, NamedTuple, Optional


class EmbeddingColumnNames(NamedTuple):
    """Represents an embedding feature - fields specify the columns holding
       the information associated with the embedding.

     Parameters
    ----------
    vector_column_name: string (required)
        Name of the column that holds the vectors of a given embedding feature.
    data_column_name: string (required)
        Name of the column that holds the raw data of a given embedding feature
        (typically the raw text associated with the embedding vector).
    link_to_data_column_name: string (required)
        Name of the column that holds the link to data of a given embedding feature
        (typically a link to the data file (image, audio, ...) associated
        with the embedding vector).
    """

    vector_column_name: str
    data_column_name: Optional[str] = None
    link_to_data_column_name: Optional[str] = None


@dataclass(frozen=True)
class Schema:
    prediction_id_column_name: str
    timestamp_column_name: Optional[str] = None
    feature_column_names: Optional[List[str]] = None
    prediction_label_column_name: Optional[str] = None
    prediction_score_column_name: Optional[str] = None
    actual_label_column_name: Optional[str] = None
    actual_score_column_name: Optional[str] = None
    embedding_feature_column_names: Optional[Dict[str, EmbeddingColumnNames]] = None
