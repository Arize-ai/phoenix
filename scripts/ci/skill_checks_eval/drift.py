"""Drift injection: break the client packages on purpose and count what the check catches.

Each mutation is a realistic breaking change to ``phoenix.client``, ``phoenix.evals`` or
``phoenix.otel``: a renamed method, a renamed or removed keyword argument, or a renamed field
of a returned type. The oracle for each mutation is independent of pyright: it walks every
skill example's syntax tree for a use of the changed name, such as a call to
``get_spans_dataframe`` or an ``experiment_name=`` keyword in a ``run_experiment`` call. An
example the oracle marks is affected, because a reader who copies it now gets an error.

For each mutation the script reports which affected examples the check flags (recall) and
which flagged examples the oracle didn't mark (spurious flags). It runs the check as CI does
and, for comparison, with the typed prelude from ``prelude.py``.

Usage: ``uv run python scripts/ci/skill_checks_eval/drift.py [--json OUT]``
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import tempfile
import textwrap
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path

from harness import checkable_sources, copy_packages, errors_by_source, failing
from prelude import with_preludes

CLIENT = "phoenix-client/src/phoenix/client"
EVALS = "phoenix-evals/src/phoenix/evals"
OTEL = "phoenix-otel/src/phoenix/otel"


@dataclass(frozen=True)
class Edit:
    """A regex substitution in one package file, relative to ``packages/``."""

    path: str
    pattern: str
    replacement: str


Oracle = Callable[[ast.Module], bool]


def _callee_name(call: ast.Call) -> str | None:
    if isinstance(call.func, ast.Attribute):
        return call.func.attr
    if isinstance(call.func, ast.Name):
        return call.func.id
    return None


def calls(names: set[str], keyword: str | None = None) -> Oracle:
    """Marks a tree that calls one of ``names``, with ``keyword`` if given."""

    def oracle(tree: ast.Module) -> bool:
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and _callee_name(node) in names:
                if keyword is None or any(kw.arg == keyword for kw in node.keywords):
                    return True
        return False

    return oracle


def imports_or_calls(module: str, name: str) -> Oracle:
    """Marks a tree that imports ``name`` from ``module`` or calls ``name``."""
    called = calls({name})

    def oracle(tree: ast.Module) -> bool:
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and (node.module or "").startswith(module):
                if any(alias.name == name for alias in node.names):
                    return True
        return called(tree)

    return oracle


def reads_field(name: str, after_call: str) -> Oracle:
    """Marks a tree that calls ``after_call`` and reads ``name`` as an attribute or key."""
    called = calls({after_call})

    def oracle(tree: ast.Module) -> bool:
        if not called(tree):
            return False
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr == name:
                return True
            if (
                isinstance(node, ast.Subscript)
                and isinstance(node.slice, ast.Constant)
                and node.slice.value == name
            ):
                return True
        return False

    return oracle


@dataclass(frozen=True)
class Mutation:
    name: str
    kind: str
    edits: tuple[Edit, ...]
    oracle: Oracle = field(compare=False)


def _rename_def(path: str, old: str, new: str) -> Edit:
    return Edit(path, rf"\bdef {old}\(", f"def {new}(")


def _rename_param(path: str, old: str, new: str) -> Edit:
    return Edit(path, rf"^(\s+){old}(\s*:)", rf"\g<1>{new}\g<2>")


def _remove_param(path: str, name: str) -> Edit:
    return Edit(path, rf"^\s+{name}\s*:[^\n]*\n", "")


SPANS = f"{CLIENT}/resources/spans/__init__.py"
DATASETS = f"{CLIENT}/resources/datasets/__init__.py"
EXPERIMENTS = f"{CLIENT}/resources/experiments/__init__.py"
EXPERIMENTS_TOP = f"{CLIENT}/experiments/__init__.py"

MUTATIONS = (
    Mutation(
        "spans.get_spans_dataframe renamed",
        "rename method",
        (_rename_def(SPANS, "get_spans_dataframe", "get_spans_frame"),),
        calls({"get_spans_dataframe"}),
    ),
    Mutation(
        "spans.log_span_annotations_dataframe renamed",
        "rename method",
        (_rename_def(SPANS, "log_span_annotations_dataframe", "log_annotations_dataframe"),),
        calls({"log_span_annotations_dataframe"}),
    ),
    Mutation(
        "spans.* project_identifier= renamed to project=",
        "rename kwarg",
        (_rename_param(SPANS, "project_identifier", "project"),),
        calls(
            {
                "get_spans_dataframe",
                "get_span_annotations_dataframe",
                "get_spans",
                "log_spans",
                "get_span_annotations",
                "log_spans_dataframe",
            },
            "project_identifier",
        ),
    ),
    Mutation(
        "datasets.create_dataset renamed to create",
        "rename method",
        (_rename_def(DATASETS, "create_dataset", "create"),),
        calls({"create_dataset"}),
    ),
    Mutation(
        "datasets.get_dataset dataset= renamed to identifier=",
        "rename kwarg",
        (
            Edit(
                DATASETS,
                r"(def get_dataset\(\s*self,\s*\*,\s*)dataset(\s*:)",
                r"\g<1>identifier\g<2>",
            ),
        ),
        calls({"get_dataset"}, "dataset"),
    ),
    Mutation(
        "run_experiment experiment_name= removed",
        "remove kwarg",
        (
            _remove_param(EXPERIMENTS, "experiment_name"),
            _remove_param(EXPERIMENTS_TOP, "experiment_name"),
        ),
        calls({"run_experiment"}, "experiment_name"),
    ),
    Mutation(
        "run_experiment evaluators= renamed to evals=",
        "rename kwarg",
        (
            _rename_param(EXPERIMENTS, "evaluators", "evals"),
            _rename_param(EXPERIMENTS_TOP, "evaluators", "evals"),
        ),
        calls({"run_experiment"}, "evaluators"),
    ),
    Mutation(
        "RanExperiment.experiment_id renamed to id",
        "change return type",
        (
            Edit(
                f"{CLIENT}/resources/experiments/types.py",
                r"^    experiment_id: ExperimentId",
                "    id: ExperimentId",
            ),
        ),
        reads_field("experiment_id", "run_experiment"),
    ),
    Mutation(
        "Client base_url= renamed to endpoint=",
        "rename kwarg",
        (_rename_param(f"{CLIENT}/client.py", "base_url", "endpoint"),),
        calls({"Client", "AsyncClient"}, "base_url"),
    ),
    Mutation(
        "otel.register renamed",
        "rename function",
        (
            _rename_def(f"{OTEL}/otel.py", "register", "register_tracer_provider"),
            Edit(f"{OTEL}/__init__.py", r"\bregister\b", "register_tracer_provider"),
        ),
        imports_or_calls("phoenix.otel", "register"),
    ),
    Mutation(
        "otel.register project_name= renamed to project=",
        "rename kwarg",
        (
            Edit(
                f"{OTEL}/otel.py",
                r"(def register\(\s*\*,\s*endpoint[^\n]*\n\s+)project_name",
                r"\g<1>project",
            ),
        ),
        calls({"register"}, "project_name"),
    ),
    Mutation(
        "otel.register auto_instrument= removed",
        "remove kwarg",
        (Edit(f"{OTEL}/otel.py", r"\n    auto_instrument: bool = False,", ""),),
        calls({"register"}, "auto_instrument"),
    ),
    Mutation(
        "evals.evaluate_dataframe renamed",
        "rename function",
        (
            _rename_def(f"{EVALS}/evaluators.py", "evaluate_dataframe", "evaluate_df"),
            Edit(f"{EVALS}/__init__.py", r"\bevaluate_dataframe\b", "evaluate_df"),
        ),
        imports_or_calls("phoenix.evals", "evaluate_dataframe"),
    ),
    Mutation(
        "evaluate_dataframe dataframe= renamed to df=",
        "rename kwarg",
        (
            Edit(
                f"{EVALS}/evaluators.py",
                r"(def (?:async_)?evaluate_dataframe\(\s*)dataframe",
                r"\g<1>df",
            ),
        ),
        calls({"evaluate_dataframe", "async_evaluate_dataframe"}, "dataframe"),
    ),
    Mutation(
        "evals.create_classifier renamed",
        "rename function",
        (
            _rename_def(f"{EVALS}/evaluators.py", "create_classifier", "make_classifier"),
            Edit(f"{EVALS}/__init__.py", r"\bcreate_classifier\b", "make_classifier"),
        ),
        imports_or_calls("phoenix.evals", "create_classifier"),
    ),
    Mutation(
        "ClassificationEvaluator choices= renamed to labels=",
        "rename kwarg",
        (
            Edit(
                f"{EVALS}/evaluators.py",
                r"(prompt_template: Union\[PromptLike, PromptTemplate, Template\],\n\s+)choices",
                r"\g<1>labels",
            ),
        ),
        calls({"ClassificationEvaluator"}, "choices"),
    ),
    Mutation(
        "LLM provider= renamed to vendor=",
        "rename kwarg",
        (_rename_param(f"{EVALS}/llm/llm.py", "provider", "vendor"),),
        calls({"LLM"}, "provider"),
    ),
    Mutation(
        "evals.create_evaluator kind= renamed to category=",
        "rename kwarg",
        (
            Edit(
                f"{EVALS}/evaluators.py",
                r"(direction: DirectionType = \"maximize\",\n\s+)kind"
                r"(: Optional\[KindType\] = None,\n\) -> Callable)",
                r"\g<1>category\g<2>",
            ),
        ),
        calls({"create_evaluator"}, "kind"),
    ),
    Mutation(
        "evals.bind_evaluator renamed",
        "rename function",
        (
            _rename_def(f"{EVALS}/evaluators.py", "bind_evaluator", "bind"),
            Edit(f"{EVALS}/__init__.py", r"\bbind_evaluator\b", "bind"),
        ),
        imports_or_calls("phoenix.evals", "bind_evaluator"),
    ),
)


def apply(mutation: Mutation, packages_root: Path) -> None:
    for edit in mutation.edits:
        path = packages_root / "packages" / edit.path
        text = path.read_text(encoding="utf-8")
        changed, count = re.subn(edit.pattern, edit.replacement, text, flags=re.MULTILINE)
        if not count:
            raise ValueError(f"{mutation.name}: {edit.pattern!r} matches nothing in {edit.path}")
        path.write_text(changed, encoding="utf-8")


def affected(mutation: Mutation, sources: Mapping[str, str]) -> set[str]:
    found = set()
    for source_id, source in sources.items():
        try:
            tree = ast.parse(source)
        except SyntaxError:
            continue
        if mutation.oracle(tree):
            found.add(source_id)
    return found


def newly_failing(baseline: Mapping[str, list[str]], mutated: Mapping[str, list[str]]) -> set[str]:
    return {
        source_id
        for source_id, messages in mutated.items()
        if set(messages) - set(baseline.get(source_id, []))
    }


def hide_module_getattr(packages_root: Path) -> None:
    """Guards ``phoenix.evals.__getattr__`` with ``if not TYPE_CHECKING``.

    The module-level ``__getattr__`` returns ``Any``, so pyright accepts every
    ``from phoenix.evals import <name>``, even for names the package no longer has.
    """
    path = packages_root / "packages" / EVALS / "__init__.py"
    text = path.read_text(encoding="utf-8")
    block = re.search(r"^def __getattr__\(.*?(?=^\S)", text, re.DOTALL | re.MULTILINE)
    assert block, "phoenix.evals no longer defines __getattr__"
    guarded = "from typing import TYPE_CHECKING\n\nif not TYPE_CHECKING:\n" + textwrap.indent(
        block.group(0), "    "
    )
    path.write_text(text.replace(block.group(0), guarded), encoding="utf-8")


def keep_decorated_signatures(packages_root: Path) -> None:
    """Types the evals deprecation decorators so they keep the signature they wrap.

    ``_deprecate_positional_args`` and ``_deprecate_source_and_heuristic`` return
    ``Callable[..., Any]``, which hides the parameters and return type of
    ``evaluate_dataframe``, ``create_classifier``, ``bind_evaluator`` and others.
    """
    path = packages_root / "packages" / EVALS / "utils.py"
    text = path.read_text(encoding="utf-8")
    for old, new in (
        (
            "import pandas as pd\n",
            'import pandas as pd\n\n_F = TypeVar("_F", bound=Callable[..., Any])\n',
        ),
        ("from typing import Any,", "from typing import TypeVar, Any,"),
        (") -> Callable[[Callable[..., Any]], Callable[..., Any]]:", ") -> Callable[[_F], _F]:"),
        (
            "def _deprecate_source_and_heuristic(func: Callable[..., Any]) -> Callable[..., Any]:",
            "def _deprecate_source_and_heuristic(func: _F) -> _F:",
        ),
    ):
        assert old in text, f"phoenix.evals.utils no longer has {old!r}"
        text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")


def type_evals(packages_root: Path) -> None:
    """Applies both phoenix.evals typing fixes."""
    hide_module_getattr(packages_root)
    keep_decorated_signatures(packages_root)


@dataclass(frozen=True)
class Variant:
    """One way to run the check: which sources it sees and how the packages look."""

    sources: Mapping[str, str]
    typed_evals: bool = False


def _packages(directory: Path, variant: Variant, mutation: Mutation | None) -> Path:
    packages_root = copy_packages(directory)
    if mutation:
        apply(mutation, packages_root)
    if variant.typed_evals:
        type_evals(packages_root)
    return packages_root


def evaluate(
    variants: Mapping[str, Variant],
) -> tuple[list[dict[str, object]], dict[str, dict[str, list[str]]]]:
    """Runs every mutation under every variant of the check."""
    oracle_sources = checkable_sources()
    baselines = {}
    for name, variant in variants.items():
        with tempfile.TemporaryDirectory() as directory:
            baselines[name] = errors_by_source(
                variant.sources, _packages(Path(directory), variant, None)
            )
    rows = []
    for mutation in MUTATIONS:
        truth = affected(mutation, oracle_sources)
        row: dict[str, object] = {
            "mutation": mutation.name,
            "kind": mutation.kind,
            "affected": sorted(truth),
        }
        for name, variant in variants.items():
            with tempfile.TemporaryDirectory() as directory:
                packages_root = _packages(Path(directory), variant, mutation)
                errors = errors_by_source(variant.sources, packages_root)
            flagged = newly_failing(baselines[name], errors)
            row[name] = {"caught": sorted(truth & flagged), "spurious": sorted(flagged - truth)}
        rows.append(row)
    return rows, baselines


def summarize(rows: list[dict[str, object]], variants: list[str]) -> str:
    lines = [f"{'mutation':52} {'affected':>8} " + " ".join(f"{v:>16}" for v in variants)]
    totals = {v: [0, 0, 0] for v in variants}
    affected_total = 0
    for row in rows:
        n = len(row["affected"])  # type: ignore[arg-type]
        affected_total += n
        cells = []
        for v in variants:
            result = row[v]  # type: ignore[index]
            caught, spurious = len(result["caught"]), len(result["spurious"])
            totals[v][0] += caught
            totals[v][1] += spurious
            totals[v][2] += int(n > 0 and caught == n)
            cells.append(f"{caught:>3}/{n:<3} +{spurious:<2} spur")
        lines.append(f"{row['mutation']:52} {n:>8} " + " ".join(f"{c:>16}" for c in cells))
    lines.append("")
    for v in variants:
        caught, spurious, full = totals[v]
        with_uses = sum(1 for row in rows if row["affected"])
        lines.append(
            f"{v}: recall {caught}/{affected_total} = {caught / affected_total:.0%} of affected "
            f"examples; {full}/{with_uses} mutations fully caught; {spurious} spurious flags"
        )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--json", type=Path, help="Write per-example results here.")
    args = parser.parse_args()
    sources = checkable_sources()
    preluded = with_preludes(sources)
    variants = {
        "check": Variant(sources),
        "+typed-evals": Variant(sources, typed_evals=True),
        "+prelude": Variant(preluded),
        "+both": Variant(preluded, typed_evals=True),
    }
    rows, baselines = evaluate(variants)
    for name, errors in baselines.items():
        print(f"{name}: {len(failing(errors))} examples fail before any mutation")
    print(summarize(rows, list(variants)))
    if args.json:
        args.json.write_text(
            json.dumps({"rows": rows, "baselines": baselines}, indent=2), encoding="utf-8"
        )


if __name__ == "__main__":
    main()
