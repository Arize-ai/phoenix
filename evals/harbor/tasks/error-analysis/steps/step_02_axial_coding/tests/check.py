"""Step 2 verifier: axial coding produced granular per-dimension annotation configs and
labelled the entities that carry open-coding notes, mirrored in the axial sidecar."""

import json
import sys

sys.path.insert(0, "/opt/error-analysis/checks")
import error_analysis_checks as ea  # noqa: E402

STEP = 2
truth = ea.load_truth()
planted = {t["trace_id"] for t in truth["planted_traces"]}
blocklist = truth["generic_config_names_blocklist"]

with ea.connect() as connection:
    annotations = ea.fetch_annotations(connection)
    configs = ea.fetch_annotation_configs(connection, truth["project_name"])
    sidecars = ea.load_sidecars(connection, ea.agent_session_rowid(STEP))

notes = ea.notes(annotations)
labels = ea.axial(annotations)
config_names = {c.name for c in configs}

categorical = [c for c in configs if c.is_categorical]
generic_names = sorted(c.name for c in configs if ea.is_generic_name(c.name, blocklist))
oversized = sorted(c.name for c in categorical if not 2 <= len(c.values) <= 6)
configs_ok = len(categorical) >= 2 and not generic_names and not oversized

noted_traces = ea.covered_trace_ids(notes)
labelled_traces = ea.covered_trace_ids(labels)
names_without_config = sorted({a.name for a in labels} - config_names)
labels_outside_notes = sorted(labelled_traces - noted_traces)
planted_unlabelled = sorted(planted - labelled_traces)
identifier = ea.shared_identifier(labels)
notes_identifier = ea.shared_identifier(notes)
labels_ok = (
    bool(labels)
    and not names_without_config
    and not labels_outside_notes
    and not planted_unlabelled
    and identifier is not None
    and identifier == notes_identifier
)

axial_rows = ea.sidecar_rows(sidecars, axial_file=True)
sidecar_ok, sidecar_detail = ea.entities_mirrored(labels, axial_rows)
sidecar_names = {str(r.get("annotation_name", "")) for r in axial_rows} - {""}
sidecar_ok = sidecar_ok and sidecar_names <= config_names

expected = truth["expected_dimensions"]
expected_text = "\n".join(
    f"- {name}: {d['question']} (example labels: {', '.join(d['example_labels'])})"
    for name, d in expected.items()
)
configs_text = "\n".join(
    f"- {c.name}: description={c.config.get('description')!r} values={c.values}" for c in configs
)
verdict = ea.judge(
    system=(
        "You grade the annotation configs an AI assistant created after grouping open-coding "
        "notes about an LLM application's traces into failure dimensions (axial coding). The "
        "expected dimensions are a reference, not required names: credit a dimension as covered "
        "when some config asks essentially the same question, however it is named, and ignore "
        "extra configs that judge additional dimensions. A config is a catch-all only when one "
        "config's labels mix unrelated failure types that belong to different questions, such "
        "as a hallucinated fact next to a tool timeout next to a missing span, the way a generic "
        "failure_mode or issue_type bucket would. A config whose labels are different outcomes of "
        "one question, for example which kind of instrumentation is missing or which kind of "
        "grounding failure occurred, is granular, not a catch-all."
    ),
    user=(
        f"EXPECTED DIMENSIONS:\n{expected_text}\n\nCREATED CONFIGS:\n{configs_text}\n\n"
        "Return JSON with keys: dimensions_covered (list of expected dimension names that some "
        "created config judges, allowing different naming), coverage (fraction of expected "
        "dimensions covered, 0-1), one_dimension_per_config (true if every config asks a single "
        "question with mutually exclusive labels), labels_are_outcomes (true if labels describe "
        "outcomes rather than system components), granular (true if no config is a catch-all "
        "bucket of unrelated failure types), rationale (one sentence)."
    ),
)
# Pass on coverage and granularity; one_dimension_per_config and labels_are_outcomes are
# reported for diagnosis but a reasonable reviewer can disagree on them.
judge_ok = bool(
    verdict
    and not verdict.get("error")
    and ea.as_fraction(verdict.get("coverage", 0)) >= 0.5
    and verdict.get("granular") is True
)

passed = configs_ok and labels_ok and sidecar_ok and judge_ok
metrics_path = ea.step_dir(STEP) / "metrics.json"
metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
ea.write_reward(
    float(passed),
    details={"tool_calls": metrics.get("tool_calls", 0), "label_count": len(labels)},
    configs_ok=configs_ok,
    labels_ok=labels_ok,
    sidecar_ok=sidecar_ok,
    judge_ok=judge_ok,
    config_names=sorted(config_names),
    config_values={c.name: c.values for c in configs},
    configs_linked_to_project=sorted(c.name for c in configs if c.project_linked),
    generic_names=generic_names,
    oversized_configs=oversized,
    label_names=sorted({a.name for a in labels}),
    names_without_config=names_without_config,
    labels_outside_notes=labels_outside_notes,
    planted_unlabelled=planted_unlabelled,
    identifier=identifier,
    sidecar_files=sorted(sidecars),
    sidecar=sidecar_detail,
    judge=verdict,
)
