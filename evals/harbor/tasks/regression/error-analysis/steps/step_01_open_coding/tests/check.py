import error_analysis_checks as ea

# The second quarterly-report turn compounds the first, so a reviewer may fold both into
# one note. The judge separately checks that the reply describes every defect.
MIN_PLANTED_RECALL = 0.8
# Clean traces the ground truth marks borderline are never counted; among the rest, one or
# two flags are reviewer judgment, three or more is noting indiscriminately.
MAX_FALSE_POSITIVES = 2

truth = ea.load_truth()
trajectory = ea.load_trajectory()
planted = {t["trace_id"]: t for t in truth["planted_traces"]}
unambiguously_clean = {t["trace_id"] for t in truth["clean_traces"] if "note" not in t}

with ea.connect() as connection:
    annotations = ea.fetch_annotations(connection)
    configs = ea.fetch_annotation_configs(connection, truth["project_name"])
    sidecars = ea.load_sidecars(connection, ea.agent_session_rowid(trajectory))

notes = ea.notes(annotations)
identifier = ea.shared_identifier(notes)
notes_ok = bool(notes) and identifier is not None

sidecar_ok, sidecar_detail = ea.entities_mirrored(
    notes, ea.sidecar_rows(sidecars, axial_file=False)
)

covered = ea.covered_trace_ids(notes)
planted_found = sorted(tid for tid in planted if tid in covered)
planted_recall = len(planted_found) / len(planted)
false_positives = ea.false_positives(notes, set(planted), unambiguously_clean)
coverage_ok = planted_recall >= MIN_PLANTED_RECALL and len(false_positives) <= MAX_FALSE_POSITIVES

stopped_at_offer = not ea.axial(annotations) and not configs

answer = ea.final_reply(trajectory)
defects = "\n".join(
    f"{i + 1}. [{t['session_id']} turn {t['turn']}] {t['defect']}"
    for i, t in enumerate(truth["planted_traces"])
)
verdict = ea.judge(
    system=(
        "You grade the final chat reply of an AI assistant that was asked to find issues in an "
        "LLM application's traces. You are given the planted defects the traces contain. Judge "
        "only what the reply says."
    ),
    user=(
        f"PLANTED DEFECTS:\n{defects}\n\nASSISTANT REPLY:\n<<<\n{answer}\n>>>\n\n"
        "Return JSON with keys: defects_identified (list of the defect numbers above that the "
        "reply clearly describes, matching on substance not wording), coverage (fraction of the "
        "defects identified, 0-1), offers_axial_coding (true if the reply offers, as a question "
        "the user must answer, to continue into axial coding / grouping the notes into "
        "categories / creating annotation configs), performed_axial_coding (true if the reply "
        "reports that it already created annotation configs or categorical annotations), "
        "final_question_is_the_offer (true if the reply's closing question to the user is that "
        "offer), rationale (one sentence)."
    ),
)
judge_ok = bool(
    verdict
    and not verdict.get("error")
    and ea.as_fraction(verdict.get("coverage", 0)) >= 0.6
    and verdict.get("offers_axial_coding") is True
    and verdict.get("performed_axial_coding") is not True
)

passed = notes_ok and sidecar_ok and coverage_ok and stopped_at_offer and judge_ok
ea.write_reward(
    float(passed),
    details={"tool_calls": ea.tool_call_count(trajectory), "note_count": len(notes)},
    notes_ok=notes_ok,
    sidecar_ok=sidecar_ok,
    coverage_ok=coverage_ok,
    stopped_at_offer=stopped_at_offer,
    judge_ok=judge_ok,
    planted_recall=planted_recall,
    note_unit=sorted({a.kind for a in notes}),
    identifier=identifier,
    false_positive_traces=false_positives,
    sidecar_files=sorted(sidecars),
    sidecar=sidecar_detail,
    judge=verdict,
)
