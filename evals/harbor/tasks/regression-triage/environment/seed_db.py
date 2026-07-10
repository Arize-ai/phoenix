#!/usr/bin/env python3
"""Seed the deterministic Phoenix database used by the Harbor regression task."""

import argparse
import asyncio
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.ext.asyncio import async_sessionmaker

from phoenix.db import models
from phoenix.db.engines import create_engine

BASE_TIME = datetime(2026, 6, 1, tzinfo=timezone.utc)
SPAN_DEFAULTS = dict(
    span_kind="CHAIN",
    attributes={},
    events=[],
    status_code="OK",
    status_message="",
    cumulative_error_count=0,
    cumulative_llm_token_count_prompt=0,
    cumulative_llm_token_count_completion=0,
    llm_token_count_prompt=None,
    llm_token_count_completion=None,
)
SPANISH = {
    5: "¿Cuál es la política de devoluciones?",
    9: "¿Cómo cambio mi contraseña?",
    14: "¿Dónde puedo ver mi factura?",
    21: "¿Cuándo llegará mi pedido?",
    26: "¿Puedo cancelar mi suscripción?",
    30: "¿Cómo contacto con soporte?",
}
HARD = {3, 11, 17}


def _hex(label: str, length: int) -> str:
    return hashlib.sha256(label.encode()).hexdigest()[:length]


async def seed(db_path: Path, ground_truth_out: Path) -> None:
    engine = create_engine(f"sqlite:///{db_path}", migrate=True, log_migrations=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        qa = models.Dataset(
            id=1,
            name="qa-bot-golden",
            description=None,
            metadata_={},
            created_at=BASE_TIME,
            updated_at=BASE_TIME,
        )
        checkout = models.Dataset(
            id=2,
            name="checkout-flows",
            description=None,
            metadata_={},
            created_at=BASE_TIME,
            updated_at=BASE_TIME,
        )
        session.add_all([qa, checkout])
        session.add_all(
            [
                models.DatasetVersion(
                    id=1, dataset_id=1, description=None, metadata_={}, created_at=BASE_TIME
                ),
                models.DatasetVersion(
                    id=2, dataset_id=2, description=None, metadata_={}, created_at=BASE_TIME
                ),
            ]
        )
        experiments = [
            models.Experiment(
                id=1,
                dataset_id=1,
                dataset_version_id=1,
                name="baseline-gpt4o",
                description=None,
                repetitions=1,
                metadata_={},
                project_name="experiment-runs",
                created_at=BASE_TIME,
                updated_at=BASE_TIME,
            ),
            models.Experiment(
                id=2,
                dataset_id=1,
                dataset_version_id=1,
                name="candidate-v2",
                description=None,
                repetitions=1,
                metadata_={},
                project_name="experiment-runs",
                created_at=BASE_TIME,
                updated_at=BASE_TIME,
            ),
            models.Experiment(
                id=3,
                dataset_id=2,
                dataset_version_id=2,
                name="checkout-baseline",
                description=None,
                repetitions=1,
                metadata_={},
                project_name=None,
                created_at=BASE_TIME,
                updated_at=BASE_TIME,
            ),
        ]
        session.add_all(experiments)
        projects = [
            models.Project(
                id=100,
                name="experiment-runs",
                description=None,
                created_at=BASE_TIME,
                updated_at=BASE_TIME,
            ),
            models.Project(
                id=101,
                name="demo-chatbot",
                description=None,
                created_at=BASE_TIME,
                updated_at=BASE_TIME,
            ),
        ]
        session.add_all(projects)
        await session.flush()

        run_id = annotation_id = span_rowid = trace_rowid = 0
        for number in range(1, 41):
            is_qa = number <= 30
            example_id = number
            dataset_id = 1 if is_qa else 2
            version_id = dataset_id
            key = f"ex-{number:03d}" if is_qa else f"checkout-{number - 30:02d}"
            question = (
                SPANISH.get(number, f"How do I resolve support request {number}?")
                if is_qa
                else f"Checkout flow {number - 30}"
            )
            session.add(
                models.DatasetExample(
                    id=example_id,
                    dataset_id=dataset_id,
                    external_id=key,
                    created_at=BASE_TIME + timedelta(seconds=number),
                )
            )
            session.add(
                models.DatasetExampleRevision(
                    id=example_id,
                    dataset_example_id=example_id,
                    dataset_version_id=version_id,
                    input={"question": question},
                    output={"answer": f"Answer {number}"},
                    metadata_={"example_key": key},
                    revision_kind="CREATE",
                    created_at=BASE_TIME + timedelta(seconds=number),
                )
            )
            await session.flush()
            experiment_ids = (1, 2) if is_qa else (3,)
            for experiment_id in experiment_ids:
                session.add(
                    models.ExperimentDatasetExample(
                        experiment_id=experiment_id,
                        dataset_example_id=example_id,
                        dataset_example_revision_id=example_id,
                    )
                )
                await session.flush()
                run_id += 1
                annotation_id += 1
                trace_id = None
                if experiment_id == 2:
                    trace_rowid += 1
                    trace_id = _hex(f"trace-{key}", 32)
                    start = BASE_TIME + timedelta(minutes=number)
                    failed = number in SPANISH
                    session.add(
                        models.Trace(
                            id=trace_rowid,
                            project_rowid=100,
                            trace_id=trace_id,
                            project_session_rowid=None,
                            start_time=start,
                            end_time=start + timedelta(seconds=3),
                        )
                    )
                    await session.flush()
                    parent = None
                    for offset, name in enumerate(("agent_run", "translate_query")):
                        span_rowid += 1
                        span_id = _hex(f"span-{key}-{name}", 16)
                        error = failed and name == "translate_query"
                        events = (
                            [
                                {
                                    "name": "exception",
                                    "timestamp": (
                                        start + timedelta(seconds=offset + 1)
                                    ).isoformat(),
                                    "attributes": {
                                        "exception.message": "UnsupportedLocaleError: locale 'es' is not enabled for translation",
                                        "exception.type": "UnsupportedLocaleError",
                                    },
                                }
                            ]
                            if error
                            else []
                        )
                        session.add(
                            models.Span(
                                id=span_rowid,
                                trace_rowid=trace_rowid,
                                span_id=span_id,
                                parent_id=parent,
                                name=name,
                                start_time=start + timedelta(seconds=offset),
                                end_time=start + timedelta(seconds=offset + 1),
                                **{
                                    **SPAN_DEFAULTS,
                                    "events": events,
                                    "status_code": "ERROR" if error else "OK",
                                    "status_message": events[0]["attributes"]["exception.message"]
                                    if error
                                    else "",
                                },
                            )
                        )
                        parent = span_id
                    if not failed:
                        span_rowid += 1
                        session.add(
                            models.Span(
                                id=span_rowid,
                                trace_rowid=trace_rowid,
                                span_id=_hex(f"span-{key}-llm", 16),
                                parent_id=parent,
                                name="llm_call",
                                start_time=start + timedelta(seconds=2),
                                end_time=start + timedelta(seconds=3),
                                **SPAN_DEFAULTS,
                            )
                        )
                score = 1.0
                if is_qa and (number in HARD or (experiment_id == 2 and number in SPANISH)):
                    score = 0.0
                run_start = BASE_TIME + timedelta(hours=experiment_id, minutes=number)
                session.add(
                    models.ExperimentRun(
                        id=run_id,
                        experiment_id=experiment_id,
                        dataset_example_id=example_id,
                        repetition_number=1,
                        trace_id=trace_id,
                        output={"answer": f"Run {run_id}"},
                        start_time=run_start,
                        end_time=run_start + timedelta(seconds=1),
                        prompt_token_count=10,
                        completion_token_count=5,
                        error=None,
                    )
                )
                await session.flush()
                session.add(
                    models.ExperimentRunAnnotation(
                        id=annotation_id,
                        experiment_run_id=run_id,
                        name="correctness",
                        annotator_kind="CODE",
                        label="pass" if score else "fail",
                        score=score,
                        explanation=None,
                        trace_id=None,
                        error=None,
                        metadata_={},
                        start_time=run_start,
                        end_time=run_start + timedelta(milliseconds=10),
                    )
                )

        for number in range(1, 6):
            trace_rowid += 1
            span_rowid += 1
            start = BASE_TIME + timedelta(days=1, minutes=number)
            trace_id = _hex(f"demo-trace-{number}", 32)
            session.add(
                models.Trace(
                    id=trace_rowid,
                    project_rowid=101,
                    trace_id=trace_id,
                    project_session_rowid=None,
                    start_time=start,
                    end_time=start + timedelta(seconds=1),
                )
            )
            await session.flush()
            session.add(
                models.Span(
                    id=span_rowid,
                    trace_rowid=trace_rowid,
                    span_id=_hex(f"demo-span-{number}", 16),
                    parent_id=None,
                    name="chat",
                    start_time=start,
                    end_time=start + timedelta(seconds=1),
                    **SPAN_DEFAULTS,
                )
            )
        await session.commit()
    await engine.dispose()
    ground_truth = {
        "step1": {
            "lower_experiment": "candidate-v2",
            "means": {"baseline-gpt4o": 0.9, "candidate-v2": 0.7},
        },
        "step2": {
            "regressed_example_keys": [f"ex-{n:03d}" for n in sorted(SPANISH)],
            "pattern_keywords": ["spanish", "español", "espanol"],
        },
        "step3": {
            "target_example_key": "ex-014",
            "span_name": "translate_query",
            "exception_substring": "UnsupportedLocaleError",
        },
        "step4": {
            "split_name": "regressions",
            "expected_example_keys": [f"ex-{n:03d}" for n in sorted(SPANISH)],
        },
    }
    ground_truth_out.parent.mkdir(parents=True, exist_ok=True)
    ground_truth_out.write_text(json.dumps(ground_truth, indent=2, sort_keys=True) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", type=Path, required=True)
    parser.add_argument("--ground-truth-out", type=Path, required=True)
    args = parser.parse_args()
    asyncio.run(seed(args.db_path, args.ground_truth_out))


if __name__ == "__main__":
    main()
