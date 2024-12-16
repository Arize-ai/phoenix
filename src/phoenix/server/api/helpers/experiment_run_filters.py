import ast
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
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
from sqlalchemy.sql import operators
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
SupportedExperimentRunAttributeName: TypeAlias = Literal[
    "input", "reference_output", "output", "error", "latency_ms", "evals"
]
SupportedExperimentRunEvalAttributeName: TypeAlias = Literal["score", "explanation", "label"]


def update_examples_query_with_filter_condition(
    query: Select[Any], filter_condition: str, experiment_ids: list[int]
) -> Select[Any]:
    orm_filter_condition, transformer = compile_orm_filter_condition(
        filter_condition=filter_condition, experiment_ids=experiment_ids
    )
    for experiment_id in experiment_ids:
        experiment_run_annotations = transformer.get_experiment_run_annotations_alias(experiment_id)
        if experiment_run_annotations is not None:
            # Ensure an experiment runs alias exists for each experiment runs
            # annotations alias. This is needed because the experiment runs
            # annotations table is joined on the experiment runs table.
            experiment_runs = transformer.get_experiment_runs_alias(
                experiment_id
            ) or transformer.create_experiment_runs_alias(experiment_id)
        else:
            experiment_runs = transformer.get_experiment_runs_alias(experiment_id)
        if experiment_runs is not None:
            query = query.join(
                experiment_runs,
                onclause=and_(
                    experiment_runs.dataset_example_id == models.DatasetExample.id,
                    experiment_runs.experiment_id == experiment_id,
                ),
                isouter=True,
            )
            if experiment_run_annotations is not None:
                query = query.join(
                    experiment_run_annotations,
                    onclause=experiment_run_annotations.experiment_run_id == experiment_runs.id,
                    isouter=True,
                )
    query = query.where(orm_filter_condition)
    return query


def compile_orm_filter_condition(
    filter_condition: str, experiment_ids: list[int]
) -> tuple[Any, "ExperimentRunFilterTransformer"]:
    try:
        tree = ast.parse(filter_condition, mode="eval")
    except SyntaxError as error:
        raise ExperimentRunFilterConditionParseError.from_syntax_error(error)
    transformer = ExperimentRunFilterTransformer(experiment_ids)
    transformed_tree = transformer.visit(tree)
    node = transformed_tree.body
    if not isinstance(node, BooleanExpression):
        raise ExperimentRunFilterConditionParseError(
            message="Filter condition must be a boolean expression",
            source=filter_condition,
            start_offset=0,
            end_offset=len(filter_condition),
        )
    orm_filter_condition = node.compile()
    return orm_filter_condition, transformer


class ExperimentRunFilterConditionParseError(Exception):
    def __init__(
        self,
        *,
        message: str,
        source: str,
        start_offset: int,
        end_offset: int,
    ) -> None:
        super().__init__(f"{message}: {source}")
        self.source = source
        self.start_offset = start_offset
        self.end_offset = end_offset

    @classmethod
    def from_ast_node(
        cls,
        message: str,
        node: ast.AST,
    ) -> "ExperimentRunFilterConditionParseError":
        source = ast.unparse(node)
        start_offset = getattr(node, "col_offset", 0)
        end_offset = getattr(node, "end_col_offset", len(source))
        return cls(
            message=message,
            source=source,
            start_offset=start_offset,
            end_offset=end_offset,
        )

    @classmethod
    def from_syntax_error(
        cls,
        syntax_error: SyntaxError,
    ) -> "ExperimentRunFilterConditionParseError":
        source = syntax_error.text or ""
        start_offset = syntax_error.offset or 0
        end_offset = getattr(
            syntax_error, "end_offset", start_offset + 1
        )  # end_offset is unavailable in Python 3.9
        return cls(
            message=syntax_error.msg,
            source=source,
            start_offset=start_offset,
            end_offset=end_offset,
        )


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
    def update_expression(self, expression: BinaryExpression[Any]) -> BinaryExpression[Any]:
        return expression


@dataclass(frozen=True)
class HasDataType(ABC):
    @abstractmethod
    def data_type(self) -> Optional[SQLAlchemyDataType]:
        raise NotImplementedError


@dataclass(frozen=True)
class Constant(HasDataType, Term):
    value: SupportedConstantType

    def compile(self) -> Any:
        value = self.value
        if value is None:
            return Null()
        return literal(value)

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
        raise ExperimentRunFilterConditionParseError.from_ast_node(
            message="Select an experiment with [<index>]", node=self.ast_node
        )


@dataclass(frozen=True)
class ExperimentRun(ExperimentRunFilterConditionNode):
    slice: Constant
    experiment_ids: list[int]
    _experiment_id: int = field(init=False)

    def __post_init__(self) -> None:
        experiment_index = self.slice.value
        if not isinstance(experiment_index, int):
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Index to experiments must be an integer", node=self.ast_node
            )
        if not (0 <= experiment_index < len(self.experiment_ids)):
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Select an experiment with [<index>]", node=self.ast_node
            )
        object.__setattr__(self, "_experiment_id", self.experiment_ids[experiment_index])

    def compile(self) -> Any:
        raise ExperimentRunFilterConditionParseError.from_ast_node(
            message="Add an attribute", node=self.ast_node
        )


@dataclass(frozen=True)
class Attribute(Term):
    pass


@dataclass(frozen=True)
class HasAliasedTables:
    transformer: "ExperimentRunFilterTransformer"

    def experiment_run_alias(self, experiment_id: ExperimentID) -> Any:
        return self.transformer.get_experiment_runs_alias(
            experiment_id
        ) or self.transformer.create_experiment_runs_alias(experiment_id)

    def experiment_run_annotation_alias(self, experiment_id: ExperimentID) -> Any:
        return self.transformer.get_experiment_run_annotations_alias(
            experiment_id
        ) or self.transformer.create_experiment_run_annotations_alias(experiment_id)


@dataclass(frozen=True)
class ExperimentRunAttribute(HasAliasedTables, HasDataType, Attribute):
    experiment_run: ExperimentRun
    attribute_name: str
    _attribute_name: SupportedExperimentRunAttributeName = field(init=False)
    _experiment_id: int = field(init=False)

    def __post_init__(self) -> None:
        if not _is_supported_attribute_name(self.attribute_name):
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Unknown name", node=self.ast_node
            )
        object.__setattr__(self, "_attribute_name", self.attribute_name)
        object.__setattr__(self, "_experiment_id", self.experiment_run._experiment_id)

    def compile(self) -> Any:
        attribute_name = self._attribute_name
        experiment_id = self._experiment_id
        if attribute_name == "evals":
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Select an eval with [<eval-name>]",
                node=self.ast_node,
            )
        elif attribute_name == "input":
            return models.DatasetExampleRevision.input
        elif attribute_name == "reference_output":
            return models.DatasetExampleRevision.output
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

    def data_type(self) -> Optional[SQLAlchemyDataType]:
        attribute_name = self._attribute_name
        if attribute_name == "evals":
            return None
        elif attribute_name == "input":
            return None
        elif attribute_name == "reference_output":
            return None
        elif attribute_name == "output":
            return None
        elif attribute_name == "error":
            return String()
        elif attribute_name == "latency_ms":
            return Float()
        assert_never(attribute_name)


@dataclass(frozen=True)
class ExperimentRunJSONAttribute(Attribute):
    attribute: Union[ExperimentRunAttribute, "ExperimentRunJSONAttribute"]
    index_constant: Constant
    _experiment_id: int = field(init=False)
    _index_value: Union[int, str] = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "_experiment_id", self.attribute._experiment_id)
        index_value = self.index_constant.value
        if not isinstance(index_value, (int, str)):
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Index must be an integer or string",
                node=self.ast_node,
            )
        object.__setattr__(self, "_index_value", index_value)

    def compile(self) -> Any:
        compiled_attribute = self.attribute.compile()
        return compiled_attribute[self._index_value]


@dataclass(frozen=True)
class ExperimentRunEval(ExperimentRunFilterConditionNode):
    experiment_run_attribute: ExperimentRunAttribute
    eval_name: str
    _experiment_id: int = field(init=False)

    def __post_init__(self) -> None:
        if not isinstance(self.eval_name, str):
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Eval must be indexed by string",
                node=self.ast_node,
            )
        object.__setattr__(self, "_experiment_id", self.experiment_run_attribute._experiment_id)

    def compile(self) -> Any:
        raise ExperimentRunFilterConditionParseError.from_ast_node(
            message="Choose an attribute for your eval (label, score, etc.)",
            node=self.ast_node,
        )


@dataclass(frozen=True)
class ExperimentRunEvalAttribute(HasAliasedTables, HasDataType, Attribute):
    experiment_run_eval: ExperimentRunEval
    attribute_name: str
    _attribute_name: SupportedExperimentRunEvalAttributeName = field(init=False)
    _experiment_id: int = field(init=False)
    _eval_name: str = field(init=False)

    def __post_init__(self) -> None:
        if not _is_supported_experiment_run_eval_attribute_name(self.attribute_name):
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Unknown eval attribute",
                node=self.ast_node,
            )
        object.__setattr__(self, "_attribute_name", self.attribute_name)
        object.__setattr__(self, "_experiment_id", self.experiment_run_eval._experiment_id)
        object.__setattr__(self, "_eval_name", self.experiment_run_eval.eval_name)

    def compile(self) -> Any:
        attribute_name = self._attribute_name
        experiment_run_annotations = self.experiment_run_annotation_alias(self._experiment_id)
        return getattr(experiment_run_annotations, attribute_name)

    def update_expression(self, expression: Any) -> Any:
        experiment_id = self._experiment_id
        experiment_run_annotations = self.experiment_run_annotation_alias(experiment_id)
        return expression & (experiment_run_annotations.name == self._eval_name)

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
            sqlalchemy_operator = operators.neg
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
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Unsupported comparison operator",
                node=self.ast_node,
            )
        object.__setattr__(self, "_operator", operator)

    def compile(self) -> Any:
        left_operand = self.left_operand
        right_operand = self.right_operand
        operator = self._operator
        cast_type = _get_cast_type_for_comparison(
            operator=operator,
            left_operand=left_operand,
            right_operand=right_operand,
        )
        compiled_left_operand = left_operand.compile()
        compiled_right_operand = right_operand.compile()
        if cast_type is not None:
            if not isinstance(left_operand, HasDataType):
                compiled_left_operand = cast(compiled_left_operand, cast_type)
            if not isinstance(right_operand, HasDataType):
                compiled_right_operand = cast(compiled_right_operand, cast_type)
        sqlalchemy_operator = _get_sqlalchemy_comparison_operator(operator)
        comparison_expression = sqlalchemy_operator(compiled_left_operand, compiled_right_operand)
        for operand in (self.left_operand, self.right_operand):
            comparison_expression = operand.update_expression(comparison_expression)
        return comparison_expression


@dataclass(frozen=True)
class UnaryBooleanOperation(BooleanExpression):
    operand: ExperimentRunFilterConditionNode
    operator: SupportedUnaryBooleanOperator

    def __post_init__(self) -> None:
        if not isinstance(self.operand, BooleanExpression):
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Operand must be a boolean expression",
                node=self.ast_node,
            )

    def compile(self) -> Any:
        operator = self.operator
        sqlalchemy_operator: Callable[[Any], Any]
        if isinstance(operator, ast.Not):
            sqlalchemy_operator = operators.inv
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
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Boolean operators require at least two operands",
                node=self.ast_node,
            )

    def compile(self) -> Any:
        ast_operator = self.operator
        operands = [operand.compile() for operand in self.operands]
        if isinstance(ast_operator, ast.And):
            return and_(*operands)
        elif isinstance(ast_operator, ast.Or):
            return or_(*operands)
        raise ExperimentRunFilterConditionParseError.from_ast_node(
            message="Unsupported boolean operator",
            node=self.ast_node,
        )


class ExperimentRunFilterTransformer(ast.NodeTransformer):
    def __init__(self, experiment_ids: list[int]) -> None:
        if not experiment_ids:
            raise ValueError("Must provide one or more experiments")
        self._experiment_ids = experiment_ids
        self._aliased_experiment_runs: dict[ExperimentID, Any] = {}
        self._aliased_experiment_run_annotations: dict[ExperimentID, Any] = {}

    def visit_Constant(self, node: ast.Constant) -> Constant:
        return Constant(value=node.value, ast_node=node)

    def visit_Name(self, node: ast.Name) -> ExperimentRunFilterConditionNode:
        name = node.id
        if name == "experiments":
            return ExperimentsName(ast_node=node)
        baseline_experiment_index = 0
        baseline_experiment = ExperimentRun(
            slice=Constant(value=baseline_experiment_index, ast_node=node),
            experiment_ids=self._experiment_ids,
            ast_node=node,
        )
        return ExperimentRunAttribute(
            attribute_name=name,
            experiment_run=baseline_experiment,
            transformer=self,
            ast_node=node,
        )

    def visit_UnaryOp(self, node: ast.UnaryOp) -> Union[UnaryBooleanOperation, UnaryTermOperation]:
        operator = node.op
        operand = self.visit(node.operand)
        if _is_supported_unary_boolean_operator(operator):
            return UnaryBooleanOperation(operand=operand, operator=operator, ast_node=node)
        if _is_supported_unary_term_operator(operator):
            return UnaryTermOperation(operand=operand, operator=operator, ast_node=node)
        raise ExperimentRunFilterConditionParseError.from_ast_node(
            message="Unsupported unary operator",
            node=node,
        )

    def visit_BoolOp(self, node: ast.BoolOp) -> BooleanOperation:
        operator = node.op
        operands = [self.visit(value) for value in node.values]
        return BooleanOperation(operator=operator, operands=operands, ast_node=node)

    def visit_Compare(self, node: ast.Compare) -> ExperimentRunFilterConditionNode:
        if not (len(node.ops) == 1 and len(node.comparators) == 1):
            raise ExperimentRunFilterConditionParseError.from_ast_node(
                message="Only binary comparisons are supported",
                node=node,
            )
        left_operand = self.visit(node.left)
        right_operand = self.visit(node.comparators[0])
        operation = node.ops[0]
        return ComparisonOperation(
            left_operand=left_operand,
            right_operand=right_operand,
            operator=operation,
            ast_node=node,
        )

    def visit_Subscript(self, node: ast.Subscript) -> ExperimentRunFilterConditionNode:
        container = self.visit(node.value)
        key = self.visit(node.slice)
        if isinstance(container, ExperimentsName):
            if not isinstance(key, Constant):
                raise ExperimentRunFilterConditionParseError.from_ast_node(
                    message="Index must be a constant",
                    node=node,
                )
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
            if container.is_json_attribute:
                return ExperimentRunJSONAttribute(
                    attribute=container,
                    index_constant=key,
                    ast_node=node,
                )
        if isinstance(container, ExperimentRunJSONAttribute):
            return ExperimentRunJSONAttribute(
                attribute=container,
                index_constant=key,
                ast_node=node,
            )
        raise ExperimentRunFilterConditionParseError.from_ast_node(
            message="Invalid subscript",
            node=node,
        )

    def visit_Attribute(self, node: ast.Attribute) -> ExperimentRunFilterConditionNode:
        parent = self.visit(node.value)
        attribute_name = node.attr
        if isinstance(parent, ExperimentRun):
            return ExperimentRunAttribute(
                attribute_name=attribute_name,
                experiment_run=parent,
                transformer=self,
                ast_node=node,
            )
        if isinstance(parent, ExperimentRunEval):
            return ExperimentRunEvalAttribute(
                attribute_name=attribute_name,
                experiment_run_eval=parent,
                transformer=self,
                ast_node=node,
            )
        raise ExperimentRunFilterConditionParseError.from_ast_node(
            message="Unknown attribute",
            node=node,
        )

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

    def create_experiment_run_annotations_alias(self, experiment_id: ExperimentID) -> Any:
        if self.get_experiment_run_annotations_alias(experiment_id) is not None:
            raise ValueError(f"Alias already exists for experiment ID: {experiment_id}")
        experiment_index = self.get_experiment_index(experiment_id)
        alias_name = f"experiment_run_annotations_{experiment_index}"
        aliased_table = aliased(models.ExperimentRunAnnotation, name=alias_name)
        self._aliased_experiment_run_annotations[experiment_id] = aliased_table
        return aliased_table

    def get_experiment_run_annotations_alias(self, experiment_id: ExperimentID) -> Any:
        return self._aliased_experiment_run_annotations.get(experiment_id)

    def get_experiment_index(self, experiment_id: ExperimentID) -> int:
        return self._experiment_ids.index(experiment_id)


def _get_sqlalchemy_comparison_operator(
    ast_operator: SupportedComparisonOperator,
) -> Callable[[Any, Any], Any]:
    if isinstance(ast_operator, ast.Eq):
        return operators.eq
    elif isinstance(ast_operator, ast.NotEq):
        return operators.ne
    elif isinstance(ast_operator, ast.Lt):
        return operators.lt
    elif isinstance(ast_operator, ast.LtE):
        return operators.le
    elif isinstance(ast_operator, ast.Gt):
        return operators.gt
    elif isinstance(ast_operator, ast.GtE):
        return operators.ge
    elif isinstance(ast_operator, ast.Is):
        return operators.is_
    elif isinstance(ast_operator, ast.IsNot):
        return operators.is_not
    elif isinstance(ast_operator, ast.In):
        return lambda left, right: operators.contains_op(right, left)
    elif isinstance(ast_operator, ast.NotIn):
        return lambda left, right: operators.not_contains_op(right, left)
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

    if isinstance(left_operand, HasDataType) and isinstance(right_operand, HasDataType):
        return None  # Both operands have known data types, so no cast is needed.

    if isinstance(operator, (ast.Gt, ast.GtE, ast.Lt, ast.LtE)):
        # These operations should always cast to float, even if a comparison is
        # being made to an integer.
        return Float()

    # If one operand has a known type and the other does not, cast to the known type.
    if isinstance(left_operand, HasDataType) and not isinstance(right_operand, HasDataType):
        return left_operand.data_type()
    elif not isinstance(left_operand, HasDataType) and isinstance(right_operand, HasDataType):
        return right_operand.data_type()

    # If neither operand has a known type, we infer a cast type from the comparison operator.
    if isinstance(operator, (ast.In, ast.NotIn, ast.Eq, ast.NotEq, ast.Is, ast.IsNot)):
        return String()
    assert_never(operator)


def _is_supported_comparison_operator(
    operator: ast.cmpop,
) -> TypeGuard[SupportedComparisonOperator]:
    return isinstance(operator, get_args(SupportedComparisonOperator))


def _is_supported_attribute_name(
    attribute_name: str,
) -> TypeGuard[SupportedExperimentRunAttributeName]:
    return attribute_name in get_args(SupportedExperimentRunAttributeName)


def _is_supported_experiment_run_eval_attribute_name(
    attribute_name: str,
) -> TypeGuard[SupportedExperimentRunEvalAttributeName]:
    return attribute_name in get_args(SupportedExperimentRunEvalAttributeName)


def _is_supported_unary_boolean_operator(
    operator: ast.unaryop,
) -> TypeGuard[SupportedUnaryBooleanOperator]:
    return isinstance(operator, SupportedUnaryBooleanOperator)


def _is_supported_unary_term_operator(
    operator: ast.unaryop,
) -> TypeGuard[SupportedUnaryTermOperator]:
    return isinstance(operator, SupportedUnaryTermOperator)


# if __name__ == "__main__":
#     expressions = [
#         "-'hello' < 10",
#     ]

#     for expression in expressions:
#         tree = ast.parse(expression, mode="eval")
#         transformer = ExperimentRunFilterTransformer([0, 1, 2])
#         transformed_tree = transformer.visit(tree)
#         node = transformed_tree.body
#         orm_filter_expression = node.compile()
#         sql_filter_expression = str(
#             orm_filter_expression.compile(compile_kwargs={"literal_binds": True})
#         )
#         print(f"{expression=}")
#         print(f"{sql_filter_expression=}")


# if __name__ == "__main__":
#     import traceback

#     expressions = [
#         "-'hello' < 10",
#     ]

#     for expression in expressions:
#         print(f"{expression=}")
#         try:
#             validate_filter_condition(
#                 filter_condition=expression,
#                 experiment_ids=[0, 1, 2],
#             )
#         except ExperimentRunFilterConditionParseError as e:
#             print("".join(traceback.format_exception(type(e), e, e.__traceback__)))
#             print(f"{e.source=}")
#             print(f"{e.start_offset=}")
#             print(f"{e.end_offset=}")
#         except Exception as e:
#             print("".join(traceback.format_exception(type(e), e, e.__traceback__)))
#         else:
#             assert False
