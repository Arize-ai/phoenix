import ast
import operator
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Literal, Union, get_args

from sqlalchemy import (
    BinaryExpression,
    Boolean,
    Float,
    Integer,
    Select,
    String,
    and_,
    cast,
    or_,
)
from sqlalchemy.orm import aliased
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
SQLAlchemyType: TypeAlias = Union[Boolean, Integer, Float[float], String]
ExperimentID: TypeAlias = int


def update_examples_query_with_filter_condition(
    query: Select[Any], filter_condition: str, experiment_ids: list[int]
) -> Select[Any]:
    tree = ast.parse(filter_condition, mode="eval")
    transformer = ExperimentRunFilterTransformer(experiment_ids)
    transformed_tree = transformer.visit(tree)
    node = transformed_tree.body
    if not isinstance(node, BooleanExpression):
        raise SyntaxError("Filter expression must be a boolean expression")
    orm_filter_expression = node.compile()

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

    query = query.where(orm_filter_expression)
    return query


def validate_filter_condition(filter_condition: str, experiment_ids: list[int]) -> None:
    tree = ast.parse(filter_condition, mode="eval")
    transformer = ExperimentRunFilterTransformer(experiment_ids)
    transformed_tree = transformer.visit(tree)
    node = transformed_tree.body
    if not isinstance(node, BooleanExpression):
        raise SyntaxError("Filter expression must be a boolean expression")
    node.compile()


@dataclass(frozen=True)
class FilterExpressionNode(ABC):
    """
    A node in a tree representing a SQLAlchemy expression.
    """

    @abstractmethod
    def compile(self) -> Any:
        """
        Compiles the node into a SQLAlchemy expression.
        """
        raise NotImplementedError


@dataclass(frozen=True)
class Constant(FilterExpressionNode):
    value: SupportedConstantType

    def compile(self) -> Any:
        return self.value

    @property
    def sqlalchemy_type(self) -> Any:
        value = self.value
        if isinstance(value, bool):
            return Boolean
        elif isinstance(value, int):
            return Integer
        elif isinstance(value, float):
            return Float
        elif isinstance(value, str):
            return String
        elif value is None:
            return None
        assert_never(value)


@dataclass(frozen=True)
class ExperimentsName(FilterExpressionNode):
    def compile(self) -> Any:
        raise NotImplementedError("Can't compile 'experiments' alone")


@dataclass(frozen=True)
class ExperimentRun(FilterExpressionNode):
    slice: Constant
    experiment_ids: list[int]
    _experiment_id: int = field(init=False)

    def __post_init__(self) -> None:
        experiment_index = self.slice.value
        assert isinstance(experiment_index, int)
        assert 0 <= experiment_index < len(self.experiment_ids)
        object.__setattr__(self, "_experiment_id", self.experiment_ids[experiment_index])

    def compile(self) -> Any:
        raise NotImplementedError("Can't compile 'experiment[<index>]' alone")


@dataclass(frozen=True)
class Attribute(FilterExpressionNode, ABC):
    @abstractmethod
    def update_comparison_expression(
        self, expression: BinaryExpression[Any]
    ) -> BinaryExpression[Any]:
        raise NotImplementedError


@dataclass(frozen=True)
class AliasedTableMixin:
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
class ExperimentRunAttribute(AliasedTableMixin, Attribute):
    experiment_run: ExperimentRun
    attribute_name: str
    _experiment_id: int = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "_experiment_id", self.experiment_run._experiment_id)

    def compile(self) -> Any:
        column = self._column
        if column is None:
            raise SyntaxError
        return column

    def update_comparison_expression(self, expression: Any) -> Any:
        return expression

    @property
    def is_eval_attribute(self) -> bool:
        return self.attribute_name == "evals"

    @property
    def is_json_attribute(self) -> bool:
        return self.attribute_name in ("input", "reference_output", "output")

    @property
    def _column(self) -> Any:
        attribute_name = self.attribute_name
        experiment_id = self._experiment_id
        if attribute_name == "evals":
            return None
        elif attribute_name == "input":
            return models.DatasetExampleRevision.input
        elif attribute_name == "reference_output":
            return models.DatasetExampleRevision.output
        elif attribute_name == "output":
            aliased_experiment_run = self.experiment_run_alias(experiment_id)
            return aliased_experiment_run.output
        elif attribute_name == "error":
            aliased_experiment_run = self.experiment_run_alias(experiment_id)
            return aliased_experiment_run.error
        elif attribute_name == "latency_ms":
            aliased_experiment_run = self.experiment_run_alias(experiment_id)
            return aliased_experiment_run.latency_ms
        raise ValueError(f"Experiment runs have no attribute '{attribute_name}'")


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
            raise SyntaxError
        object.__setattr__(self, "_index_value", index_value)

    def compile(self) -> Any:
        compiled_attribute = self.attribute.compile()
        return compiled_attribute[self._index_value]

    def update_comparison_expression(self, expression: Any) -> Any:
        return expression


@dataclass(frozen=True)
class ExperimentRunEval(FilterExpressionNode):
    experiment_run_attribute: ExperimentRunAttribute
    eval_name: str
    _experiment_id: int = field(init=False)

    def __post_init__(self) -> None:
        assert isinstance(self.eval_name, str)
        object.__setattr__(self, "_experiment_id", self.experiment_run_attribute._experiment_id)

    def compile(self) -> Any:
        raise NotImplementedError("Can't compile 'experiment[<index>].evals[<eval_name>]' alone")


@dataclass(frozen=True)
class ExperimentRunEvalAttribute(AliasedTableMixin, Attribute):
    experiment_run_eval: ExperimentRunEval
    attribute_name: str
    _experiment_id: int = field(init=False)
    _eval_name: str = field(init=False)

    def __post_init__(self) -> None:
        assert self.attribute_name in ("score", "explanation", "label")
        object.__setattr__(self, "_experiment_id", self.experiment_run_eval._experiment_id)
        object.__setattr__(self, "_eval_name", self.experiment_run_eval.eval_name)

    def compile(self) -> Any:
        experiment_run_annotations = self.experiment_run_annotation_alias(self._experiment_id)
        return getattr(experiment_run_annotations, self.attribute_name)

    def update_comparison_expression(self, expression: Any) -> Any:
        experiment_id = self._experiment_id
        experiment_run_annotations = self.experiment_run_annotation_alias(experiment_id)
        return expression & (experiment_run_annotations.name == self._eval_name)


@dataclass(frozen=True)
class BooleanExpression(FilterExpressionNode):
    pass


@dataclass(frozen=True)
class ComparisonOperation(BooleanExpression):
    left_operand: Union[Attribute, Constant]
    right_operand: Union[Attribute, Constant]
    operator: ast.cmpop
    _attribute_operand: Attribute = field(init=False)
    _constant_operand: Constant = field(init=False)
    _operator: SupportedComparisonOperator = field(init=False)

    def __post_init__(self) -> None:
        operator = self.operator
        if not _is_supported_comparison_operator(operator):
            raise SyntaxError(f"Unsupported comparison operator: {operator}")
        object.__setattr__(self, "_operator", operator)

        expected_attribute_position: Literal["left", "right", "left_or_right"]
        if isinstance(operator, (ast.Is, ast.IsNot)):
            expected_attribute_position = "left"
        elif isinstance(operator, (ast.In, ast.NotIn)):
            expected_attribute_position = "right"
        elif isinstance(operator, (ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE)):
            expected_attribute_position = "left_or_right"
        else:
            assert_never(operator)

        if expected_attribute_position == "left":
            assert isinstance(self.left_operand, Attribute)
            assert isinstance(self.right_operand, Constant)
            object.__setattr__(self, "_attribute_operand", self.left_operand)
            object.__setattr__(self, "_constant_operand", self.right_operand)
        elif expected_attribute_position == "right":
            assert isinstance(self.left_operand, Constant)
            assert isinstance(self.right_operand, Attribute)
            object.__setattr__(self, "_attribute_operand", self.right_operand)
            object.__setattr__(self, "_constant_operand", self.left_operand)
        elif expected_attribute_position == "left_or_right":
            if isinstance(self.left_operand, Attribute) and isinstance(
                self.right_operand, Constant
            ):
                object.__setattr__(self, "_attribute_operand", self.left_operand)
                object.__setattr__(self, "_constant_operand", self.right_operand)
            elif isinstance(self.left_operand, Constant) and isinstance(
                self.right_operand, Attribute
            ):
                object.__setattr__(self, "_attribute_operand", self.right_operand)
                object.__setattr__(self, "_constant_operand", self.left_operand)
            else:
                raise SyntaxError
        else:
            assert_never(expected_attribute_position)

    def compile(self) -> Any:
        compiled_left_operand = self._compile_operand(self.left_operand)
        compiled_right_operand = self._compile_operand(self.right_operand)
        comparison_expression = self._sqlalchemy_operator(
            compiled_left_operand, compiled_right_operand
        )
        comparison_expression = self._attribute_operand.update_comparison_expression(
            comparison_expression
        )
        return comparison_expression

    def _compile_operand(self, operand: Union[Attribute, Constant]) -> Any:
        compiled_operand = operand.compile()
        operator = self._operator
        if isinstance(operand, ExperimentRunJSONAttribute):
            # A cast is needed for comparisons between values in a JSON column
            # and non-null constants. We don't know the true type of the value
            # in the JSON column, so we use heuristics to cast to a reasonable
            # type given the operator and constant being compared.
            if isinstance(operator, (ast.Gt, ast.GtE, ast.Lt, ast.LtE)):
                # Assume the value is a float. If it's actually an integer, this
                # is probably okay.
                compiled_operand = cast(compiled_operand, Float())
            elif isinstance(operator, (ast.In, ast.NotIn)):
                compiled_operand = cast(compiled_operand, String())
            elif isinstance(operator, (ast.Eq, ast.NotEq, ast.Is, ast.IsNot)):
                # For the remaining operators, infer the cast type from the type
                # of the constant being compared. If the constant is None, no
                # cast is needed.
                if (constant_type := self._constant_operand.sqlalchemy_type) is not None:
                    compiled_operand = cast(compiled_operand, constant_type)
            else:
                assert_never(operator)
        return compiled_operand

    @property
    def _sqlalchemy_operator(self) -> Callable[[Any, Any], Any]:
        ast_operator = self._operator
        if isinstance(ast_operator, ast.Eq):
            return operator.eq
        elif isinstance(ast_operator, ast.NotEq):
            return operator.ne
        elif isinstance(ast_operator, ast.Lt):
            return operator.lt
        elif isinstance(ast_operator, ast.LtE):
            return operator.le
        elif isinstance(ast_operator, ast.Gt):
            return operator.gt
        elif isinstance(ast_operator, ast.GtE):
            return operator.ge
        elif isinstance(ast_operator, ast.Is):
            return lambda left, right: left.is_(right)  # noqa: E731
        elif isinstance(ast_operator, ast.IsNot):
            return lambda left, right: ~(left.is_(right))  # noqa: E731
        elif isinstance(ast_operator, ast.In):
            return lambda left, right: right.contains(left)  # noqa: E731
        elif isinstance(ast_operator, ast.NotIn):
            return lambda left, right: ~(right.contains(left))  # noqa: E731
        assert_never(ast_operator)


@dataclass(frozen=True)
class UnaryBooleanOperation(BooleanExpression):
    operand: BooleanExpression
    operator: ast.unaryop

    def compile(self) -> Any:
        ast_operator = self.operator
        sqlalchemy_operator: Callable[[BinaryExpression[Any]], BinaryExpression[Any]]
        if isinstance(ast_operator, ast.Not):
            sqlalchemy_operator = operator.invert
        else:
            raise ValueError(f"Unsupported unary operator: {ast_operator}")
        compiled_operand = self.operand.compile()
        return sqlalchemy_operator(compiled_operand)


@dataclass(frozen=True)
class BooleanOperation(BooleanExpression):
    operator: ast.boolop
    operands: list[BooleanExpression]

    def __post_init__(self) -> None:
        if len(self.operands) < 2:
            raise SyntaxError("boolean operation requires at least 2 operands")

    def compile(self) -> Any:
        ast_operator = self.operator
        operands = [operand.compile() for operand in self.operands]
        if isinstance(ast_operator, ast.And):
            return and_(*operands)
        elif isinstance(ast_operator, ast.Or):
            return or_(*operands)
        raise SyntaxError(f"Unsupported boolean operator: {ast_operator}")


class ExperimentRunFilterTransformer(ast.NodeTransformer):
    def __init__(self, experiment_ids: list[int]) -> None:
        assert len(experiment_ids) > 0
        self._experiment_ids = experiment_ids
        self._aliased_experiment_runs: dict[ExperimentID, Any] = {}
        self._aliased_experiment_run_annotations: dict[ExperimentID, Any] = {}

    def visit_Constant(self, node: ast.Constant) -> Constant:
        return Constant(value=node.value)

    def visit_Name(self, node: ast.Name) -> FilterExpressionNode:
        name = node.id
        if name == "experiments":
            return ExperimentsName()
        baseline_experiment_index = 0
        baseline_experiment = ExperimentRun(
            slice=Constant(value=baseline_experiment_index),
            experiment_ids=self._experiment_ids,
        )
        return ExperimentRunAttribute(
            attribute_name=name,
            experiment_run=baseline_experiment,
            transformer=self,
        )

    def visit_UnaryOp(self, node: ast.UnaryOp) -> UnaryBooleanOperation:
        operation = node.op
        operand = self.visit(node.operand)
        assert isinstance(operand, BooleanExpression)
        return UnaryBooleanOperation(operand=operand, operator=operation)

    def visit_BoolOp(self, node: ast.BoolOp) -> BooleanOperation:
        operator = node.op
        operands = [self.visit(value) for value in node.values]
        return BooleanOperation(operator=operator, operands=operands)

    def visit_Compare(self, node: ast.Compare) -> FilterExpressionNode:
        assert len(node.ops) == 1
        assert len(node.comparators) == 1

        left_operand = self.visit(node.left)
        right_operand = self.visit(node.comparators[0])
        operation = node.ops[0]
        return ComparisonOperation(
            left_operand=left_operand,
            right_operand=right_operand,
            operator=operation,
        )

    def visit_Subscript(self, node: ast.Subscript) -> FilterExpressionNode:
        container = self.visit(node.value)
        key = self.visit(node.slice)
        if isinstance(container, ExperimentsName):
            assert isinstance(key, Constant)
            return ExperimentRun(slice=key, experiment_ids=self._experiment_ids)
        if isinstance(container, ExperimentRunAttribute):
            if container.is_eval_attribute:
                return ExperimentRunEval(
                    experiment_run_attribute=container,
                    eval_name=key.value,
                )
            if container.is_json_attribute:
                return ExperimentRunJSONAttribute(
                    attribute=container,
                    index_constant=key,
                )
        if isinstance(container, ExperimentRunJSONAttribute):
            return ExperimentRunJSONAttribute(
                attribute=container,
                index_constant=key,
            )
        raise SyntaxError

    def visit_Attribute(self, node: ast.Attribute) -> FilterExpressionNode:
        parent = self.visit(node.value)
        attribute_name = node.attr
        if isinstance(parent, ExperimentRun):
            return ExperimentRunAttribute(
                attribute_name=attribute_name,
                experiment_run=parent,
                transformer=self,
            )
        if isinstance(parent, ExperimentRunEval):
            return ExperimentRunEvalAttribute(
                attribute_name=attribute_name,
                experiment_run_eval=parent,
                transformer=self,
            )
        raise ValueError

    def create_experiment_runs_alias(self, experiment_id: ExperimentID) -> Any:
        if self.get_experiment_runs_alias(experiment_id) is not None:
            raise ValueError
        experiment_index = self.get_experiment_index(experiment_id)
        alias_name = f"experiment_runs_{experiment_index}"
        aliased_table = aliased(models.ExperimentRun, name=alias_name)
        self._aliased_experiment_runs[experiment_id] = aliased_table
        return aliased_table

    def get_experiment_runs_alias(self, experiment_id: ExperimentID) -> Any:
        return self._aliased_experiment_runs.get(experiment_id)

    def create_experiment_run_annotations_alias(self, experiment_id: ExperimentID) -> Any:
        if self.get_experiment_run_annotations_alias(experiment_id) is not None:
            raise ValueError
        experiment_index = self.get_experiment_index(experiment_id)
        alias_name = f"experiment_run_annotations_{experiment_index}"
        aliased_table = aliased(models.ExperimentRunAnnotation, name=alias_name)
        self._aliased_experiment_run_annotations[experiment_id] = aliased_table
        return aliased_table

    def get_experiment_run_annotations_alias(self, experiment_id: ExperimentID) -> Any:
        return self._aliased_experiment_run_annotations.get(experiment_id)

    def get_experiment_index(self, experiment_id: ExperimentID) -> int:
        return self._experiment_ids.index(experiment_id)


def _is_supported_comparison_operator(
    operator: ast.cmpop,
) -> TypeGuard[SupportedComparisonOperator]:
    return isinstance(operator, get_args(SupportedComparisonOperator))


if __name__ == "__main__":
    expressions = [
        "'search-term' in experiments[0].evals['Hallucination'].explanation",
    ]

    for expression in expressions:
        tree = ast.parse(expression, mode="eval")
        transformer = ExperimentRunFilterTransformer([0, 1, 2])
        transformed_tree = transformer.visit(tree)
        node = transformed_tree.body
        orm_filter_expression = node.compile()
        sql_filter_expression = str(
            orm_filter_expression.compile(compile_kwargs={"literal_binds": True})
        )
        print(f"{expression=}")
        print(f"{sql_filter_expression=}")
