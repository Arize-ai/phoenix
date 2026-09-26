# /// script
# requires-python = ">=3.10"
# dependencies = ["daytona>=0.100"]
# ///
"""Delete the Daytona sandboxes a Harbor run left behind.

Harbor deletes a trial's sandbox when the trial ends, but a cancelled ``harbor run``
process never reaches that step, and the sandboxes keep running until Daytona's
auto-stop interval passes. CI runs this after ``harbor run`` to remove the sandboxes
that carry the run's label::

    uv run --script evals/harbor/scripts/delete_daytona_sandboxes.py --label ci_run=12345

Pass the same label through ``harbor run --ek labels='{"ci_run": "12345"}'``. Only
sandboxes that Harbor created (``harbor.managed=true``) and that carry every requested
label are deleted. ``--dry-run`` lists them instead. Reads ``DAYTONA_API_KEY``.
"""

from __future__ import annotations

import argparse
import sys
from typing import Any


def parse_label(value: str) -> tuple[str, str]:
    key, separator, label_value = value.partition("=")
    if not separator or not key or not label_value:
        raise argparse.ArgumentTypeError(f"expected key=value, got {value!r}")
    return key, label_value


def matching_sandboxes(sandboxes: Any, labels: dict[str, str]) -> list[Any]:
    wanted = {"harbor.managed": "true", **labels}
    return [
        sandbox
        for sandbox in sandboxes
        if all((sandbox.labels or {}).get(key) == value for key, value in wanted.items())
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--label",
        action="append",
        type=parse_label,
        required=True,
        help="key=value a sandbox must carry; repeatable, every label must match",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    labels = dict(args.label)

    from daytona import Daytona

    client = Daytona()
    sandboxes = matching_sandboxes(client.list(), labels)
    if not sandboxes:
        print(f"No Harbor sandboxes carry {labels}")
        return 0
    for sandbox in sandboxes:
        session = (sandbox.labels or {}).get("harbor.session_id", "")
        if args.dry_run:
            print(f"would delete {sandbox.id} ({sandbox.state}) {session}")
            continue
        try:
            client.delete(sandbox, wait=True)
            print(f"deleted {sandbox.id} ({sandbox.state}) {session}")
        except Exception as exc:  # noqa: BLE001
            print(f"failed to delete {sandbox.id}: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
