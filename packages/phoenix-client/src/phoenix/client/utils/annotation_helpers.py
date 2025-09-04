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
    """Configuration for ID column handling in annotation DataFrames."""

    columns: Mapping[str, Type[Any]]
    fallbacks: Mapping[str, str] = MappingProxyType({})


# Pre-configured ID configurations for different annotation types
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


def _is_valid_value(value: Any, expected_type: Type[Any]) -> bool:
    """Check if a value is valid for the expected type.

    Args:
        value: The value to check.
        expected_type: The expected type for the value.

    Returns:
        bool: True if the value is valid for the expected type, False otherwise.
    """  # noqa: E501
    if value is None:
        return False
    if expected_type is str:
        return isinstance(value, str) and value.strip() != ""
    return True  # For non-string types, any non-None value is valid


def _extract_id_value(
    row: Any,
    dataframe: "pd.DataFrame",
    column: str,
    fallback_column: Optional[str],
    expected_type: Type[Any],
) -> Optional[Any]:
    """Extract and convert ID value from row, trying primary then fallback column.

    Args:
        row: The DataFrame row to extract the ID value from.
        dataframe: The pandas DataFrame containing the row.
        column: The primary column name to look for the ID value.
        fallback_column: Optional fallback column name if primary column is not found or invalid.
        expected_type: The expected type to convert the ID value to.

    Returns:
        Optional[Any]: The converted ID value if found and valid, None otherwise.
    """  # noqa: E501
    # Try primary column first
    if column in dataframe.columns and _is_valid_value(row[column], expected_type):  # pyright: ignore[reportUnknownArgumentType]
        value = row[column]  # pyright: ignore[reportUnknownArgumentType]
        if expected_type is str and isinstance(value, str):
            value = value.strip()
        return expected_type(value)  # pyright: ignore[reportUnknownArgumentType]

    # Try fallback column
    if (
        fallback_column
        and fallback_column in dataframe.columns
        and _is_valid_value(row[fallback_column], expected_type)
    ):  # pyright: ignore[reportUnknownArgumentType]
        value = row[fallback_column]  # pyright: ignore[reportUnknownArgumentType]
        if expected_type is str and isinstance(value, str):
            value = value.strip()
        return expected_type(value)  # pyright: ignore[reportUnknownArgumentType]

    return None


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

    Args:
        span_id (str): The ID of the span to annotate.
        annotation_name (str): The name of the annotation.
        annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
            Defaults to "HUMAN".
        label (Optional[str]): The label assigned by the annotation.
        score (Optional[float]): The score assigned by the annotation.
        explanation (Optional[str]): Explanation of the annotation result.
        metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
        identifier (Optional[str]): An optional identifier for the annotation. Each annotation is uniquely identified by the combination
            of name, span_id, and identifier (where a null identifier is equivalent to an empty string).
            If an annotation with the same name, span_id, and identifier already exists, it will be updated.
            Using a non-empty identifier allows you to have multiple annotations with the same name and span_id.
            Most of the time, you can leave this as None - it will still update the record if it exists.
            It will also update the record with identifier="" if it exists.

    Returns:
        SpanAnnotationData: A span annotation data object that can be used with the Annotations API.
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
    """Create a span document annotation data object.

    Args:
        span_id (str): The ID of the span to annotate.
        document_position (int): The 0-based index of the document within the span.
        annotation_name (str): The name of the annotation.
        annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
            Defaults to "HUMAN".
        label (Optional[str]): The label assigned by the annotation.
        score (Optional[float]): The score assigned by the annotation.
        explanation (Optional[str]): Explanation of the annotation result.
        metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.

    Returns:
        SpanDocumentAnnotationData: A span document annotation data object that can be used with the Annotations API.
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
    """Internal generic function to validate that the DataFrame has the required columns and data.

    This function performs comprehensive validation of the DataFrame structure and content,
    including type checking, required columns, and value validation.

    Args:
        dataframe (pd.DataFrame): The DataFrame to validate.
        annotation_name_required (bool): Whether the annotation name field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.
        annotator_kind_required (bool): Whether the annotator kind field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.
        id_config (_IdConfig): Configuration for ID column handling (columns, types, fallbacks).
            Defaults to _SPAN_ID_CONFIG.
        valid_annotator_kinds (frozenset[str]): Set of valid annotator kind values for this annotation type.
            Defaults to frozenset(["LLM", "CODE", "HUMAN"]).

    Raises:
        ValueError: If the DataFrame is missing required columns, if no valid annotation data is provided,
            or if annotator_kind values are invalid.
        TypeError: If the input is not a pandas DataFrame.
    """  # noqa: E501
    try:
        import pandas as pd
    except ImportError:
        raise ImportError(
            "Pandas is not installed. Please install pandas to use this method: pip install pandas"
        )

    # Type check for DataFrame
    if not isinstance(dataframe, pd.DataFrame):  # pyright: ignore[reportUnnecessaryIsInstance]
        raise TypeError(f"Expected pandas DataFrame, got {type(dataframe)}")

    # Check if DataFrame is empty
    if dataframe.empty:
        raise ValueError("DataFrame cannot be empty")

    # Check for name/annotation_name columns
    has_name = "name" in dataframe.columns
    has_annotation_name = "annotation_name" in dataframe.columns
    if has_name and has_annotation_name:
        raise ValueError("DataFrame cannot have both 'name' and 'annotation_name' columns")
    if annotation_name_required and not has_name and not has_annotation_name:
        raise ValueError(
            "DataFrame must contain either 'name' or 'annotation_name' column "
            "when annotation_name_required=True"
        )
    # When annotation_name_required=False, allow missing name columns
    # (global parameter can be provided)

    # Check for required columns
    required_columns = set()  # pyright: ignore[reportUnknownVariableType]
    if annotation_name_required and not has_name and not has_annotation_name:
        # This is already checked above, but for completeness
        pass
    if annotator_kind_required:
        required_columns.add("annotator_kind")  # pyright: ignore[reportUnknownMemberType]

    if not required_columns.issubset(dataframe.columns):
        raise ValueError(
            f"DataFrame must contain columns: {required_columns}. "
            f"Found columns: {dataframe.columns.tolist()}"
        )

    # Check for non-null values in required columns
    for col in required_columns:  # pyright: ignore[reportUnknownVariableType]
        if dataframe[col].isna().all():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"Column '{col}' must contain at least one non-null value")

    # Validate name values if annotation name is required in DataFrame
    if annotation_name_required or (
        not annotation_name_required and (has_name or has_annotation_name)
    ):
        name_column = "annotation_name" if has_annotation_name else "name"
        # Check for null/NaN values
        if dataframe[name_column].isna().any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"{name_column} values cannot be None")
        # Check for empty or whitespace-only strings
        if (dataframe[name_column].str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"{name_column} values must be non-empty strings")
        # Check for non-string values
        if not all(isinstance(x, str) for x in dataframe[name_column]):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            raise ValueError(f"{name_column} values must be strings")

    # Check for ID columns - ALL required ID columns must be present (or have fallbacks)
    available_id_columns: list[str] = []
    conflicting_columns: list[tuple[str, str]] = []
    missing_id_columns: list[str] = []

    for id_col in id_config.columns.keys():
        # Check if primary column is available
        if id_col in dataframe.columns:
            available_id_columns.append(id_col)

            # Check if this ID column's fallback is also present (conflict)
            fallback_col = id_config.fallbacks.get(id_col)
            if fallback_col and fallback_col in dataframe.columns:
                conflicting_columns.append((id_col, fallback_col))
        else:
            # Check if fallback is available
            fallback_col = id_config.fallbacks.get(id_col)
            if fallback_col and fallback_col in dataframe.columns:
                available_id_columns.append(fallback_col)
            else:
                missing_id_columns.append(id_col)

    # Check for conflicts (primary and fallback both present)
    if conflicting_columns:
        conflicts = [f"'{primary}' and '{fallback}'" for primary, fallback in conflicting_columns]
        raise ValueError(
            f"DataFrame cannot have both primary and fallback ID columns: {', '.join(conflicts)}"
        )

    # For multi-ID configs, ALL ID columns must be present (or have fallbacks)
    # For single-ID configs, allow index fallback if no ID columns available
    if missing_id_columns:
        if len(id_config.columns) == 1 and all(isinstance(x, str) for x in dataframe.index):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            # Single ID config can use index as fallback
            pass
        else:
            # Multi-ID config or single-ID without valid index
            missing_options: list[str] = []
            for id_col in missing_id_columns:
                fallback_col = id_config.fallbacks.get(id_col)
                if fallback_col:
                    missing_options.append(f"'{id_col}' or '{fallback_col}'")
                else:
                    missing_options.append(f"'{id_col}'")

            if len(id_config.columns) == 1:
                raise ValueError(
                    f"DataFrame must have {missing_options[0]} column or a string-based index"
                )
            else:
                raise ValueError(
                    f"DataFrame must have ALL required ID columns: {', '.join(missing_options)}"
                )

    # Validate ID values if using column - check the first available column
    actual_id_column = available_id_columns[0] if available_id_columns else None
    if actual_id_column:
        # Check for None values
        if dataframe[actual_id_column].isna().any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"{actual_id_column} values cannot be None")

        # Get expected data type for this column (default to str for fallback columns)
        expected_type = id_config.columns.get(actual_id_column, str)

        # Type-specific validation
        if expected_type is str:
            # Check for empty or whitespace-only strings
            if (dataframe[actual_id_column].str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType]
                raise ValueError(f"{actual_id_column} values must be non-empty strings")
            # Check for non-string values
            if not all(isinstance(x, str) for x in dataframe[actual_id_column]):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
                raise ValueError(f"{actual_id_column} values must be strings")
        else:
            # Check for correct data type for non-string types
            if not all(isinstance(x, expected_type) for x in dataframe[actual_id_column]):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
                raise ValueError(
                    f"{actual_id_column} values must be of type {expected_type.__name__}"
                )
    # Validate index values if using index as ID
    else:
        # Check for empty or whitespace-only strings
        if (pd.Series(dataframe.index).str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
            raise ValueError("Index values must be non-empty strings when used as ID")
        # Check for non-string values
        if not all(isinstance(x, str) for x in dataframe.index):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            raise ValueError("Index values must be strings when used as ID")

    # Check row-level annotator_kind values if required or present in DataFrame
    if annotator_kind_required or (
        not annotator_kind_required and "annotator_kind" in dataframe.columns
    ):
        invalid_values = set(dataframe["annotator_kind"].dropna().unique()) - valid_annotator_kinds  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
        if invalid_values:
            raise ValueError(
                f"Invalid annotator_kind values found in DataFrame: {invalid_values}. "
                f"Must be one of: {valid_annotator_kinds}"
            )

    # Check that at least one result field exists
    result_columns = {"label", "score", "explanation"}
    if not any(col in dataframe.columns for col in result_columns):
        raise ValueError("DataFrame must contain at least one of: label, score, explanation")


# Convenience wrapper functions for specific annotation types
def _validate_span_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name_required: bool = False,
    annotator_kind_required: bool = False,
) -> None:
    """Validate DataFrame for span annotations.

    Args:
        dataframe (pd.DataFrame): The DataFrame to validate for span annotations.
        annotation_name_required (bool): Whether the annotation name field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.
        annotator_kind_required (bool): Whether the annotator kind field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.

    Raises:
        ValueError: If the DataFrame is missing required columns, if no valid annotation data is provided,
            or if annotator_kind values are invalid.
        TypeError: If the input is not a pandas DataFrame.
    """  # noqa: E501
    return _validate_annotations_dataframe(
        dataframe=dataframe,
        annotation_name_required=annotation_name_required,
        annotator_kind_required=annotator_kind_required,
        id_config=_SPAN_ID_CONFIG,
    )


def _validate_document_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name_required: bool = False,
    annotator_kind_required: bool = False,
) -> None:
    """Validate DataFrame for span document annotations.

    Args:
        dataframe (pd.DataFrame): The DataFrame to validate for span document annotations.
        annotation_name_required (bool): Whether the annotation name field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.
        annotator_kind_required (bool): Whether the annotator kind field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.

    Raises:
        ValueError: If the DataFrame is missing required columns, if no valid annotation data is provided,
            or if annotator_kind values are invalid.
        TypeError: If the input is not a pandas DataFrame.
    """  # noqa: E501
    return _validate_annotations_dataframe(
        dataframe=dataframe,
        annotation_name_required=annotation_name_required,
        annotator_kind_required=annotator_kind_required,
        id_config=_DOCUMENT_ID_CONFIG,
    )


def _validate_trace_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name_required: bool = False,
    annotator_kind_required: bool = False,
) -> None:
    """Validate DataFrame for trace annotations.

    Args:
        dataframe (pd.DataFrame): The DataFrame to validate for trace annotations.
        annotation_name_required (bool): Whether the annotation name field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.
        annotator_kind_required (bool): Whether the annotator kind field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.

    Raises:
        ValueError: If the DataFrame is missing required columns, if no valid annotation data is provided,
            or if annotator_kind values are invalid.
        TypeError: If the input is not a pandas DataFrame.
    """  # noqa: E501
    return _validate_annotations_dataframe(
        dataframe=dataframe,
        annotation_name_required=annotation_name_required,
        annotator_kind_required=annotator_kind_required,
        id_config=_TRACE_ID_CONFIG,
        valid_annotator_kinds=_VALID_ANNOTATOR_KINDS,
    )


def _validate_session_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name_required: bool = False,
    annotator_kind_required: bool = False,
) -> None:
    """Validate DataFrame for session annotations.

    Args:
        dataframe (pd.DataFrame): The DataFrame to validate for session annotations.
        annotation_name_required (bool): Whether the annotation name field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.
        annotator_kind_required (bool): Whether the annotator kind field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.

    Raises:
        ValueError: If the DataFrame is missing required columns, if no valid annotation data is provided,
            or if annotator_kind values are invalid.
        TypeError: If the input is not a pandas DataFrame.
    """  # noqa: E501
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
    """Internal generic function to split a DataFrame into smaller chunks for batch processing of annotations.

    This function processes the DataFrame in chunks for efficient batch processing.
    It handles type conversion of the data and creates annotations using the provided factory.

    Note: This function assumes the DataFrame has already been validated. Call the appropriate
    validation function before using this chunking function.

    Args:
        dataframe (pd.DataFrame): The DataFrame to split into chunks. Must contain either an ID column
            or have a non-empty index.
        annotation_name (Optional[str]): The name to use for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include a "name" column. Defaults to None.
        annotator_kind (Optional[str]): The kind of annotator used for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include an "annotator_kind" column. Defaults to None.
        chunk_size (int): Number of annotations per chunk. Defaults to _DATAFRAME_CHUNK_SIZE.
        id_config (_IdConfig): Configuration for ID column handling (columns, types, fallbacks).
            Defaults to _SPAN_ID_CONFIG.
        annotation_factory (Callable[..., T]): Function to create annotation objects.

    Yields:
        Lists of annotation objects, one chunk at a time.

    Raises:
        ValueError: If required fields are missing during processing.
        TypeError: If score values cannot be converted to float.
    """  # noqa: E501

    annotations = []
    for idx, row in dataframe.iterrows():  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
        try:
            # Get required fields with null checks
            row_name = annotation_name
            if row_name is None:
                if "name" in row and bool(row["name"]):  # pyright: ignore[reportUnknownArgumentType]
                    row_name = str(row["name"]).strip()  # pyright: ignore[reportUnknownArgumentType]
                elif "annotation_name" in row and bool(row["annotation_name"]):  # pyright: ignore[reportUnknownArgumentType]
                    row_name = str(row["annotation_name"]).strip()  # pyright: ignore[reportUnknownArgumentType]
            assert row_name

            row_annotator_kind = annotator_kind or (
                str(row["annotator_kind"]).strip()  # pyright: ignore[reportUnknownArgumentType]
                if "annotator_kind" in row and bool(row["annotator_kind"])  # pyright: ignore[reportUnknownArgumentType]
                else None
            )

            # Extract all required ID values with proper type conversion
            id_params = {}
            missing_ids: list[str] = []

            for id_col in id_config.columns.keys():
                expected_type = id_config.columns.get(id_col, str)
                fallback_col = id_config.fallbacks.get(id_col)
                value = _extract_id_value(row, dataframe, id_col, fallback_col, expected_type)
                if value is not None:
                    id_params[id_col] = value
                else:
                    missing_ids.append(id_col)

            # For multi-ID configs, ALL IDs must be present
            if missing_ids:
                if len(id_config.columns) == 1:
                    # Single ID config can fall back to index
                    first_col = next(iter(id_config.columns.keys()))
                    expected_type = id_config.columns[first_col]
                    value = idx
                    if expected_type is str and isinstance(value, str):
                        value = value.strip()
                    id_params[first_col] = expected_type(value)
                else:
                    # Multi-ID config requires all IDs
                    raise ValueError(f"Row {idx}: Missing required ID columns: {missing_ids}")

            # Get optional fields with proper type conversion
            label = str(row["label"]).strip() if "label" in row and bool(row["label"]) else None  # pyright: ignore[reportUnknownArgumentType]
            score = None
            if "score" in row and row["score"] is not None:
                try:
                    score = float(row["score"])  # pyright: ignore[reportUnknownArgumentType,reportArgumentType]
                except (ValueError, TypeError):
                    raise TypeError(f"Score value '{row['score']}' cannot be converted to float")
            explanation = (
                str(row["explanation"]).strip()  # pyright: ignore[reportUnknownArgumentType]
                if "explanation" in row and bool(row["explanation"])  # pyright: ignore[reportUnknownArgumentType]
                else None
            )
            metadata = cast(
                dict[str, Any],
                dict(row["metadata"]) if "metadata" in row and bool(row["metadata"]) else None,  # pyright: ignore[reportUnknownArgumentType]
            )
            identifier = (
                str(row["identifier"]).strip()  # pyright: ignore[reportUnknownArgumentType]
                if "identifier" in row and bool(row["identifier"])  # pyright: ignore[reportUnknownArgumentType]
                else None
            )

            # Create annotation using factory function with all ID parameters
            # Check if the factory function accepts 'identifier' parameter
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

            # Only pass identifier if the function accepts it
            if "identifier" in factory_signature.parameters:
                kwargs["identifier"] = identifier

            annotation = annotation_factory(**kwargs)

            annotations.append(annotation)  # pyright: ignore[reportUnknownMemberType]

            # Yield chunk when we reach chunk_size
            if len(annotations) >= chunk_size:  # pyright: ignore[reportUnknownArgumentType]
                yield annotations
                annotations = []

        except Exception as e:
            raise ValueError(f"Error processing row {idx}: {str(e)}")

    # Yield any remaining annotations
    if annotations:
        yield annotations


# Convenience wrapper functions for specific annotation types
def _chunk_span_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name: Optional[str] = None,
    annotator_kind: Optional[str] = None,
    chunk_size: int = _DATAFRAME_CHUNK_SIZE,
) -> Iterator[list[v1.SpanAnnotationData]]:
    """Split a DataFrame into chunks for span annotation processing.

    Args:
        dataframe (pd.DataFrame): The DataFrame to split into chunks. Must contain either a 'span_id' column
            or 'context.span_id' column, or have a string-based index.
        annotation_name (Optional[str]): The name to use for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include a "name" column. Defaults to None.
        annotator_kind (Optional[str]): The kind of annotator used for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include an "annotator_kind" column. Defaults to None.
        chunk_size (int): Number of annotations per chunk. Defaults to _DATAFRAME_CHUNK_SIZE.

    Yields:
        Lists of SpanAnnotationData objects, one chunk at a time.

    Raises:
        ValueError: If required fields are missing during processing.
        TypeError: If score values cannot be converted to float.
    """  # noqa: E501
    return _chunk_annotations_dataframe(
        dataframe=dataframe,
        annotation_name=annotation_name,
        annotator_kind=annotator_kind,
        chunk_size=chunk_size,
        id_config=_SPAN_ID_CONFIG,
        annotation_factory=_create_span_annotation,
    )


def _chunk_document_annotations_dataframe(
    *,
    dataframe: "pd.DataFrame",
    annotation_name: Optional[str] = None,
    annotator_kind: Optional[str] = None,
    chunk_size: int = _DATAFRAME_CHUNK_SIZE,
) -> Iterator[list[v1.SpanDocumentAnnotationData]]:
    """Split a DataFrame into chunks for span document annotation processing.

    Args:
        dataframe (pd.DataFrame): The DataFrame to split into chunks. Must contain 'span_id' and 'document_position' columns
            (or 'context.span_id' as fallback for span_id).
        annotation_name (Optional[str]): The name to use for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include a "name" column. Defaults to None.
        annotator_kind (Optional[str]): The kind of annotator used for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include an "annotator_kind" column. Defaults to None.
        chunk_size (int): Number of annotations per chunk. Defaults to _DATAFRAME_CHUNK_SIZE.

    Yields:
        Lists of SpanDocumentAnnotationData objects, one chunk at a time.

    Raises:
        ValueError: If required fields are missing during processing.
        TypeError: If score values cannot be converted to float.
    """  # noqa: E501
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
