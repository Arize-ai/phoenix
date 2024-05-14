import json
from abc import ABC
from dataclasses import dataclass, field
from itertools import product
from pathlib import Path
from types import MappingProxyType
from typing import Any, Callable, List, Mapping, Optional, Sequence, Set, Tuple, Type, Union
from uuid import UUID, uuid4

import pandas as pd
from pandas.api.types import is_integer_dtype, is_numeric_dtype, is_string_dtype
from pyarrow import RecordBatchStreamReader, Schema, Table, parquet

from phoenix.config import TRACE_DATASETS_DIR
from phoenix.exceptions import PhoenixEvaluationNameIsMissing
from phoenix.trace.errors import InvalidParquetMetadataError

EVAL_NAME_COLUMN_PREFIX = "eval."
EVAL_PARQUET_FILE_NAME = "evaluations-{id}.parquet"


class NeedsNamedIndex(ABC):
    index_names: Mapping[Tuple[str, ...], Callable[[Any], bool]]
    all_valid_index_name_sorted_combos: Set[Tuple[str, ...]]

    @classmethod
    def preferred_names(cls) -> List[str]:
        return [choices[0] for choices in cls.index_names.keys()]

    @classmethod
    def aliases(cls) -> Mapping[str, str]:
        return {alias: choices[0] for choices in cls.index_names.keys() for alias in choices[1:]}

    @classmethod
    def unalias(cls, name: str) -> str:
        return cls.aliases().get(name, name)

    @classmethod
    def is_valid_index_names(cls, names: Sequence[str]) -> bool:
        return (
            len(names) == len(cls.index_names)
            and tuple(sorted(names)) in cls.all_valid_index_name_sorted_combos
        )

    @classmethod
    def find_valid_index_names(cls, dtypes: "pd.Series[Any]") -> Optional[List[str]]:
        valid_names = []
        for names, check_type in cls.index_names.items():
            for name in names:
                if name in dtypes.index and check_type(dtypes[name]):
                    valid_names.append(name)
                    break
            else:
                return None
        return valid_names


class NeedsResultColumns(ABC):
    result_column_names: Mapping[str, Callable[[Any], bool]] = MappingProxyType(
        {
            "score": is_numeric_dtype,
            "label": is_string_dtype,
            "explanation": is_string_dtype,
        }
    )

    @classmethod
    def is_valid_result_columns(cls, dtypes: "pd.Series[Any]") -> bool:
        names = cls.result_column_names.keys()
        intersection = dtypes.index.intersection(names)  # type: ignore
        if not len(intersection):
            return False
        for name in intersection:
            check_type = cls.result_column_names[name]
            if not check_type(dtypes[name]):
                return False
        return True


@dataclass(frozen=True)
class Evaluations(NeedsNamedIndex, NeedsResultColumns, ABC):
    eval_name: str  # The name for the evaluation, e.g. 'toxicity'
    dataframe: pd.DataFrame = field(repr=False)
    id: UUID = field(init=False, default_factory=uuid4)

    def __len__(self) -> int:
        return len(self.dataframe)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(eval_name={self.eval_name!r}, "
            f"dataframe=<rows: {len(self.dataframe)!r}>)"
        )

    def __dir__(self) -> List[str]:
        return ["get_dataframe"]

    def get_dataframe(self, prefix_columns_with_name: bool = True) -> pd.DataFrame:
        """
        Returns a copy of the dataframe with the evaluation annotations

        Parameters
        __________
        prefix_columns_with_name: bool
            if True, the columns will be prefixed with the eval_name, e.g. 'eval.toxicity.value'
        """
        if prefix_columns_with_name:
            prefix = f"{EVAL_NAME_COLUMN_PREFIX}{self.eval_name}."
            return self.dataframe.add_prefix(prefix)
        return self.dataframe.copy(deep=False)

    def __bool__(self) -> bool:
        return not self.dataframe.empty

    def __post_init__(self) -> None:
        dataframe = (
            pd.DataFrame() if self.dataframe.empty else self._clean_dataframe(self.dataframe)
        )
        object.__setattr__(self, "dataframe", dataframe)

    def _clean_dataframe(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        # Ensure column names are strings.
        column_names = dataframe.columns.astype(str)
        dataframe = dataframe.set_axis(column_names, axis=1)

        # If the dataframe contains the index columns, set the index to those columns
        if not self.is_valid_index_names(dataframe.index.names) and (
            index_names := self.find_valid_index_names(dataframe.dtypes)
        ):
            dataframe = dataframe.set_index(index_names)

        # Validate that the dataframe is indexed correctly.
        if not self.is_valid_index_names(dataframe.index.names):
            raise ValueError(
                f"The dataframe index must be {self.preferred_names()} but was "
                f"'{dataframe.index.name or dataframe.index.names}'"
            )

        # Validate that the dataframe contains result columns of appropriate types.
        if not self.is_valid_result_columns(dataframe.dtypes):
            raise ValueError(
                f"The dataframe must contain one of these columns with appropriate "
                f"value types: {self.result_column_names.keys()} "
            )

        # Un-alias to the preferred names.
        preferred_names = [self.unalias(name) for name in dataframe.index.names]
        dataframe = dataframe.rename_axis(preferred_names, axis=0)

        # Drop the unnecessary columns.
        result_column_names = dataframe.columns.intersection(self.result_column_names.keys())  # type: ignore
        return dataframe.loc[:, result_column_names]  # type: ignore

    def __init_subclass__(
        cls,
        index_names: Mapping[Tuple[str, ...], Callable[[Any], bool]],
        **kwargs: Any,
    ) -> None:
        super().__init_subclass__(**kwargs)
        cls.index_names = index_names
        cls.all_valid_index_name_sorted_combos = set(
            tuple(sorted(prod)) for prod in product(*cls.index_names.keys())
        )

    def to_pyarrow_table(self) -> Table:
        table = Table.from_pandas(self.dataframe)
        table = table.replace_schema_metadata(
            {
                **(table.schema.metadata or {}),
                # explicitly encode keys and values, which are automatically encoded regardless
                b"arize": json.dumps(
                    {
                        "eval_id": str(self.id),
                        "eval_name": self.eval_name,
                        "eval_type": self.__class__.__name__,
                    }
                ).encode("utf-8"),
            }
        )
        return table

    @staticmethod
    def from_pyarrow_reader(reader: RecordBatchStreamReader) -> "Evaluations":
        schema = reader.schema
        eval_id, eval_name, evaluations_cls = _parse_schema_metadata(schema)
        dataframe = reader.read_pandas()
        evaluations = evaluations_cls(eval_name=eval_name, dataframe=dataframe)
        object.__setattr__(evaluations, "id", eval_id)
        return evaluations

    def save(self, directory: Optional[Union[str, Path]] = None) -> UUID:
        """
        Persists the evaluations to disk.

        Args:
            directory (Optional[Union[str, Path]], optional): An optional path
            to a directory where the data will be saved. If not provided, the
            data will be saved to a default location.

        Returns:
            UUID: The ID of the evaluations, which can be used as a key to load
            the evaluations from disk using `load`.
        """
        directory = Path(directory) if directory else TRACE_DATASETS_DIR
        path = directory / EVAL_PARQUET_FILE_NAME.format(id=self.id)
        table = self.to_pyarrow_table()
        parquet.write_table(table, path)
        return self.id

    @classmethod
    def load(
        cls, id: Union[str, UUID], directory: Optional[Union[str, Path]] = None
    ) -> "Evaluations":
        """
        Loads the evaluations from disk.

        Args:
            id (Union[str, UUID]): The ID of the evaluations to load.

            directory(Optional[Union[str, Path]], optional): The path to the
            directory containing the persisted evaluations. If not provided, the
            parquet file will be loaded from the same default location used by
            `save`.

        Returns:
            Evaluations: The loaded evaluations. The type of the returned
            evaluations will be the same as the type of the evaluations that
            were originally persisted.
        """
        if not isinstance(id, UUID):
            id = UUID(id)
        path = Path(directory or TRACE_DATASETS_DIR) / EVAL_PARQUET_FILE_NAME.format(id=id)
        schema = parquet.read_schema(path)
        eval_id, eval_name, evaluations_cls = _parse_schema_metadata(schema)
        if id != eval_id:
            raise InvalidParquetMetadataError(
                f"The input id {id} does not match the id {eval_id} in the parquet metadata. "
                "Ensure that you have not renamed the parquet file."
            )
        table = parquet.read_table(path)
        dataframe = table.to_pandas()
        evaluations = evaluations_cls(eval_name=eval_name, dataframe=dataframe)
        object.__setattr__(evaluations, "id", eval_id)
        return evaluations


@dataclass(frozen=True)
class SpanEvaluations(
    Evaluations,
    index_names=MappingProxyType({("context.span_id", "span_id"): is_string_dtype}),
):
    """
    SpanEvaluations is a set of evaluation annotations for a set of spans.
    SpanEvaluations encompasses the evaluation annotations for a single evaluation task
    such as toxicity or hallucinations.

    SpanEvaluations can be appended to TraceDatasets so that the spans and
    evaluations can be joined and analyzed together.

    Parameters
    __________
    eval_name: str
        the name of the evaluation, e.g. 'toxicity'
    dataframe: pandas.DataFrame
        the pandas dataframe containing the evaluation annotations Each row
        represents the evaluations on a span.

    Example
    _______

    DataFrame of evaluations for toxicity may look like:

    | span_id | score              | label              | explanation        |
    |---------|--------------------|--------------------|--------------------|
    | span_1  | 1                  | toxic              | bad language       |
    | span_2  | 0                  | non-toxic          | violence           |
    | span_3  | 1                  | toxic              | discrimination     |
    """


@dataclass(frozen=True)
class DocumentEvaluations(
    Evaluations,
    index_names=MappingProxyType(
        {
            ("context.span_id", "span_id"): is_string_dtype,
            ("document_position", "position"): is_integer_dtype,
        }
    ),
):
    """
    DocumentEvaluations is a set of evaluation annotations for a set of documents.
    DocumentEvaluations encompasses the evaluation annotations for a single evaluation task
    such as relevance.

    Parameters
    __________
    eval_name: str
        the name of the evaluation, e.g. 'relevance'
    dataframe: pandas.DataFrame
        the pandas dataframe containing the evaluation annotations. Each row
        represents the evaluations on a document.

    Example
    _______

    DataFrame of document evaluations for relevance may look like:

    | span_id | position | score | label      | explanation  |
    |---------|----------|-------|------------|--------------|
    | span_1  | 0        | 1     | relevant   | it's apropos |
    | span_1  | 1        | 1     | relevant   | it's germane |
    | span_2  | 0        | 0     | irrelevant | it's rubbish |
    """

    def _clean_dataframe(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        dataframe = super()._clean_dataframe(dataframe)
        if dataframe.index.names != self.preferred_names():
            return dataframe.swaplevel()
        return dataframe


@dataclass(frozen=True)
class TraceEvaluations(
    Evaluations,
    index_names=MappingProxyType({("context.trace_id", "trace_id"): is_string_dtype}),
): ...


def _parse_schema_metadata(schema: Schema) -> Tuple[UUID, str, Type[Evaluations]]:
    """
    Validates and parses the pyarrow schema metadata.
    """
    try:
        metadata = schema.metadata
        arize_metadata = json.loads(metadata[b"arize"])
        eval_classes = {subclass.__name__: subclass for subclass in Evaluations.__subclasses__()}
        eval_id = UUID(arize_metadata["eval_id"])
        if not isinstance((eval_name := arize_metadata["eval_name"]), str) or not eval_name.strip():
            raise PhoenixEvaluationNameIsMissing(
                'Arize metadata must contain a non-empty string value for key "eval_name"'
            )
        evaluations_cls = eval_classes[arize_metadata["eval_type"]]
        return eval_id, eval_name, evaluations_cls
    except Exception as err:
        raise InvalidParquetMetadataError(
            "An error occurred while parsing parquet schema metadata"
        ) from err
