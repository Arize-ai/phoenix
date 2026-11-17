#!/bin/sh
# Install the corrected nightly script over the original, rescore every trace, and
# write the reply from the new annotations.
set -eu
cp /solution/nightly_grounding.py /app/evals/nightly_grounding.py
status=0
cd /app && python evals/nightly_grounding.py || status=$?
python /solution/report.py
exit "$status"
