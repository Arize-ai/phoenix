import inspect
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Iterator,
    Literal,
    Mapping,
    NamedTuple,
    Optional,
    Type,
    TypeVar,
    cast,
    get_args,
)

from typing_extensions import TypeAlias

from phoenix.client.__generated__ import v1

if TYPE_CHECKING:
    import pandas as pd

_AnnotatorKind: TypeAlias = Literal["LLM", "CODE", "HUMAN"]
_VALID_ANNOTATOR_KINDS: frozenset[_AnnotatorKind] = frozenset(get_args(_AnnotatorKind))
_DATAFRAME_CHUNK_SIZE = 100


class _IdConfig(NamedTuple):
    """Configuration for ID column handling in annotation DataFrames.

    Key behaviors:
    - ID columns can be in DataFrame columns OR index levels, but not both
    - Multi-ID configs require ALL IDs in same location (all columns or all index)
    - Single-ID configs can fall back to unnamed string index if no ID columns found
    """

    columns: Mapping[str, Type[Any]]  # Primary ID column names and their expected types
    fallbacks: Mapping[str, str] = MappingProxyType({})  # Fallback column name mappings


_SPAN_ID_CONFIG = _IdConfig(
    columns=MappingProxyType({"span_id": str}),
    fallbacks=MappingProxyType({"span_id": "context.span_id"}),
)

_TRACE_ID_CONFIG = _IdConfig(
    columns=MappingProxyType({"trace_id": str}),
    fallbacks=MappingProxyType({"trace_id": "context.trace_id"}),
)

_DOCUMENT_ID_CONFIG = _IdConfig(
    columns=MappingProxyType({"span_id": str, "document_position": int}),
    fallbacks=MappingProxyType({"span_id": "context.span_id"}),
)

_SESSION_ID_CONFIG = _IdConfig(
    columns=MappingProxyType({"session_id": str}),
    fallbacks=MappingProxyType({}),
)


def _get_index_names(dataframe: "pd.DataFrame") -> list[Any]:
    """Extract non-None index level names. Returns empty list for unnamed index."""
    if hasattr(dataframe.index, "names") and dataframe.index.names:  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
        return [name for name in dataframe.index.names if name is not None]  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType,reportReturnType,reportUnnecessaryComparison]
    elif hasattr(dataframe.index, "name") and dataframe.index.name is not None:  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType,reportUnnecessaryComparison]
        return [dataframe.index.name]  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType,reportReturnType]
    return []


def _is_multiindex(dataframe: "pd.DataFrame") -> bool:
    """Check if DataFrame has a MultiIndex (more than one index level)."""
    return hasattr(dataframe.index, "names") and len(dataframe.index.names) > 1  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]


def _is_valid_value(value: Any, expected_type: Type[Any]) -> bool:
    """Check if value is valid for expected type. Strings must be non-empty after stripping."""
    if value is None:
        return False
    if expected_type is str:
        return isinstance(value, str) and value.strip() != ""
    return True


def _extract_id_value(
    row: Any,
    dataframe: "pd.DataFrame",
    column: str,
    fallback_column: Optional[str],
    expected_type: Type[Any],
) -> Optional[Any]:
    """Extract and convert ID value from DataFrame columns with fallback support."""
    if column in dataframe.columns and _is_valid_value(row.loc[column], expected_type):  # pyright: ignore[reportUnknownArgumentType]
        value = row.loc[column]  # pyright: ignore[reportUnknownArgumentType]
        if expected_type is str and isinstance(value, str):
            value = value.strip()
        return expected_type(value)  # pyright: ignore[reportUnknownArgumentType]

    if (
        fallback_column
        and fallback_column in dataframe.columns
        and _is_valid_value(row.loc[fallback_column], expected_type)
    ):  # pyright: ignore[reportUnknownArgumentType]
        value = row.loc[fallback_column]  # pyright: ignore[reportUnknownArgumentType]
        if expected_type is str and isinstance(value, str):
            value = value.strip()
        return expected_type(value)  # pyright: ignore[reportUnknownArgumentType]

    return None


def _extract_id_value_from_index(
    row_index: Any,
    dataframe: "pd.DataFrame",
    column: str,
    fallback_column: Optional[str],
    expected_type: Type[Any],
) -> Optional[Any]:
    """Extract and convert ID value from DataFrame index levels with fallback support."""
    index_names = _get_index_names(dataframe)

    if column in index_names:
        if _is_multiindex(dataframe):
            level_index = dataframe.index.names.index(column)  # pyright: ignore[reportUnknownMemberType]
            value = row_index[level_index]
        else:
            value = row_index

        if _is_valid_value(value, expected_type):
            if expected_type is str and isinstance(value, str):
                value = value.strip()
            return expected_type(value)

    if fallback_column and fallback_column in index_names:
        if _is_multiindex(dataframe):
            level_index = dataframe.index.names.index(fallback_column)  # pyright: ignore[reportUnknownMemberType]
            value = row_index[level_index]
        else:
            value = row_index

        if _is_valid_value(value, expected_type):
            if expected_type is str and isinstance(value, str):
                value = value.strip()
            return expected_type(value)

    return None


def _validate_column_values(
    dataframe: "pd.DataFrame", column: str, expected_type: Type[Any], value_description: str
) -> None:
    """Validate DataFrame column values for correct type and no None/empty values."""
    if dataframe.loc[:, column].isna().any():  # pyright: ignore[reportUnknownMemberType,reportGeneralTypeIssues]
        raise ValueError(f"{value_description} values cannot be None")

    if expected_type is str:
        if (dataframe.loc[:, column].str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"{value_description} values must be non-empty strings")
        if not all(isinstance(x, str) for x in dataframe.loc[:, column]):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            raise ValueError(f"{value_description} values must be strings")
    else:
        if not all(isinstance(x, expected_type) for x in dataframe.loc[:, column]):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            raise ValueError(f"{value_description} values must be of type {expected_type.__name__}")


def _validate_index_level_values(
    dataframe: "pd.DataFrame", index_name: str, expected_type: Type[Any]
) -> None:
    """Validate DataFrame index level values for correct type and no None/empty values."""
    try:
        import pandas as pd
    except ImportError:
        raise ImportError(
            "Pandas is not installed. Please install pandas to use this method: pip install pandas"
        )

    if _is_multiindex(dataframe):
        level_index = dataframe.index.names.index(index_name)  # pyright: ignore[reportUnknownMemberType]
        level_values = dataframe.index.get_level_values(level_index)  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType]
    else:
        level_values = dataframe.index  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType]

    if pd.Series(level_values).isna().any():  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
        raise ValueError(f"Index level '{index_name}' values cannot be None")

    if expected_type is str:
        if (pd.Series(level_values).str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
            raise ValueError(f"Index level '{index_name}' values must be non-empty strings")
        if not all(isinstance(x, str) for x in level_values):  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]
            raise ValueError(f"Index level '{index_name}' values must be strings")
    else:
        if not all(isinstance(x, expected_type) for x in level_values):  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]
            raise ValueError(
                f"Index level '{index_name}' values must be of type {expected_type.__name__}"
            )


def _create_span_annotation(
    *,
    span_id: str,
    annotation_name: str,
    annotator_kind: _AnnotatorKind = "HUMAN",
    label: Optional[str] = None,
    score: Optional[float] = None,
    explanation: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    identifier: Optional[str] = None,
) -> v1.SpanAnnotationData:
    """Create a span annotation data object.

    identifier: Enables multiple annotations with same name/span_id when provided.
    """

    result: v1.AnnotationResult = {}
    if label is not None and label.strip():
        result["label"] = label.strip()
    if score is not None:
        result["score"] = score
    if explanation is not None and explanation.strip():
        result["explanation"] = explanation.strip()

    if not result:
        raise ValueError("At least one of label, score, or explanation must be provided")

    anno: v1.SpanAnnotationData = {
        "name": annotation_name.strip(),
        "annotator_kind": annotator_kind,
        "span_id": span_id.strip(),
        "result": result,
    }
    if metadata:
        anno["metadata"] = metadata
    if identifier and identifier.strip():
        anno["identifier"] = identifier.strip()
    return anno


def _create_document_annotation(
    *,
    span_id: str,
    document_position: int,
    annotation_name: str,
    annotator_kind: _AnnotatorKind = "HUMAN",
    label: Optional[str] = None,
    score: Optional[float] = None,
    explanation: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> v1.SpanDocumentAnnotationData:
    """Create a span document annotation data object."""

    result: v1.AnnotationResult = {}
    if label is not None and label.strip():
        result["label"] = label.strip()
    if score is not None:
        result["score"] = score
    if explanation is not None and explanation.strip():
        result["explanation"] = explanation.strip()

    if not result:
        raise ValueError("At least one of label, score, or explanation must be provided")

    anno: v1.SpanDocumentAnnotationData = {
        "name": annotation_name.strip(),
        "annotator_kind": annotator_kind,
        "span_id": span_id.strip(),
        "document_position": document_position,
        "result": result,
    }
    if metadata:
        anno["metadata"] = metadata
    return anno


def _validate_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name_required: bool = False,
    annotator_kind_required: bool = False,
    id_config: _IdConfig = _SPAN_ID_CONFIG,
    valid_annotator_kinds: frozenset[str] = frozenset(["LLM", "CODE", "HUMAN"]),
) -> None:
    """Validate DataFrame structure and content for annotation processing.

    Key rules:
    - ID columns can be in DataFrame columns OR index levels, but not both
    - Multi-ID configs require ALL IDs in same location
    - Single-ID configs can fall back to unnamed string index
    """
    try:
        import pandas as pd
    except ImportError:
        raise ImportError(
            "Pandas is not installed. Please install pandas to use this method: pip install pandas"
        )

    if not isinstance(dataframe, pd.DataFrame):  # pyright: ignore[reportUnnecessaryIsInstance]
        raise TypeError(f"Expected pandas DataFrame, got {type(dataframe)}")

    if dataframe.empty:
        raise ValueError("DataFrame cannot be empty")

    has_name = "name" in dataframe.columns
    has_annotation_name = "annotation_name" in dataframe.columns
    if has_name and has_annotation_name:
        raise ValueError("DataFrame cannot have both 'name' and 'annotation_name' columns")
    if annotation_name_required and not has_name and not has_annotation_name:
        raise ValueError(
            "DataFrame must contain either 'name' or 'annotation_name' column "
            "when annotation_name_required=True"
        )

    required_columns = set()  # pyright: ignore[reportUnknownVariableType]
    if annotation_name_required and not has_name and not has_annotation_name:
        pass
    if annotator_kind_required:
        required_columns.add("annotator_kind")  # pyright: ignore[reportUnknownMemberType]

    if not required_columns.issubset(dataframe.columns):
        raise ValueError(
            f"DataFrame must contain columns: {required_columns}. "
            f"Found columns: {dataframe.columns.tolist()}"
        )

    for col in required_columns:  # pyright: ignore[reportUnknownVariableType]
        if dataframe.loc[:, col].isna().all():  # pyright: ignore[reportUnknownMemberType,reportGeneralTypeIssues]
            raise ValueError(f"Column '{col}' must contain at least one non-null value")

    if annotation_name_required or (
        not annotation_name_required and (has_name or has_annotation_name)
    ):
        name_column = "annotation_name" if has_annotation_name else "name"
        _validate_column_values(dataframe, name_column, str, name_column)

    available_id_columns: list[str] = []
    available_id_index_names: list[str] = []
    conflicting_columns: list[tuple[str, str]] = []
    missing_id_columns: list[str] = []

    index_names = _get_index_names(dataframe)

    for id_col in id_config.columns.keys():
        found_in_columns = False
        found_in_index = False

        if id_col in dataframe.columns:
            available_id_columns.append(id_col)
            found_in_columns = True

        if id_col in index_names:
            available_id_index_names.append(id_col)
            found_in_index = True

        if found_in_columns and found_in_index:
            raise ValueError(
                f"ID column '{id_col}' cannot be present in both DataFrame columns and index"
            )

        if not found_in_columns and not found_in_index:
            fallback_col = id_config.fallbacks.get(id_col)
            if fallback_col:
                if fallback_col in dataframe.columns:
                    available_id_columns.append(fallback_col)
                    found_in_columns = True
                elif fallback_col in index_names:
                    available_id_index_names.append(fallback_col)
                    found_in_index = True

            if not found_in_columns and not found_in_index:
                missing_id_columns.append(id_col)
        else:
            fallback_col = id_config.fallbacks.get(id_col)
            if fallback_col and fallback_col in dataframe.columns and found_in_columns:
                conflicting_columns.append((id_col, fallback_col))

    if conflicting_columns:
        conflicts = [f"'{primary}' and '{fallback}'" for primary, fallback in conflicting_columns]
        raise ValueError(
            f"DataFrame cannot have both primary and fallback ID columns: {', '.join(conflicts)}"
        )

    multi_id_check = (
        len(id_config.columns) > 1 and available_id_columns and available_id_index_names
    )
    if multi_id_check:
        raise ValueError(
            "For multi-ID configurations, all ID columns must be in the same location "
            "(either all in DataFrame columns or all in index levels). "
            f"Found columns: {available_id_columns}, index levels: {available_id_index_names}"
        )

    if missing_id_columns:
        if len(id_config.columns) == 1 and all(isinstance(x, str) for x in dataframe.index):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            pass  # Single-ID configs can use unnamed string index as fallback
        else:
            missing_options: list[str] = []
            for id_col in missing_id_columns:
                fallback_col = id_config.fallbacks.get(id_col)
                if fallback_col:
                    missing_options.append(f"'{id_col}' or '{fallback_col}'")
                else:
                    missing_options.append(f"'{id_col}'")

            if len(id_config.columns) == 1:
                raise ValueError(
                    f"DataFrame must have {missing_options[0]} column, index level, "
                    "or a string-based index"
                )
            else:
                raise ValueError(
                    f"DataFrame must have ALL required ID columns in columns or index levels: "
                    f"{', '.join(missing_options)}"
                )

    if available_id_columns:
        actual_id_column = available_id_columns[0]
        expected_type = id_config.columns.get(actual_id_column, str)
        _validate_column_values(dataframe, actual_id_column, expected_type, actual_id_column)

    elif available_id_index_names:
        for index_name in available_id_index_names:
            expected_type = id_config.columns.get(index_name, str)
            _validate_index_level_values(dataframe, index_name, expected_type)

    else:
        if len(id_config.columns) == 1:
            if (pd.Series(dataframe.index).str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
                raise ValueError("Index values must be non-empty strings when used as ID")
            if not all(isinstance(x, str) for x in dataframe.index):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
                raise ValueError("Index values must be strings when used as ID")

    if annotator_kind_required or (
        not annotator_kind_required and "annotator_kind" in dataframe.columns
    ):
        invalid_values = (  # pyright: ignore[reportUnknownVariableType]
            set(dataframe.loc[:, "annotator_kind"].dropna().unique()) - valid_annotator_kinds  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType,reportCallIssue]
        )
        if invalid_values:
            raise ValueError(
                f"Invalid annotator_kind values found in DataFrame: {invalid_values}. "
                f"Must be one of: {valid_annotator_kinds}"
            )

    result_columns = {"label", "score", "explanation"}
    if not any(col in dataframe.columns for col in result_columns):
        raise ValueError("DataFrame must contain at least one of: label, score, explanation")


def _validate_span_annotations_dataframe(  # pyright: ignore[reportUnusedFunction]
    *,
    dataframe: "pd.DataFrame",
    annotation_name_required: bool = False,
    annotator_kind_required: bool = False,
) -> None:
    """Validate DataFrame for span annotations."""
    return _validate_annotations_dataframe(
        dataframe=dataframe,
        annotation_name_required=annotation_name_required,
        annotator_kind_required=annotator_kind_required,
        id_config=_SPAN_ID_CONFIG,
    )


def _validate_document_annotations_dataframe(  # pyright: ignore[reportUnusedFunction]
    *,
    dataframe: "pd.DataFrame",
    annotation_name_required: bool = False,
    annotator_kind_required: bool = False,
) -> None:
    """Validate DataFrame for span document annotations."""
    return _validate_annotations_dataframe(
        dataframe=dataframe,
        annotation_name_required=annotation_name_required,
        annotator_kind_required=annotator_kind_required,
        id_config=_DOCUMENT_ID_CONFIG,
    )


def _validate_trace_annotations_dataframe(  # pyright: ignore[reportUnusedFunction]
    *,
    dataframe: "pd.DataFrame",
    annotation_name_required: bool = False,
    annotator_kind_required: bool = False,
) -> None:
    """Validate DataFrame for trace annotations."""
    return _validate_annotations_dataframe(
        dataframe=dataframe,
        annotation_name_required=annotation_name_required,
        annotator_kind_required=annotator_kind_required,
        id_config=_TRACE_ID_CONFIG,
        valid_annotator_kinds=_VALID_ANNOTATOR_KINDS,
    )


def _validate_session_annotations_dataframe(  # pyright: ignore[reportUnusedFunction]
    *,
    dataframe: "pd.DataFrame",
    annotation_name_required: bool = False,
    annotator_kind_required: bool = False,
) -> None:
    """Validate DataFrame for session annotations."""
    return _validate_annotations_dataframe(
        dataframe=dataframe,
        annotation_name_required=annotation_name_required,
        annotator_kind_required=annotator_kind_required,
        id_config=_SESSION_ID_CONFIG,
    )


T = TypeVar("T")


def _chunk_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name: Optional[str] = None,
    annotator_kind: Optional[str] = None,
    chunk_size: int = _DATAFRAME_CHUNK_SIZE,
    id_config: _IdConfig = _SPAN_ID_CONFIG,
    annotation_factory: Callable[..., T],
) -> Iterator[list[T]]:
    """Convert DataFrame rows to annotation objects in chunks. Assumes pre-validated DataFrame.

    Global parameters override DataFrame columns when provided.
    """

    annotations = []
    for idx, row in dataframe.iterrows():  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
        try:
            row_name = annotation_name
            if row_name is None:
                if "name" in row and bool(row.loc["name"]):  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                    row_name = str(row.loc["name"]).strip()  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                elif "annotation_name" in row and bool(row.loc["annotation_name"]):  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                    row_name = str(row.loc["annotation_name"]).strip()  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
            assert row_name

            row_annotator_kind = annotator_kind or (
                str(row.loc["annotator_kind"]).strip()  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                if "annotator_kind" in row and bool(row.loc["annotator_kind"])  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                else None
            )

            id_params = {}
            missing_ids: list[str] = []

            for id_col in id_config.columns.keys():
                expected_type = id_config.columns.get(id_col, str)
                fallback_col = id_config.fallbacks.get(id_col)

                value = _extract_id_value(row, dataframe, id_col, fallback_col, expected_type)

                if value is None:
                    value = _extract_id_value_from_index(
                        idx, dataframe, id_col, fallback_col, expected_type
                    )

                if value is not None:
                    id_params[id_col] = value
                else:
                    missing_ids.append(id_col)

            if missing_ids:
                if len(id_config.columns) == 1:
                    first_col = next(iter(id_config.columns.keys()))
                    expected_type = id_config.columns[first_col]
                    value = idx  # Fall back to using row index as ID value
                    if expected_type is str and isinstance(value, str):
                        value = value.strip()
                    id_params[first_col] = expected_type(value)
                else:
                    raise ValueError(f"Row {idx}: Missing required ID columns: {missing_ids}")

            label = (
                str(row.loc["label"]).strip() if "label" in row and bool(row.loc["label"]) else None  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
            )
            score = None
            if "score" in row and row.loc["score"] is not None:  # pyright: ignore[reportUnknownMemberType]
                try:
                    score = float(row.loc["score"])  # pyright: ignore[reportUnknownArgumentType,reportArgumentType,reportUnknownMemberType]
                except (ValueError, TypeError):
                    raise TypeError(
                        f"Score value '{row.loc['score']}' cannot be converted to float"  # pyright: ignore[reportUnknownMemberType]
                    )
            explanation = (
                str(row.loc["explanation"]).strip()  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                if "explanation" in row and bool(row.loc["explanation"])  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                else None
            )
            metadata = cast(
                dict[str, Any],
                dict(row.loc["metadata"])  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                if "metadata" in row and bool(row.loc["metadata"])  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                else None,
            )
            identifier = (
                str(row.loc["identifier"]).strip()  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                if "identifier" in row and bool(row.loc["identifier"])  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
                else None
            )

            factory_signature = inspect.signature(annotation_factory)
            kwargs: dict[str, Any] = {
                **id_params,
                "annotation_name": row_name,
                "annotator_kind": row_annotator_kind,
                "label": label,
                "score": score,
                "explanation": explanation,
                "metadata": metadata,
            }

            if "identifier" in factory_signature.parameters:  # Not all factories accept identifier
                kwargs["identifier"] = identifier

            annotation = annotation_factory(**kwargs)

            annotations.append(annotation)  # pyright: ignore[reportUnknownMemberType]

            if len(annotations) >= chunk_size:  # pyright: ignore[reportUnknownArgumentType]
                yield annotations
                annotations = []

        except Exception as e:
            raise ValueError(f"Error processing row {idx}: {str(e)}")

    if annotations:
        yield annotations


def _chunk_span_annotations_dataframe(  # pyright: ignore[reportUnusedFunction]
    *,
    dataframe: "pd.DataFrame",
    annotation_name: Optional[str] = None,
    annotator_kind: Optional[str] = None,
    chunk_size: int = _DATAFRAME_CHUNK_SIZE,
) -> Iterator[list[v1.SpanAnnotationData]]:
    """Split DataFrame into chunks for span annotation processing."""
    return _chunk_annotations_dataframe(
        dataframe=dataframe,
        annotation_name=annotation_name,
        annotator_kind=annotator_kind,
        chunk_size=chunk_size,
        id_config=_SPAN_ID_CONFIG,
        annotation_factory=_create_span_annotation,
    )


def _chunk_document_annotations_dataframe(  # pyright: ignore[reportUnusedFunction]
    *,
    dataframe: "pd.DataFrame",
    annotation_name: Optional[str] = None,
    annotator_kind: Optional[str] = None,
    chunk_size: int = _DATAFRAME_CHUNK_SIZE,
) -> Iterator[list[v1.SpanDocumentAnnotationData]]:
    """Split DataFrame into chunks for span document annotation processing."""
    return _chunk_annotations_dataframe(
        dataframe=dataframe,
        annotation_name=annotation_name,
        annotator_kind=annotator_kind,
        chunk_size=chunk_size,
        id_config=_DOCUMENT_ID_CONFIG,
        annotation_factory=_create_document_annotation,
    )


def _create_session_annotation(
    *,
    session_id: str,
    annotation_name: str,
    annotator_kind: _AnnotatorKind = "HUMAN",
    label: Optional[str] = None,
    score: Optional[float] = None,
    explanation: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    identifier: Optional[str] = None,
) -> v1.SessionAnnotationData:
    """Create a session annotation data object.

    Args:
        session_id (str): The ID of the session to annotate.
        annotation_name (str): The name of the annotation.
        annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
            Defaults to "HUMAN".
        label (Optional[str]): The label assigned by the annotation.
        score (Optional[float]): The score assigned by the annotation.
        explanation (Optional[str]): Explanation of the annotation result.
        metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
        identifier (Optional[str]): An optional identifier for the annotation. Each annotation is uniquely identified by the combination
            of name, session_id, and identifier (where a null identifier is equivalent to an empty string).
            If an annotation with the same name, session_id, and identifier already exists, it will be updated.
            Using a non-empty identifier allows you to have multiple annotations with the same name and session_id.
            Most of the time, you can leave this as None - it will still update the record if it exists.
            It will also update the record with identifier="" if it exists.

    Returns:
        SessionAnnotationData: A session annotation data object that can be used with the Annotations API.
    """  # noqa: E501

    result: v1.AnnotationResult = {}
    if label is not None and label.strip():
        result["label"] = label.strip()
    if score is not None:
        result["score"] = score
    if explanation is not None and explanation.strip():
        result["explanation"] = explanation.strip()

    if not result:
        raise ValueError("At least one of label, score, or explanation must be provided")

    anno: v1.SessionAnnotationData = {
        "name": annotation_name.strip(),
        "annotator_kind": annotator_kind,
        "session_id": session_id.strip(),
        "result": result,
    }
    if metadata:
        anno["metadata"] = metadata
    if identifier and identifier.strip():
        anno["identifier"] = identifier.strip()
    return anno


def _create_trace_annotation(
    *,
    trace_id: str,
    annotation_name: str,
    annotator_kind: _AnnotatorKind = "HUMAN",
    label: Optional[str] = None,
    score: Optional[float] = None,
    explanation: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    identifier: Optional[str] = None,
) -> v1.TraceAnnotationData:
    """Create a trace annotation data object.

    Args:
        trace_id (str): The ID of the trace to annotate.
        annotation_name (str): The name of the annotation.
        annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
            Defaults to "HUMAN".
        label (Optional[str]): The label assigned by the annotation.
        score (Optional[float]): The score assigned by the annotation.
        explanation (Optional[str]): Explanation of the annotation result.
        metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
        identifier (Optional[str]): An optional identifier for the annotation. Each annotation is uniquely identified by the combination
            of name, trace_id, and identifier (where a null identifier is equivalent to an empty string).
            If an annotation with the same name, trace_id, and identifier already exists, it will be updated.
            Using a non-empty identifier allows you to have multiple annotations with the same name and trace_id.
            Most of the time, you can leave this as None - it will still update the record if it exists.
            It will also update the record with identifier="" if it exists.

    Returns:
        TraceAnnotationData: A trace annotation data object that can be used with the Annotations API.
    """  # noqa: E501

    result: v1.AnnotationResult = {}
    if label is not None and label.strip():
        result["label"] = label.strip()
    if score is not None:
        result["score"] = score
    if explanation is not None and explanation.strip():
        result["explanation"] = explanation.strip()

    if not result:
        raise ValueError("At least one of label, score, or explanation must be provided")

    anno: v1.TraceAnnotationData = {
        "name": annotation_name.strip(),
        "annotator_kind": annotator_kind,
        "trace_id": trace_id.strip(),
        "result": result,
    }
    if metadata:
        anno["metadata"] = metadata
    if identifier and identifier.strip():
        anno["identifier"] = identifier.strip()
    return anno


def _chunk_session_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name: Optional[str] = None,
    annotator_kind: Optional[str] = None,
    chunk_size: int = _DATAFRAME_CHUNK_SIZE,
) -> Iterator[list[v1.SessionAnnotationData]]:
    """Split a DataFrame into chunks for session annotation processing.

    Args:
        dataframe (pd.DataFrame): The DataFrame to split into chunks. Must contain either a 'session_id' column
            or have a string-based index.
        annotation_name (Optional[str]): The name to use for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include a "name" column. Defaults to None.
        annotator_kind (Optional[str]): The kind of annotator used for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include an "annotator_kind" column. Defaults to None.
        chunk_size (int): Number of annotations per chunk. Defaults to _DATAFRAME_CHUNK_SIZE.

    Yields:
        Lists of SessionAnnotationData objects, one chunk at a time.

    Raises:
        ValueError: If required fields are missing during processing.
        TypeError: If score values cannot be converted to float.
    """  # noqa: E501
    return _chunk_annotations_dataframe(
        dataframe=dataframe,
        annotation_name=annotation_name,
        annotator_kind=annotator_kind,
        chunk_size=chunk_size,
        id_config=_SESSION_ID_CONFIG,
        annotation_factory=_create_session_annotation,
    )


def _chunk_trace_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name: Optional[str] = None,
    annotator_kind: Optional[str] = None,
    chunk_size: int = _DATAFRAME_CHUNK_SIZE,
) -> Iterator[list[v1.TraceAnnotationData]]:
    """Split a DataFrame into chunks for trace annotation processing.

    Args:
        dataframe (pd.DataFrame): The DataFrame to split into chunks. Must contain either a 'trace_id' column
            or 'context.trace_id' column, or have a string-based index.
        annotation_name (Optional[str]): The name to use for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include a "name" column. Defaults to None.
        annotator_kind (Optional[str]): The kind of annotator used for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include an "annotator_kind" column. Defaults to None.
        chunk_size (int): Number of annotations per chunk. Defaults to _DATAFRAME_CHUNK_SIZE.

    Yields:
        Lists of TraceAnnotationData objects, one chunk at a time.

    Raises:
        ValueError: If required fields are missing during processing.
        TypeError: If score values cannot be converted to float.
    """  # noqa: E501
    return _chunk_annotations_dataframe(
        dataframe=dataframe,
        annotation_name=annotation_name,
        annotator_kind=annotator_kind,
        chunk_size=chunk_size,
        id_config=_TRACE_ID_CONFIG,
        annotation_factory=_create_trace_annotation,
    )
