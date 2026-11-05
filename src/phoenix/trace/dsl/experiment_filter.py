"""ExperimentFilter — the experiment-grain sibling of :class:`~phoenix.trace.dsl.filter.SpanFilter`.

Experiment intrinsics bind to ``Experiment`` columns, and ``metadata["k"]`` reads the experiment's
own metadata JSON. Each subscript is one key, so ``metadata["a"]["b.c"]`` reads the key ``b.c``
nested under ``a``.
"""

import ast
import typing
from dataclasses import dataclass, field
from types import MappingProxyType

from sqlalchemy.sql.expression import Select

from phoenix.db import models
from phoenix.trace.dsl.filter import NameMap, _compile_condition, _eval_globals, _FilterBindings

__all__ = ["ExperimentFilter", "EXPERIMENT_BINDINGS", "EXPERIMENT_FILTER_DESCRIPTIONS"]

_EXPERIMENT_STRING_NAMES: NameMap = MappingProxyType(
    {
        "name": models.Experiment.name,
        "description": models.Experiment.description,
        "project_name": models.Experiment.project_name,
    }
)
_EXPERIMENT_FLOAT_NAMES: NameMap = MappingProxyType(
    {
        "repetitions": models.Experiment.repetitions,
    }
)
_EXPERIMENT_DATETIME_NAMES: NameMap = MappingProxyType(
    {
        "created_at": models.Experiment.created_at,
        "updated_at": models.Experiment.updated_at,
    }
)

# The shared translator lowers `metadata[...]` to `attributes[["metadata", ...]]`.
_METADATA_KEY = "metadata"
_ATTRIBUTES_NAME = "attributes"
_UNSUPPORTED_ACCESSOR_ERROR = "`{name}[...]` is not available in the experiment filter"

EXPERIMENT_BINDINGS = _FilterBindings(
    string_names=_EXPERIMENT_STRING_NAMES,
    float_names=_EXPERIMENT_FLOAT_NAMES,
    datetime_names=_EXPERIMENT_DATETIME_NAMES,
    extra_names=MappingProxyType({}),
    aggregate_names=frozenset(),
    legacy_replacements=MappingProxyType({}),
    uppercase_names=frozenset(),
    annotation_model=models.ExperimentRunAnnotation,
    annotation_fk="experiment_run_id",
    entity_id=models.Experiment.id,
    annotation_table_prefix="experiment_run_annotation",
    reject_unbound_names=True,
    annotation_accessors=frozenset(),
    annotation_accessor_errors=MappingProxyType(
        {
            name: _UNSUPPORTED_ACCESSOR_ERROR.format(name=name)
            for name in (_ATTRIBUTES_NAME, "annotations", "evals")
        }
    ),
    case_insensitive_containment=True,
    strict_semantics=True,
)

EXPERIMENT_FILTER_DESCRIPTIONS: typing.Mapping[str, str] = MappingProxyType(
    {
        "name": "The experiment's name. `in` ignores case; `==` is exact.",
        "description": (
            "The experiment's description. `in` ignores case; `==` is exact; missing when the "
            "experiment has no description."
        ),
        "project_name": (
            "The name of the project that holds the experiment's traces. `in` ignores case; "
            "`==` is exact."
        ),
        "repetitions": "How many times the experiment runs each example.",
        "created_at": (
            "When the experiment was created. Compare against an ISO 8601 string with an "
            "explicit offset, e.g. `2026-07-01T00:00:00Z`."
        ),
        "updated_at": (
            "When the experiment was last updated. Compare against an ISO 8601 string with an "
            "explicit offset, e.g. `2026-07-01T00:00:00Z`."
        ),
        'metadata["key"]': (
            "A value in the experiment's metadata. Each subscript is one key, so "
            '`metadata["a"]["b"]` reads `b` nested under `a`. A comparison with a number or a '
            "boolean reads the value as one."
        ),
    }
)


class _ExperimentMetadata:
    """Reads ``attributes[["metadata", ...]]`` from the experiment's metadata column."""

    def __getitem__(self, keys: typing.Sequence[typing.Any]) -> typing.Any:
        if not keys or keys[0] != _METADATA_KEY or len(keys) < 2:
            raise SyntaxError('read experiment metadata as `metadata["key"]`')
        return models.Experiment.metadata_[list(keys[1:])]


@dataclass(frozen=True)
class ExperimentFilter:
    """Compile and apply one experiment filter condition."""

    condition: str = ""
    translated: ast.Expression = field(init=False, repr=False)
    compiled: typing.Any = field(init=False, repr=False)
    _literal_bindings: dict[str, typing.Any] = field(init=False, repr=False)

    def __bool__(self) -> bool:
        return bool(self.condition)

    def __post_init__(self) -> None:
        if not (source := self.condition):
            return
        compiled_condition = _compile_condition(source, EXPERIMENT_BINDINGS, None)
        object.__setattr__(self, "translated", compiled_condition.translated)
        object.__setattr__(self, "compiled", compiled_condition.compiled)
        object.__setattr__(self, "_literal_bindings", compiled_condition.literal_bindings)

    def __call__(self, stmt: Select[typing.Any]) -> Select[typing.Any]:
        """Apply the condition to a statement selecting from ``Experiment``."""
        if not self.condition:
            return stmt
        return stmt.where(
            eval(
                self.compiled,
                _eval_globals(
                    EXPERIMENT_BINDINGS,
                    {},
                    {**self._literal_bindings, _ATTRIBUTES_NAME: _ExperimentMetadata()},
                ),
            )
        )
