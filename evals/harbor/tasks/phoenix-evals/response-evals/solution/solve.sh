#!/bin/sh
# Install the reference evals as the nightly entry point and score the existing traces.
set -eu
mkdir -p /app/evals
cp /solution/refund_evals.py /app/evals/refund_evals.py
cd /app && python evals/refund_evals.py
