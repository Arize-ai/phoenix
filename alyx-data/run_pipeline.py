"""Single-path pipeline entry point for alyx-data (Stage 1).

Runs: export -> extract -> flag -> trajectories.

Each step is idempotent: if its output parquet already exists, it is skipped
unless ``--force`` is passed (forces all steps) or ``--from-step <name>`` is
passed (forces from that step onward).

Usage::

    uv run python run_pipeline.py
    uv run python run_pipeline.py --from-step trajectories
    uv run python run_pipeline.py --force
    uv run python run_pipeline.py --probe          # 2-day quick run
    uv run python run_pipeline.py --window-days 30
"""

from __future__ import annotations

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

# Ensure ``src/`` is importable whether run from any CWD.
_SRC = Path(__file__).resolve().parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import pipeline.export as export_step  # noqa: E402
import pipeline.extract as extract_step  # noqa: E402
import pipeline.flag as flag_step  # noqa: E402
import pipeline.trajectories as trajectories_step  # noqa: E402
from pipeline.config import PipelineConfig, setup_logging  # noqa: E402

STEPS: tuple[str, ...] = ("export", "extract", "flag", "trajectories")
PROBE_DAYS = 2


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--from-step",
        choices=STEPS,
        default=None,
        help="Force rerun from this step (all downstream artifacts regenerate).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force rerun of all steps.",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=90,
        help="Export window in days ending at now (default: 90).",
    )
    parser.add_argument(
        "--probe",
        action="store_true",
        help=f"Quick {PROBE_DAYS}-day sanity run (overrides --window-days).",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging.")
    return parser.parse_args(argv)


def _should_force(step: str, args: argparse.Namespace) -> bool:
    """True iff this step (or an earlier one) was requested."""
    if args.force:
        return True
    if args.from_step is None:
        return False
    return STEPS.index(step) >= STEPS.index(args.from_step)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    log = setup_logging(logging.DEBUG if args.verbose else logging.INFO)

    window_days = PROBE_DAYS if args.probe else args.window_days
    cfg = PipelineConfig.load(window_days=window_days)
    log.info(
        "Pipeline start: window=%s to %s (model=%s, space=%s, days=%d)",
        cfg.start_time.isoformat(),
        cfg.end_time.isoformat(),
        cfg.model_id,
        cfg.space_id,
        window_days,
    )

    # Layer 0 -- raw export
    raw_path: Path = export_step.run(cfg, force=_should_force("export", args))

    # Layer 1a -- extract user queries
    extracted_path: Path = extract_step.run(cfg, raw_path, force=_should_force("extract", args))

    # Layer 1b -- annotate with flags (only is_empty hard-dropped)
    flagged_path: Path = flag_step.run(cfg, extracted_path, force=_should_force("flag", args))

    # Layer 2 -- trajectories
    spans_path, sessions_path = trajectories_step.run(
        cfg, raw_path, force=_should_force("trajectories", args)
    )

    log.info("Pipeline complete.")
    log.info("  raw       : %s", raw_path)
    log.info("  extracted : %s", extracted_path)
    log.info("  flagged   : %s", flagged_path)
    log.info("  spans     : %s", spans_path)
    log.info("  sessions  : %s", sessions_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
