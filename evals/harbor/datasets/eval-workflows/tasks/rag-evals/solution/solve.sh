#!/bin/sh
set -eu
mkdir -p /app/evals
cp /solution/rag_evals.py /app/evals/rag_evals.py
cd /app && python evals/rag_evals.py | python /solution/rag_reply.py
