#!/usr/bin/env python3
"""Merge per-shard integration documentation reports for CI."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reports", type=Path, required=True, help="Directory containing shard artifacts")
    parser.add_argument("--output-dir", type=Path, default=Path("ci-results/integration-docs"))
    parser.add_argument("--run-mode", choices=("all", "changed", "none"), required=True)
    parser.add_argument("--reason", required=True)
    parser.add_argument("--shard-result", required=True)
    args = parser.parse_args()

    integrations = []
    if args.reports.exists():
        for report_path in sorted(args.reports.rglob("integration-docs.json")):
            try:
                report = json.loads(report_path.read_text())
                integrations.extend(report.get("integrations", []))
            except (OSError, json.JSONDecodeError) as exc:
                print(f"Ignoring unreadable shard report {report_path}: {exc}")

    statuses = {item.get("status") for item in integrations}
    status = "fail" if "fail" in statuses or args.shard_result == "failure" else "skipped" if statuses == {"skipped"} else "pass"
    if args.run_mode == "none":
        status = "no-op"
    summary = {
        "schema_version": 1,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "reason": args.reason,
        "run_mode": args.run_mode,
        "counts": {name: sum(item.get("status") == name for item in integrations) for name in ("pass", "fail", "skipped")},
        "integrations": integrations,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "integration-docs.json").write_text(json.dumps(summary, indent=2) + "\n")
    lines = [
        "# Integration documentation checks",
        "",
        f"Overall status: **{status}**",
        f"Classification: {args.reason}",
        "",
        "| Integration | Document | Language | Status | Result |",
        "|---|---|---|---|---|",
    ]
    for record in integrations:
        span = record.get("span", {})
        result = record.get("reason") or record.get("error") or "—"
        if span:
            result = f"{span.get('span_kind')} span `{span.get('name')}`"
            model = span.get("attributes", {}).get("llm.model_name")
            if model:
                result += f"; model `{model}`"
        result = str(result).replace("|", "\\|").replace("\n", " ")
        lines.append(f"| `{record.get('id', '?')}` | `{record.get('document', '?')}` | {record.get('language', '?')} | **{record.get('status', '?')}** | {result} |")
    (args.output_dir / "integration-docs.md").write_text("\n".join(lines) + "\n")
    print((args.output_dir / "integration-docs.md").read_text())
    # The shard job already determines the workflow result. Return success here
    # so summary, comment, and artifact steps still run to completion.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
