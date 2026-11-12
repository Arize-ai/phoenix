#!/bin/sh
# Install the corrected nightly script over the original and rescore every trace.
set -eu
cp /solution/nightly_grounding.py /app/evals/nightly_grounding.py
cd /app && python evals/nightly_grounding.py
