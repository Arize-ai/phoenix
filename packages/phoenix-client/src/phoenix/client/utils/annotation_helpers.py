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

    This configuration defines which columns are required as IDs, their expected types,
    and fallback column names. It supports both single-ID configs (e.g., span_id only)
    and multi-ID configs (e.g., span_id + document_position for document annotations).

    Key behaviors:
    - ID columns can be in DataFrame columns OR index levels, but not both
    - For multi-ID configs, ALL IDs must be in the same location (all columns or all index)
    - Fallbacks provide alternative column names (e.g., "context.span_id" for "span_id")
    - Single-ID configs can fall back to unnamed string index if no ID columns found
    """

    columns: Mapping[str, Type[Any]]  # Primary ID column names and their expected types
    fallbacks: Mapping[str, str] = MappingProxyType({})  # Fallback column name mappings


# Pre-configured ID configurations for different annotation types
# Each config defines the required IDs and their fallback strategies

# Single-ID config: span annotations require only span_id
# Important: Can fall back to "context.span_id" or unnamed string index
_SPAN_ID_CONFIG = _IdConfig(
    columns=MappingProxyType({"span_id": str}),
    fallbacks=MappingProxyType({"span_id": "context.span_id"}),
)

# Single-ID config: trace annotations require only trace_id
# Important: Can fall back to "context.trace_id" or unnamed string index
_TRACE_ID_CONFIG = _IdConfig(
    columns=MappingProxyType({"trace_id": str}),
    fallbacks=MappingProxyType({"trace_id": "context.trace_id"}),
)

# Multi-ID config: document annotations require BOTH span_id AND document_position
# Critical: ALL IDs must be in same location (columns OR index), no mixing allowed
# Note: No unnamed index fallback for multi-ID configs
_DOCUMENT_ID_CONFIG = _IdConfig(
    columns=MappingProxyType({"span_id": str, "document_position": int}),
    fallbacks=MappingProxyType({"span_id": "context.span_id"}),  # Only span_id has fallback
)

# Single-ID config: session annotations require only session_id
# Note: No fallback columns defined, must be exact match or unnamed index
_SESSION_ID_CONFIG = _IdConfig(
    columns=MappingProxyType({"session_id": str}),
    fallbacks=MappingProxyType({}),
)


def _get_index_names(dataframe: "pd.DataFrame") -> list[Any]:
    """Extract index level names from DataFrame, handling both MultiIndex and single Index.

    This function centralizes the complex logic for extracting index names from pandas
    DataFrames, which can have different index types (MultiIndex vs single Index).

    Args:
        dataframe: The pandas DataFrame to extract index names from.

    Returns:
        List of non-None index level names (can be any hashable type, not just strings).
        Returns empty list if index has no names (unnamed index).

    Important considerations:
        - MultiIndex.names can contain None values that must be filtered out
        - Single Index.name can be None (unnamed index)
        - Index names are typically strings but can be any hashable type
    """
    if hasattr(dataframe.index, "names") and dataframe.index.names:  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
        # MultiIndex case: filter out None names (unnamed levels)
        return [name for name in dataframe.index.names if name is not None]  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType,reportReturnType,reportUnnecessaryComparison]
    elif hasattr(dataframe.index, "name") and dataframe.index.name is not None:  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType,reportUnnecessaryComparison]
        # Named single Index case
        return [dataframe.index.name]  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType,reportReturnType]
    # Unnamed index case: return empty list
    return []


def _is_multiindex(dataframe: "pd.DataFrame") -> bool:
    """Check if DataFrame has a MultiIndex (more than one index level).

    This is used to determine how to extract values from index levels - MultiIndex
    requires get_level_values() while single Index can be accessed directly.

    Args:
        dataframe: The pandas DataFrame to check.

    Returns:
        True if the DataFrame has a MultiIndex (2+ levels), False for single level.

    Important considerations:
        - A named single Index is NOT a MultiIndex (has names=[name] but len=1)
        - Unnamed index has names=[None] so len=1, also not MultiIndex
    """
    return hasattr(dataframe.index, "names") and len(dataframe.index.names) > 1  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]


def _is_valid_value(value: Any, expected_type: Type[Any]) -> bool:
    """Check if a value is valid for the expected type.

    This function does basic type and emptiness validation for ID values.
    String types have additional validation for empty/whitespace-only values.

    Args:
        value: The value to check.
        expected_type: The expected type for the value.

    Returns:
        bool: True if the value is valid for the expected type, False otherwise.

    Important considerations:
        - None values are always invalid regardless of type
        - For strings: empty strings and whitespace-only strings are invalid
        - For non-strings: only None check is performed (type conversion happens later)
        - This is a lightweight check - full type validation happens elsewhere
    """  # noqa: E501
    if value is None:
        return False
    if expected_type is str:
        # Strings must be non-empty after stripping whitespace
        return isinstance(value, str) and value.strip() != ""
    # For non-string types, any non-None value is considered valid here
    # Full type validation happens in _validate_column_values and _validate_index_level_values
    return True


def _extract_id_value(
    row: Any,
    dataframe: "pd.DataFrame",
    column: str,
    fallback_column: Optional[str],
    expected_type: Type[Any],
) -> Optional[Any]:
    """Extract and convert ID value from DataFrame columns, with fallback support.

    This function implements the fallback chain for ID extraction from DataFrame columns:
    1. Try primary column (e.g., "span_id")
    2. If not found/invalid, try fallback column (e.g., "context.span_id")
    3. Return None if neither is available

    Args:
        row: The DataFrame row to extract the ID value from (pandas Series).
        dataframe: The pandas DataFrame containing the row (used for column checking).
        column: The primary column name to look for the ID value.
        fallback_column: Optional fallback column name if primary column is not found or invalid.
        expected_type: The expected type to convert the ID value to.

    Returns:
        Optional[Any]: The converted ID value if found and valid, None otherwise.

    Important considerations:
        - Column existence is checked against dataframe.columns, not just row keys
        - Values are validated using _is_valid_value before type conversion
        - String values are stripped of whitespace before type conversion
        - Type conversion can raise exceptions if value is incompatible with expected_type
    """  # noqa: E501
    # Try primary column first (e.g., "span_id")
    if column in dataframe.columns and _is_valid_value(row.loc[column], expected_type):  # pyright: ignore[reportUnknownArgumentType]
        value = row.loc[column]  # pyright: ignore[reportUnknownArgumentType]
        if expected_type is str and isinstance(value, str):
            value = value.strip()  # Clean whitespace for string types
        return expected_type(value)  # pyright: ignore[reportUnknownArgumentType]

    # Try fallback column if primary didn't work (e.g., "context.span_id")
    if (
        fallback_column
        and fallback_column in dataframe.columns
        and _is_valid_value(row.loc[fallback_column], expected_type)
    ):  # pyright: ignore[reportUnknownArgumentType]
        value = row.loc[fallback_column]  # pyright: ignore[reportUnknownArgumentType]
        if expected_type is str and isinstance(value, str):
            value = value.strip()  # Clean whitespace for string types
        return expected_type(value)  # pyright: ignore[reportUnknownArgumentType]

    # No valid value found in either column
    return None


def _extract_id_value_from_index(
    row_index: Any,
    dataframe: "pd.DataFrame",
    column: str,
    fallback_column: Optional[str],
    expected_type: Type[Any],
) -> Optional[Any]:
    """Extract and convert ID value from DataFrame index levels, with fallback support.

    This function handles the complex logic of extracting values from pandas index levels,
    which can be either a single named index or a MultiIndex with multiple levels.

    The extraction process:
    1. Get all available index level names
    2. Try primary level name (e.g., "span_id")
    3. If not found/invalid, try fallback level name (e.g., "context.span_id")
    4. Handle MultiIndex vs single Index extraction differently

    Args:
        row_index: The index of the current row (scalar for single index, tuple for MultiIndex).
        dataframe: The pandas DataFrame containing the row (used for index structure).
        column: The primary index level name to look for the ID value.
        fallback_column: Optional fallback index level name if primary is not found.
        expected_type: The expected type to convert the ID value to.

    Returns:
        Optional[Any]: The converted ID value if found and valid, None otherwise.

    Important considerations:
        - For MultiIndex: row_index is a tuple, need to find position of level name
        - For single Index: row_index is the value directly
        - Index level names must match exactly (case-sensitive)
        - Values are validated and type-converted just like column values
    """  # noqa: E501
    # Get all available index level names (filters out None names automatically)
    index_names = _get_index_names(dataframe)

    # Try primary index level first (e.g., "span_id")
    if column in index_names:
        if _is_multiindex(dataframe):
            # MultiIndex case: row_index is tuple, extract by position
            level_index = dataframe.index.names.index(column)  # pyright: ignore[reportUnknownMemberType]
            value = row_index[level_index]  # Extract from tuple by position
        else:
            # Single named index case: row_index is the value directly
            value = row_index

        if _is_valid_value(value, expected_type):
            if expected_type is str and isinstance(value, str):
                value = value.strip()  # Clean whitespace for string types
            return expected_type(value)

    # Try fallback index level if primary didn't work (e.g., "context.span_id")
    if fallback_column and fallback_column in index_names:
        if _is_multiindex(dataframe):
            # MultiIndex case: row_index is tuple, extract by position
            level_index = dataframe.index.names.index(fallback_column)  # pyright: ignore[reportUnknownMemberType]
            value = row_index[level_index]  # Extract from tuple by position
        else:
            # Single named index case: row_index is the value directly
            value = row_index

        if _is_valid_value(value, expected_type):
            if expected_type is str and isinstance(value, str):
                value = value.strip()  # Clean whitespace for string types
            return expected_type(value)

    # No valid value found in any index level
    return None


def _validate_column_values(
    dataframe: "pd.DataFrame", column: str, expected_type: Type[Any], value_description: str
) -> None:
    """Validate values in a specific DataFrame column with comprehensive type checking.

    This function performs thorough validation of column values, including None checks,
    type validation, and string-specific validation (empty/whitespace checking).

    Args:
        dataframe: The DataFrame to validate.
        column: The column name to validate (must exist in dataframe.columns).
        expected_type: The expected type for values in the column.
        value_description: Human-readable description of the values for error messages.

    Raises:
        ValueError: If any validation fails (None values, wrong types, empty strings).

    Important considerations:
        - Uses pandas .isna() which catches both None and NaN values
        - For strings: validates against empty strings AND whitespace-only strings
        - Type checking uses isinstance() for each individual value (not vectorized)
        - value_description should be user-friendly (e.g., "span_id", "annotation name")
    """
    # Check for None/NaN values (pandas .isna() catches both)
    if dataframe.loc[:, column].isna().any():  # pyright: ignore[reportUnknownMemberType,reportGeneralTypeIssues]
        raise ValueError(f"{value_description} values cannot be None")

    # Type-specific validation
    if expected_type is str:
        # String validation: check for empty strings after stripping whitespace
        if (dataframe.loc[:, column].str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"{value_description} values must be non-empty strings")
        # String validation: ensure all values are actually strings
        if not all(isinstance(x, str) for x in dataframe.loc[:, column]):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            raise ValueError(f"{value_description} values must be strings")
    else:
        # Non-string validation: check exact type match for all values
        if not all(isinstance(x, expected_type) for x in dataframe.loc[:, column]):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            raise ValueError(f"{value_description} values must be of type {expected_type.__name__}")


def _validate_index_level_values(
    dataframe: "pd.DataFrame", index_name: str, expected_type: Type[Any]
) -> None:
    """Validate values in a specific DataFrame index level with comprehensive type checking.

    This function handles the complex task of validating index level values, which requires
    different extraction methods for MultiIndex vs single Index, followed by the same
    validation logic as column values.

    Args:
        dataframe: The DataFrame to validate.
        index_name: The index level name to validate (must exist in index names).
        expected_type: The expected type for values in the index level.

    Raises:
        ValueError: If any validation fails (None values, wrong types, empty strings).
        ImportError: If pandas is not available.

    Important considerations:
        - MultiIndex uses get_level_values() to extract specific level
        - Single Index uses the index directly (index_name is just for error messages)
        - Index values are wrapped in pd.Series for consistent validation methods
        - Index level names are case-sensitive and must match exactly
    """
    try:
        import pandas as pd
    except ImportError:
        raise ImportError(
            "Pandas is not installed. Please install pandas to use this method: pip install pandas"
        )

    # Extract the index level values (different methods for MultiIndex vs single Index)
    if _is_multiindex(dataframe):
        # MultiIndex case: extract specific level by name
        level_index = dataframe.index.names.index(index_name)  # pyright: ignore[reportUnknownMemberType]
        level_values = dataframe.index.get_level_values(level_index)  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType]
    else:
        # Single named index case: use entire index (index_name is just for error context)
        level_values = dataframe.index  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType]

    # Check for None/NaN values (wrap in Series for consistent .isna() method)
    if pd.Series(level_values).isna().any():  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
        raise ValueError(f"Index level '{index_name}' values cannot be None")

    # Type-specific validation (same logic as column validation)
    if expected_type is str:
        # String validation: check for empty strings after stripping whitespace
        if (pd.Series(level_values).str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
            raise ValueError(f"Index level '{index_name}' values must be non-empty strings")
        # String validation: ensure all values are actually strings
        if not all(isinstance(x, str) for x in level_values):  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]
            raise ValueError(f"Index level '{index_name}' values must be strings")
    else:
        # Non-string validation: check exact type match for all values
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

    This is the core validation function that handles all annotation DataFrame validation.
    It performs comprehensive checks on structure, content, and types, with sophisticated
    support for ID columns in either DataFrame columns OR index levels.

    Validation stages:
    1. Basic DataFrame validation (type, emptiness)
    2. Name column validation (name vs annotation_name conflicts)
    3. Required column presence validation
    4. ID column location and structure validation (most complex part)
    5. ID value type and content validation
    6. Annotator kind value validation
    7. Result column presence validation

    Args:
        dataframe (pd.DataFrame): The DataFrame to validate.
        annotation_name_required (bool): Whether the annotation name field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.
        annotator_kind_required (bool): Whether the annotator kind field is required to be present
            in the DataFrame. If False, it can be provided as a global parameter. Defaults to False.
        id_config (_IdConfig): Configuration for ID column handling (columns, types, fallbacks).
            Defaults to _SPAN_ID_CONFIG. See _IdConfig docstring for behavior details.
        valid_annotator_kinds (frozenset[str]): Set of valid annotator kind values for this annotation type.
            Defaults to frozenset(["LLM", "CODE", "HUMAN"]).

    Raises:
        ValueError: If the DataFrame is missing required columns, if no valid annotation data is provided,
            or if annotator_kind values are invalid, or if ID column configuration is invalid.
        TypeError: If the input is not a pandas DataFrame.

    Critical behavior notes:
        - ID columns can be in DataFrame columns OR index levels, but not both for same ID
        - Multi-ID configs require ALL IDs in same location (all columns or all index)
        - Single-ID configs can fall back to unnamed string index if no ID columns found
        - Fallback columns (e.g., "context.span_id") cannot coexist with primary columns
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
        if dataframe.loc[:, col].isna().all():  # pyright: ignore[reportUnknownMemberType,reportGeneralTypeIssues]
            raise ValueError(f"Column '{col}' must contain at least one non-null value")

    # Validate name values if annotation name is required in DataFrame
    if annotation_name_required or (
        not annotation_name_required and (has_name or has_annotation_name)
    ):
        name_column = "annotation_name" if has_annotation_name else "name"
        _validate_column_values(dataframe, name_column, str, name_column)

    # STAGE 4: ID column location and structure validation (most complex part)
    # This section implements the sophisticated ID column detection logic that supports:
    # - Primary vs fallback column names (e.g., "span_id" vs "context.span_id")
    # - ID columns in DataFrame columns OR index levels (but not both)
    # - Single-ID vs multi-ID configurations with different fallback rules

    available_id_columns: list[str] = []  # ID columns found in DataFrame columns
    available_id_index_names: list[str] = []  # ID columns found in index levels
    conflicting_columns: list[tuple[str, str]] = []  # Primary/fallback conflicts
    missing_id_columns: list[str] = []  # IDs not found anywhere

    # Get all available index level names (empty list if unnamed index)
    index_names = _get_index_names(dataframe)

    # Check each required ID column for availability and conflicts
    for id_col in id_config.columns.keys():
        found_in_columns = False
        found_in_index = False

        # Step 1: Check if primary ID column is in DataFrame columns
        if id_col in dataframe.columns:
            available_id_columns.append(id_col)
            found_in_columns = True

        # Step 2: Check if primary ID column is in index level names
        if id_col in index_names:
            available_id_index_names.append(id_col)
            found_in_index = True

        # Step 3: Enforce rule - ID cannot be in both columns and index
        if found_in_columns and found_in_index:
            raise ValueError(
                f"ID column '{id_col}' cannot be present in both DataFrame columns and index"
            )

        # Step 4: If primary not found anywhere, try fallback column
        if not found_in_columns and not found_in_index:
            fallback_col = id_config.fallbacks.get(id_col)
            if fallback_col:
                # Check fallback in DataFrame columns
                if fallback_col in dataframe.columns:
                    available_id_columns.append(fallback_col)
                    found_in_columns = True
                # Check fallback in index level names
                elif fallback_col in index_names:
                    available_id_index_names.append(fallback_col)
                    found_in_index = True

            # Step 5: If still not found anywhere, mark as missing
            if not found_in_columns and not found_in_index:
                missing_id_columns.append(id_col)
        else:
            # Step 6: Check for primary/fallback conflicts in columns
            # (Primary found, but fallback also exists - this is not allowed)
            fallback_col = id_config.fallbacks.get(id_col)
            if fallback_col and fallback_col in dataframe.columns and found_in_columns:
                conflicting_columns.append((id_col, fallback_col))

    # STAGE 4a: Check for primary/fallback conflicts
    # Rule: Cannot have both "span_id" and "context.span_id" columns simultaneously
    if conflicting_columns:
        conflicts = [f"'{primary}' and '{fallback}'" for primary, fallback in conflicting_columns]
        raise ValueError(
            f"DataFrame cannot have both primary and fallback ID columns: {', '.join(conflicts)}"
        )

    # STAGE 4b: Multi-ID location consistency check
    # Rule: For multi-ID configs (e.g., span_id + document_position), ALL IDs must be in same
    # location. Valid: all in columns OR all in index. Invalid: some in columns, some in index
    multi_id_check = (
        len(id_config.columns) > 1 and available_id_columns and available_id_index_names
    )
    if multi_id_check:
        raise ValueError(
            "For multi-ID configurations, all ID columns must be in the same location "
            "(either all in DataFrame columns or all in index levels). "
            f"Found columns: {available_id_columns}, index levels: {available_id_index_names}"
        )

    # STAGE 4c: Missing ID column handling with fallback rules
    # Different rules for single-ID vs multi-ID configs:
    # - Single-ID: can fall back to unnamed string index if no ID columns found
    # - Multi-ID: ALL IDs must be present, no unnamed index fallback
    if missing_id_columns:
        if len(id_config.columns) == 1 and all(isinstance(x, str) for x in dataframe.index):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            # Single-ID config special case: unnamed string index is acceptable fallback
            # E.g., DataFrame with string index can be used for span_id if no columns found
            pass
        else:
            # Generate helpful error messages listing available options
            missing_options: list[str] = []
            for id_col in missing_id_columns:
                fallback_col = id_config.fallbacks.get(id_col)
                if fallback_col:
                    missing_options.append(f"'{id_col}' or '{fallback_col}'")
                else:
                    missing_options.append(f"'{id_col}'")

            # Different error messages for single vs multi-ID configs
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

    # STAGE 5: ID value type and content validation
    # Now that we know WHERE the IDs are, validate their actual values
    if available_id_columns:
        # Case 1: ID values are in DataFrame columns
        actual_id_column = available_id_columns[0]
        # Get expected data type (primary ID type, or str for fallback columns)
        expected_type = id_config.columns.get(actual_id_column, str)
        _validate_column_values(dataframe, actual_id_column, expected_type, actual_id_column)

    elif available_id_index_names:
        # Case 2: ID values are in index levels (single index or MultiIndex)
        for index_name in available_id_index_names:
            # Get expected data type for this specific index level
            expected_type = id_config.columns.get(index_name, str)
            _validate_index_level_values(dataframe, index_name, expected_type)

    else:
        # Case 3: Using unnamed string index as fallback (single-ID config only)
        # This path is only reached for single-ID configs where no named columns/index found
        if len(id_config.columns) == 1:
            # Validate unnamed index values directly (must be non-empty strings)
            if (pd.Series(dataframe.index).str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
                raise ValueError("Index values must be non-empty strings when used as ID")
            if not all(isinstance(x, str) for x in dataframe.index):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
                raise ValueError("Index values must be strings when used as ID")

    # STAGE 6: Annotator kind value validation
    # Check that annotator_kind values are from the allowed set (LLM, CODE, HUMAN, etc.)
    if annotator_kind_required or (
        not annotator_kind_required and "annotator_kind" in dataframe.columns
    ):
        # Get unique non-null values and check against allowed values
        invalid_values = (
            set(dataframe.loc[:, "annotator_kind"].dropna().unique()) - valid_annotator_kinds  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
        )
        if invalid_values:
            raise ValueError(
                f"Invalid annotator_kind values found in DataFrame: {invalid_values}. "
                f"Must be one of: {valid_annotator_kinds}"
            )

    # STAGE 7: Result column presence validation
    # Ensure at least one annotation result field is present (can't have annotations without
    # results)
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

    This function converts DataFrame rows into annotation objects using a chunked processing approach
    for memory efficiency. It handles the complex ID extraction logic (columns vs index levels),
    applies global parameter overrides, and performs type conversions.

    Processing flow for each row:
    1. Extract annotation name (global override or row value)
    2. Extract annotator kind (global override or row value)
    3. Extract all required ID values using the same fallback logic as validation
    4. Extract optional annotation fields (label, score, explanation, metadata, identifier)
    5. Create annotation object using factory function
    6. Yield chunks when chunk_size is reached

    IMPORTANT: This function assumes the DataFrame has already been validated. Call the appropriate
    validation function first (_validate_annotations_dataframe or its wrappers).

    Args:
        dataframe (pd.DataFrame): The DataFrame to process. Must be pre-validated.
        annotation_name (Optional[str]): Global annotation name to use for all rows. If provided,
            overrides any "name" or "annotation_name" columns. Defaults to None.
        annotator_kind (Optional[str]): Global annotator kind to use for all rows. If provided,
            overrides any "annotator_kind" column. Defaults to None.
        chunk_size (int): Number of annotations per chunk. Defaults to _DATAFRAME_CHUNK_SIZE (100).
        id_config (_IdConfig): Configuration for ID column handling. Must match validation.
        annotation_factory (Callable[..., T]): Function to create annotation objects from extracted data.

    Yields:
        Lists of annotation objects, one chunk at a time. Final chunk may be smaller than chunk_size.

    Raises:
        ValueError: If required fields are missing during processing (should not happen if pre-validated).
        TypeError: If score values cannot be converted to float.

    Critical behavior notes:
        - Uses same ID extraction logic as validation but operates on individual rows
        - Global parameters (annotation_name, annotator_kind) override DataFrame columns
        - Factory function signature is inspected to conditionally pass 'identifier' parameter
        - Yields empty list if no annotations are generated (empty DataFrame after validation)
    """  # noqa: E501

    annotations = []
    for idx, row in dataframe.iterrows():  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
        try:
            # Get required fields with null checks
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

            # Extract all required ID values with proper type conversion
            id_params = {}
            missing_ids: list[str] = []

            for id_col in id_config.columns.keys():
                expected_type = id_config.columns.get(id_col, str)
                fallback_col = id_config.fallbacks.get(id_col)

                # Try to extract from columns first
                value = _extract_id_value(row, dataframe, id_col, fallback_col, expected_type)

                # If not found in columns, try to extract from index
                if value is None:
                    value = _extract_id_value_from_index(
                        idx, dataframe, id_col, fallback_col, expected_type
                    )

                if value is not None:
                    id_params[id_col] = value
                else:
                    missing_ids.append(id_col)

            # For multi-ID configs, ALL IDs must be present
            # For single-ID configs, allow fallback to unnamed index
            if missing_ids:
                if len(id_config.columns) == 1:
                    # Single ID config can fall back to unnamed index
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
