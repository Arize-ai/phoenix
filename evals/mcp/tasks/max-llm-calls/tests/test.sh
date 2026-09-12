#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task max-llm-calls --interface "$BENCHMARK_INTERFACE"
