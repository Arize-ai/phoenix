#!/bin/sh
# Install the improved judge at the nightly path and rescore every trace in the project.
set -eu
cp /solution/policy_judge.py /app/evals/policy_judge.py
cd /app && python evals/policy_judge.py --rescore
