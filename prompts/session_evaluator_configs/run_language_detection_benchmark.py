#!/usr/bin/env python3
"""Benchmark runner for the out-of-library `language_detection` session-level evaluator.

Loads the template (LANGUAGE_DETECTION_SESSION_EVALUATOR_CONFIG.yaml) and the
labeled dataset (language_detection_benchmark.yaml), renders the prompt with each
session, and calls the *real* structured-output primitive the library uses:
`LLM.generate_object(prompt, schema)`. It then scores predictions against the gold
labels with:

  - languages: micro & macro precision / recall / F1 (set membership per example)
               + exact-set-match rate
  - primary_language: exact-match accuracy (case-insensitive, null-aware)

Usage:
    OPENAI_API_KEY=sk-... python run_language_detection_benchmark.py
    EVAL_MODEL=gpt-4o OPENAI_API_KEY=sk-... python run_language_detection_benchmark.py

Requires the `arize-phoenix-evals` package (this repo's packages/phoenix-evals).
"""

from __future__ import annotations

import asyncio
import os
from collections import Counter
from pathlib import Path
from typing import Any, Optional

import yaml
from phoenix.evals.llm import LLM

HERE = Path(__file__).parent
TEMPLATE_PATH = HERE / "LANGUAGE_DETECTION_SESSION_EVALUATOR_CONFIG.yaml"
DATASET_PATH = HERE / "language_detection_benchmark.yaml"

# Normalize known synonyms so scoring is not tripped up by naming variants.
SYNONYMS = {
    "mandarin": "chinese",
    "mandarin chinese": "chinese",
    "simplified chinese": "chinese",
    "traditional chinese": "chinese",
    "farsi": "persian",
    "castilian": "spanish",
    "brazilian portuguese": "portuguese",
    "modern standard arabic": "arabic",
}


def norm(name: Optional[str]) -> Optional[str]:
    if name is None:
        return None
    key = " ".join(name.strip().lower().split())
    if not key or key in {"null", "none", "n/a"}:
        return None
    return SYNONYMS.get(key, key)


def norm_set(names: list[str]) -> set[str]:
    out = set()
    for n in names or []:
        v = norm(n)
        if v:
            out.add(v)
    return out


def render_prompt(template: dict[str, Any], session: str) -> str:
    # Single user message; substitute the {{session}} variable.
    content = template["messages"][0]["content"]
    return content.replace("{{session}}", session)


async def evaluate_one(llm: LLM, prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
    return await llm.async_generate_object(prompt=prompt, schema=schema)


async def main() -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("Set OPENAI_API_KEY to run the benchmark.")

    template = yaml.safe_load(TEMPLATE_PATH.read_text(encoding="utf-8"))
    dataset = yaml.safe_load(DATASET_PATH.read_text(encoding="utf-8"))
    schema = template["output_schema"]
    examples = dataset["examples"]

    model = os.environ.get("EVAL_MODEL", "gpt-4o-mini")
    llm = LLM(provider="openai", model=model)
    print(f"Running {len(examples)} examples on {model}\n")

    # Aggregates
    tp = fp = fn = 0  # micro (language membership)
    macro_p = macro_r = macro_f1 = 0.0
    exact_set_hits = 0
    primary_hits = 0
    per_case: dict[str, Counter] = {}

    for ex in examples:
        prompt = render_prompt(template, ex["session"])
        try:
            result = await evaluate_one(llm, prompt, schema)
        except Exception as e:  # noqa: BLE001
            print(f"[ERROR] {ex['id']}: {e}")
            continue

        gold_langs = norm_set(ex.get("languages", []))
        pred_langs = norm_set(result.get("languages", []))
        gold_primary = norm(ex.get("primary_language"))
        pred_primary = norm(result.get("primary_language"))

        ex_tp = len(gold_langs & pred_langs)
        ex_fp = len(pred_langs - gold_langs)
        ex_fn = len(gold_langs - pred_langs)
        tp += ex_tp
        fp += ex_fp
        fn += ex_fn

        p = ex_tp / (ex_tp + ex_fp) if (ex_tp + ex_fp) else 1.0
        r = ex_tp / (ex_tp + ex_fn) if (ex_tp + ex_fn) else 1.0
        f1 = 2 * p * r / (p + r) if (p + r) else (1.0 if not gold_langs and not pred_langs else 0.0)
        macro_p += p
        macro_r += r
        macro_f1 += f1

        set_ok = gold_langs == pred_langs
        primary_ok = gold_primary == pred_primary
        exact_set_hits += set_ok
        primary_hits += primary_ok

        case = ex.get("case", "uncategorized")
        c = per_case.setdefault(case, Counter())
        c["n"] += 1
        c["set_ok"] += set_ok
        c["primary_ok"] += primary_ok

        flag = "OK " if set_ok and primary_ok else "MISS"
        print(f"[{flag}] {ex['id']} ({case})")
        if not set_ok:
            print(f"        languages gold={sorted(gold_langs)} pred={sorted(pred_langs)}")
        if not primary_ok:
            print(f"        primary   gold={gold_primary!r} pred={pred_primary!r}")

    n = len(examples)
    micro_p = tp / (tp + fp) if (tp + fp) else 1.0
    micro_r = tp / (tp + fn) if (tp + fn) else 1.0
    micro_f1 = 2 * micro_p * micro_r / (micro_p + micro_r) if (micro_p + micro_r) else 0.0

    print("\n=== languages (set membership) ===")
    print(f"micro  P={micro_p:.3f} R={micro_r:.3f} F1={micro_f1:.3f}")
    print(f"macro  P={macro_p / n:.3f} R={macro_r / n:.3f} F1={macro_f1 / n:.3f}")
    print(f"exact-set-match: {exact_set_hits}/{n} = {exact_set_hits / n:.3f}")
    print("\n=== primary_language ===")
    print(f"accuracy: {primary_hits}/{n} = {primary_hits / n:.3f}")

    print("\n=== per-case (exact set & primary) ===")
    for case in sorted(per_case):
        c = per_case[case]
        print(
            f"  {case:28s} n={c['n']:2d}  "
            f"set={c['set_ok']}/{c['n']}  primary={c['primary_ok']}/{c['n']}"
        )


if __name__ == "__main__":
    asyncio.run(main())
