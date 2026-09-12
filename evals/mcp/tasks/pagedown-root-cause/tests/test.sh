#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task pagedown-root-cause --interface "$BENCHMARK_INTERFACE"
