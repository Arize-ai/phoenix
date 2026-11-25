#!/bin/sh
set -eu
cp /solution/nightly_grounding.py /app/evals/nightly_grounding.py
# Write the reply even if some replies couldn't be scored, and keep the script's status.
status=0
cd /app && python evals/nightly_grounding.py || status=$?
python /solution/report.py
exit "$status"
