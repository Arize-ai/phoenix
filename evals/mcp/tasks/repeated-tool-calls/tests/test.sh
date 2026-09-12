#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task repeated-tool-calls --interface "$BENCHMARK_INTERFACE"
