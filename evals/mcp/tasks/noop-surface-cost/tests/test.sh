#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task noop-surface-cost --interface "$BENCHMARK_INTERFACE"
