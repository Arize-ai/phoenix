import ast
import logging
import math
import operator
from abc import ABC, abstractmethod
from copy import deepcopy
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Any, Callable, Literal, Optional, Union, get_args

from sqlalchemy import (
    BinaryExpression,
    Boolean,
    Float,
    Integer,
    Null,
    Select,
    String,
    and_,
    cast,
    literal,
    or_,
)
from sqlalchemy.orm import aliased
from sqlalchemy.sql import operators as sqlalchemy_operators
from typing_extensions import TypeAlias, TypeGuard, assert_never

from phoenix.db import models
from phoenix.db.models import SafeJsonBoolean, SafeJsonFloat

logger = logging.getLogger(__name__)

SupportedComparisonOperator: TypeAlias = Union[
    ast.Is,
    ast.IsNot,
    ast.In,
    ast.NotIn,
    ast.Eq,
    ast.NotEq,
    ast.Lt,
    ast.LtE,
    ast.Gt,
    ast.GtE,
]
SupportedConstantType: TypeAlias = Union[bool, int, float, str, None]
SQLAlchemyDataType: TypeAlias = Union[Boolean, Integer, Float[float], String]
ExperimentID: TypeAlias = int
SupportedUnaryBooleanOperator: TypeAlias = ast.Not
SupportedUnaryTermOperator: TypeAlias = ast.USub
SupportedDatasetExampleAttributeName: TypeAlias = Literal["input", "reference_output", "metadata"]
SupportedExperimentRunAttributeName: TypeAlias = Literal["output", "error", "latency_ms", "evals"]
SupportedExperimentRunEvalAttributeName: TypeAlias = Literal["score", "explanation", "label"]
EvalName: TypeAlias = str


def update_examples_query_with_filter_condition(
    query: Select[Any], filter_condition: str, experiment_ids: list[int]
) -> Select[Any]:
    orm_filter_condition, transformer = compile_sqlalchemy_filter_condition(
        filter_condition=filter_condition, experiment_ids=experiment_ids
    )
    for experiment_id in experiment_ids:
        experiment_runs = transformer.get_experiment_runs_alias(experiment_id)
        if experiment_runs is None:
            continue
        query = query.join(
            experiment_runs,
            onclause=and_(
                experiment_runs.dataset_example_id == models.DatasetExample.id,
                experiment_runs.experiment_id == experiment_id,
            ),
            isouter=True,
        )
        experiment_run_annotations_aliases = transformer.get_experiment_run_annotations_aliases(
            experiment_id
        )
        for eval_name, experiment_run_annotations in experiment_run_annotations_aliases.items():
            query = query.join(
                experiment_run_annotations,
                onclause=(
                    and_(
                        experiment_run_annotations.experiment_run_id == experiment_runs.id,
                        experiment_run_annotations.name == eval_name,
                    )
                ),
                isouter=True,
            )
    query = query.where(orm_filter_condition)
    return query


def compile_sqlalchemy_filter_condition(
    filter_condition: str, experiment_ids: list[int]
) -> tuple[Any, "SQLAlchemyTransformer"]:
    """Compile a filter condition, reporting every rejection as a filter error.

    Validation here happens during construction rather than as a pass over the
    whole tree, so an expression can reach a branch no node anticipated and fail
    with whatever Python raises there -- `AssertionError` from `assert_never`,
    `TypeError` from an operation applied to the wrong shape. Those are not
    caught by callers, which look only for
    `ExperimentRunFilterConditionSyntaxError`, so an ordinary typo in a filter
    box surfaced as a server error.

    A condition is user input: every way it can fail is a filter error, not a
    fault. The original is logged with its traceback, because an unexpected
    exception type here still indicates a gap in validation worth closing.
    """
    # Checked before the boundary below, deliberately. An empty list is a caller
    # contract violation, not something a user typed, and reporting it as an
    # invalid filter would blame them for our bug.
    if not experiment_ids:
        raise ValueError("Must provide one or more experiments")
    try:
        return _compile_sqlalchemy_filter_condition(
            filter_condition=filter_condition, experiment_ids=experiment_ids
        )
    except ExperimentRunFilterConditionSyntaxError as error:
        # Messages name the offending fragment, which can be a 320-digit
        # literal or a multi-kilobyte expression reflected into the UI, logs,
        # and GraphQL responses. This is the backstop: fragment-first messages
        # bound their echo at the format site (see `_ellipsize`), and this
        # bounds the whole message for any site that forgets.
        raise ExperimentRunFilterConditionSyntaxError(_ellipsize(str(error))) from error
    except RecursionError:
        # Parsing, transformation, and compilation all recurse, so deeply
        # nested input can exhaust the stack at any of them.
        raise ExperimentRunFilterConditionSyntaxError(
            "Filter condition is nested too deeply"
        ) from None
    except Exception as error:
        # The condition echo is bounded here too: this is the one place the
        # *source* text reaches a log, and log entries are as much a
        # reflection surface as GraphQL responses.
        logger.exception(
            "Unexpected error compiling filter condition: %r", _ellipsize(filter_condition)
        )
        # Deliberately generic: the internal message ("Expected code to be
        # unreachable!") describes our code, not the user's condition.
        raise ExperimentRunFilterConditionSyntaxError("Invalid filter condition") from error


def _compile_sqlalchemy_filter_condition(
    filter_condition: str, experiment_ids: list[int]
) -> tuple[Any, "SQLAlchemyTransformer"]:
    try:
        original_tree = ast.parse(filter_condition, mode="eval")
    except SyntaxError as error:
        if "null bytes" in str(error):
            # A NUL in the source, which CPython reports as `ValueError` on
            # 3.10 (the branch below) and as `SyntaxError` from 3.11 on. One
            # canonical message, whatever the interpreter.
            raise ExperimentRunFilterConditionSyntaxError(
                "Filter condition cannot contain a NUL character"
            ) from error
        if "integer string conversion" in str(error):
            # CPython's 4300-digit guard, whose message advises
            # `sys.set_int_max_str_digits()` -- Python's remedy, not the
            # condition's. Every such literal is invalid here anyway.
            raise ExperimentRunFilterConditionSyntaxError(
                "Invalid numeric literal: too many digits"
            ) from error
        # `str()` on a parser error appends `(<unknown>, line 1)` -- a file
        # the user never wrote in -- and these messages surface verbatim in
        # the filter field and through the GraphQL masker. `msg` carries the
        # useful part; the column is the one locator a one-line condition has.
        message = error.msg or "invalid syntax"
        message = message.replace(" (detected at line 1)", "")
        if (offset := error.offset) is not None and offset > 0:
            message = f"{message} at character {offset}"
        raise ExperimentRunFilterConditionSyntaxError(message) from error
    except ValueError as error:
        # A NUL anywhere in the source, which `ast.parse` reports as a
        # `ValueError` rather than a `SyntaxError`.
        raise ExperimentRunFilterConditionSyntaxError(
            "Filter condition cannot contain a NUL character"
        ) from error
    _validate_python_surface(original_tree.body, filter_condition)

    trees_with_bound_attribute_names = _bind_free_attribute_names(original_tree, experiment_ids)
    has_free_attribute_names = bool(trees_with_bound_attribute_names)
    if has_free_attribute_names:
        # compile the filter condition once for each experiment and return the disjunction
        sqlalchemy_transformer = SQLAlchemyTransformer(experiment_ids=experiment_ids)
        compiled_filter_conditions: dict[ExperimentID, BinaryExpression[Any]] = {}
        for experiment_id, tree in trees_with_bound_attribute_names.items():
            sqlalchemy_tree = sqlalchemy_transformer.visit(tree)
            node = sqlalchemy_tree.body
            if not isinstance(node, BooleanExpression):
                raise ExperimentRunFilterConditionSyntaxError(
                    "Filter condition must be a boolean expression"
                )
            compiled_filter_conditions[experiment_id] = node.compile()
        return or_(*compiled_filter_conditions.values()), sqlalchemy_transformer

    # compile the filter condition once for all experiments
    sqlalchemy_transformer = SQLAlchemyTransformer(experiment_ids)
    sqlalchemy_tree = sqlalchemy_transformer.visit(original_tree)
    node = sqlalchemy_tree.body
    if not isinstance(node, BooleanExpression):
        raise ExperimentRunFilterConditionSyntaxError(
            "Filter condition must be a boolean expression"
        )
    compiled_filter_condition = node.compile()
    return compiled_filter_condition, sqlalchemy_transformer


def _bind_free_attribute_names(
    tree: ast.AST, experiment_ids: list[ExperimentID]
) -> dict[ExperimentID, ast.AST]:
    trees_with_bound_attribute_names: dict[ExperimentID, ast.AST] = {}
    for experiment_index, experiment_id in enumerate(experiment_ids):
        binder = FreeAttributeNameBinder(experiment_index=experiment_index)
        trees_with_bound_attribute_names[experiment_id] = binder.visit(deepcopy(tree))
        has_free_attribute_names = binder.binds_free_attribute_name
        if not has_free_attribute_names:
            return {}  # return early since there are no free attribute names
    return trees_with_bound_attribute_names


class FreeAttributeNameBinder(ast.NodeTransformer):
    def __init__(self, *, experiment_index: int) -> None:
        super().__init__()
        self._experiment_index = experiment_index
        self._binds_free_attribute_name = False

    def visit_Name(self, node: ast.Name) -> Any:
        name = node.id
        if _is_supported_experiment_run_attribute_name(name):
            self._binds_free_attribute_name = True
            return ast.Attribute(
                value=ast.Subscript(
                    value=ast.Name(id="experiments", ctx=ast.Load()),
                    slice=ast.Constant(value=self._experiment_index),
                    ctx=ast.Load(),
                ),
                attr=name,
                ctx=node.ctx,
            )
        return node

    @property
    def binds_free_attribute_name(self) -> bool:
        return self._binds_free_attribute_name


class ExperimentRunFilterConditionSyntaxError(Exception):
    pass


def _ellipsize(message: str, limit: int = 300) -> str:
    """Bound text that echoes user-controlled input.

    As in the span DSL, two layers: format sites whose fragment precedes the
    advice bound the fragment itself (limit 80) so truncation cannot eat the
    guidance, and the compile boundary bounds the whole message as the
    backstop for any site that forgets.
    """
    return message if len(message) <= limit else message[: limit - 1] + "…"


def _is_finite_number(value: Union[int, float]) -> bool:
    """Whether the value converts to a finite float -- the portability bound
    every numeric literal must satisfy. As in the span DSL, one predicate so
    the int and float rules cannot drift."""
    try:
        return math.isfinite(float(value))
    except OverflowError:
        # An int too large for a float.
        return False


@dataclass(frozen=True)
class ExperimentRunFilterConditionNode(ABC):
    """
    A node in a tree representing a SQLAlchemy expression.
    """

    ast_node: ast.AST

    @abstractmethod
    def compile(self) -> Any:
        """
        Compiles the node into a SQLAlchemy expression.
        """
        raise NotImplementedError


@dataclass(frozen=True)
class Term(ExperimentRunFilterConditionNode):
    @property
    def data_type(self) -> Optional[SQLAlchemyDataType]:
        return None


@dataclass(frozen=True)
class Constant(Term):
    value: SupportedConstantType

    def compile(self) -> Any:
        value = self.value
        if value is None:
            return Null()
        return literal(value)

    @property
    def data_type(self) -> Optional[SQLAlchemyDataType]:
        value = self.value
        if isinstance(value, bool):
            return Boolean()
        elif isinstance(value, int):
            return Integer()
        elif isinstance(value, float):
            return Float()
        elif isinstance(value, str):
            return String()
        elif value is None:
            return None
        assert_never(value)


class ExperimentsName(ExperimentRunFilterConditionNode):
    def compile(self) -> Any:
        raise ExperimentRunFilterConditionSyntaxError("Select an experiment with [<index>]")


@dataclass(frozen=True)
class ExperimentRun(ExperimentRunFilterConditionNode):
    slice: Constant
    experiment_ids: list[int]
    experiment_id: int = field(init=False)

    def __post_init__(self) -> None:
        experiment_index = self.slice.value
        # As above: `experiments[True]` must not silently mean `experiments[1]`.
        if isinstance(experiment_index, bool) or not isinstance(experiment_index, int):
            raise ExperimentRunFilterConditionSyntaxError("Index to experiments must be an integer")
        if not (0 <= experiment_index < len(self.experiment_ids)):
            raise ExperimentRunFilterConditionSyntaxError("Select an experiment with [<index>]")
        object.__setattr__(self, "experiment_id", self.experiment_ids[experiment_index])

    def compile(self) -> Any:
        raise ExperimentRunFilterConditionSyntaxError("Add an attribute")


@dataclass(frozen=True)
class Attribute(Term):
    pass


@dataclass(frozen=True)
class HasAliasedTables:
    transformer: "SQLAlchemyTransformer"

    def experiment_run_alias(self, experiment_id: ExperimentID) -> Any:
        return self.transformer.get_experiment_runs_alias(
            experiment_id
        ) or self.transformer.create_experiment_runs_alias(experiment_id)

    def experiment_run_annotation_alias(
        self, experiment_id: ExperimentID, eval_name: EvalName
    ) -> Any:
        return self.transformer.get_experiment_run_annotations_alias(
            experiment_id, eval_name
        ) or self.transformer.create_experiment_run_annotations_alias(experiment_id, eval_name)


@dataclass(frozen=True)
class DatasetExampleAttribute(HasAliasedTables, Attribute):
    attribute_name: str
    _attribute_name: SupportedDatasetExampleAttributeName = field(init=False)

    def __post_init__(self) -> None:
        if not _is_supported_dataset_example_attribute(self.attribute_name):
            raise ExperimentRunFilterConditionSyntaxError("Unknown name")
        object.__setattr__(self, "_attribute_name", self.attribute_name)

    def compile(self) -> Any:
        attribute_name = self._attribute_name
        if attribute_name == "input":
            return models.DatasetExampleRevision.input
        elif attribute_name == "reference_output":
            return models.DatasetExampleRevision.output
        elif attribute_name == "metadata":
            return models.DatasetExampleRevision.metadata_
        assert_never(attribute_name)


@dataclass(frozen=True)
class ExperimentRunAttribute(HasAliasedTables, Attribute):
    attribute_name: str
    experiment_id: int
    _attribute_name: SupportedExperimentRunAttributeName = field(init=False)

    def __post_init__(self) -> None:
        if not _is_supported_experiment_run_attribute_name(self.attribute_name):
            raise ExperimentRunFilterConditionSyntaxError("Unknown name")
        object.__setattr__(self, "_attribute_name", self.attribute_name)

    def compile(self) -> Any:
        attribute_name = self._attribute_name
        experiment_id = self.experiment_id
        if attribute_name == "evals":
            raise ExperimentRunFilterConditionSyntaxError("Select an eval with [<eval-name>]")
        elif attribute_name == "output":
            aliased_experiment_run = self.experiment_run_alias(experiment_id)
            return aliased_experiment_run.output["task_output"]
        elif attribute_name == "error":
            aliased_experiment_run = self.experiment_run_alias(experiment_id)
            return aliased_experiment_run.error
        elif attribute_name == "latency_ms":
            aliased_experiment_run = self.experiment_run_alias(experiment_id)
            return aliased_experiment_run.latency_ms
        assert_never(attribute_name)

    @property
    def is_eval_attribute(self) -> bool:
        return self.attribute_name == "evals"

    @property
    def is_json_attribute(self) -> bool:
        return self.attribute_name in ("input", "reference_output", "output")

    @property
    def data_type(self) -> Optional[SQLAlchemyDataType]:
        attribute_name = self._attribute_name
        if attribute_name == "evals":
            return None
        elif attribute_name == "output":
            return None
        elif attribute_name == "error":
            return String()
        elif attribute_name == "latency_ms":
            return Float()
        assert_never(attribute_name)


@dataclass(frozen=True)
class JSONAttribute(Attribute):
    attribute: Attribute
    index_constant: Constant
    _index_value: Union[int, str] = field(init=False)

    def __post_init__(self) -> None:
        index_value = self.index_constant.value
        # `bool` is a subclass of `int`, so `input[True]` would otherwise be
        # accepted as `input[1]` -- a position the user did not write.
        if isinstance(index_value, bool) or not isinstance(index_value, (int, str)):
            raise ExperimentRunFilterConditionSyntaxError("Index must be an integer or string")
        object.__setattr__(self, "_index_value", index_value)

    def compile(self) -> Any:
        compiled_attribute = self.attribute.compile()
        return compiled_attribute[self._index_value]


@dataclass(frozen=True)
class ExperimentRunEval(ExperimentRunFilterConditionNode):
    experiment_run_attribute: ExperimentRunAttribute
    eval_name: str
    experiment_id: int = field(init=False)

    def __post_init__(self) -> None:
        if not isinstance(self.eval_name, str):
            raise ExperimentRunFilterConditionSyntaxError("Eval must be indexed by string")
        object.__setattr__(self, "experiment_id", self.experiment_run_attribute.experiment_id)

    def compile(self) -> Any:
        raise ExperimentRunFilterConditionSyntaxError(
            "Choose an attribute for your eval (label, score, etc.)"
        )


@dataclass(frozen=True)
class ExperimentRunEvalAttribute(HasAliasedTables, Attribute):
    experiment_run_eval: ExperimentRunEval
    attribute_name: str
    experiment_id: int = field(init=False)
    _attribute_name: SupportedExperimentRunEvalAttributeName = field(init=False)
    _eval_name: str = field(init=False)

    def __post_init__(self) -> None:
        if not _is_supported_experiment_run_eval_attribute_name(self.attribute_name):
            raise ExperimentRunFilterConditionSyntaxError("Unknown eval attribute")
        object.__setattr__(self, "experiment_id", self.experiment_run_eval.experiment_id)
        object.__setattr__(self, "_attribute_name", self.attribute_name)
        object.__setattr__(self, "_eval_name", self.experiment_run_eval.eval_name)

    def compile(self) -> Any:
        experiment_id = self.experiment_id
        eval_name = self._eval_name
        attribute_name = self._attribute_name
        experiment_run_annotations = self.experiment_run_annotation_alias(experiment_id, eval_name)
        return getattr(experiment_run_annotations, attribute_name)

    @property
    def data_type(self) -> Optional[SQLAlchemyDataType]:
        attribute_name = self._attribute_name
        if attribute_name == "label":
            return String()
        elif attribute_name == "score":
            return Float()
        elif attribute_name == "explanation":
            return String()
        assert_never(attribute_name)


@dataclass(frozen=True)
class UnaryTermOperation(Term):
    operand: Term
    operator: SupportedUnaryTermOperator

    def __post_init__(self) -> None:
        # As in `ComparisonOperation`: a whole JSON document has no scalar to
        # negate, so require a keyed extract before the numeric conversion.
        if isinstance(self.operand, DatasetExampleAttribute):
            raise ExperimentRunFilterConditionSyntaxError(
                f"Select a key from `{self.operand.attribute_name}` with [<key>]"
            )
        # Negating text is not something either backend agrees on: PostgreSQL
        # rejects `-'hello'` as an ambiguous operator, SQLite coerces it to 0.
        data_type = self.operand.data_type
        if data_type is not None and _get_data_type_family(data_type) != "number":
            raise ExperimentRunFilterConditionSyntaxError("Unary minus requires a numeric operand")

    @property
    def data_type(self) -> Optional[SQLAlchemyDataType]:
        # Negating a number yields a number. Reporting "unknown" here made the
        # comparison treat an already-numeric operand as a JSON value and wrap
        # it in `SafeJsonFloat`, which PostgreSQL rejects outright --
        # `jsonb_path_query_first(numeric, ...) does not exist`. An unknown
        # operand is converted to a number by `compile` below, so the result is
        # numeric either way and the comparison must not wrap it again.
        return self.operand.data_type or Float()

    def compile(self) -> Any:
        operator = self.operator
        operand = self.operand
        sqlalchemy_operator: Callable[[Any], Any]
        if isinstance(operator, ast.USub):
            sqlalchemy_operator = sqlalchemy_operators.neg
        else:
            assert_never(operator)
        compiled_operand = operand.compile()
        if operand.data_type is None:
            # Convert before negating, not after. `-` has no meaning for a JSON
            # value -- PostgreSQL rejects `- jsonb` outright, and SQLite quietly
            # coerces -- so the safe numeric conversion has to happen first.
            compiled_operand = SafeJsonFloat(compiled_operand)
        return sqlalchemy_operator(compiled_operand)


@dataclass(frozen=True)
class BooleanExpression(ExperimentRunFilterConditionNode):
    pass


@dataclass(frozen=True)
class ComparisonOperation(BooleanExpression):
    left_operand: Term
    right_operand: Term
    operator: ast.cmpop
    _operator: SupportedComparisonOperator = field(init=False)

    def __post_init__(self) -> None:
        operator = self.operator
        if not _is_supported_comparison_operator(operator):
            raise ExperimentRunFilterConditionSyntaxError("Unsupported comparison operator")
        if isinstance(operator, (ast.Is, ast.IsNot)) and not (
            _is_singleton(self.left_operand) or _is_singleton(self.right_operand)
        ):
            # SQL has no identity comparison. `score is 1` compiled to
            # `score IS %(param)s`, which PostgreSQL rejects; only the
            # singletons have a SQL spelling (`IS NULL` / `IS TRUE` /
            # `IS FALSE`).
            raise ExperimentRunFilterConditionSyntaxError(
                "`is` is only supported with None, True, or False"
            )
        for operand in (self.left_operand, self.right_operand):
            # A whole JSON document has no scalar to compare or search: every
            # accessor downstream (`as_string`, the safe casts) assumes a keyed
            # extract, so a bare column failed inside compilation with an
            # implementation error (`JSON.as_string() only works with a JSON
            # index expression`) instead of a message about the filter.
            if isinstance(operand, DatasetExampleAttribute):
                raise ExperimentRunFilterConditionSyntaxError(
                    f"Select a key from `{operand.attribute_name}` with [<key>]"
                )
        if isinstance(operator, (ast.In, ast.NotIn)):
            # Membership compiles to string containment (`strpos` / `instr`),
            # so a non-text operand hands the database SQL it cannot run --
            # `strpos(numeric, integer) does not exist` on PostgreSQL -- after
            # the condition has been reported valid. The span DSL rejects the
            # same shapes with the same message.
            left_family = _get_operand_family(self.left_operand)
            right_family = _get_operand_family(self.right_operand)
            if left_family not in (None, "string") or right_family not in (None, "string"):
                raise ExperimentRunFilterConditionSyntaxError(
                    f"cannot compare {left_family or 'value'} and {right_family or 'string'}"
                )
        if isinstance(operator, (ast.Lt, ast.LtE, ast.Gt, ast.GtE)) and "boolean" in (
            _get_operand_family(self.left_operand),
            _get_operand_family(self.right_operand),
        ):
            # Ordered comparison casts the JSON side to a number, so
            # `input['x'] > True` compiled to `numeric > boolean` -- an
            # operator PostgreSQL does not have -- after the condition
            # validated. As in the span DSL, the rule is by type.
            raise ExperimentRunFilterConditionSyntaxError(
                "cannot order a boolean, use `==`, `!=`, or `is` instead of `<` / `>`"
            )
        _validate_comparable_data_types(self.left_operand, self.right_operand)
        object.__setattr__(self, "_operator", operator)

    def compile(self) -> Any:
        left_operand = self.left_operand
        right_operand = self.right_operand
        operator = self._operator
        compiled_left_operand = left_operand.compile()
        compiled_right_operand = right_operand.compile()
        cast_type = _get_cast_type_for_comparison(
            operator=operator,
            left_operand=left_operand,
            right_operand=right_operand,
        )
        if cast_type is not None:
            if left_operand.data_type is None:
                compiled_left_operand = _cast_json_value(compiled_left_operand, cast_type)
            if right_operand.data_type is None:
                compiled_right_operand = _cast_json_value(compiled_right_operand, cast_type)
        else:
            # Comparison against None, the only case with no cast type. The
            # accessor still has to be unwrapped, or `IS NULL` tests the JSON
            # rendering instead of the value.
            if left_operand.data_type is None:
                compiled_left_operand = _as_json_scalar(compiled_left_operand)
            if right_operand.data_type is None:
                compiled_right_operand = _as_json_scalar(compiled_right_operand)
        sqlalchemy_operator = _get_sqlalchemy_comparison_operator(operator)
        return sqlalchemy_operator(compiled_left_operand, compiled_right_operand)


@dataclass(frozen=True)
class UnaryBooleanOperation(BooleanExpression):
    operand: ExperimentRunFilterConditionNode
    operator: SupportedUnaryBooleanOperator

    def __post_init__(self) -> None:
        if not isinstance(self.operand, BooleanExpression):
            raise ExperimentRunFilterConditionSyntaxError("Operand must be a boolean expression")

    def compile(self) -> Any:
        operator = self.operator
        sqlalchemy_operator: Callable[[Any], Any]
        if isinstance(operator, ast.Not):
            sqlalchemy_operator = sqlalchemy_operators.inv
        else:
            assert_never(operator)
        compiled_operand = self.operand.compile()
        return sqlalchemy_operator(compiled_operand)


@dataclass(frozen=True)
class BooleanOperation(BooleanExpression):
    operator: ast.boolop
    operands: list[BooleanExpression]

    def __post_init__(self) -> None:
        if len(self.operands) < 2:
            raise ExperimentRunFilterConditionSyntaxError(
                "Boolean operators require at least two operands"
            )
        # `not` already required this of its operand; `and` / `or` did not, so
        # `input and error` compiled to `dataset_example_revisions.input AND
        # experiment_runs_0.error` -- a JSON column in boolean position, which
        # PostgreSQL rejects and SQLite silently coerces.
        for operand in self.operands:
            if not isinstance(operand, BooleanExpression):
                raise ExperimentRunFilterConditionSyntaxError(
                    "Operands of `and` / `or` must be boolean expressions"
                )

    def compile(self) -> Any:
        ast_operator = self.operator
        operands = [operand.compile() for operand in self.operands]
        if isinstance(ast_operator, ast.And):
            return and_(*operands)
        elif isinstance(ast_operator, ast.Or):
            return or_(*operands)
        raise ExperimentRunFilterConditionSyntaxError("Unsupported boolean operator")


class SQLAlchemyTransformer(ast.NodeTransformer):
    def __init__(self, experiment_ids: list[int]) -> None:
        if not experiment_ids:
            raise ValueError("Must provide one or more experiments")
        self._experiment_ids = experiment_ids
        self._aliased_experiment_runs: dict[ExperimentID, Any] = {}
        self._aliased_experiment_run_annotations: dict[ExperimentID, dict[EvalName, Any]] = {}

    def visit_Constant(self, node: ast.Constant) -> Constant:
        value = node.value
        if not (value is None or isinstance(value, (bool, int, float, str))):
            # `_validate_python_surface` already rejected these, so reaching
            # here means it and `Constant` disagree about the value types.
            raise ExperimentRunFilterConditionSyntaxError(
                f"Unsupported literal: `{ast.unparse(node)}`"
            )
        return Constant(value=value, ast_node=node)

    def visit_List(self, node: ast.List) -> Any:
        # There is no node type for a collection, so an untransformed `ast.List`
        # used to reach compilation and fail with `'Constant' object is not
        # iterable`. Saying so plainly is the point: the construct is
        # unimplemented, and reporting it as an invalid condition tells the user
        # their perfectly reasonable filter is wrong.
        raise ExperimentRunFilterConditionSyntaxError(
            "Membership against a list is not supported here; "
            "compare against a single value, or combine comparisons with `or`"
        )

    def visit_Tuple(self, node: ast.Tuple) -> Any:
        return self.visit_List(ast.List(elts=node.elts, ctx=node.ctx))

    def visit_Name(self, node: ast.Name) -> ExperimentRunFilterConditionNode:
        name = node.id
        if name == "experiments":
            return ExperimentsName(ast_node=node)
        elif _is_supported_dataset_example_attribute(name):
            return DatasetExampleAttribute(
                attribute_name=name,
                transformer=self,
                ast_node=node,
            )
        raise ExperimentRunFilterConditionSyntaxError("Unknown name")

    def visit_UnaryOp(self, node: ast.UnaryOp) -> Union[UnaryBooleanOperation, UnaryTermOperation]:
        operator = node.op
        operand = self.visit(node.operand)
        if _is_supported_unary_boolean_operator(operator):
            return UnaryBooleanOperation(operand=operand, operator=operator, ast_node=node)
        if _is_supported_unary_term_operator(operator):
            return UnaryTermOperation(operand=operand, operator=operator, ast_node=node)
        raise ExperimentRunFilterConditionSyntaxError("Unsupported unary operator")

    def visit_BoolOp(self, node: ast.BoolOp) -> BooleanOperation:
        operator = node.op
        operands = [self.visit(value) for value in node.values]
        return BooleanOperation(operator=operator, operands=operands, ast_node=node)

    def visit_Compare(self, node: ast.Compare) -> ExperimentRunFilterConditionNode:
        if not (len(node.ops) == 1 and len(node.comparators) == 1):
            raise ExperimentRunFilterConditionSyntaxError("Only binary comparisons are supported")
        left_operand = self.visit(node.left)
        right_operand = self.visit(node.comparators[0])
        operator = node.ops[0]
        return ComparisonOperation(
            left_operand=left_operand,
            right_operand=right_operand,
            operator=operator,
            ast_node=node,
        )

    def visit_Subscript(self, node: ast.Subscript) -> ExperimentRunFilterConditionNode:
        container = self.visit(node.value)
        key = self.visit(node.slice)
        if not isinstance(key, Constant):
            # Anything the visitors do not turn into a `Constant` -- a slice, an
            # f-string, a negative number (which parses as unary minus over a
            # literal, not as a literal) -- used to arrive here untransformed and
            # fail on attribute access further down, reported as a server-side
            # fault rather than as the unsupported key it is.
            raise ExperimentRunFilterConditionSyntaxError(
                f"Subscript key must be a literal: `{ast.unparse(node.slice)}`"
            )
        if isinstance(container, ExperimentsName):
            return ExperimentRun(
                slice=key,
                experiment_ids=self._experiment_ids,
                ast_node=node,
            )
        if isinstance(container, ExperimentRunAttribute):
            if container.is_eval_attribute:
                if not isinstance(key.value, str):
                    # `ExperimentRunEval` checks this too; narrowing here keeps
                    # the call below typed without an ignore. Same message, so
                    # which one fires is not observable.
                    raise ExperimentRunFilterConditionSyntaxError("Eval must be indexed by string")
                return ExperimentRunEval(
                    experiment_run_attribute=container,
                    eval_name=key.value,
                    ast_node=node,
                )
        if isinstance(container, (JSONAttribute, DatasetExampleAttribute)) or (
            isinstance(container, ExperimentRunAttribute) and container.is_json_attribute
        ):
            return JSONAttribute(
                attribute=container,
                index_constant=key,
                ast_node=node,
            )
        raise ExperimentRunFilterConditionSyntaxError("Invalid subscript")

    def visit_Attribute(self, node: ast.Attribute) -> ExperimentRunFilterConditionNode:
        parent = self.visit(node.value)
        attribute_name = node.attr
        if isinstance(parent, ExperimentRun):
            if _is_supported_experiment_run_attribute_name(attribute_name):
                return ExperimentRunAttribute(
                    attribute_name=attribute_name,
                    experiment_id=parent.experiment_id,
                    transformer=self,
                    ast_node=node,
                )
            elif _is_supported_dataset_example_attribute(attribute_name):
                return DatasetExampleAttribute(
                    attribute_name=attribute_name,
                    transformer=self,
                    ast_node=node,
                )
            raise ExperimentRunFilterConditionSyntaxError("Unknown attribute")
        if isinstance(parent, ExperimentRunEval):
            return ExperimentRunEvalAttribute(
                attribute_name=attribute_name,
                experiment_run_eval=parent,
                transformer=self,
                ast_node=node,
            )
        raise ExperimentRunFilterConditionSyntaxError("Unknown attribute")

    def create_experiment_runs_alias(self, experiment_id: ExperimentID) -> Any:
        if self.get_experiment_runs_alias(experiment_id) is not None:
            raise ValueError(f"Alias already exists for experiment ID: {experiment_id}")
        experiment_index = self.get_experiment_index(experiment_id)
        alias_name = f"experiment_runs_{experiment_index}"
        aliased_table = aliased(models.ExperimentRun, name=alias_name)
        self._aliased_experiment_runs[experiment_id] = aliased_table
        return aliased_table

    def get_experiment_runs_alias(self, experiment_id: ExperimentID) -> Any:
        return self._aliased_experiment_runs.get(experiment_id)

    def create_experiment_run_annotations_alias(
        self, experiment_id: ExperimentID, eval_name: EvalName
    ) -> Any:
        if self.get_experiment_run_annotations_alias(experiment_id, eval_name) is not None:
            raise ValueError(
                f"Alias exists for experiment ID and eval name: {(experiment_id, eval_name)}"
            )
        self._ensure_experiment_runs_alias_exists(
            experiment_id
        )  # experiment_runs are needed so we have something to join experiment_run_annotations to
        experiment_index = self.get_experiment_index(experiment_id)
        eval_name_hash = sha256(eval_name.encode()).hexdigest()[:9]
        alias_name = (  # postgres truncates identifiers at 63 chars, so cap the length
            f"experiment_run_annotations_{experiment_index}_{eval_name_hash}"
        )
        aliased_table = aliased(models.ExperimentRunAnnotation, name=alias_name)
        if experiment_id not in self._aliased_experiment_run_annotations:
            self._aliased_experiment_run_annotations[experiment_id] = {}
        self._aliased_experiment_run_annotations[experiment_id][eval_name] = aliased_table
        return aliased_table

    def get_experiment_run_annotations_alias(
        self, experiment_id: ExperimentID, eval_name: EvalName
    ) -> Any:
        return self._aliased_experiment_run_annotations.get(experiment_id, {}).get(eval_name)

    def get_experiment_run_annotations_aliases(
        self, experiment_id: ExperimentID
    ) -> dict[EvalName, Any]:
        return self._aliased_experiment_run_annotations.get(experiment_id, {})

    def get_experiment_index(self, experiment_id: ExperimentID) -> int:
        return self._experiment_ids.index(experiment_id)

    def _ensure_experiment_runs_alias_exists(self, experiment_id: ExperimentID) -> None:
        if self.get_experiment_runs_alias(experiment_id) is None:
            self.create_experiment_runs_alias(experiment_id)


def _get_sqlalchemy_comparison_operator(
    ast_operator: SupportedComparisonOperator,
) -> Callable[[Any, Any], Any]:
    if isinstance(ast_operator, ast.Eq):
        return operator.eq
    elif isinstance(ast_operator, ast.NotEq):
        return operator.ne
    elif isinstance(ast_operator, ast.Lt):
        return sqlalchemy_operators.lt
    elif isinstance(ast_operator, ast.LtE):
        return sqlalchemy_operators.le
    elif isinstance(ast_operator, ast.Gt):
        return sqlalchemy_operators.gt
    elif isinstance(ast_operator, ast.GtE):
        return sqlalchemy_operators.ge
    elif isinstance(ast_operator, ast.Is):
        return sqlalchemy_operators.is_
    elif isinstance(ast_operator, ast.IsNot):
        return sqlalchemy_operators.is_not
    elif isinstance(ast_operator, ast.In):
        return lambda left, right: models.TextContains(right, left)
    elif isinstance(ast_operator, ast.NotIn):
        return lambda left, right: ~models.TextContains(right, left)
    assert_never(ast_operator)


def _cast_json_value(compiled_operand: Any, cast_type: SQLAlchemyDataType) -> Any:
    """Convert a JSON value to the compared type without risking the statement.

    Only operands of *unknown* type reach here, which means a JSON column. A
    plain `CAST(jsonb AS FLOAT)` succeeds while every row happens to hold a
    number and aborts the whole query the moment one does not -- `cannot cast
    jsonb string to type double precision`. Whether a filter works then depends
    on the data rather than on the expression, and no amount of validation can
    see it coming.

    `SafeJsonFloat` / `SafeJsonBoolean` are total: a value of the wrong shape
    becomes NULL and its row drops out.

    Text is a different failure. Casting a JSON value to text renders it *as
    JSON*, so a stored string keeps its quotes and `input['x'] == 'yes'`
    compares `"yes"` against `yes` -- false on both backends, for every row.
    Extracting as text instead (`->>` on PostgreSQL, a plain `json_extract` on
    SQLite) yields the string itself.
    """
    if isinstance(cast_type, Boolean):
        return SafeJsonBoolean(compiled_operand)
    if isinstance(cast_type, (Integer, Float)):
        return SafeJsonFloat(compiled_operand)
    if isinstance(cast_type, String):
        return _as_json_scalar(compiled_operand)
    return cast(compiled_operand, cast_type)


# The node types a valid condition can contain: the expression forms the
# transformer implements, their operator nodes, and the contexts `ast.walk`
# yields alongside them. `List` / `Tuple` are included so they reach the
# transformer's own named rejection rather than dying here with a worse
# message; unsupported *operators* under an allowed parent (`~x`, `x ** y`)
# are rejected at the parent before the walk descends to the operator node.
_ALLOWED_PYTHON_SURFACE: tuple[type, ...] = (
    ast.BoolOp,
    ast.UnaryOp,
    ast.Compare,
    ast.Constant,
    ast.Name,
    ast.Attribute,
    ast.Subscript,
    ast.List,
    ast.Tuple,
    # Operators and contexts enumerated concretely rather than by abstract
    # base, so a node type a future CPython adds under `cmpop`/`boolop`/
    # `unaryop` cannot pass the floor: every operator is opt-in, exactly like
    # every expression form. Unsupported operators under an *allowed* parent
    # (`~x`, `+x`) never reach here -- the parent's named rejection fires
    # before the walk descends to the operator node.
    ast.And,
    ast.Or,
    ast.Not,
    ast.USub,
    ast.Eq,
    ast.NotEq,
    ast.Lt,
    ast.LtE,
    ast.Gt,
    ast.GtE,
    ast.Is,
    ast.IsNot,
    ast.In,
    ast.NotIn,
    ast.Load,
)


def _validate_python_surface(body: ast.expr, source: str) -> None:
    """Reject Python constructs this language never implemented.

    The grammar is a subset of Python's, taken by parsing with `ast`, so every
    literal and operator Python has arrives here whether or not anything handles
    it. Unhandled ones used to reach the transformer and fail with whatever
    Python raised at the point of contact -- an `AttributeError` on an
    untransformed node, an `AssertionError` from `assert_never` -- which the
    compile boundary reports as "Invalid filter condition" and logs at error
    level. A typo then reads as a fault in the server and costs a stack trace.

    Rejecting the surface up front makes each of these a named message about
    what the user typed, and keeps the boundary for what it is meant to catch:
    gaps we do not know about.
    """
    for node in ast.walk(body):
        if isinstance(node, ast.Constant):
            _validate_literal(node)
        elif isinstance(node, ast.BinOp):
            # No binary arithmetic is implemented -- there is no `visit_BinOp`,
            # so every one of these reached compilation as a raw `ast.BinOp`.
            raise ExperimentRunFilterConditionSyntaxError(
                f"Arithmetic is not supported here: `{ast.unparse(node)}`"
            )
        elif isinstance(node, ast.UnaryOp) and not isinstance(node.op, (ast.Not, ast.USub)):
            # `+x` and `~x` are the two Python leaves beside the supported
            # `not` and unary minus. `~` reaches SQLAlchemy as `NOT x`, which is
            # unrelated to what was written.
            raise ExperimentRunFilterConditionSyntaxError(
                f"Unsupported operator: `{ast.unparse(node)}`"
            )
        elif isinstance(node, (ast.Dict, ast.Set)):
            # The collection literals with no visitor. `ast.List` and
            # `ast.Tuple` have one and say so themselves; these reached
            # compilation untransformed.
            raise ExperimentRunFilterConditionSyntaxError(
                f"Unsupported collection: `{ast.unparse(node)}`"
            )
        elif isinstance(node, ast.Slice):
            # `input[1:2]`. A subscript selects one key or index.
            raise ExperimentRunFilterConditionSyntaxError(
                "Slicing is not supported; select a single key or index"
            )
        elif isinstance(node, (ast.JoinedStr, ast.FormattedValue)):
            # An f-string builds its value at evaluation time, which is exactly
            # what this language does not do -- there is nothing to interpolate
            # against. These break inside the transformer rather than at a
            # visitor, because the pieces are nested below the node.
            raise ExperimentRunFilterConditionSyntaxError(
                "Formatted strings are not supported; use a plain string literal"
            )
        elif isinstance(node, (ast.Call, ast.Lambda)):
            # This language has no functions -- there is no `visit_Call` -- so a
            # call is never valid. Most spellings already fail on the callee as
            # an unknown name, but one that never resolves a name (`(lambda:
            # 1)()`) reached the transformer and failed there instead.
            raise ExperimentRunFilterConditionSyntaxError(
                f"Function calls are not supported: `{ast.unparse(node)}`"
            )
        elif isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            raise ExperimentRunFilterConditionSyntaxError(
                f"Comprehensions are not supported: `{ast.unparse(node)}`"
            )
        elif isinstance(node, (ast.Await, ast.Yield, ast.YieldFrom, ast.IfExp)):
            # Reachable only because `ast.parse` accepts them in an expression.
            raise ExperimentRunFilterConditionSyntaxError(
                f"Unsupported expression: `{ast.unparse(node)}`"
            )
        elif isinstance(node, ast.NamedExpr):
            # A walrus (`error == (error := 'x')`) parses in an expression and
            # used to reach compilation as an untransformed node -- reported as
            # a server fault with the full condition logged at error level.
            raise ExperimentRunFilterConditionSyntaxError(
                f"Assignment is not supported: `{ast.unparse(node)}`"
            )
        elif not isinstance(node, _ALLOWED_PYTHON_SURFACE):
            # The rejections above exist to *name* constructs for better
            # messages; this is the default-deny floor beneath them. A denylist
            # is a permanent backlog of node types nobody has thought of yet --
            # the walrus operator escaped this walk for exactly that reason --
            # and CPython adds node types over releases, so exhaustiveness has
            # to come from an allowlist, not from enumeration of the bad.
            raise ExperimentRunFilterConditionSyntaxError(
                f"Unsupported construct: `{ast.unparse(node)}`"
            )
        elif isinstance(node, (ast.Name, ast.Attribute)):
            # Python NFKC-normalizes identifiers while parsing, so a full-width
            # `ｉｎｐｕｔ` silently becomes `input` and resolves to a real column
            # the user never spelled. Attribute segments normalize too, which is
            # how `experiments[0].ｌａｔｅｎｃｙ_ｍｓ` reaches a real field.
            #
            # Compared against the node's own source span, not against the
            # whole condition: searching the text would pass whenever the
            # normalized spelling appears anywhere else -- inside a string
            # literal or in another operand.
            written = ast.get_source_segment(source, node)
            normalized = node.id if isinstance(node, ast.Name) else node.attr
            # An attribute's span covers its whole chain, so compare only the
            # trailing segment the parser normalized.
            if written is not None and isinstance(node, ast.Attribute):
                written = written.rpartition(".")[2].strip()
            if written and written != normalized:
                raise ExperimentRunFilterConditionSyntaxError(
                    f"`{_ellipsize(written, 80)}` is interpreted as `{_ellipsize(normalized, 80)}`"
                    ", use unaccented ASCII for field names"
                )


def _validate_literal(node: ast.Constant) -> None:
    """Literals are limited to the value types this language compares against.

    `b'x'`, `1j`, and `...` have no column type to compare against; the driver
    either refuses them or binds something meaningless. Non-finite floats and
    embedded NULs are accepted by SQLite and rejected by PostgreSQL, so admitting
    them would make a condition's validity depend on the backend it runs on.
    """
    value = node.value
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int):
        # Python ints are unbounded; both backends evaluate numeric fields in
        # float, so an int too large for a finite float has no faithful value
        # to bind -- asyncpg refuses it while SQLite quietly stores infinity.
        if not _is_finite_number(value):
            raise ExperimentRunFilterConditionSyntaxError(
                f"Invalid numeric literal: `{ast.unparse(node)}`"
            )
        return
    if isinstance(value, str):
        if "\x00" in value:
            raise ExperimentRunFilterConditionSyntaxError(
                "String literals cannot contain a NUL character"
            )
        return
    if isinstance(value, float):
        if not _is_finite_number(value):
            raise ExperimentRunFilterConditionSyntaxError(
                f"Invalid numeric literal: `{ast.unparse(node)}`"
            )
        return
    raise ExperimentRunFilterConditionSyntaxError(f"Unsupported literal: `{ast.unparse(node)}`")


def _as_json_scalar(compiled_operand: Any) -> Any:
    """Extract a JSON value rather than re-render it as JSON.

    A JSON accessor keeps its operand encoded: the string `yes` comes back as
    `"yes"`, and a missing key comes back as SQLite's text `'null'` instead of
    SQL NULL. Both make a comparison silently false for every row. `as_string()`
    picks the extracting accessor on each backend -- `->>` on PostgreSQL, a bare
    `json_extract` on SQLite.

    Neither backend can then tell a stored JSON null from an absent key, since
    `json_extract` returns SQL NULL for both. Conflating them is the only
    behavior both dialects can express, and it is the one `is None` reads as.
    """
    as_string = getattr(compiled_operand, "as_string", None)
    # Present on JSON accessors, which is what an unknown-typed operand is;
    # anything else is already a scalar.
    return as_string() if callable(as_string) else compiled_operand


def _is_singleton(operand: Any) -> bool:
    """`None`, `True`, `False` -- the only values SQL can compare identity
    against (`IS NULL` / `IS TRUE` / `IS FALSE`)."""
    return isinstance(operand, Constant) and (
        operand.value is None or isinstance(operand.value, bool)
    )


def _get_data_type_family(data_type: SQLAlchemyDataType) -> str:
    """Group data types by what they can be compared against.

    `Boolean` is checked first because it is emulated over an integer on some
    backends, and a boolean compared to a number is a mistake rather than a
    widening.
    """
    if isinstance(data_type, Boolean):
        return "boolean"
    if isinstance(data_type, (Integer, Float)):
        return "number"
    return "string"


def _get_operand_family(operand: Any) -> Optional[str]:
    """The type family of a comparison operand, or None when it is unknown.

    A None literal is reported as its own family rather than as unknown:
    binding NULL into string containment yields NULL, so `None in output`
    silently matches nothing instead of failing.
    """
    if isinstance(operand, Constant) and operand.value is None:
        return "null"
    if isinstance(operand, Term) and (data_type := operand.data_type) is not None:
        return _get_data_type_family(data_type)
    return None


def _validate_comparable_data_types(left_operand: Term, right_operand: Term) -> None:
    """Reject a comparison between two known types that SQL cannot evaluate.

    `_get_cast_type_for_comparison` casts an operand whose type is unknown -- a
    JSON attribute -- to match the one that is known. When *both* types are
    known it correctly emits no cast, but nothing then checks that the two are
    actually comparable, so a mismatch is handed to the database as written:
    `evals['x'].score == ''` becomes `double precision = varchar` and
    `evals['x'].label == 100` becomes `varchar = integer`. PostgreSQL rejects
    both, after the condition has already been reported valid.

    Unknown types are deliberately untouched. A JSON attribute has no type until
    the rows are read, so the cast heuristics remain the right answer there;
    this only covers the case where guessing was never necessary.
    """
    # The operands are typed as `Term`, but a malformed condition can put a
    # non-`Term` node here -- `experiments < 0` compares against the bare
    # `experiments` name. Those have their own diagnostics further along, so
    # this check must not pre-empt them with an `AttributeError`.
    if not isinstance(left_operand, Term) or not isinstance(right_operand, Term):
        return
    left_data_type = left_operand.data_type
    right_data_type = right_operand.data_type
    if left_data_type is None or right_data_type is None:
        # At least one side is a JSON attribute or NULL; the cast heuristics
        # handle those, and NULL is comparable to anything.
        return
    left_family = _get_data_type_family(left_data_type)
    right_family = _get_data_type_family(right_data_type)
    if left_family != right_family:
        raise ExperimentRunFilterConditionSyntaxError(
            f"cannot compare {left_family} and {right_family}"
        )


def _get_cast_type_for_comparison(
    *,
    operator: SupportedComparisonOperator,
    left_operand: Term,
    right_operand: Term,
) -> Optional[SQLAlchemyDataType]:
    """
    Some column types (e.g., JSON columns) require an explicit cast before
    comparing with non-null values. We don't know the true type of the value in
    the JSON column, so we use heuristics to cast to a reasonable type given the
    operator and operands. There are three cases:

      1. Both operands have known types.
      2. One operand has a known type and the other does not.
      3. Neither operand has a known type, e.g., both are JSON attributes.

    In the first case, a cast is not needed. In the second case, we cast the
    operand with the unknown type to the type of the operand being compared. In
    the third case, we cast both operands to the same type using heuristics
    based on the operator.
    """

    left_operand_data_type = left_operand.data_type
    right_operand_data_type = right_operand.data_type
    if left_operand_data_type is not None and right_operand_data_type is not None:
        return None  # Both operands have known data types, so no cast is needed.

    if isinstance(operator, (ast.Gt, ast.GtE, ast.Lt, ast.LtE)):
        # These operations should always cast to float, even if a comparison is
        # being made to an integer.
        return Float()

    if isinstance(operator, (ast.In, ast.NotIn)):
        # These operations are performed on strings.
        return String()

    # If one operand is None, don't cast.
    left_operand_is_null = isinstance(left_operand, Constant) and left_operand.value is None
    right_operand_is_null = isinstance(right_operand, Constant) and right_operand.value is None
    if left_operand_is_null or right_operand_is_null:
        return None

    # If one operand has a known type and the other does not, cast to the known type.
    if left_operand_data_type is not None and right_operand_data_type is None:
        return left_operand_data_type
    elif left_operand_data_type is None and right_operand_data_type is not None:
        return right_operand_data_type

    # If neither operand has a known type, we infer a cast type from the comparison operator.
    if isinstance(operator, (ast.Eq, ast.NotEq, ast.Is, ast.IsNot)):
        return String()
    assert_never(operator)


def _is_supported_comparison_operator(
    operator: ast.cmpop,
) -> TypeGuard[SupportedComparisonOperator]:
    return isinstance(operator, get_args(SupportedComparisonOperator))


def _is_supported_dataset_example_attribute(
    name: str,
) -> TypeGuard[SupportedDatasetExampleAttributeName]:
    return name in get_args(SupportedDatasetExampleAttributeName)


def _is_supported_experiment_run_attribute_name(
    name: str,
) -> TypeGuard[SupportedExperimentRunAttributeName]:
    return name in get_args(SupportedExperimentRunAttributeName)


def _is_supported_experiment_run_eval_attribute_name(
    name: str,
) -> TypeGuard[SupportedExperimentRunEvalAttributeName]:
    return name in get_args(SupportedExperimentRunEvalAttributeName)


def _is_supported_unary_boolean_operator(
    operator: ast.unaryop,
) -> TypeGuard[SupportedUnaryBooleanOperator]:
    return isinstance(operator, SupportedUnaryBooleanOperator)


def _is_supported_unary_term_operator(
    operator: ast.unaryop,
) -> TypeGuard[SupportedUnaryTermOperator]:
    return isinstance(operator, SupportedUnaryTermOperator)
