#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task most-failing-tool --interface "$BENCHMARK_INTERFACE"
