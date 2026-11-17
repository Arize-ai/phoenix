#!/bin/sh
set -eu
mkdir -p /app/evals
cp /solution/session_evals.py /app/evals/session_evals.py
cd /app && python evals/session_evals.py
