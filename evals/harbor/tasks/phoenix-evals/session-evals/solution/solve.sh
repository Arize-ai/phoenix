#!/bin/sh
# Install the reference session evals as the nightly entry point and score the existing sessions.
set -eu
mkdir -p /app/evals
cp /solution/session_evals.py /app/evals/session_evals.py
cd /app && python evals/session_evals.py
