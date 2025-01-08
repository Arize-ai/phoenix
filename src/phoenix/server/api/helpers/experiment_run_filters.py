import ast
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
    try:
        original_tree = ast.parse(filter_condition, mode="eval")
    except SyntaxError as error:
        raise ExperimentRunFilterConditionSyntaxError(str(error))

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
        if not isinstance(experiment_index, int):
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
        if not isinstance(index_value, (int, str)):
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

    def compile(self) -> Any:
        operator = self.operator
        operand = self.operand
        sqlalchemy_operator: Callable[[Any], Any]
        if isinstance(operator, ast.USub):
            sqlalchemy_operator = sqlalchemy_operators.neg
        else:
            assert_never(operator)
        compiled_operand = operand.compile()
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
                compiled_left_operand = cast(compiled_left_operand, cast_type)
            if right_operand.data_type is None:
                compiled_right_operand = cast(compiled_right_operand, cast_type)
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
        return Constant(value=node.value, ast_node=node)

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
        if isinstance(container, ExperimentsName):
            if not isinstance(key, Constant):
                raise ExperimentRunFilterConditionSyntaxError("Index must be a constant")
            return ExperimentRun(
                slice=key,
                experiment_ids=self._experiment_ids,
                ast_node=node,
            )
        if isinstance(container, ExperimentRunAttribute):
            if container.is_eval_attribute:
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
