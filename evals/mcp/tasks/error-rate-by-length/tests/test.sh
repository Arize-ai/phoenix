#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task error-rate-by-length --interface "$BENCHMARK_INTERFACE"
