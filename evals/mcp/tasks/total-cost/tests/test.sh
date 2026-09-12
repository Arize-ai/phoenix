#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task total-cost --interface "$BENCHMARK_INTERFACE"
