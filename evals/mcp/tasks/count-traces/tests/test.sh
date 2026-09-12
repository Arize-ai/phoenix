#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task count-traces --interface "$BENCHMARK_INTERFACE"
