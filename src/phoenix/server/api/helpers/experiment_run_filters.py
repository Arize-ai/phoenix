import ast
import operator
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Literal, Union, get_args

from sqlalchemy import BinaryExpression, Boolean, Float, Integer, String, and_, cast, or_
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


def get_orm_filter_expression(filter_expression: str, experiment_ids: list[int]) -> Any:
    tree = ast.parse(filter_expression, mode="eval")
    transformer = ExperimentRunFilterTransformer(experiment_ids)
    transformed_tree = transformer.visit(tree)
    node = transformed_tree.body
    if not isinstance(node, BooleanExpression):
        raise ValueError("Filter expression must be a boolean expression")
    orm_filter_expression = node.compile()
    return orm_filter_expression


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
class HasExperimentIdMixin:
    experiment_id: int = field(init=False)


@dataclass(frozen=True)
class ExperimentRun(HasExperimentIdMixin, FilterExpressionNode):
    slice: Constant
    experiment_ids: list[int]

    def __post_init__(self) -> None:
        experiment_index = self.slice.value
        assert isinstance(experiment_index, int)
        assert 0 <= experiment_index < len(self.experiment_ids)
        object.__setattr__(self, "experiment_id", self.experiment_ids[experiment_index])

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
class ExperimentRunAttribute(HasExperimentIdMixin, Attribute):
    experiment_run: ExperimentRun
    attribute_name: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "experiment_id", self.experiment_run.experiment_id)

    def compile(self) -> Any:
        column = self._column
        if column is None:
            raise SyntaxError
        return column

    def update_comparison_expression(self, expression: Any) -> Any:
        return expression & (models.ExperimentRun.experiment_id == self.experiment_id)

    @property
    def is_eval_attribute(self) -> bool:
        return self.attribute_name == "evals"

    @property
    def is_json_attribute(self) -> bool:
        return self.attribute_name in ("input", "reference_output", "output")

    @property
    def _column(self) -> Any:
        attribute_name = self.attribute_name
        if attribute_name == "evals":
            return None
        elif attribute_name == "input":
            return models.DatasetExampleRevision.input
        elif attribute_name == "reference_output":
            return models.DatasetExampleRevision.output
        elif attribute_name == "output":
            return models.ExperimentRun.output
        elif attribute_name == "error":
            return models.ExperimentRun.error
        elif attribute_name == "latency_ms":
            return models.ExperimentRun.latency_ms
        raise ValueError(f"Experiment runs have no attribute '{attribute_name}'")


@dataclass(frozen=True)
class ExperimentRunJSONAttribute(HasExperimentIdMixin, Attribute):
    attribute: Union[ExperimentRunAttribute, "ExperimentRunJSONAttribute"]
    index_constant: Constant
    _index_value: Union[int, str] = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "experiment_id", self.attribute.experiment_id)
        index_value = self.index_constant.value
        if not isinstance(index_value, (int, str)):
            raise SyntaxError
        object.__setattr__(self, "_index_value", index_value)

    def compile(self) -> Any:
        compiled_attribute = self.attribute.compile()
        return compiled_attribute[self._index_value]

    def update_comparison_expression(self, expression: Any) -> Any:
        return expression & (models.ExperimentRun.experiment_id == self.experiment_id)


@dataclass(frozen=True)
class ExperimentRunEval(HasExperimentIdMixin, FilterExpressionNode):
    experiment_run_attribute: ExperimentRunAttribute
    eval_name: str

    def __post_init__(self) -> None:
        assert isinstance(self.eval_name, str)
        object.__setattr__(self, "experiment_id", self.experiment_run_attribute.experiment_id)

    def compile(self) -> Any:
        raise NotImplementedError("Can't compile 'experiment[<index>].evals[<eval_name>]' alone")


@dataclass(frozen=True)
class ExperimentRunEvalAttribute(HasExperimentIdMixin, Attribute):
    experiment_run_eval: ExperimentRunEval
    attribute_name: str
    table: type[models.Base] = field(init=False)
    eval_name: str = field(init=False)

    def __post_init__(self) -> None:
        assert self.attribute_name in ("score", "explanation", "label")
        object.__setattr__(self, "experiment_id", self.experiment_run_eval.experiment_id)
        object.__setattr__(self, "table", models.ExperimentRunAnnotation)
        object.__setattr__(self, "eval_name", self.experiment_run_eval.eval_name)

    def compile(self) -> Any:
        return getattr(self.table, self.attribute_name)

    def update_comparison_expression(self, expression: Any) -> Any:
        return (
            expression
            & (models.ExperimentRun.experiment_id == self.experiment_id)
            & (models.ExperimentRunAnnotation.name == self.eval_name)
        )


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
        if isinstance(operand, ExperimentRunJSONAttribute):
            cast_type = self._constant_operand.sqlalchemy_type
            if cast_type is not None:
                compiled_operand = cast(compiled_operand, cast_type)
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
            )
        if isinstance(parent, ExperimentRunEval):
            return ExperimentRunEvalAttribute(
                attribute_name=attribute_name,
                experiment_run_eval=parent,
            )
        raise ValueError


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
