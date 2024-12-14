# evals["Hallucination"].score > 0.5
# evals["Hallucination"].label == "hallucinated"
# latency_seconds > 10
# evals["Hallucination"].metadata["key"] == "value"
# error is None
# error is not None
# input["key"] == "value"
# input["key"] > 10
# output["key"] == "value"
# output["key"] > 10

import ast
import operator
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Union

from sqlalchemy import BinaryExpression

from phoenix.db import models


@dataclass(frozen=True)
class FilterExpressionNode(ABC):
    """
    A node in the syntax tree for a translated SQLAlchemy expression.
    """

    @abstractmethod
    def compile(self) -> Any:
        """
        Compiles the node into a SQLAlchemy expression.
        """
        raise NotImplementedError


@dataclass(frozen=True)
class Constant(FilterExpressionNode):
    value: Union[bool, int, float, str, None]

    def compile(self) -> Any:
        return self.value


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
    def update_primitive_boolean_expression(
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
        table: type[models.Base]
        attribute_name = self.attribute_name
        if attribute_name == "evals":
            raise NotImplementedError("Can't compile 'experiment[<index>].evals' alone")
        elif attribute_name in ("input", "output"):
            table = models.DatasetExampleRevision
        elif attribute_name in ("reference_output", "error", "latency_ms"):
            table = models.ExperimentRun
        else:
            raise ValueError(f"Experiment runs have no attribute '{attribute_name}'")
        return getattr(table, self.attribute_name)

    @property
    def is_eval_attribute(self) -> bool:
        return self.attribute_name == "evals"

    def update_primitive_boolean_expression(self, expression: Any) -> Any:
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

    def update_primitive_boolean_expression(self, expression: Any) -> Any:
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

    def compile(self) -> Any:
        ast_operator = self.operator
        sqlalchemy_operator: Callable[
            [BinaryExpression[Any], BinaryExpression[Any]], BinaryExpression[Any]
        ]
        if isinstance(ast_operator, ast.Eq):
            sqlalchemy_operator = operator.eq
        elif isinstance(ast_operator, ast.NotEq):
            sqlalchemy_operator = operator.ne
        elif isinstance(ast_operator, ast.Lt):
            sqlalchemy_operator = operator.lt
        elif isinstance(ast_operator, ast.LtE):
            sqlalchemy_operator = operator.le
        elif isinstance(ast_operator, ast.Gt):
            sqlalchemy_operator = operator.gt
        elif isinstance(ast_operator, ast.GtE):
            sqlalchemy_operator = operator.ge
        elif isinstance(ast_operator, ast.Is):
            sqlalchemy_operator = lambda left, right: left.is_(right)  # noqa: E731
        elif isinstance(ast_operator, ast.IsNot):
            sqlalchemy_operator = lambda left, right: ~(left.is_(right))  # noqa: E731
        else:
            raise ValueError(f"Unsupported comparison operator: {ast_operator}")
        assert isinstance(left_operand := self.left_operand, Attribute)
        assert isinstance(right_operand := self.right_operand, Constant)
        compiled_left_operand = left_operand.compile()
        compiled_right_operand = right_operand.compile()
        comparison_expression = sqlalchemy_operator(compiled_left_operand, compiled_right_operand)
        comparison_expression = left_operand.update_primitive_boolean_expression(
            comparison_expression
        )
        return comparison_expression


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
class BinaryBooleanOperation(BooleanExpression):
    left_operand: BooleanExpression
    right_operand: BooleanExpression
    operator: ast.boolop

    def compile(self) -> Any:
        ast_operator = self.operator
        sqlalchemy_operator: Callable[
            [BinaryExpression[Any], BinaryExpression[Any]], BinaryExpression[Any]
        ]
        if isinstance(ast_operator, ast.And):
            sqlalchemy_operator = operator.and_
        elif isinstance(ast_operator, ast.Or):
            sqlalchemy_operator = operator.or_
        else:
            raise ValueError(f"Unsupported binary boolean operator: {ast_operator}")
        compiled_left_operand = self.left_operand.compile()
        compiled_right_operand = self.right_operand.compile()
        return sqlalchemy_operator(compiled_left_operand, compiled_right_operand)


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

    def visit_BoolOp(self, node: ast.BoolOp) -> BinaryBooleanOperation:
        operator = node.op
        assert len(node.values) == 2
        left_operand, right_operand = [self.visit(value) for value in node.values]
        assert isinstance(left_operand, BooleanExpression)
        assert isinstance(right_operand, BooleanExpression)
        return BinaryBooleanOperation(
            left_operand=left_operand,
            right_operand=right_operand,
            operator=operator,
        )

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
        if isinstance(container, ExperimentRunAttribute) and container.is_eval_attribute:
            return ExperimentRunEval(
                experiment_run_attribute=container,
                eval_name=key.value,
            )
        raise ValueError

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


if __name__ == "__main__":
    expressions = [
        "input",
        "output",
        "error",
        "latency_ms",
        "error is None",
        "error is not None",
        "latency_ms > 10",
        "experiments[0].input",
        "experiments[1].output",
        "experiments[2].error is None",
        "experiments[0].error is not None",
        "experiments[1].latency_ms > 10",
        "experiments[0].evals['Hallucination'].score > 0.5",
        "experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 10",
        "not (experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 10)",
    ]
    for expression in expressions:
        tree = ast.parse(expression, mode="eval")
        transformer = ExperimentRunFilterTransformer([0, 1, 2])
        transformed_tree = transformer.visit(tree)
        node = transformed_tree.body
        orm_filter_expression = node.compile()
        sql_filter_expression = orm_filter_expression.compile(
            compile_kwargs={"literal_binds": True}
        )
        print(expression, sql_filter_expression)
