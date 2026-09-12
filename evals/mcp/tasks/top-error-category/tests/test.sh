#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task top-error-category --interface "$BENCHMARK_INTERFACE"
