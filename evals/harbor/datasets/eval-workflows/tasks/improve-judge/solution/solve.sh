#!/bin/sh
set -eu
cp /solution/policy_judge.py /app/evals/policy_judge.py
cd /app && python evals/policy_judge.py --rescore
