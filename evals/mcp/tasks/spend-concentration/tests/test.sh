#!/bin/sh
set -eu
python -m evals.mcp.scoring.verify --task spend-concentration --interface "$BENCHMARK_INTERFACE"
